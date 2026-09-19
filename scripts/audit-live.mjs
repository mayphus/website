#!/usr/bin/env node

const DEFAULT_BASE_URL = "https://mayphus.org/";
const REQUEST_TIMEOUT_MS = 15_000;
const CONCURRENCY = 12;

function baseUrlFrom(argv) {
  const value = argv[2] || DEFAULT_BASE_URL;
  const url = new URL(value);
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url;
}

async function fetchTimed(url, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const started = performance.now();
  try {
    const response = await fetch(url, {
      ...init,
      redirect: "follow",
      signal: controller.signal
    });
    return { response, elapsedMs: performance.now() - started };
  } finally {
    clearTimeout(timeout);
  }
}

async function mapLimit(items, limit, operation) {
  const results = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await operation(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function sameOriginReferences(html, baseUrl) {
  const references = new Set();
  const attributePattern = /(?:href|src|poster)\s*=\s*["']([^"']+)["']/gi;

  for (const match of html.matchAll(attributePattern)) {
    try {
      const url = new URL(match[1], baseUrl);
      if (url.origin !== baseUrl.origin || !["http:", "https:"].includes(url.protocol)) {
        continue;
      }
      url.hash = "";
      references.add(url.href);
    } catch {
      // Invalid visitor-facing URLs are reported by route rendering checks.
    }
  }

  return references;
}

async function checkRoute(siteBase, route) {
  const url = new URL(route, siteBase);
  try {
    const { response, elapsedMs } = await fetchTimed(url);
    const contentType = response.headers.get("content-type") || "";
    const html = contentType.includes("text/html") ? await response.text() : "";
    return {
      elapsedMs,
      html,
      ok: response.ok,
      route,
      status: response.status,
      url
    };
  } catch (error) {
    return { error, ok: false, route, url };
  }
}

async function checkReference(url) {
  let head;
  try {
    head = await fetchTimed(url, { method: "HEAD" });
    if (head.response.ok) {
      await head.response.body?.cancel();
      return { elapsedMs: head.elapsedMs, method: "HEAD", ok: true, status: head.response.status, url };
    }
    await head.response.body?.cancel();
  } catch {
    // Retry with the visitor-equivalent method below.
  }

  try {
    const get = await fetchTimed(url);
    await get.response.body?.cancel();
    return {
      elapsedMs: get.elapsedMs,
      headStatus: head?.response.status,
      method: "GET",
      ok: get.response.ok,
      status: get.response.status,
      url
    };
  } catch (error) {
    return { error, headStatus: head?.response.status, method: "GET", ok: false, url };
  }
}

function failureText(item) {
  const status = item.status ? `HTTP ${item.status}` : item.error?.message || "request failed";
  return `${item.url} (${status})`;
}

async function main() {
  const siteBase = baseUrlFrom(process.argv);
  const healthUrl = new URL("/healthz", siteBase);
  const pagesUrl = new URL("/api/pages", siteBase);

  const health = await fetchTimed(healthUrl);
  const healthBody = await health.response.text();
  if (!health.response.ok || healthBody.trim() !== "ok") {
    throw new Error(`health check failed: HTTP ${health.response.status} ${healthBody.trim()}`);
  }

  const pagesResponse = await fetchTimed(pagesUrl);
  if (!pagesResponse.response.ok) {
    throw new Error(`page manifest failed: HTTP ${pagesResponse.response.status}`);
  }
  const manifest = await pagesResponse.response.json();
  const routes = manifest.pages
    .filter((page) => page.access === "public")
    .map((page) => page.route);

  const routeResults = await mapLimit(routes, CONCURRENCY, (route) => checkRoute(siteBase, route));
  const routeFailures = routeResults.filter((result) => !result.ok);
  const references = new Set();
  for (const result of routeResults) {
    if (!result.ok || !result.html) continue;
    for (const reference of sameOriginReferences(result.html, result.url)) {
      references.add(reference);
    }
  }

  const referenceResults = await mapLimit([...references].sort(), CONCURRENCY, checkReference);
  const referenceFailures = referenceResults.filter((result) => !result.ok);
  const getFallbacks = referenceResults.filter((result) => result.ok && result.method === "GET");
  const slowestRoute = routeResults
    .filter((result) => result.ok)
    .sort((a, b) => b.elapsedMs - a.elapsedMs)[0];

  console.log(`Live audit: ${siteBase.origin}`);
  console.log(`Health: HTTP ${health.response.status} ok (${Math.round(health.elapsedMs)} ms)`);
  console.log(`Routes: ${routes.length - routeFailures.length}/${routes.length} passed`);
  console.log(`Same-origin references: ${references.size - referenceFailures.length}/${references.size} passed`);
  console.log(`HEAD-to-GET fallbacks: ${getFallbacks.length}`);
  if (slowestRoute) {
    console.log(`Slowest route: ${slowestRoute.route} (${Math.round(slowestRoute.elapsedMs)} ms)`);
  }

  for (const item of [...routeFailures, ...referenceFailures]) {
    console.error(`FAIL ${failureText(item)}`);
  }
  if (routeFailures.length || referenceFailures.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`Live audit failed: ${error.message}`);
  process.exitCode = 1;
});

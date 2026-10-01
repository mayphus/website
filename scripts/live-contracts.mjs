import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';

export function typingOwner(base) {
  const origin = new URL(base).origin;
  if (origin === 'https://mayphus.org') return 'input-foundry';
  assert.match(origin, /^https:\/\/[a-f0-9]+-mayphus\.mayphus\.workers\.dev$/);
  return 'website';
}

// Edges can lag promotion. Retry the same assertions, never accept stale bytes.
export async function verifyTextPage(get, route, expected, {attempts=12, pause=()=>delay(5000)}={}) {
  for (let attempt=0; ; attempt++) {
    try {
      for (const path of [route, `${route}index.html`]) {
        const response = await get(path);
        assert.match(response.headers.get('content-type') || '', /^text\/plain/, `${path}: expected plain text`);
        assert.equal(await response.text(), expected, `${path}: content differs from the reviewed build`);
      }
      return;
    } catch (error) {
      if (attempt + 1 >= attempts) throw error;
      console.log(`Waiting for reviewed text and alias at ${route}...`);
      await pause();
    }
  }
}

export async function verifyFoundryZip(bytes, config) {
  assert.match(config, /^[a-z0-9_-]+$/);
  const folder = await mkdtemp(join(tmpdir(), 'mayphus-foundry-live-'));
  try {
    const path = join(folder, 'package.zip');
    await writeFile(path, bytes);
    execFileSync('unzip', ['-t', path], {stdio:'pipe'}); // Includes archive CRC checks.
    const defaults = execFileSync('unzip', ['-p', path, 'input-foundry/default.custom.yaml'], {encoding:'utf8'});
    assert.match(defaults, new RegExp(`^\\s*- schema: ${config}\\s*$`, 'm'));
    const schema = execFileSync('unzip', ['-p', path, `input-foundry/${config}.schema.yaml`], {encoding:'utf8'});
    assert.ok(schema.trim(), 'Downloaded schema is empty');
  } finally {
    await rm(folder, {recursive:true, force:true});
  }
}

// Input Foundry independently owns mayphus.org/typing*. Validate its public
// service contract, not bytes from the website's older pinned publication.
export async function verifyInputFoundry(get, verifyZip=verifyFoundryZip) {
  const health = await (await get('/typing/healthz')).json();
  assert.equal(health.ok, true);
  assert.equal(health.service, 'input-foundry');
  const page = await get('/typing/');
  assert.match(page.headers.get('content-type') || '', /^text\/html/);
  const html = await page.text();
  assert.match(html, /data-schema=/);
  assert.match(html, /href="\/typing\/customize"/);
  assert.match(html, /Customize with AI/);
  const catalog = await (await get('/typing/api/schemas')).json();
  const selected = catalog.schemas.find(schema=>schema.id === 'double-pinyin-flypy');
  assert.ok(selected?.artifacts.includes('rime'), 'Flypy Rime must be supported');
  assert.match(selected.config, /^[a-z0-9_-]+$/);
  const engine = await (await get('/typing/engine-package.json?schema=double-pinyin-flypy')).json();
  assert.equal(engine.schema, selected.config);
  assert.ok(engine.files[`${selected.config}.schema.yaml`]);
  const wasm = new Uint8Array(await (await get('/typing/runtime/rime.wasm')).arrayBuffer());
  assert.deepEqual([...wasm.slice(0,4)], [0,97,115,109]);
  const response = await get('/typing/build', {method:'POST', body:new URLSearchParams({schemas:selected.id, artifact:'rime'})});
  assert.match(response.headers.get('content-type') || '', /^application\/zip/);
  await verifyZip(Buffer.from(await response.arrayBuffer()), selected.config);
  console.log('Verified independent Input Foundry: identity, workbench, catalog, engine, WASM and valid Rime ZIP.');
}

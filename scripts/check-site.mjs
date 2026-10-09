import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {buildSite} from './build-site.mjs';
import {render} from './render.mjs';
execFileSync(process.execPath,['--test','scripts/check-pipeline.mjs','scripts/check-live-contracts.mjs','scripts/check-editorial.mjs'],{stdio:'inherit'});
await mkdir('dist/unpublished',{recursive:true});
await writeFile('dist/unpublished/fixture.json','{}');
const {source} = await buildSite({checkContent:true});

execFileSync(process.execPath,['scripts/check-release.mjs'],{stdio:'inherit'});
const html = await readFile('dist/index.html','utf8');
assert.ok(!html.includes('{{'));
assert.equal(render('{{title}}',{title:'<script>"&'}),'&lt;script&gt;&quot;&amp;');
assert.throws(()=>render('{{title}}',{}),/Missing homepage field/);
assert.throws(()=>render('{{github}}',{github:'javascript:alert(1)'}),/Invalid GitHub/);
console.log('Website checks passed: composed routes, homepage rendering, escaping and release guards.');

// Exercise the exact bundle configured for deployment, with the composed assets.
const {default: worker} = await import('../.cache/worker.mjs');
const env = {ASSETS:{async fetch(request) {
 const path = new URL(typeof request === 'string' ? request : request.url).pathname;
 const asset = path === '/' ? '/index.html' : path;
 try {
  const body = await readFile(resolve('dist','.'+asset));
  const type = asset.endsWith('.html') ? 'text/html' : asset.endsWith('.json') ? 'application/json' : 'text/plain';
  return new Response(body,{headers:{'Content-Type':type}});
 } catch { return new Response('missing',{status:404}); }
}}};
const get = path => worker.fetch(new Request('https://mayphus.org'+path),env);
assert.equal(await (await get('/healthz')).text(),'ok\n');
assert.equal(await (await get('/')).text(),html);
assert.equal((await get('/api/search?q=Mayphus')).status,200);
assert.equal((await (await get('/mcp')).json()).endpoint,'/mcp');
assert.equal((await get('/api/private')).status,404);
console.log('Deployment bundle passed: homepage, health, search, MCP and privacy.');

const routes=JSON.parse(await readFile('.cache/human-routes.json','utf8'));
const docs=JSON.parse(await readFile('dist/documents.json','utf8')).documents;
for(const route of ['/profile/','/four-province-expressway-atlas/','/about-this-content/','/work/','/journal/','/archive/','/sitemap/']) {
 const expected=await readFile('dist'+routes[route],'utf8');
 for(const path of [route,route+'index.html']) {
  const response=await worker.fetch(new Request('https://mayphus.org'+path,{headers:{Accept:'text/html'}}),env);
  assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/text\/html/);assert.equal(response.headers.get('vary'),'Accept, User-Agent');assert.equal(await response.text(),expected);
 }
 const head=await worker.fetch(new Request('https://mayphus.org'+route,{method:'HEAD',headers:{Accept:'text/html'}}),env);
 assert.equal(head.status,200);assert.equal(await head.text(),'');
}
for(const route of ['/profile/','/four-province-expressway-atlas/','/about-this-content/','/journal/','/work/','/archive/','/sitemap/']) {
 const text=await readFile('dist'+route+'index.txt','utf8');
 for(const accept of ['', '*/*','text/plain','text/html;q=0','text/plain;q=1,text/html;q=.5']) {
  const response=await worker.fetch(new Request('https://mayphus.org'+route,{headers:{Accept:accept}}),env);
  assert.equal(await response.text(),text);assert.equal(response.headers.get('vary'),'Accept, User-Agent');
 }
}
assert.equal((await get(Object.values(routes)[0])).status,404);
const home=JSON.parse(await readFile('dist/homepage.json','utf8'));
assert.ok(html.includes('mailto:'+home.email));
const ai=JSON.parse(await readFile('dist/ai.json','utf8'));
if(home.contact_invitation) assert.deepEqual(ai.contact,{email:home.email,invitation:home.contact_invitation});
assert.ok(html.includes('/four-province-expressway-atlas/'));
console.log('Human channels passed: HTML negotiation, aliases, HEAD, original text, contact parity and hidden build assets.');

const preview=await worker.fetch(new Request('https://review-mayphus.example.workers.dev/profile/',{headers:{Accept:'text/html'}}),env);
assert.equal(preview.status,200);
assert.equal(preview.headers.get('x-mayphus-environment'),'review');
assert.equal(preview.headers.get('x-robots-tag'),'noindex, nofollow, noarchive');
assert.equal(preview.headers.get('cache-control'),'no-store');
const production=await worker.fetch(new Request('https://mayphus.org/profile/',{headers:{Accept:'text/html'}}),env);
assert.equal(production.headers.get('x-robots-tag'),null);
console.log('HTML preview retains noindex and no-store; production remains indexable.');

const disclosureLabel='Human work. AI-assisted words.';
for(const document of docs) {
 if(new URL(document.url).pathname!=='/about-this-content/') {
  assert.ok(!document.text.includes(disclosureLabel),'No disclosure footers in machine records');
 }
}
for(const route of Object.keys(routes)) {
 const human=await readFile('dist'+routes[route],'utf8');
 assert.equal((human.match(/href="\/about-this-content\/"/g)||[]).length,1,route);
}
const explanation=docs.find(document=>new URL(document.url).pathname==='/about-this-content/');
assert.ok(explanation.text.includes('Based on my real work, experiments and observations. AI helps turn them into published content. Claims should be judged by their evidence; corrections are welcome.'));
const explanationHtml=await readFile('dist'+routes['/about-this-content/'],'utf8');
assert.ok(!explanationHtml.includes('mailto:'));
assert.ok(!explanationHtml.includes(home.email));
console.log('Disclosure passed: canonical provenance, one HTML link per page, no per-record machine footers or new contact details.');

const sitemapHtml=await readFile('dist'+routes['/sitemap/'],'utf8');
assert.match(sitemapHtml,/<details class="sitemap-group" id="sitemap-books"><summary>Books/);
assert.ok(!sitemapHtml.includes('<details class="sitemap-group" open'));
const appPages=new Set(['/typing/methods','/typing/guide','/typing/customize']);
for(const match of sitemapHtml.match(/<main[\s\S]*?<\/main>/)[0].matchAll(/href="(\/[^"#]*)"/g)){
 const path=match[1];assert.ok(path==='/'||path==='/rss.xml'||routes[path]||appPages.has(path),'Unknown sitemap link '+path);
}
assert.ok(!sitemapHtml.includes('href="/todo/"'));
assert.ok(!sitemapHtml.includes('?book='));
console.log('Human sitemap passed: known routes, collapsed Books, public-only links and text representation.');
assert.match(sitemapHtml,/<details class="sitemap-group" id="sitemap-legacy"><summary>Legacy links<\/summary>/);
assert.ok(!/<details[^>]*\bopen(?:\s|>|=)/.test(sitemapHtml));
const legacySection=sitemapHtml.match(/<details class="sitemap-group" id="sitemap-legacy">[\s\S]*?<\/details>/)[0];
assert.match(legacySection,/href="\/work\/"/);assert.match(legacySection,/href="\/writing\/"/);
assert.ok(!legacySection.includes('href="/journal/"'));
console.log('Legacy sitemap links passed: two evidenced compatibility views, collapsed without canonical duplicates.');

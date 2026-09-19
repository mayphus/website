import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {buildSite} from './build-site.mjs';
import {render} from './render.mjs';
await mkdir('dist/unpublished',{recursive:true});
await writeFile('dist/unpublished/fixture.json','{}');
const {source} = await buildSite({checkContent:true});
execFileSync(process.execPath,['scripts/check-agent-site.mjs'],{cwd:source,stdio:'inherit',env:{...process.env,MAYPHUS_SITE_DIST:resolve('dist')}});
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

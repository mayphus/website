import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {randomUUID} from 'node:crypto';
import {typingOwner, verifyTextPage, verifyInputFoundry} from './live-contracts.mjs';
const base = process.argv[2];
assert.match(base, /^https:\/\//);
async function get(path, options) {
 const url = new URL(path, base);
 // Service APIs validate their query parameters strictly; only bust the homepage cache.
 if (url.pathname === '/') url.searchParams.set('__asset_version', randomUUID());
 const response = await fetch(url, {...options, cache:'no-store', signal:AbortSignal.timeout(60000)});
 assert.ok(response.ok, `${path}: HTTP ${response.status}`);
 return response;
}
assert.equal((await (await get('/healthz')).text()).trim(),'ok');
const expectedHome = await readFile('dist/index.html','utf8');
// A successful promotion can briefly return the previous version at some edges.
// Retry within a bound, but always require an exact match before checking APIs.
for (let attempt = 0; ; attempt++) {
 try {
  const home = await get('/');
  assert.match(home.headers.get('content-type'),/text\/html/);
  assert.equal(await home.text(),expectedHome);
  break;
 } catch (error) {
  if (attempt === 11) throw error;
  console.log('Waiting for the published homepage to reach this edge...');
  await delay(5000);
 }
}
const humanRoutes=JSON.parse(await readFile('.cache/human-routes.json','utf8'));
for(const route of ['/profile/','/four-province-expressway-atlas/','/work/','/journal/']) {
 const response=await get(route,{headers:{Accept:'text/html'}});
 assert.match(response.headers.get('content-type'),/text\/html/);
 assert.equal(response.headers.get('vary'),'Accept');
 assert.equal(await response.text(),await readFile('dist'+humanRoutes[route],'utf8'));
 const head=await get(route,{method:'HEAD',headers:{Accept:'text/html'}});
 assert.equal(await head.text(),'');
}
const mcp = await (await get('/mcp')).json();
assert.equal(mcp.endpoint,'/mcp');
const index = await (await get('/agent-index.json')).json();
assert.deepEqual(index,JSON.parse(await readFile('dist/agent-index.json','utf8')));
assert.deepEqual(await (await get('/documents.json')).json(),JSON.parse(await readFile('dist/documents.json','utf8')));
const owner = typingOwner(base);
const textRoutes = ['/profile/','/agents/','/infrastructure/'];
if (owner === 'website') textRoutes.push('/typing/');
for (const route of textRoutes) {
 await verifyTextPage(get, route, await readFile(`dist${route}index.txt`,'utf8'));
}
const document = index.documents.find(record => record.metadata?.route === '/profile/');
assert.ok(document);
const record = await (await get(`/api/document?id=${encodeURIComponent(document.id)}`)).json();
assert.ok(JSON.stringify(record).includes(document.url));
assert.equal((await get('/api/search?q=Linux')).status,200);
assert.match(await (await get('/llms.txt')).text(),/agent-index.json/);
assert.equal(await (await get(new URL(document.text_url).pathname)).text(),await readFile(`dist${new URL(document.text_url).pathname}`,'utf8'));
if (owner === 'input-foundry') {
 await verifyInputFoundry(get);
} else {
 const engine = await (await get('/typing/engine-package.json?schema=double-pinyin-flypy')).json();
 assert.ok(engine.files[`${engine.schema}.schema.yaml`]);
 const wasm = new Uint8Array(await (await get('/typing/runtime/rime.wasm')).arrayBuffer());
 assert.deepEqual([...wasm.slice(0,4)],[0,97,115,109]);
 const body = new URLSearchParams({schemas:'double-pinyin-flypy',artifact:'rime'});
 const download = new Uint8Array(await (await get('/typing/build',{method:'POST',body})).arrayBuffer());
 assert.deepEqual([...download.slice(0,4)],[80,75,3,4]);
 assert.deepEqual(Buffer.from(download), await readFile('/tmp/mayphus-cloud-packages/rime-single.zip'));
}
const status = await (await get('/api/infra-status')).json();
assert.equal(status.status,'ok');
assert.ok(!('hardware' in status));
assert.ok(!('network' in status));
const chat = await (await get('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'What is Mayphus? Answer in one short sentence.'})})).json();
assert.ok(typeof chat.reply === 'string' && chat.reply.trim());
console.log('Verified homepage, agent index, canonical text and aliases, search, records, downloads and APIs:',base);

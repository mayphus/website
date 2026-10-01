import assert from 'node:assert/strict';
import {test} from 'node:test';
import {execFileSync} from 'node:child_process';
import {typingOwner, verifyTextPage, verifyInputFoundry, verifyFoundryZip} from './live-contracts.mjs';

const text = body=>new Response(body, {headers:{'content-type':'text/plain'}});
const fast = {attempts:2, pause:async()=>{}};
test('only the production origin delegates typing; immutable preview retains website checks', () => {
  assert.equal(typingOwner('https://mayphus.org'), 'input-foundry');
  assert.equal(typingOwner('https://118b9cad-mayphus.mayphus.workers.dev'), 'website');
  for (const base of ['https://mayphus.org.example', 'https://mayphus.org:444', 'http://mayphus.org']) assert.throws(()=>typingOwner(base));
});
test('website pages and aliases must both match reviewed text, even after retries', async () => {
  for (const bad of ['/profile/', '/profile/index.html']) {
    await assert.rejects(verifyTextPage(async path=>text(path === bad ? 'stale' : 'expected'), '/profile/', 'expected', fast), /content differs/);
  }
  await assert.rejects(verifyTextPage(async()=>new Response('expected',{headers:{'content-type':'text/html'}}), '/profile/', 'expected', fast), /expected plain text/);
});
test('propagation retry succeeds only when both canonical and alias bytes converge', async () => {
  let calls=0;
  await verifyTextPage(async()=>text(++calls === 1 ? 'stale' : 'expected'), '/profile/', 'expected', fast);
  assert.equal(calls, 3);
});

function service(overrides={}) {
  const fixtures = {
    '/typing/healthz': {ok:true, service:'input-foundry'},
    '/typing/': '<html><a href="/typing/customize">Customize with AI</a><form data-schema="double-pinyin-flypy"></form></html>',
    '/typing/api/schemas': {schemas:[{id:'double-pinyin-flypy', config:'flypy', artifacts:['rime']}]},
    '/typing/engine-package.json?schema=double-pinyin-flypy': {schema:'flypy', files:{'flypy.schema.yaml':'schema: flypy'}},
    '/typing/runtime/rime.wasm': new Uint8Array([0,97,115,109]),
    '/typing/build': new Uint8Array([80,75,3,4]),
    ...overrides,
  };
  return async (path, options) => {
    assert.ok(path in fixtures, `Unexpected service request ${path}`);
    if (path === '/typing/build') {
      assert.equal(options.method, 'POST');
      assert.equal(options.body.get('schemas'), 'double-pinyin-flypy');
      assert.equal(options.body.get('artifact'), 'rime');
    }
    const value = fixtures[path];
    if (value instanceof Uint8Array) return new Response(value, {headers:{'content-type':path.endsWith('/build')?'application/zip':'application/wasm'}});
    if (typeof value === 'string') return new Response(value, {headers:{'content-type':'text/html'}});
    return Response.json(value);
  };
}
test('independent service validates identity, workbench, catalog, engine, runtime and download', async () => {
  let verified=false;
  await verifyInputFoundry(service(), async (bytes, config)=>{assert.equal(config,'flypy');assert.deepEqual([...bytes],[80,75,3,4]);verified=true;});
  assert.ok(verified);
});
for (const [name, overrides] of [
  ['wrong service', {'/typing/healthz':{ok:true,service:'other'}}],
  ['generic HTML', {'/typing/':'<html>wrong application</html>'}],
  ['unsupported schema', {'/typing/api/schemas':{schemas:[]}}],
  ['mismatched engine', {'/typing/engine-package.json?schema=double-pinyin-flypy':{schema:'other',files:{'other.schema.yaml':'x'}}}],
  ['invalid WASM', {'/typing/runtime/rime.wasm':new Uint8Array([1,2,3,4])}],
]) {
  test(`independent service rejects ${name}`, async () => {
    await assert.rejects(verifyInputFoundry(service(overrides), async()=>assert.fail('must not reach download validation')));
  });
}
test('download validation tests the real archive and selected schema, not just ZIP magic', async () => {
  const zip = execFileSync('python3', ['-c', `import io,sys,zipfile
b=io.BytesIO()
with zipfile.ZipFile(b,'w',zipfile.ZIP_DEFLATED) as z:
 z.writestr('input-foundry/default.custom.yaml','patch:\\n  schema_list:\\n    - schema: flypy\\n')
 z.writestr('input-foundry/flypy.schema.yaml','schema: flypy\\n')
sys.stdout.buffer.write(b.getvalue())`]);
  await verifyFoundryZip(zip, 'flypy');
  await assert.rejects(verifyFoundryZip(zip, 'wrong'));
  const corrupt = Buffer.from(zip);
  corrupt[30 + corrupt.readUInt16LE(26) + corrupt.readUInt16LE(28) + 3] ^= 1;
  await assert.rejects(verifyFoundryZip(corrupt, 'flypy'));
  await assert.rejects(verifyFoundryZip(zip.subarray(0, 20), 'flypy'));
  await assert.rejects(verifyFoundryZip(Buffer.from([80,75,3,4]), 'flypy'));
});

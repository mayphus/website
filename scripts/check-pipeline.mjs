import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import YAML from 'yaml';
import {release} from './release.mjs';
import {selectContent} from './content-source.mjs';

const version = 'f2d7498c-604d-4a6d-88b5-a28bf883f515';
test('release promotes the receipt version once and only summarizes success', async () => {
  const calls = [];
  await release({run: (...args) => calls.push(args), readReceipt: async () => ({version}), summarize: () => calls.push(['summary'])});
  assert.deepEqual(calls, [['review'], ['ship', version], ['summary']]);
});
for (const failure of ['review', 'receipt', 'ship']) {
  test(`${failure} failure stops release and never reports success`, async () => {
    const calls = [];
    await assert.rejects(release({
      run: command => { calls.push(command); if (command === failure) throw Error(failure); },
      readReceipt: async () => ({version: failure === 'receipt' ? 'invalid' : version}),
      summarize: () => calls.push('summary'),
    }));
    assert.deepEqual(calls, failure === 'ship' ? ['review', 'ship'] : ['review']);
  });
}
const repository = 'https://github.com/mayphus/mayphus.git';
const first = 'a'.repeat(40), newest = 'b'.repeat(40);
test('local builds resolve main afresh rather than reuse an earlier build identity', async () => {
 let current = first, selected;
 const options = {prepared:false, readIdentity:() => {throw Error('must not reuse');},
  refresh:() => {selected = current; return selected;}, head:() => selected, status:() => ''};
 assert.equal(await selectContent(options),first);
 current = newest;
 assert.equal(await selectContent(options),newest);
});
test('CI reuses its one resolved main even if upstream advances during the build', async () => {
 const options = {prepared:true, readIdentity:async () => ({repository,ref:'refs/heads/main',commit:first}),
  refresh:() => {throw Error('must not resolve twice');}, head:() => first, status:() => ''};
 assert.equal(await selectContent(options),first);
 assert.equal(await selectContent(options),first);
});
test('missing, non-main, dirty or changed prepared content fails closed', async () => {
 const valid = {prepared:true, readIdentity:async () => ({repository,ref:'refs/heads/main',commit:first}),
  refresh:() => {throw Error('must not fetch');}, head:() => first, status:() => ''};
 for (const overrides of [
  {readIdentity:async () => {throw Error('missing identity');}},
  {readIdentity:async () => ({repository,ref:'refs/pull/1/head',commit:first})},
  {readIdentity:async () => ({repository:'unexpected',ref:'refs/heads/main',commit:first})},
  {readIdentity:async () => ({repository,ref:'refs/heads/main',commit:'main'})},
  {head:() => newest}, {status:() => ' M record'},
 ]) await assert.rejects(selectContent({...valid,...overrides}));
});
test('automatic content publication polls trusted main without wider permissions or PR deployment', async () => {
 const ship = YAML.parse(await readFile('.github/workflows/ship.yml','utf8'));
 const check = YAML.parse(await readFile('.github/workflows/check.yml','utf8'));
 const setup = YAML.parse(await readFile('.github/actions/setup/action.yml','utf8'));
 assert.ok(ship.on.schedule.length > 0, 'Content-only changes need an independent trigger');
 assert.deepEqual(ship.permissions, {contents:'read'});
 assert.equal(ship.jobs.ship.if, "github.ref == 'refs/heads/main'");
 assert.equal(ship.concurrency['cancel-in-progress'], false);
 assert.ok(!ship.on.pull_request && !ship.on.pull_request_target);
 const checkout = setup.runs.steps.find(step => step.with?.repository === 'mayphus/mayphus');
 assert.equal(checkout.with.ref, 'main');
 assert.equal(checkout.with['persist-credentials'], false);
 assert.ok(check.on.pull_request !== undefined);
 assert.ok(!JSON.stringify(check).includes('CLOUDFLARE_API_TOKEN'));
});

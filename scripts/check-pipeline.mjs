import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import YAML from 'yaml';
import {release} from './release.mjs';
import {selectContent} from './content-source.mjs';
import {canReuseProduction, successfulProduction} from './production-provenance.mjs';

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

// A historical successful run alone is insufficient: the receipt must identify
// the deployment currently serving 100% of production traffic.
const productionVersion = 'f2d7498c-604d-4a6d-88b5-a28bf883f515';
const deploymentId = 'ac8ab124-f200-4ff1-88a2-133610d32c49';
const otherDeployment = 'c231176a-128f-471c-a401-baa23ebd91af';
const otherVersion = '67a016f4-814a-456e-94b0-37a2a076af00';
const successful = {status:'verified',website:first,content:newest,assets:'c'.repeat(64),deployment:deploymentId,version:productionVersion};
const deployed = {id:deploymentId,versions:[{version_id:productionVersion,percentage:100}]};
const versionMetadata = {id:productionVersion,metadata:{has_preview:true},annotations:{'workers/alias':'review','workers/tag':'commit-aaaaaaaaaaaa','workers/message':'review commit-aaaaaaaaaaaa','workers/triggered_by':'version_upload'}};
const reuseOptions = {website:first,content:newest,readWebsiteMain:async () => first,readSuccess:async () => successful,readProduction:async () => deployed,readVersion:async () => versionMetadata};
test('unchanged sources skip only with a verified receipt matching current production', async () => {
 assert.equal(await canReuseProduction(reuseOptions),true);
});
for (const [name, overrides] of [
 ['new content',{content:'d'.repeat(40)}],
 ['new website',{website:'d'.repeat(40)}],
 ['failed previous release',{readSuccess:async () => ({...successful,status:'failed'})}],
 ['missing receipt',{readSuccess:async () => {throw Error('cache miss');}}],
 ['unavailable production provenance',{readProduction:async () => {throw Error('read failed');}}],
 ['unavailable version provenance',{readVersion:async () => {throw Error('read failed');}}],
 ['manual retry',{force:true}],
 ['website main moving during setup',{readWebsiteMain:async () => 'd'.repeat(40)}],
 ['unavailable website main',{readWebsiteMain:async () => {throw Error('read failed');}}],
 ['interrupted or failed post-promotion verification',{readProduction:async () => ({id:otherDeployment,versions:[{version_id:otherVersion,percentage:100}]})}],
 ['a later deployment of the same version',{readProduction:async () => ({...deployed,id:otherDeployment})}],
 ['split production traffic',{readProduction:async () => ({...deployed,versions:[{version_id:productionVersion,percentage:50},{version_id:otherVersion,percentage:50}]})}],
]) test(`${name} cannot bypass the checked release`, async () => {
 assert.equal(await canReuseProduction({...reuseOptions,...overrides}),false);
});
test('success recording rejects a deployment that moved after production verification', () => {
 const receipt = {commit:first,content:newest,assets:'c'.repeat(64),version:productionVersion};
 assert.deepEqual(successfulProduction(receipt,deployed),successful);
 assert.throws(() => successfulProduction(receipt,{...deployed,versions:[{version_id:otherVersion,percentage:100}]}));
});
test('only successful main Ship can save production provenance, without fuzzy cache restores', async () => {
 const ship = YAML.parse(await readFile('.github/workflows/ship.yml','utf8'));
 const steps = ship.jobs.ship.steps;
 const releaseIndex = steps.findIndex(s => s.run === 'npm run release');
 const recordIndex = steps.findIndex(s => s.run === 'node scripts/production-provenance.mjs record');
 const saveIndex = steps.findIndex(s => s.uses?.startsWith('actions/cache/save@'));
 assert.ok(releaseIndex < recordIndex && recordIndex < saveIndex);
 for (const step of [steps[recordIndex],steps[saveIndex]]) {
  assert.ok(step.if.includes('success()'));
  assert.ok(!/always\(|failure\(/.test(step.if));
 }
 const restore = steps.find(s => s.uses?.startsWith('actions/cache/restore@'));
 assert.ok(!restore.with['restore-keys']);
 assert.equal(restore.with.path,'.cache/verified-production.json');
 assert.equal(ship.jobs.ship.if,"github.ref == 'refs/heads/main'");
});

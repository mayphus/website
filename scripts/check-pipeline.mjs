import assert from 'node:assert/strict';
import {test} from 'node:test';
import {release} from './release.mjs';
import {updateContent} from './update-content.mjs';

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
const previous = JSON.stringify({repository:'https://github.com/mayphus/mayphus.git', commit:'a'.repeat(40)}) + '\n';
test('content update validates an exact pin and repeated updates are stable', async () => {
  let contents = previous, checks = 0;
  const options = {read:async () => contents, write:async value => {contents = value;}, check:async () => {checks++; assert.equal(JSON.parse(contents).commit, 'b'.repeat(40));}};
  await updateContent('b'.repeat(40), options);
  const first = contents;
  await updateContent('b'.repeat(40), options);
  assert.equal(contents, first);
  assert.equal(checks, 2);
});
test('failed fetch/build/check restores the exact previous lock', async () => {
  let contents = previous;
  await assert.rejects(updateContent('b'.repeat(40), {read:async () => contents, write:async value => {contents = value;}, check:async () => {throw Error('check failed');}}), /check failed/);
  assert.equal(contents, previous);
});
test('branches, abbreviated SHAs and shell syntax cannot become pins', async () => {
  for (const value of ['main', 'abc123', 'a'.repeat(40)+'\n', '$(touch unexpected)', undefined]) {
    await assert.rejects(updateContent(value, {read:() => {throw Error('must not read');}}), /Supply the full/);
  }
});

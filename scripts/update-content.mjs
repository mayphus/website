import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export async function updateContent(commit, {read, write, check}) {
  assert.match(commit || '', /^[a-f0-9]{40}$/, 'Supply the full reviewed content commit SHA');
  const previous = await read();
  const lock = JSON.parse(previous);
  assert.equal(lock.repository, 'https://github.com/mayphus/mayphus.git');
  try {
    await write(JSON.stringify({...lock, commit}, null, 2) + '\n');
    await check();
  } catch (error) {
    await write(previous);
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.ok(!process.env.MAYPHUS_CONTENT_DIR, 'Content update must validate the pinned GitHub source');
  await updateContent(process.argv[2], {
    read: () => readFile('content.lock.json', 'utf8'),
    write: content => writeFile('content.lock.json', content),
    check: () => execFileSync('npm', ['run', 'check'], {stdio:'inherit'}),
  });
  console.log('Content pin validated. Review content.lock.json and open a website PR. Nothing was published.');
}

import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile, writeFile, mkdir, access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const repository = 'https://github.com/mayphus/mayphus.git';
const git = (cwd, ...args) => execFileSync('git', args, {cwd, encoding:'utf8'}).trim();
export async function contentSource() {
 const lock = JSON.parse(await readFile('content.lock.json', 'utf8'));
 assert.equal(lock.repository, repository);
 assert.match(lock.commit, /^[a-f0-9]{40}$/);
 const source = resolve(process.env.MAYPHUS_CONTENT_DIR || '.cache/content');
 if (!process.env.MAYPHUS_CONTENT_DIR) {
  await mkdir('.cache', {recursive:true});
  try { await access(resolve(source,'.git')); }
  catch { git(process.cwd(), 'clone', '--no-checkout', '--filter=blob:none', repository, source); }
  assert.ok([repository,'git@github.com:mayphus/mayphus.git'].includes(git(source,'remote','get-url','origin')), 'Unexpected content repository');
  assert.equal(git(source,'status','--porcelain'), '', 'Cached content checkout is dirty');
  try { git(source,'cat-file','-e',`${lock.commit}^{commit}`); }
  catch { git(source,'fetch','--depth=1','origin',lock.commit); }
  git(source,'checkout','--detach',lock.commit);
 }
 assert.equal(git(source,'rev-parse','HEAD'), lock.commit, 'Content does not match content.lock.json');
 assert.equal(git(source,'status','--porcelain'), '', 'Commit content edits before building the website');
 execFileSync('npm',['ci','--prefer-offline','--no-audit'],{cwd:source,stdio:'inherit'});
 return {source, commit:lock.commit};
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
 assert.equal(process.argv[2], 'pin', 'Usage: npm run content:pin -- /path/to/mayphus');
 const source = resolve(process.argv[3] || '../mayphus');
 assert.equal(git(source,'status','--porcelain'), '', 'Commit content edits before pinning');
 const commit = git(source,'rev-parse','HEAD');
 await writeFile('content.lock.json', JSON.stringify({repository,commit},null,2)+'\n');
 console.log(`Pinned content ${commit}. Run npm run check before committing this lock.`);
}

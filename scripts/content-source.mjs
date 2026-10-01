import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile, mkdir, access} from 'node:fs/promises';
import {resolve} from 'node:path';
const repository = 'https://github.com/mayphus/mayphus.git';
const git = (cwd, ...args) => execFileSync('git', args, {cwd, encoding:'utf8'}).trim();

// CI resolves trusted main once during setup. Local builds resolve it afresh.
// This identity is ignored build state, never a maintained source pin.
export async function selectContent({prepared, readIdentity, refresh, head, status}) {
 assert.equal(await status(), '', 'Commit content edits before building the website');
 let commit;
 if (prepared) {
  const identity = await readIdentity();
  assert.equal(identity.repository, repository);
  assert.equal(identity.ref, 'refs/heads/main');
  commit = identity.commit;
 } else commit = await refresh();
 assert.match(commit, /^[a-f0-9]{40}$/);
 assert.equal(await head(), commit, 'Content checkout differs from resolved main');
 assert.equal(await status(), '', 'Content checkout is dirty');
 return commit;
}
export async function contentSource() {
 const source = resolve('.cache/content');
 assert.ok(!process.env.MAYPHUS_CONTENT_DIR, 'Builds use trusted GitHub main, not a local source override');
 await mkdir('.cache', {recursive:true});
 try { await access(resolve(source,'.git')); }
 catch { git(process.cwd(), 'clone', '--no-checkout', '--filter=blob:none', repository, source); }
 assert.ok([repository,'git@github.com:mayphus/mayphus.git'].includes(git(source,'remote','get-url','origin')), 'Unexpected content repository');
 const commit = await selectContent({
  prepared: process.env.MAYPHUS_CONTENT_RESOLVED === '1',
  readIdentity: async () => JSON.parse(await readFile('.cache/content-source.json','utf8')),
  refresh: () => {
   git(source,'fetch','--depth=1','origin','refs/heads/main');
   const commit = git(source,'rev-parse','FETCH_HEAD');
   git(source,'checkout','--detach',commit);
   return commit;
  },
  head: () => git(source,'rev-parse','HEAD'),
  status: () => git(source,'status','--porcelain'),
 });
 execFileSync('npm',['ci','--prefer-offline','--no-audit'],{cwd:source,stdio:'inherit'});
 return {source, commit};
}

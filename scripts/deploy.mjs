import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const run=(program,args,inherit=false)=>execFileSync(program,args,{encoding:'utf8',stdio:inherit?'inherit':'pipe',env:{...process.env,WRANGLER_LOG_PATH:resolve('.wrangler/logs/deploy.log')}})?.trim();
const git=(...args)=>run('git',args);
const wrangler=(...args)=>run('node_modules/.bin/wrangler',args);
const receipt='.cache/review.json';
export function verifyVersion(version,id,commit){
 const tag=`commit-${commit.slice(0,12)}`;
 assert.equal(version.id,id);
 assert.equal(version.metadata?.has_preview,true);
 assert.equal(version.annotations?.['workers/alias'],'review');
 assert.equal(version.annotations?.['workers/tag'],tag);
 assert.equal(version.annotations?.['workers/message'],`review ${tag}`);
 assert.equal(version.annotations?.['workers/triggered_by'],'version_upload');
}
export function verifySource(branch,status,head,remote){
 assert.equal(branch,'main','Production requires main');
 assert.equal(status,'','Production requires a clean checkout');
 assert.match(head,/^[a-f0-9]{40}$/);assert.equal(head,remote,'Main moved; review the new commit');
}
async function assetHash(){
 const hash=createHash('sha256');
 async function walk(dir){for(const entry of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const path=`${dir}/${entry.name}`;if(entry.isDirectory())await walk(path);else{hash.update(path);hash.update(await readFile(path));}}}
 await walk('dist');
 hash.update(await readFile('.cache/worker.mjs'));
 hash.update(await readFile('content.lock.json'));
 return hash.digest('hex');
}
async function main(){
 const [command,id]=process.argv.slice(2);
 if(!['review','ship'].includes(command))throw new Error('Usage: node scripts/deploy.mjs review | ship VERSION');
 assert.equal(git('status','--porcelain'),'','Release requires a clean checkout');
 assert.ok(!process.env.MAYPHUS_CONTENT_DIR,'Release must use the pinned GitHub content checkout');
 const commit=git('rev-parse','HEAD');
 const tag=`commit-${commit.slice(0,12)}`;
 if(command==='review'){
  run('npm',['run','check'],true);
  const output=wrangler('versions','upload','-c','wrangler.jsonc','--preview-alias','review','--tag',tag,'--message',`review ${tag}`,'--strict');
  console.log(output);
  const version=output.match(/Worker Version ID:\s+([a-f0-9-]{36})/)?.[1];
  const url=output.match(/Version Preview URL:\s+(https:\/\/\S+)/)?.[1];
  assert.match(version||'',/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
  assert.match(url||'',/^https:\/\/[a-f0-9]+-mayphus\.mayphus\.workers\.dev\/?$/);
  verifyVersion(JSON.parse(wrangler('versions','view',version,'-c','wrangler.jsonc','--json')),version,commit);
  run(process.execPath,['scripts/check-cloud-live.mjs',url],true);
  await mkdir('.cache',{recursive:true});
  await writeFile(receipt,JSON.stringify({commit,version,url,assets:await assetHash()}));
  console.log(`Review version: ${version}\nReview URL: ${url}`);
 }else{
  assert.match(id||'',/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
  const reviewed=JSON.parse(await readFile(receipt,'utf8'));
  assert.equal(reviewed.commit,commit);assert.equal(reviewed.version,id);
  assert.equal(reviewed.assets,await assetHash(),'Build output differs from the verified review');
  const checkMain=()=>verifySource(git('branch','--show-current'),git('status','--porcelain'),commit,git('ls-remote','--exit-code','origin','refs/heads/main').split(/\s/)[0]);
  checkMain();
  verifyVersion(JSON.parse(wrangler('versions','view',id,'-c','wrangler.jsonc','--json')),id,commit);
  run(process.execPath,['scripts/check-cloud-live.mjs',reviewed.url],true);
  checkMain();
  console.log(wrangler('versions','deploy',`${id}@100%`,'-c','wrangler.jsonc','--message',`production ${id} from ${tag}`,'--yes'));
  console.log(wrangler('triggers','deploy','-c','wrangler.jsonc'));
  run(process.execPath,['scripts/check-cloud-live.mjs','https://mayphus.org'],true);
 }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();

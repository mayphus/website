import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile, writeFile, appendFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyVersion} from './deploy.mjs';
import {currentContentMain} from './content-source.mjs';
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const sha = /^[a-f0-9]{40}$/;
const marker = '.cache/verified-production.json';
const run = (program,args) => execFileSync(program,args,{encoding:'utf8',env:{...process.env,WRANGLER_LOG_PATH:resolve('.wrangler/logs/provenance.log')}}).trim();
const wrangler = (...args) => JSON.parse(run('node_modules/.bin/wrangler',[...args,'-c','wrangler.jsonc','--json']));
export function productionIdentity(deployment) {
 assert.match(deployment.id,uuid);
 assert.equal(deployment.versions.length,1,'Split traffic is not a verified single-version release');
 const [{version_id:version,percentage}] = deployment.versions;
 assert.match(version,uuid);
 assert.equal(percentage,100);
 return {deployment:deployment.id,version};
}
export async function canReuseProduction({website,content,readSuccess,readProduction,readVersion,readWebsiteMain,readContentMain,force=false}) {
 if (force) return false;
 try {
  assert.match(website,sha); assert.match(content,sha);
  assert.equal(await readWebsiteMain(),website,'Website main moved before reuse');
  assert.equal(await readContentMain(),content,'Content main moved before reuse');
  const success = await readSuccess();
  assert.equal(success.status,'verified');
  assert.equal(success.website,website); assert.equal(success.content,content);
  assert.match(success.assets,/^[a-f0-9]{64}$/);
  const current = productionIdentity(await readProduction());
  assert.equal(success.deployment,current.deployment);
  assert.equal(success.version,current.version);
  verifyVersion(await readVersion(current.version),current.version,website);
  assert.equal(await readWebsiteMain(),website,'Website main moved during provenance checks');
  assert.equal(await readContentMain(),content,'Content main moved during provenance checks');
  return true;
 } catch { return false; }
}
export function successfulProduction(receipt,deployment) {
 const current = productionIdentity(deployment);
 assert.equal(current.version,receipt.version,'Production changed after verified release');
 assert.match(receipt.commit,sha); assert.match(receipt.content,sha); assert.match(receipt.assets,/^[a-f0-9]{64}$/);
 return {status:'verified',website:receipt.commit,content:receipt.content,assets:receipt.assets,...current};
}
async function output(name,value) {
 if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT,`${name}=${value}\n`);
}
const cacheKey = id => `verified-production-v1-${id}`;
async function main() {
 const command = process.argv[2];
 if (command === 'identity') {
  try {
   const current = productionIdentity(wrangler('deployments','status'));
   await output('cache-key',cacheKey(current.deployment));
  } catch {
   console.log('Current production provenance unavailable; normal checked release required.');
  }
 } else if (command === 'reuse') {
  const {commit:content} = JSON.parse(await readFile('.cache/content-source.json','utf8'));
  const reuse = await canReuseProduction({
   website:run('git',['rev-parse','HEAD']),content,
   readWebsiteMain:async () => {
    assert.equal(run('git',['branch','--show-current']),'main');
    assert.equal(run('git',['status','--porcelain']),'');
    return run('git',['ls-remote','--exit-code','origin','refs/heads/main']).split(/\s/)[0];
   },
   readSuccess:async () => JSON.parse(await readFile(marker,'utf8')),
   readProduction:async () => wrangler('deployments','status'),
   readVersion:async id => wrangler('versions','view',id),
   readContentMain:async () => currentContentMain(),
   force:JSON.parse(await readFile('.cache/publication-event.json','utf8')).kind === 'manual-retry',
  });
  await output('unchanged',String(reuse));
  console.log(reuse ? 'Current production matches this verified website/content release; no build or deployment needed.' : 'No matching verified current production; run the full checked release.');
 } else if (command === 'record') {
  // Called only after release and strict production verification succeed.
  const receipt = JSON.parse(await readFile('.cache/review.json','utf8'));
  const success = successfulProduction(receipt,wrangler('deployments','status'));
  verifyVersion(wrangler('versions','view',success.version),success.version,success.website);
  await writeFile(marker,JSON.stringify(success)+'\n');
  await output('cache-key',cacheKey(success.deployment));
 } else throw Error('Usage: production-provenance.mjs identity | reuse | record');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

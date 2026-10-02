import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile, appendFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// A dispatch is only a wake-up. Its claims never authorize source or select code.
// Ship independently checks the current main sources before immutable promotion.
export function publicationEvent({repository, ref, eventName, event}) {
 assert.equal(repository, 'mayphus/website');
 assert.equal(ref, 'refs/heads/main', 'Only trusted website main may release');
 if (eventName === 'push') return {kind:'website-push'};
 assert.equal(eventName, 'workflow_dispatch', 'Unsupported publication trigger');
 const {source_repository:source, source_sha:sha, source_run_id:run, source_run_attempt:attempt} = event.inputs || {};
 if ([source,sha,run,attempt].every(value => value === undefined || value === '')) return {kind:'manual-retry'};
 assert.equal(source, 'mayphus/mayphus');
 assert.match(sha || '', /^[a-f0-9]{40}$/, 'A full checked content commit is required');
 assert.match(run || '', /^[1-9][0-9]*$/, 'A check run ID is required');
 assert.match(attempt || '', /^[1-9][0-9]*$/, 'A check run attempt is required');
 return {kind:'content-check', repository:source, commit:sha, run, attempt};
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
 const identity = publicationEvent({repository:process.env.GITHUB_REPOSITORY, ref:process.env.GITHUB_REF,
  eventName:process.env.GITHUB_EVENT_NAME, event:JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH,'utf8'))});
 await mkdir('.cache',{recursive:true});
 await writeFile('.cache/publication-event.json', JSON.stringify(identity)+'\n');
 if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,
  identity.kind === 'content-check' ? `Content wake-up: ${identity.repository}@${identity.commit}, Check run ${identity.run}, attempt ${identity.attempt}. Current trusted mains are resolved and checked independently.\n` : `Publication trigger: ${identity.kind}.\n`);
}

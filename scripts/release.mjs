import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {appendFile, readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// Keep promotion behind the existing receipt, source and live verification guards.
export async function release({run, readReceipt, summarize}) {
  await run('review');
  const receipt = await readReceipt();
  assert.match(receipt.version || '', /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
  await run('ship', receipt.version);
  await summarize(receipt);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await release({
    run: (...args) => execFileSync(process.execPath, ['scripts/deploy.mjs', ...args], {stdio:'inherit'}),
    readReceipt: async () => JSON.parse(await readFile('.cache/review.json', 'utf8')),
    summarize: async ({commit, version}) => {
      const {commit:content} = JSON.parse(await readFile('content.lock.json', 'utf8'));
      const summary = `### Shipped Mayphus\nWebsite: ${commit}\nContent: ${content}\nCloudflare version: ${version}\nReview and production checks passed.\nhttps://mayphus.org/?__asset_version=${version}\n`;
      console.log(summary);
      if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
    },
  });
}

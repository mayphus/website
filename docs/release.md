# Release and migration

The website is the only production deployment owner. Preserve the existing
Cloudflare Worker name, domain route, R2, AI and rate-limit bindings.

## Initial handoff

1. Publish the approved content split to mayphus/mayphus. Its former Ship workflow
   is removed; content pushes only validate. Let any earlier Ship run finish.
2. Create mayphus/website, publish these sources and ensure content.lock.json pins
   that exact published content commit.
3. Configure a read-only deploy key on mayphus/mayphus and save its private key
   as website repository secret CONTENT_READ_KEY. Configure the production environment with
   CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN using the existing authorized
   Cloudflare credentials. Keep secret values out of files and logs.
4. Run the website Ship workflow. Verify its immutable review and production
   health/homepage/record checks before considering the handoff complete.

Do not delete the content repository or rewrite its historical commits.
If the handoff fails before promotion, the existing deployed Worker stays live.

## Routine release

An update request permits local edits and validation. Commit/push or production
publication needs user authorization; existing authorization carries forward.
An authorized push to main runs Ship: check both repositories, upload an immutable
review, verify it, promote exactly that version, and verify production.
Do not run local deployment concurrently. The receipt binds website commit,
content lock, bundled Worker and asset bytes to the reviewed version.

For content-only changes, merge the content PR and wait for its Check, then run
`scripts/node22 npm run content:update -- FULL_CONTENT_COMMIT_SHA`. This validates the composed site and restores the prior lock on
failure. Open a website lock PR, wait for Check, then request release approval.
No second content checkout or manual lock editing is required. Website PR checks
cancel older checks for the same PR; Ship stays serialized and is never cancelled
in progress. The two checks intentionally validate different source states: the
PR integration and the exact merged release commit.

A push to main is the normal release trigger. Do not also dispatch Ship for the
same change. Manual dispatch remains available for an intentional retry: it
revalidates, uploads a fresh immutable version and promotes it. Duplicate triggers
are serialized, not silently deduplicated. Superseded queued commits skip before
setup/upload. If main moves during review, the existing promotion guards still
fail closed. A failed review never promotes; a failed production verification
fails the run and requires investigation (it does not imply automatic rollback).

PR Check and Ship share one setup action, the existing read-only content key and
an npm download cache keyed by both dependency locks. Every build still uses
`npm ci`; cached dependencies never replace lockfile validation. Permissions,
production environment protections and the content pin remain unchanged.

For an authorized local release from a clean, pushed main:

```sh
scripts/node22 npm run release
```

Never bypass receipts, source checks or rebuild different output for promotion.
Production /healthz must return ok; published homepage and records must match the
reviewed build. An upload or passing build alone is not publication proof.

The single release command reads the verified receipt directly, promotes its
version with the existing guards, and reports website/content commits and the
Cloudflare version only after production verification succeeds. The separate
`release:review` and `release:ship -- VERSION_ID` commands remain available for
an intentionally separated review/promotion.

## Rollback and failures

Keep the last successful Ship summary (website commit, content commit and
Cloudflare version). To roll back through the normal pipeline, open a PR reverting
the problematic website change or restoring the last known-good content pin.
Check the composed site, obtain release approval, and merge. Ship reviews and
promotes that exact new commit as usual. Do not reset main or bypass receipts.
For an urgent production version rollback, obtain explicit approval and coordinate
with any in-flight Ship before using Cloudflare's version rollback controls;
verify production and follow with a source revert so the next release agrees.

## Cross-repository automation boundary

Content merges do not deploy. The current content deploy key is read-only and
cannot create website PRs. This change adds no token, write permission, schedule
or automatic production trigger. The minimum no-new-permission handoff is the
single `content:update` command followed by a reviewed website PR. Fully automatic
lock PRs would be a separate approval decision for narrowly scoped website write
access; do not broaden CONTENT_READ_KEY or use a general-purpose personal token.

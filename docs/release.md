# Release and migration

The website owns production deployment of the Mayphus site Worker. Preserve the
existing Cloudflare Worker name, domain route, R2, AI and rate-limit bindings.
Input Foundry independently owns the more-specific `mayphus.org/typing*` route;
do not replace or delete that service route when releasing the website.

## Live verification boundaries

The [Input Foundry configuration](https://github.com/mayphus/input-foundry/blob/main/wrangler.jsonc)
and its README define the separate typing service. On the production origin,
verify its service identity, HTML workbench, supported Flypy catalog entry,
matching engine schema, WASM signature, and a real Rime ZIP with valid archive
checksums and the selected schema. Its compiled files can advance independently
of the website build, so they are not compared to that older publication.
The immutable website preview still verifies its own `/typing/` text, alias and
exact resolved ZIP bytes; it does not exercise the production route delegation.

Website-owned homepage, canonical text, aliases, document metadata and API checks
remain tied to the reviewed build. Text pages and aliases retry the same strict
content checks for up to 12 attempts, five seconds apart, to allow edge propagation;
exhausted retries fail the release. A generic HTML page, missing typing service,
invalid runtime or corrupt download cannot satisfy the delegated service checks.

## Initial handoff

1. Publish the approved content split to mayphus/mayphus. Its former Ship workflow
   is removed; content pushes validate; website polling publishes trusted main. Let any earlier Ship run finish.
2. Create mayphus/website, publish these sources; each build resolves content main once.
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
resolved content commit, bundled Worker and asset bytes to the reviewed version.

For content-only changes, merge the reviewed content PR to main. Ship polls content
main hourly at minute 17 with the existing read-only deploy key. No maintained lock,
content-update command, or website pin PR remains. GitHub may delay scheduled runs;
this is the supported no-new-permission alternative to an immediate cross-repository
webhook. Schedule and manual runs execute only trusted website main; content checkout
always resolves trusted content main, never an event payload or PR branch.

The setup action checks out main once and records its full commit in ignored
`.cache/content-source.json`. Checks and bundling reuse that checkout. The immutable
review receipt binds website commit, resolved content commit, Worker and asset bytes;
promotion does not rebuild or fetch newer content. Content moving during review is
handled in a later release. A build/review failure never changes production.
Scheduled runs currently revalidate and release unchanged source too.

Website PR checks cancel older checks for the same PR; Ship remains serialized and
is never cancelled in progress. No content repository write access or new credential
is required. Immediate content-merge dispatch would require separately authorized,
narrow website workflow write access; do not broaden the existing read-only key,
create a general-purpose token, or use pull_request_target.

Website main pushes and the hourly content poll are the normal release triggers. Do not also dispatch Ship for the
same change. Manual dispatch remains available for an intentional retry: it
revalidates, uploads a fresh immutable version and promotes it. Concurrency protects
the running release from cancellation, but GitHub retains only one pending run;
a newer run can replace that pending run. Not every queued trigger will execute.
Any superseded commit that does start skips before setup/upload. If main moves
during review, the existing promotion guards still
fail closed. A failed review never promotes; a failed production verification
fails the run and requires investigation (it does not imply automatic rollback).

PR Check and Ship share one setup action, the existing read-only content key and
an npm download cache keyed by both dependency locks. Every build still uses
`npm ci`; cached dependencies never replace lockfile validation. Repository permissions and production environment protections remain unchanged.

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
the problematic website change or reverting the problematic content change in content main.
Check the composed site, obtain release approval, and merge. Ship reviews and
promotes that exact new commit as usual. Do not reset main or bypass receipts.
For an urgent production version rollback, obtain explicit approval and coordinate
with any in-flight Ship before using Cloudflare's version rollback controls;
verify production and follow with a source revert so the next release agrees.

## Cross-repository automation boundary

The content repository only validates; website Ship polls trusted content main with
its existing read-only key. This adds a schedule but no token, repository write
permission, or content pin. No untrusted PR content is deployed. A failed download,
build, or immutable preview leaves the current production version running. A failed
production verification still requires investigation, not automatic rollback.

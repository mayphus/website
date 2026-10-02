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
   is removed; content pushes validate; a successful trusted main check dispatches website Ship. Let any earlier Ship run finish.
2. Create mayphus/website, publish these sources; each build resolves content main once.
3. Reuse the existing read-only content deploy key, already stored as website
   repository secret CONTENT_READ_KEY. A replacement key is not needed for this
   workflow. CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN remain in the existing
   production environment restricted to main. Keep secret values out of files
   and logs.
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

For content-only changes, merge the reviewed content PR to main. Its separate
`website-publication` job depends on successful content checks and runs only for a
push to `mayphus/mayphus` main. It verifies the checked SHA is still current, then
dispatches the fixed website `ship.yml` workflow on `main` with the source repository,
full SHA, Check run ID and run attempt. Superseded source runs do not dispatch.
No maintained lock, content-update command, website pin PR or polling remains.

The event is a wake-up, not authorization or a checkout ref. Website Ship checks
out current trusted website main and resolves current trusted content main. It
never runs code from event fields or a PR. Partial/malformed source identities fail
closed. If content advanced after dispatch, Ship checks the newer main instead.
The source run can still be in progress while its dispatch job runs: its successful
Check job is the sender gate. The receiver independently runs full content checks;
it does not claim to authenticate the run fields through the private Actions API.

The setup action checks out main once and records its full commit in ignored
`.cache/content-source.json`. Checks and bundling reuse that checkout. The immutable
review receipt binds website commit, resolved content commit, Worker and asset bytes;
promotion does not rebuild or fetch newer content. Both website and content mains are read again around final preview verification.
If either moved, promotion fails closed and a newer event handles the latest state. A build/review failure never changes production.
Unchanged sources skip build and deployment only when a trusted cached success
receipt matches both source commits and the exact current Cloudflare production
deployment at 100% traffic. Missing or unavailable provenance falls back to the
full checked release.

Production provenance is saved only after strict production verification succeeds,
using the existing Actions cache service on trusted website main. Its exact cache
key includes the Cloudflare deployment ID, not only a source commit or workflow run.
The next automatic event reads current deployment status with the existing Cloudflare token,
restores that exact receipt, then reads current status again before deciding to skip.
Both full source commits, deployment ID, single version at 100% traffic and version
metadata must match. A later promotion followed by failed/interrupted verification
has a different deployment ID and no verified receipt, so it cannot reuse an older
success. Evicted receipts, malformed data or unavailable reads require a normal full
checked release. No fuzzy restore keys or new repository/API permissions are used.
Manual workflow dispatch with all source inputs empty always forces a checked retry.
Content dispatches use source/production identity for deduplication; a new run ID
alone never makes an already verified source pair deploy again. Production receipts contain
only public build identities and hashes; no credential values are cached.

Website PR checks cancel older checks for the same PR. The configured Check installs
the public website lock and runs `npm run check:public` without requesting secrets. They do not claim a
full private-content integration pass. Trusted main Ship runs `npm run check`
before any upload. Its existing read-only content key is retained only for that
job's moving-main guards and is removed by checkout's post-job cleanup. Deployment
credentials remain scoped to the production environment; keep that environment
restricted to trusted main too. Do not use `pull_request_target` or pass secrets to the configured PR check to
restore broader PR coverage.

The existing CONTENT_READ_KEY remains a **repository secret**, preserving the
existing access setup. It is read-only but can read the private content repository.
A same-repository PR author who can edit workflow YAML can explicitly request a
repository secret; the current Check's lack of secret references does not prevent
that. This is a known retained limitation, not a claim of repository-wide PR secret
isolation. Replacing or migrating the key is optional hardening and is not part of
this activation. Cloudflare deployment secrets and the cross-repository dispatch
token are separately protected by their main-only environments.

Website main pushes and successful content-main checks are normal release triggers.
Do not also manually dispatch the same change. Manual retry revalidates, uploads a
fresh immutable version and promotes it. Ship remains serialized and is never
cancelled in progress. GitHub retains only one pending run; newer events may replace
older pending runs. Every receiver resolves the newest main, so events are coalesced
rather than promising every intermediate commit a deployment. A run whose resolved
main is already superseded skips before setup/upload. Main moving during review
fails the promotion guards. A failed review never promotes; a failed production
verification fails the run and requires investigation, not automatic rollback.

Trusted Ship caches npm downloads by both dependency locks; every build still uses
`npm ci`. Cached dependencies never replace lockfile validation. No source files,
private history or secrets are copied into the public website repository.

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

## Cross-repository automation boundary and activation

Keep the content repository private and the website repository separate. The
read-only `CONTENT_READ_KEY` cannot dispatch another repository, and the content
repository's normal `GITHUB_TOKEN` is scoped to its own repository. Do not broaden
either or reuse a general-purpose credential.

1. Review and merge the receiver first with explicit release approval. Its website
   main push verifies and publishes the newest checked content through the existing
   immutable review/promotion pipeline. The receiver must exist on default main
   before the sender can call `workflow_dispatch`.
2. Confirm private-repository environment secrets and selected deployment branches
   are supported by the owner's existing plan. For personal private repositories,
   GitHub documents these features for Pro, not Free. Do not silently require a
   paid upgrade or fall back to an unprotected repository secret.
3. After specific user approval, the user creates an expiring fine-grained token
   (recommended lifetime: 90 days), resource owner `mayphus`, selected repository
   **only `mayphus/website`**, repository **Actions: read and write** and automatic
   **Metadata: read**. No Contents write, administration, other repositories or
   organization permissions are needed. Token generation and secret entry occur
   in GitHub's secure UI, never chat, tracked files or logs.
4. In private `mayphus/mayphus`, configure the `website-publication` environment
   with selected deployment branch **main only** (not all/protected branches while
   main has no protection), then save that token as `WEBSITE_DISPATCH_TOKEN` there.
   Set the branch policy before storing the secret. A main-only `if` is additional
   defense; it does not replace the environment boundary because PR authors can
   edit workflow YAML. Confirm the existing website production environment also
   restricts secret-bearing jobs to trusted main.
5. Review and merge the sender with explicit approval. Confirm successful content
   Check, a successful dispatch response, and the resulting Website Ship's exact
   source commits, immutable preview and production verification. Dispatch success
   alone is not publication proof. Missing/expired credentials or API failures fail
   the source publication job; after repair rerun the job if its source is current,
   otherwise run the newest main check or intentionally retry website main.

GitHub Actions write is the narrowest API permission for workflow dispatch, but it
also permits other Actions operations on the website repository; fine-grained PATs
cannot be limited to one workflow endpoint. A separately approved GitHub App can
issue short-lived installation tokens with that same website-only permission, but
requires its own installation and private-key lifecycle. The supported baseline
here uses the explicitly approved expiring token and main-restricted environment.

References: [workflow dispatch permissions](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event),
[environments and private-plan support](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments),
[automatic token scope](https://docs.github.com/en/actions/concepts/security/github_token).

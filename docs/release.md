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

For an authorized local release from a clean, pushed main:

```sh
scripts/node22 npm run release:review
scripts/node22 npm run release:ship -- VERSION_ID
```

Never bypass receipts, source checks or rebuild different output for promotion.
Production /healthz must return ok; published homepage and records must match the
reviewed build. An upload or passing build alone is not publication proof.

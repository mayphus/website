# Working on the Mayphus website

Read README.md and docs/release.md. Inspect status and preserve unrelated changes.

- Own page templates, CSS, browser behavior and deployment here.
- Keep personal content and API/MCP source in mayphus/mayphus. Never copy authoritative data into this repository.
- content.lock.json pins an exact content commit. Do not build against an unpinned branch.
- Preserve the single homepage, no-JavaScript reading, URLs, anchors and accessibility.
- Run scripts/node22 npm run check. Inspect desktop and mobile when appearance changes.
- An update request permits local edits and validation. Commit/push or production publication needs user authorization; existing authorization carries forward.
- An authorized push to main deploys. Use docs/release.md and preserve immutable review/promotion guards.

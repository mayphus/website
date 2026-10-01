# Mayphus website

Page rendering and production deployment for mayphus.org.
Content, data, downloads and API/MCP source live in
[mayphus/mayphus](https://github.com/mayphus/mayphus).

## Build and check

```sh
scripts/node22 npm ci
scripts/node22 npm run check
scripts/node22 npm run dev
```

Each build resolves the newest `mayphus/mayphus` main into ignored
`.cache/content`, installs its locked dependencies and runs its export. CI records
the resolved commit in ignored `.cache/content-source.json` and reuses it throughout
that build. Local builds fetch main afresh. There is no committed content pin or
content-update PR. It renders `public/index.html` with exported `homepage.json`,
copies browser assets and bundles the content repository's Worker. Downloads and
API URLs stay on the same origin. The private content repository uses existing
read-only `CONTENT_READ_KEY` in Actions; local builds require authorized Git access.

| Change | Location |
| --- | --- |
| HTML structure | `public/index.html` |
| Styling | `public/landing.css` |
| Legacy anchor behavior | `public/fragments.js` |
| Wording, notes, profile, downloads, APIs and MCP | `mayphus/mayphus` |
| Build and release | `scripts/`, `wrangler.jsonc`, `.github/` |

## Automatic content publication

Merge reviewed content to its main branch. Website Ship polls that trusted branch
hourly at minute 17 using existing read-only access, so content-only changes publish
without a website PR. GitHub scheduling can be delayed; this is polling, not an
immediate cross-repository event. Website main pushes and intentional manual retries
also run Ship. Each run checks both repositories, verifies an immutable preview,
and promotes exactly that reviewed version. A failed build or review preserves the
currently deployed version. Scheduled runs currently revalidate and release even
when source is unchanged; no write token, new credential or cross-repo permission
is needed. PR Check validates without deploying PR code.

Build metadata and release receipts retain both resolved commits for provenance.
An upstream content commit arriving during review is handled by a later run; it
cannot change the bytes being promoted. Releases reject local source overrides.
The build rejects content/renderer asset collisions and escapes homepage fields.
Generated `dist/` and `.cache/` are never authoritative or committed.

See [release procedure](docs/release.md). The renderer and release files were
extracted from mayphus/mayphus at `2df37f9240b046a27d519e8060d578982b7d27c0`;
full source history remains there.

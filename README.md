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

`content.lock.json` selects an exact content commit. The build fetches it
into ignored `.cache/content`, installs its locked dependencies and runs its
export. It renders `public/index.html` with the exported `homepage.json`, copies
CSS/browser assets and bundles the content repository's Worker. Downloads and
API URLs stay on the same origin. No second backend or runtime GitHub fetch is
required. The content repository is private: local builds require authorized Git access;
GitHub Actions uses a dedicated read-only deploy key (`CONTENT_READ_KEY`).
First builds need GitHub/npm access; prepared checkouts build offline.

| Change | Location |
| --- | --- |
| HTML structure | `public/index.html` |
| Styling | `public/landing.css` |
| Legacy anchor behavior | `public/fragments.js` |
| Wording, notes, profile, downloads, APIs and MCP | `mayphus/mayphus` |
| Content version | `content.lock.json` |
| Build and release | `scripts/`, `wrangler.jsonc`, `.github/` |

## Update content

Commit and push the content change first. Then:

```sh
scripts/node22 npm run content:pin -- ../mayphus
scripts/node22 npm run check
```

Commit the lock change. Pinning does not publish. A local, clean checkout at the
pinned commit can be used for development:

```sh
MAYPHUS_CONTENT_DIR=../mayphus scripts/node22 npm run check
```

Release commands reject this override and fetch the pinned GitHub source.
The build rejects content/renderer asset collisions and escapes homepage fields.
Generated `dist/` and `.cache/` are never authoritative or committed.

See [release procedure](docs/release.md). The renderer and release files were
extracted from mayphus/mayphus at `2df37f9240b046a27d519e8060d578982b7d27c0`;
full source history remains there.

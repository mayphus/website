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

After reviewed content merges to main and its Check job succeeds, the content
repository dispatches Website Ship on main. This is event-driven: no scheduled
poll, committed pin, content-update PR or combined repository. Website main pushes
also trigger Ship; an empty manual dispatch forces an intentional checked retry.

The dispatch carries repository, checked commit, run ID and run attempt as a
wake-up identity. It cannot choose executable code. Ship resolves current trusted
main in both repositories, runs both sets of checks, verifies an immutable preview,
and promotes that exact version without rebuilding. If either main moves before
promotion, the release fails closed and the newer event can publish the latest state.
Duplicate or delayed events skip only when both current source commits and a
verified receipt match the exact current production deployment at 100% traffic.
A missing receipt or unavailable comparison runs the normal checked release.

Activation requires an approved, expiring fine-grained token restricted to
`mayphus/website` Actions write, securely stored as `WEBSITE_DISPATCH_TOKEN` in the
private content repository's main-only `website-publication` environment. Confirm
that this private repository's existing plan supports environment secrets and
selected-branch deployment policies before configuring it. The configured PR Check requests no
private-content or deployment secrets and runs public pipeline/contract tests;
full composed private-content checks run on trusted main before release.
The existing repository-scoped `CONTENT_READ_KEY` is retained. A writer who can
change a same-repository PR workflow can request that repository secret; the
current PR Check does not establish a repository-wide secret isolation boundary.
Cloudflare deployment secrets remain in the main-only production environment.

Build metadata and release receipts retain both resolved commits for provenance.
An upstream content commit arriving during review blocks promotion and is handled
by a later run; it cannot change the bytes being promoted. Releases reject local source overrides.
The build rejects content/renderer asset collisions and escapes homepage fields.
Generated `dist/` and `.cache/` are never authoritative or committed.

See [release procedure](docs/release.md). The renderer and release files were
extracted from mayphus/mayphus at `2df37f9240b046a27d519e8060d578982b7d27c0`;
full source history remains there.

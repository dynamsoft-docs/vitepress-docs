# @dynamsoft/vitepress-docs

Shared VitePress theme for Dynamsoft product documentation sites. Extends the
default VitePress theme with:

- **Corporate header/footer** — the real markup from
  [Docs-Template-Repo](https://github.com/dynamsoft-docs/Docs-Template-Repo)
  plus the fleet's full stylesheet cascade, vendored by
  `scripts/sync-chrome.mts`. The sync transforms make the cascade safe inside
  a VitePress page: url() absolutization (template assets resolve to GitHub
  raw), rem→px against the fleet's 10px root, @font-face hoisting (font URLs
  retargeted to the shared webres copies — GitHub raw's max-age=300 plus the
  fleet's `font-display: optional` made fresh visits render in the UA serif;
  rewritten to `font-display: swap`), sans-serif fallbacks on the fleet's
  bare custom font stacks, and `@scope (.ds-corporate)` isolation. A small
  shim in `CorporateHeader.vue` reproduces the corporate menu behaviour
  (click-toggled panels, Escape and outside-click close) since `layout.js`
  is not vendored; the header scrolls away with the page while the VitePress
  nav bar docks at the viewport top. Known gaps: the mobile hamburger menu
  is inert, and the signed-in account widget shows its logged-out state.
- **Doc skin** — `styles/doc-skin.css` styles the article body like the
  original Jekyll docs (GitHub-markdown look in OpenSans: 16px/26px `#24292e`
  text, `#0366d6` links, bordered GFM tables, `#f5f5f5` code blocks), with a
  dark-mode palette falling back to VitePress colours.
- **Breadcrumbs** — nav-bar trail replacing the site title, ending in the
  page title; directory labels overridable via `breadcrumbLabels`.
- **Version switcher** — a sidebar dropdown driven by the version manifest
  (see Versioning below).
- **Comm100 live chat** — fleet-wide site/plan defaults, overridable via
  `themeConfig.comm100`.
- **Brand accents** — Dynamsoft orange for nav/sidebar highlights.
- **Config defaults** — `defineDynamsoftConfig` (the `./config` export)
  wraps a site's VitePress config with the fleet-wide mechanics: versioned
  `base` from `themeConfig.docsRoot` + the `DOCS_VERSION` env var,
  GitHub-style GFM alerts (`> [!NOTE]` etc.) via markdown-it-github-alerts
  (plugin wired here, styles imported by the theme entry), version-manifest
  serving/publishing, local full-text search (no Algolia), nav-banner
  conventions, vue/vitepress dedupe, and bundling of this theme
  (`ssr.noExternal` + `optimizeDeps.exclude`). Anything it sets can be
  overridden by the site config it wraps.

The package ships TypeScript/Vue source (no build step); the consuming
site's VitePress compiles it. A few shipped files must stay JavaScript —
`src/config.js` (loaded by Node when VitePress bundles the site config) and
the `scripts/*.mjs` bins — because Node refuses to type-strip TypeScript
inside `node_modules`; all of them are fully typed via JSDoc (+
`config.d.ts`) and type-checked with `checkJs`. The maintainer-only
`scripts/sync-chrome.mts` is TypeScript (run it with Node ≥ 23.6).

## Setting up a docs site

```jsonc
// docs/package.json
{
	"scripts": {
		"api": "typedoc",
		"dev": "npm run api && vitepress dev",
		"build": "npm run api && vitepress build",
		"preview": "vitepress preview",
		"build:versions": "ds-docs-build-versions",
	},
	"devDependencies": {
		"@dynamsoft/vitepress-docs": "<version>", // or file:../../vitepress-docs while unpublished
	},
}
```

```ts
// docs/.vitepress/theme/index.ts
import DynamsoftTheme from "@dynamsoft/vitepress-docs";
export default DynamsoftTheme;
```

```ts
// docs/.vitepress/config.mts
import { defineDynamsoftConfig, loadApiSidebar } from "@dynamsoft/vitepress-docs/config";

export default defineDynamsoftConfig({
	title: "Your Product",
	themeConfig: {
		docsRoot: "/your-product/docs/web/",
		dynamsoftChrome: true,
		breadcrumbLabels: { api: "API Reference", guide: "User Guide" },
		nav: [{ text: "Download", link: "https://www.dynamsoft.com/your-product/downloads/" }],
		sidebar: [
			/* ...guide groups... */
			{ text: "API Reference", link: "/api/", items: loadApiSidebar() },
		],
	},
});
```

Install with `npm install` in the docs package (and in the repo root — the
API reference is generated from the product's TypeScript source, which
resolves types from the root `node_modules`). While this theme is consumed
via a `file:` link, also run `npm install` in this checkout: Node and Vite
resolve imports from the real path, so the theme's own dependencies must be
present in this package's `node_modules`, not just the consumer's.

## Commands (docs-site convention)

| Command                  | Effect                                                                                                |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| `npm run dev`            | Generate API markdown, then serve the site locally with live reload                                   |
| `npm run build`          | Generate API markdown, then build the static site to `.vitepress/dist/`                               |
| `npm run api`            | Regenerate only the API reference (`api/`, gitignored)                                                |
| `npm run build:versions` | Build every branch tracked by `versions.json` and assemble the multi-version tree into `<repo>/_site` |

## Content conventions

- `api/` is generated from TSDoc comments via typedoc +
  typedoc-plugin-markdown + typedoc-vitepress-theme; improve API docs by
  editing the TSDoc in the product source, not the output. `loadApiSidebar()`
  reads the generated sidebar. (File-structure sidebar derivation was
  evaluated in July 2026 and rejected: VitePress has no built-in for it, and
  a scanner — bespoke or the vitepress-sidebar package — costs more than
  the few sidebar lines it replaces.)
- GFM callouts (`> [!NOTE]` etc.) render GitHub-style out of the box.
- The `ds-docs-npm-readme` bin renders a guide page npm-ready: it prints the
  page with site-relative links absolutized against the given production
  site root (`.md` paths mapped to the published `.html` pages) and GFM
  alert markers downgraded to plain `> **Note**` blockquotes — npm renders
  neither. Product repos whose npm package should carry the full guide run
  it in their publish workflow just before `npm pack`:
  `ds-docs-npm-readme guide/index.md --site https://…/docs/web/ > README.md`.
  It is dependency-free, so it can also be run with plain `node` straight
  from a checkout of this repo.
- A docs `README.md` is excluded from the site (it documents the docs setup).
- Prose links into the API reference are handwritten and site-relative
  (`/api/…#anchor`, pointing at the typedoc-generated pages) so they stay
  correct inside versioned builds. VitePress fails the build on dead pages
  but does **not** check `#anchors`; no existing tool generates or validates
  such links from symbol names (evaluated July 2026 — bespoke tooling
  rejected). If anchor rot ever becomes a problem, `lychee
  --include-fragments` is an existing checker for markdown heading anchors.
- Single-sourcing pattern: a docs page can include a repository file via
  VitePress markdown inclusion, whole (e.g. a changelog page including the
  root `CHANGELOG.md`) or partially with `<!-- #region ... -->` markers.
  Includes fail **silently** — if the page renders empty, check the included
  file and markers still exist.

## Versioning model (branch-tracked, manifest-driven)

`versions.json` in the docs package designates exactly which branch is
tracked for which version, with which label:

```jsonc
{
	"versions": [
		{ "label": "1.5.0 (latest)", "path": "", "branch": "main" },
		{ "label": "1.4.2", "path": "v1.4/" },
	],
}
```

- `label` — text shown in the version switcher.
- `path` — URL subpath under `docsRoot`: `""` for the root/latest, otherwise
  with a trailing slash.
- `branch` — the git branch built for this version. Only branches containing
  the docs toolchain can be tracked; entries without a `branch` are listed in
  the switcher but not built (frozen copies that live only on the server).

The `ds-docs-build-versions` bin builds every branch-tracked entry in a
detached git worktree (created as a sibling of the repo root so `file:`
dependencies resolve) with its subpath as the base, and assembles the
results plus the manifest into one tree (default `<repo>/_site`), ready to
deploy as a whole. `defineDynamsoftConfig` serves the manifest at
`<base>versions.json` in dev and copies it into single builds via
`buildEnd`.

Note that `npm run dev` (and a plain `npm run build`) serves **only the
current checkout** at the docs root — other versions' subpaths exist only in
an assembled tree, so the switcher's other entries 404 in dev. To check
versions locally, run `npm run build:versions` and serve `_site` under the
`docsRoot` prefix.

## Deployment (fleet convention)

Docs sites deploy as static trees FTP-synced to the IIS server behind
www.dynamsoft.com. The conventional GitHub workflow (see mds-js's
`.github/workflows/docs.yml` for a working example):

- Push/PR runs build only the current checkout and upload the site as an
  artifact for verification — no deployment.
- Manual runs (`workflow_dispatch`) build every version designated in
  `versions.json` via `ds-docs-build-versions` and FTP-sync the assembled
  tree to the site's `docsRoot` — production, or the demo3 test site behind
  a "beta" input (separate FTP secrets pair).
- The FTP action's sync state only manages files it uploaded itself:
  pre-existing server content (e.g. frozen Jekyll-era version copies) is
  left untouched. Anything the site must own on the server — IIS
  `web.config` redirects, for instance — lives at the docs package root
  (`<docs>/web.config`), which the config factory copies into the built
  site at `buildEnd`, like the version manifest. `public/` is untracked
  scratch space by fleet convention, so deploy files never live there.

## Updating the corporate chrome

Chrome _styling_ assets (fonts, images) track upstream at runtime; chrome
_markup_ and the stylesheet cascade are vendored. Refresh with:

```shell
npm run sync-chrome   # re-vendor markup + styles; review and commit the diff
```

Reads a local Docs-Template-Repo checkout (`DOCS_TEMPLATE_REPO` env var or
`../documentation/Docs-Template-Repo`) via `git show`, falling back to GitHub
raw; webres stylesheets are fetched from www.dynamsoft.com.

### Design decision: vendored chrome with sync transforms

Three approaches were tried for the corporate chrome. Live-linking the
corporate stylesheets in a shadow root fails structurally (@font-face does
not register inside shadow trees; rem sizes assume the fleet's
`html{font-size:10px}`). Hand-written approximations were compact but could
not match the original look. The final mechanism vendors the real markup and
CSS and fixes both mismatches at sync time (rem→px, font retargeting),
giving a faithful, server-rendered chrome with deterministic builds.

## Publishing

The package is registry-ready: `npm pack` ships `src/` + the
`ds-docs-build-versions` bin, and a tarball install has been verified to
build a consuming site end to end (the config factory handles the
non-linked-install requirements: `ssr.noExternal` and
`optimizeDeps.exclude`). Publishing is: set `repository`/`license`,
`npm publish` to the chosen registry, then consumers replace the `file:`
link with a semver version — no other changes.

## TODO: switch to `vp doc` (Vite+ bundled VitePress)

Vite+ ships VitePress as `vp doc`
([vite-plus#121](https://github.com/voidzero-dev/vite-plus/issues/121)), but
the fleet-pinned `vite-plus 0.2.4` doesn't include the module yet
(`dist/vitepress/node/cli.js` missing). When a later vite-plus release ships
it, migrate:

1. Bump `vite-plus` in the product root, docs packages, and this repo
   together.
2. Replace `vitepress dev/build` with `vp doc dev/build` in docs scripts and
   drop the explicit `vitepress` devDependency.
3. **Smoke-test this theme first**: it imports bare
   `vitepress`/`vitepress/theme` as a peer — those must resolve to vp's
   bundled copy, or the site silently falls back to the default theme
   (dual-instance; see `resolve.dedupe` in the config factory).
4. Accept that the VitePress version then rides vite-plus releases instead
   of an explicit pin.

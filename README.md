# @dynamsoft-docs/vitepress-docs

Shared VitePress theme for Dynamsoft product documentation sites (based off
of the default VitePress theme).

1. **Corporate header/footer** — `scripts/sync-chrome.mts`. vendors theming by
	extracting from [Docs-Template-Repo](https://github.com/dynamsoft-docs/Docs-Template-Repo)
	and `www.dynamsoft.com`. The sync transforms make the cascade safe inside
	a VitePress page:
		1. url() absolutization (template assets resolve to GitHub raw)
		2. rem→px against the fleet's 10px root
		3. @font-face hoisting (font URLs
	retargeted to the shared webres copies — GitHub raw's max-age=300 plus the
	fleet's `font-display: optional` made fresh visits render in the UA serif;
	rewritten to `font-display: swap`)
		4. sans-serif fallbacks on the fleet's
	bare custom font stacks, and `@scope (.ds-corporate)` isolation
		5. a small shim in `CorporateHeader.vue` reproduces the corporate menu behaviour
	(click-toggled panels, Escape and outside-click close) since `layout.js`
	is not vendored
		6. the header scrolls away with the page while the VitePress
	nav bar docks at the viewport top
		7. both hosts carry `vp-raw`, which is how the VitePress router is kept
	from hijacking the corporate links: the docs are served from
	www.dynamsoft.com, so every one of them is same-origin, and an intercepted
	click renders this site's 404 at the corporate URL until the reader
	refreshes
		8. the remaining inert controls in the vendored markup are wired by the
	same shims (portal login carrying a return `callback`, corporate session,
	the signed-in account popup and its logout, back-to-top) or hidden
	(`.xsMenuToggle`, the header search icon), so no dead link ships
		9. known gap: the mobile hamburger menu is inert (hidden — VitePress
	has its own narrow-screen nav).
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
- **Google Tag Manager** — the fleet container, overridable via
	`themeConfig.gtm`, wired only when `dynamsoftChrome` is set. The stock
	loader snippet is a `head` entry; only the `noscript` half is a
	component, since a visitor without scripting cannot run an injector.
	VitePress routes on the client, so only the first page of a visit trips
	the container's All Pages trigger; in-site navigation needs an event the
	container listens for.
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
site's VitePress compiles it.

`src/config.mjs` and `src/typedoc.mjs` are deliberately not TypeScript: they
are the only files bare Node executes (VitePress externalizes bare specifiers
when loading a site's config; typedoc loads `typedoc.config.mjs` the same
way), and Node refuses to strip types inside `node_modules`, so a TypeScript
factory would work in a linked checkout and fail on every git-dependency
install. Their JSDoc is the source of the shipped declarations: `npm run
types` generates `types/`, committed so installs stay build-free and
CI-checked for staleness. Public types live in `src/types.ts`.

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
		// or file:../../vitepress-docs for theme development
		"@dynamsoft-docs/vitepress-docs": "git+https://github.com/dynamsoft-docs/vitepress-docs.git#semver:^0.1.0",
	},
}
```

`#semver:` resolves against the repo's version tags (`v0.1.0`) and
the consumer's lockfile pins the exact commit, so `npm ci` is
reproducible. npm packs the clone with the usual `files`/`bin` rules, and
the package ships source with no `prepare` script, so nothing builds at
install time.

```ts
// docs/.vitepress/theme/index.ts
import DynamsoftTheme from "@dynamsoft-docs/vitepress-docs";
export default DynamsoftTheme;
```

```ts
// docs/.vitepress/config.mts
import { defineDynamsoftConfig, loadApiSidebar } from "@dynamsoft-docs/vitepress-docs/config";

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

```jsonc
// docs/tsconfig.json — typechecking for the config/theme files
{
	"extends": "@dynamsoft-docs/vitepress-docs/tsconfig.base.json",
	"include": ["env.d.ts", ".vitepress/**/*.ts", ".vitepress/**/*.mts", ".vitepress/**/*.vue"],
}
```

```ts
// docs/typedoc.config.mjs — API reference generation
import { defineDynamsoftTypedoc } from "@dynamsoft-docs/vitepress-docs/typedoc";

// Fleet conventions: markdown + vitepress plugins, out: "api" wiped per
// run, no README page, private/internal excluded, plus the source-link
// revision below. Path-type options (out, docsRoot, basePath, tsconfig,
// entryPoints) resolve relative to the file DECLARING them, which is this
// one — so they stay here rather than in the theme.
export default defineDynamsoftTypedoc({
	name: "Your Product API Reference",
	repo: "Dynamsoft/your-product", // builds sourceLinkTemplate
	entryPoints: ["../src/index.ts"],
	tsconfig: "../tsconfig.json",
	out: "api",
	docsRoot: ".",
	basePath: "..",
});
```

Keep the config in a `.mjs` file: typedoc prefers a `typedoc.json` over a
`typedoc.config.mjs` in the same directory, so a leftover JSON config
silently wins.

### Source links and `gitRevision`

Typedoc takes line numbers from the working tree, then writes them into
links against whatever `gitRevision` names, and never checks that the two
are the same code. A hand-written revision that falls behind therefore
produces links that resolve fine and land in the wrong place — no 404, no
build error, nothing for a link checker to catch.

So `defineDynamsoftTypedoc` does not write one down. `versions.json`
already names the branch each version is built from, and that branch is
the source being documented: `ds-docs-build-versions` passes it as
`DOCS_BRANCH`, and a plain `npm run api` uses the checked-out branch.
Nothing has to be kept in step, so nothing can fall behind.

The branch must exist on the repository `repo` names — the public product
repo, not the internal one. `gitRevision` overrides all of this.

With a `sourceLinkTemplate` in play the factory also sets `disableGit` and
roots `displayBasePath` at the product: both values typedoc would go to
git for are already known, and left to find a repository itself it needs
`.git` to be a directory, finds none, and drops every source link without
saying so. Link `{path}` is rooted at `displayBasePath`, not `basePath` as
the option help claims.

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
typedoc-plugin-markdown + typedoc-vitepress-theme. VitePress has no built-in
for file-structure sidebar derivation .
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
deploy as a whole. Each build also gets its tracked branch as
`DOCS_BRANCH`, which is where its API reference points its source links
— so the manifest is the only place a version's branch is named. `defineDynamsoftConfig` serves the manifest at
`<base>versions.json` in dev and copies it into single builds via
`buildEnd`.

`npm run dev` serves the **current checkout live** at the docs root and the
**other versions statically** from the assembled tree at `<repo>/_site`, so
the version switcher works in dev — run `npm run build:versions` once to
assemble it first to serve it with `npm run dev`.

## Deployment (fleet convention)

Docs sites deploy as static trees FTP-synced to the IIS server behind
www.dynamsoft.com. The build/deploy job is owned by this repo's reusable
workflow, `.github/workflows/docs-site.yml`; each product repo keeps a thin
caller owning its triggers (see mds-js's `.github/workflows/docs.yml` for a
working example):

```yaml
jobs:
  docs:
    uses: dynamsoft-docs/vitepress-docs/.github/workflows/docs-site.yml@main
    with:
      deploy: ${{ github.event_name == 'workflow_dispatch' }}
      beta: ${{ inputs.beta || false }}
      server-dir: /www.dynamsoft.com/<product>/docs/web/
    # Explicit, not `secrets: inherit`: inherited secrets do not cross
    # organization boundaries, and product repos live outside
    # dynamsoft-docs — inherit silently passes nothing.
    secrets:
      FTP_DYNAMSOFT_LOCAL_SERVER: ${{ secrets.FTP_DYNAMSOFT_LOCAL_SERVER }}
      FTP_DYNAMSOFT_LOCAL_USER: ${{ secrets.FTP_DYNAMSOFT_LOCAL_USER }}
      FTP_DYNAMSOFT_LOCAL_PASSWORD: ${{ secrets.FTP_DYNAMSOFT_LOCAL_PASSWORD }}
      FTP_TEST_SITE_SERVER: ${{ secrets.FTP_TEST_SITE_SERVER }}
      FTP_TEST_SITE_USER: ${{ secrets.FTP_TEST_SITE_USER }}
      FTP_TEST_SITE_PASSWORD: ${{ secrets.FTP_TEST_SITE_PASSWORD }}
      FTP_TEST_SITE_PORT: ${{ secrets.FTP_TEST_SITE_PORT }}
```

- Without `deploy`, the job builds only the current checkout (push/PR
  verification) and uploads the site as an artifact — no deployment.
- With `deploy` (conventionally `workflow_dispatch`), it builds every
	version designated in `versions.json` via `ds-docs-build-versions` and
	FTP-syncs the assembled tree to `server-dir` — production, or the demo3
	test site behind the "beta" input (separate FTP secrets pair; both pairs
	are passed explicitly by the caller, declared under
	`on.workflow_call.secrets`).
- `uses:` takes an exact ref — no `#semver:` ranges like the npm
	dependency — so callers ride `@main`, or pin a release tag at the cost
	of a second version to bump.
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

Fetches Docs-Template-Repo from GitHub raw on `main` (`DOCS_TEMPLATE_BRANCH`
overrides the branch); set `DOCS_TEMPLATE_REPO` to a local checkout to read
via `git show` instead (offline/pre-push work). webres stylesheets are
fetched from www.dynamsoft.com.

## Publishing

Releases are git tags on this public repository; consumers depend on it
directly as a git dep (Setting up a docs site), so no registry is
involved and installs need no auth. Publishing a version is: bump
`version` in package.json, commit, tag `vX.Y.Z`, push the tag. Git deps
are packed from the clone with normal `npm pack` semantics, and a tarball
install has been verified to build a consuming site end to end (the
config factory handles the non-linked-install requirements:
`ssr.noExternal` and `optimizeDeps.exclude`).

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

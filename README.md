# dynamsoft-vitepress-theme

Shared VitePress theme for Dynamsoft product documentation sites. Extends the
default VitePress theme with:

- **Corporate header/footer** — the real markup from
  [Docs-Template-Repo](https://github.com/dynamsoft-docs/Docs-Template-Repo)
  plus the fleet's full stylesheet cascade, vendored by
  `scripts/sync-chrome.mjs`. The sync transforms make the cascade safe inside
  a VitePress page: url() absolutization (template assets resolve to GitHub
  raw), rem→px against the fleet's 10px root, @font-face hoisting, and
  `@scope (.ds-corporate)` isolation. A small shim in `CorporateHeader.vue`
  reproduces the corporate menu behaviour (click-toggled panels, Escape and
  outside-click close) since `layout.js` is not vendored; the header scrolls
  away with the page while the VitePress nav bar docks at the viewport top.
  Known gaps: the mobile hamburger menu is inert, and the signed-in account
  widget shows its logged-out state.
- **Doc skin** — `styles/doc-skin.css` styles the article body like the
  original Jekyll docs (GitHub-markdown look in OpenSans: 16px/26px `#24292e`
  text, `#0366d6` links, bordered GFM tables, `#f5f5f5` code blocks, GitHub
  alert palette). Light palette only — disable dark mode in the consuming
  site (`appearance: false`).
- **Breadcrumbs** — path-derived trail above each article ending in the page
  title; directory labels overridable via `breadcrumbLabels`.
- **Version switcher** — a nav-bar dropdown driven by a `versions.json`
  served from the product's docs root; hides itself while only one version is
  listed.
- **Brand accents** — Dynamsoft orange for nav/sidebar highlights.

The package ships TypeScript/Vue source (no build step); the consumer's
VitePress compiles it.

## Usage

```jsonc
// docs/package.json
"devDependencies": {
	"dynamsoft-vitepress-theme": "file:../../dynamsoft-vitepress-theme" // or a published version
}
```

```ts
// docs/.vitepress/theme/index.ts
import DynamsoftTheme from "dynamsoft-vitepress-theme";
export default DynamsoftTheme;
```

```ts
// docs/.vitepress/config.mts
import { defineConfigWithTheme } from "vitepress";
import type { DynamsoftThemeConfig } from "dynamsoft-vitepress-theme";

export default defineConfigWithTheme<DynamsoftThemeConfig>({
	appearance: false, // doc skin is light-only
	vite: {
		// Force single vue/vitepress instances (required for file:/linked
		// installs; harmless otherwise).
		resolve: { dedupe: ["vue", "vitepress"] },
		// Required when installed from a registry (source package must be
		// bundled, not externalized, during SSR).
		ssr: { noExternal: ["dynamsoft-vitepress-theme"] },
	},
	themeConfig: {
		docsRoot: "/your-product/docs/web/",
		dynamsoftChrome: true,
		downloadUrl: "https://www.dynamsoft.com/your-product/downloads/",
		breadcrumbLabels: { api: "API Reference", guide: "User Guide" },
		// ...default-theme options
	},
});
```

## Design decision: vendored chrome with sync transforms

Three approaches were tried for the corporate chrome. Live-linking the
corporate stylesheets in a shadow root fails structurally (@font-face does
not register inside shadow trees; rem sizes assume the fleet's
`html{font-size:10px}`). Hand-written approximations were compact but could
not match the original look. The final mechanism vendors the real markup and
CSS and fixes both mismatches at sync time (rem→px, font hoisting), giving a
faithful, server-rendered chrome with deterministic builds. Refresh with:

```shell
npm run sync-chrome   # re-vendor markup + styles; review and commit the diff
```

Reads a local Docs-Template-Repo checkout (`DOCS_TEMPLATE_REPO` env var or
`../documentation/Docs-Template-Repo`) via `git show`, falling back to GitHub
raw; webres stylesheets are fetched from www.dynamsoft.com.

## Status

Temporary home as a sibling directory of consuming repos, consumed via a
`file:` dependency. To be published to GitHub and/or an npm registry once
stabilized; consumers then switch to a pinned semver version.

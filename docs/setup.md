# Setting up a docs site

```jsonc
// docs/package.json
{
	"scripts": {
		"api": "typedoc",
		"dev": "vp run api && vitepress dev",
		"build": "vp run api && vitepress build",
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
the consumer's lockfile pins the exact commit, so
`vp install --frozen-lockfile` is reproducible. The package manager packs
the clone with the usual `files`/`bin` rules, and the package ships source
with no `prepare` script, so nothing builds at install time.

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

## Source links and `gitRevision`

Typedoc takes line numbers from the working tree, then writes them into
links against whatever `gitRevision` names, and never checks that the two
are the same code. A hand-written revision that falls behind therefore
produces links that resolve fine and land in the wrong place — no 404, no
build error, nothing for a link checker to catch.

So `defineDynamsoftTypedoc` does not write one down. `versions.json`
already names the branch each version is built from, and that branch is
the source being documented: `ds-docs-build-versions` passes it as
`DOCS_BRANCH`, and a plain `vp run api` uses the checked-out branch.
Nothing has to be kept in step, so nothing can fall behind.

The branch must exist on the repository `repo` names — the public product
repo, not the internal one. `gitRevision` overrides all of this.

With a `sourceLinkTemplate` in play the factory also sets `disableGit` and
roots `displayBasePath` at the product: both values typedoc would go to
git for are already known, and left to find a repository itself it needs
`.git` to be a directory, finds none, and drops every source link without
saying so. Link `{path}` is rooted at `displayBasePath`, not `basePath` as
the option help claims.

Install with `vp install` in the docs package (and in the repo root — the
API reference is generated from the product's TypeScript source, which
resolves types from the root `node_modules`). While this theme is consumed
via a `file:` link, also run `pnpm install` in this checkout: Node and Vite
resolve imports from the real path, so the theme's own dependencies must be
present in this package's `node_modules`, not just the consumer's.

## Commands

| Command                 | Effect                                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| `vp run dev`            | Generate API markdown, then serve the site locally with live reload                                   |
| `vp run build`          | Generate API markdown, then build the static site to `.vitepress/dist/`                               |
| `vp run api`            | Regenerate only the API reference (`api/`, gitignored)                                                |
| `vp run build:versions` | Build every branch tracked by `versions.json` and assemble the multi-version tree into `<repo>/_site` |

## Content conventions

- `api/` is generated from TSDoc comments via typedoc +
	typedoc-plugin-markdown + typedoc-vitepress-theme. VitePress has no built-in
	for file-structure sidebar derivation. `loadApiSidebar` marks the camelCase
	boundaries in the entry names with `<wbr>`: a name like
	`DocumentCorrectionViewToolbarButtonsConfig` is one unbreakable word wider
	than the sidebar column, and the CSS fallback for that breaks it mid-word.
	The default theme renders sidebar and prev/next labels as HTML, and `<wbr>`
	leaves nothing behind in copied text.
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

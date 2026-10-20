# Set up a docs site

This page explains how to add the theme to the docs package of a product. The docs package is the directory `docs/` in these examples.

## Add the package

Add the package as a git dependency, and add the scripts of a docs site:

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

The range `#semver:` matches the version tags of the repository, such as `v0.1.0`. The lockfile of the docs package pins the exact commit. Thus `vp install --frozen-lockfile` gives the same result each time.

The package manager packs the clone with the usual `files` and `bin` rules. The package ships source and has no `prepare` script, so nothing builds at install time.

## Add the theme and the config

Export the theme from the theme entry:

```ts
// docs/.vitepress/theme/index.ts
import DynamsoftTheme from "@dynamsoft-docs/vitepress-docs";
export default DynamsoftTheme;
```

Wrap the VitePress config of the site with `defineDynamsoftConfig`:

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

Use this `tsconfig.json` to check the types of the config and theme files:

```jsonc
// docs/tsconfig.json
{
	"extends": "@dynamsoft-docs/vitepress-docs/tsconfig.base.json",
	"include": ["env.d.ts", ".vitepress/**/*.ts", ".vitepress/**/*.mts", ".vitepress/**/*.vue"],
}
```

## Generate the API reference

Configure typedoc with `defineDynamsoftTypedoc`:

```ts
// docs/typedoc.config.mjs
import { defineDynamsoftTypedoc } from "@dynamsoft-docs/vitepress-docs/typedoc";

// Fleet conventions: markdown + vitepress plugins, out: "api" wiped per
// run, no README page, private/internal excluded, plus the source-link
// revision below. Path-type options (out, docsRoot, basePath, tsconfig,
// entryPoints) resolve relative to the file DECLARING them, which is this
// one, so they stay here and not in the theme.
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

Keep this config in a `.mjs` file. Typedoc prefers a `typedoc.json` over a `typedoc.config.mjs` in the same directory. Thus a leftover JSON config silently wins.

Run `vp install` in the docs package and in the root of the repository. The API reference comes from the TypeScript source of the product, and that source resolves its types from the root `node_modules`.

## Source links and `gitRevision`

Typedoc takes line numbers from the working tree. It writes them into links against the revision that `gitRevision` names. It never checks that the two are the same code. Thus a hand-written revision that falls behind gives links that resolve but land in the wrong place. The build shows no error, and a link checker finds nothing.

`defineDynamsoftTypedoc` does not write a revision. The version manifest already names the branch of each version, and that branch is the documented source. The version builder passes the branch as `DOCS_BRANCH`. A plain `vp run api` uses the checked-out branch. Nothing needs a manual update, so nothing falls behind.

The option `repo` names the public product repository. The branch must exist there. The internal repository does not count. The option `gitRevision` overrides all of this.

When a `sourceLinkTemplate` exists, the factory also sets `disableGit` and roots `displayBasePath` at the product. Typedoc would otherwise search git for both values, and the factory already knows them. Typedoc needs `.git` to be a directory. Where it finds none, it drops every source link without a warning. The link placeholder `{path}` is rooted at `displayBasePath`. The help text of the option says `basePath`, and that text is wrong.

## Develop the theme with a `file:` link

When a docs package uses this theme through a `file:` link, also run `pnpm install` in the checkout of this package. Node and Vite resolve imports from the real path. Thus the dependencies of the theme must be in the `node_modules` of this package, and the `node_modules` of the docs package is not enough.

## Commands

Each docs package has these scripts:

| Command                 | Effect                                                                                 |
| ----------------------- | -------------------------------------------------------------------------------------- |
| `vp run dev`            | Generates the API markdown, then serves the site locally with live reload.             |
| `vp run build`          | Generates the API markdown, then builds the static site to `.vitepress/dist/`.         |
| `vp run api`            | Generates only the API reference in `api/`. Git ignores this directory.                |
| `vp run build:versions` | Builds every tracked version and assembles the multi-version tree into `<repo>/_site`. |

## Content conventions

### The API sidebar

Typedoc, `typedoc-plugin-markdown`, and `typedoc-vitepress-theme` generate `api/` from the TSDoc comments. VitePress has no built-in way to derive a sidebar from a file structure, so `loadApiSidebar` builds it.

`loadApiSidebar` marks the camelCase boundaries in the entry names with `<wbr>`. A name such as `DocumentCorrectionViewToolbarButtonsConfig` is one unbreakable word. It is wider than the sidebar column, and the CSS fallback breaks it in the middle of a word. The default theme renders the sidebar labels and the previous and next labels as HTML. The `<wbr>` tag leaves nothing in copied text.

### Other conventions

- GitHub-style callouts (`> [!NOTE]` and the like) render without more setup.
- A `README.md` in the docs package is not part of the site. It documents the setup of the docs package.
- A docs page can include a repository file with VitePress markdown inclusion. The page includes the whole file, for example the root `CHANGELOG.md`. It can also include a part of the file between `<!-- #region ... -->` markers. An include that fails shows no error. If the page renders empty, check that the file and the markers exist.

### Markdown for npm

The `ds-docs-npm-readme` command renders a guide page for npm. It does two things:

1. It makes the site-relative links absolute, against the production site root that the caller gives. It maps `.md` paths to the published `.html` pages.
2. It changes the GitHub alert markers to plain `> **Note**` blockquotes, because npm renders neither links nor alerts of that kind.

Some product repositories ship the full guide in their npm package. Such a repository runs the command in its publish workflow, just before `npm pack`:

```shell
ds-docs-npm-readme guide/index.md --site https://…/docs/web/ > README.md
```

The command has no dependencies. Thus you can also run it with plain `node` from a checkout of this repository.

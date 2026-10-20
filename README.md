# @dynamsoft-docs/vitepress-docs

The shared VitePress theme and toolkit for Dynamsoft product documentation
sites. The theme extends the default VitePress theme.

The package provides these parts:

- The corporate header and footer, the breadcrumbs, the version switcher, and
	the doc skin.
- `defineDynamsoftConfig`, the config factory with the fleet defaults, and
	`defineDynamsoftTypedoc`, the factory for the API reference.
- The `ds-docs-build-versions` bin, which builds every version of a site.
- Every page as markdown for agents, with `llms.txt` and `llms-full.txt`.
- A reusable GitHub workflow that builds a docs site and deploys it by FTP.

The package ships TypeScript and Vue source with no build step. The VitePress
build of the consuming site compiles it.

## Install

Add the package as a git dependency of the docs package of the site:

```jsonc
// docs/package.json
{
	"devDependencies": {
		"@dynamsoft-docs/vitepress-docs": "git+https://github.com/dynamsoft-docs/vitepress-docs.git#semver:^0.1.0",
	},
}
```

Then use the theme and the config factory:

```ts
// docs/.vitepress/theme/index.ts
import DynamsoftTheme from "@dynamsoft-docs/vitepress-docs";
export default DynamsoftTheme;
```

```ts
// docs/.vitepress/config.mts
import { defineDynamsoftConfig } from "@dynamsoft-docs/vitepress-docs/config";

export default defineDynamsoftConfig({
	title: "Your Product",
	themeConfig: { docsRoot: "/your-product/docs/web/", dynamsoftChrome: true },
});
```

## Documentation

- [Setting up a docs site](docs/setup.md): scripts, the API reference, source
	links, and the commands of a docs site.
- [Features](docs/features.md): what the theme adds to VitePress.
- [Corporate chrome](docs/corporate-chrome.md): how the header and footer are
	vendored, and how to update them.
- [Markdown for agents](docs/markdown-for-agents.md): the markdown twin of
	every page.
- [Versioning](docs/versioning.md): the version manifest and the multi-version
	build.
- [Deployment](docs/deployment.md): the reusable workflow, the FTP sync, and
	nested sites.
- [Search indexing](docs/search-indexing.md): the sitemap.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The issues of the project are in
git-bug, inside the repository.

## Licence

The package is proprietary. The `license` field of `package.json` is
`UNLICENSED`.

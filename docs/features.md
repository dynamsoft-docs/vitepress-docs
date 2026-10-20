# Features

The corporate header, the footer, the chat, and the tag manager need `themeConfig.dynamsoftChrome`. For the corporate chrome, see [corporate-chrome.md](corporate-chrome.md).

## Page features

- **Corporate header and footer.** The theme vendors the header and the footer of www.dynamsoft.com.
- **Markdown twins.** Every page has a markdown twin next to its HTML. The files `llms.txt` and `llms-full.txt` are at the site root. See [markdown-for-agents.md](markdown-for-agents.md).
- **Doc skin.** The file `styles/doc-skin.css` styles the article body like the original Jekyll docs. The look is GitHub markdown in Open Sans. Body text is 16px with a 26px line height and the colour `#24292e`. Links use `#0366d6`. Tables have borders. Code blocks use `#f5f5f5`. A dark-mode palette falls back to the VitePress colours.
- **Breadcrumbs.** A trail in the nav bar replaces the site title. It ends with the page title. A site can override the directory labels with `breadcrumbLabels`.
- **Version switcher.** A dropdown in the sidebar shows the versions of the version manifest. See [versioning.md](versioning.md).
- **Comm100 live chat.** The theme sets the site and plan of the fleet. A site can override them with `themeConfig.comm100`.
- **Brand accents.** Dynamsoft orange marks the highlights of the nav bar and the sidebar.

## Google Tag Manager

The theme loads the container of the fleet. A site can override it with `themeConfig.gtm`. The theme wires the container only when `dynamsoftChrome` is set.

The stock loader snippet is a `head` entry. Only the `noscript` half is a component, because a visitor without scripting cannot run an injector.

VitePress routes on the client. Thus only the first page of a visit trips the All Pages trigger of the container. Navigation inside the site needs an event that the container listens for.

## Config defaults

`defineDynamsoftConfig` is the `./config` export. It wraps the VitePress config of a site with the defaults of the fleet:

- The `base` follows from `themeConfig.docsRoot` and the environment variable `DOCS_VERSION`.
- GitHub-style alerts (`> [!NOTE]` and the like) work through `markdown-it-github-alerts`. The factory wires the plugin, and the theme entry imports its styles.
- The factory serves and publishes the version manifest.
- Search is local full-text search. It does not use Algolia.
- The factory sets the conventions of the nav banner.
- The factory dedupes `vue` and `vitepress`.
- The factory bundles this theme with `ssr.noExternal` and `optimizeDeps.exclude`.

The site config that the factory wraps can override every setting.

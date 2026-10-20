# Features

The corporate header, footer, chat, and tag manager need
`themeConfig.dynamsoftChrome`. For the corporate chrome, see
[corporate-chrome.md](corporate-chrome.md). For the page markdown, see
[markdown-for-agents.md](markdown-for-agents.md).

- **Doc skin** — `styles/doc-skin.css` styles the article body like the
	original Jekyll docs (GitHub-markdown look in OpenSans: 16px/26px `#24292e`
	text, `#0366d6` links, bordered GFM tables, `#f5f5f5` code blocks), with a
	dark-mode palette falling back to VitePress colours.
- **Breadcrumbs** — nav-bar trail replacing the site title, ending in the
	page title; directory labels overridable via `breadcrumbLabels`.
- **Version switcher** — a sidebar dropdown driven by the version manifest
	(see [versioning.md](versioning.md)).
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

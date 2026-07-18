// Node-side config entry: loaded by VitePress's config bundler, so it must
// stay plain JavaScript (Node does not type-strip inside node_modules) and
// must not import the client theme entry (.vue/.css). Types in config.d.ts.
import { cpSync, existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { searchForWorkspaceRoot } from "vite";
import MarkdownItGitHubAlerts from "markdown-it-github-alerts";

const themeRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The committed version manifest (versions.json in the site root); the
 * served copy is generated (dev middleware / buildEnd / build-versions bin).
 * @param {string} root
 */
const manifestIn = (root) => resolve(root, "versions.json");

/**
 * Serve the manifest at <base>versions.json during dev (the version
 * switcher fetches it from the docs root). Builds get it via buildEnd.
 * @param {string} base
 * @returns {import("vite").Plugin}
 */
const versionManifestPlugin = (base) => ({
	name: "ds-version-manifest",
	configureServer(server) {
		server.middlewares.use((req, res, next) => {
			const manifest = manifestIn(server.config.root);
			if (req.url?.split("?")[0] === `${base}versions.json` && existsSync(manifest)) {
				res.setHeader("Content-Type", "application/json");
				res.end(readFileSync(manifest));
			} else {
				next();
			}
		});
	},
});

/**
 * Wrap a docs site's VitePress config with the fleet-wide Dynamsoft
 * defaults; site-provided values extend or override them.
 *
 * - `base` derives from `themeConfig.docsRoot`, with the `DOCS_VERSION`
 *   environment variable (e.g. "v1.5") selecting a version subpath — the
 *   branch-tracked versioning model shared by the Dynamsoft VitePress sites
 *   (built by the ds-docs-build-versions bin). An explicit `base` wins.
 * - GFM alerts (`> [!NOTE]` etc.) render GitHub-style: the built-in
 *   container-style rendering is disabled so markdown-it-github-alerts
 *   receives the blockquotes. The matching styles ship with the theme entry.
 *   A site-provided `markdown.config` still runs, after the plugin.
 * - Nav-bar banner conventions: the title column is replaced by breadcrumbs
 *   (`siteTitle: false`), outline depth 2–3, external-link icons on.
 * - `README.md` inside the docs dir is excluded from the site (it documents
 *   the docs setup itself).
 * - The dev server may read this theme's checkout (file:-linked installs
 *   resolve imports from the real path, outside the site root).
 * - vue/vitepress are deduped and the theme is added to `ssr.noExternal`:
 *   the theme ships TypeScript/Vue source, so its peer imports must resolve
 *   to the site's single instances (vital for file:/linked installs) and it
 *   must be bundled, not externalized, when installed from a registry.
 * - Search defaults to the offline local index (the fleet's VitePress sites
 *   do not use Algolia).
 * - A sitemap is generated for www.dynamsoft.com and the corporate favicon
 *   is set; a site-provided `sitemap` wins, site `head` entries append.
 *
 * @param {import("vitepress").UserConfig<import("./index.js").DynamsoftThemeConfig>} config
 * @returns {import("vitepress").UserConfig<import("./index.js").DynamsoftThemeConfig>}
 */
export function defineDynamsoftConfig(config) {
	const version = process.env.DOCS_VERSION?.replace(/^\/+|\/+$/g, "") ?? "";
	const docsRoot = config.themeConfig?.docsRoot ?? "/";
	const base = config.base ?? (version ? `${docsRoot}${version}/` : docsRoot);
	const siteMarkdownConfig = config.markdown?.config;
	const siteNoExternal = config.vite?.ssr?.noExternal;
	return {
		lastUpdated: true,
		// The sitemap hostname must carry the base path; versioned copies are
		// left out of search indexes, like the fleet's Jekyll sitemaps.
		...(version ? {} : { sitemap: { hostname: new URL(base, "https://www.dynamsoft.com").href } }),
		...config,
		base,
		head: [
			["link", { rel: "icon", href: "https://www.dynamsoft.com/favicon.ico" }],
			...(config.head ?? []),
		],
		async buildEnd(siteConfig) {
			// Publish the committed manifest into the built site so the version
			// switcher (which fetches <docsRoot>versions.json) finds it. The
			// site's server config (IIS web.config) ships the same way: deploy
			// files live at the docs package root — public/ is conventionally
			// untracked scratch space in the fleet.
			for (const file of ["versions.json", "web.config"]) {
				const src = resolve(siteConfig.root, file);
				if (existsSync(src)) cpSync(src, join(siteConfig.outDir, file));
			}
			await config.buildEnd?.(siteConfig);
		},
		srcExclude: [...new Set(["README.md", ...(config.srcExclude ?? [])])],
		themeConfig: {
			search: { provider: "local" },
			siteTitle: false,
			outline: [2, 3],
			externalLinkIcon: true,
			...config.themeConfig,
		},
		markdown: {
			gfmAlerts: false,
			...config.markdown,
			config(md) {
				md.use(MarkdownItGitHubAlerts);
				siteMarkdownConfig?.(md);
			},
		},
		vite: {
			...config.vite,
			plugins: [...(config.vite?.plugins ?? []), versionManifestPlugin(base)],
			server: {
				...config.vite?.server,
				fs: {
					...config.vite?.server?.fs,
					allow: [
						searchForWorkspaceRoot(process.cwd()),
						themeRoot,
						...(config.vite?.server?.fs?.allow ?? []),
					],
				},
			},
			resolve: {
				...config.vite?.resolve,
				dedupe: [...new Set(["vue", "vitepress", ...(config.vite?.resolve?.dedupe ?? [])])],
			},
			optimizeDeps: {
				...config.vite?.optimizeDeps,
				// The dep optimizer cannot pre-bundle this package's .vue source.
				// Linked (file:) installs are excluded automatically; registry
				// installs need it explicit.
				exclude: [
					...new Set(["@dynamsoft/vitepress-docs", ...(config.vite?.optimizeDeps?.exclude ?? [])]),
				],
			},
			ssr: {
				...config.vite?.ssr,
				noExternal:
					siteNoExternal === true
						? true
						: [
								"@dynamsoft/vitepress-docs",
								...(Array.isArray(siteNoExternal)
									? siteNoExternal
									: siteNoExternal
										? [siteNoExternal]
										: []),
							],
			},
		},
	};
}

/**
 * Load the sidebar generated by typedoc-vitepress-theme for the fleet's
 * `api/` convention; empty before the first API-reference generation.
 *
 * @param {string} [docsDir] docs package directory (defaults to the cwd,
 *   which is where VitePress runs config from)
 * @returns {import("vitepress").DefaultTheme.SidebarItem[]}
 */
export function loadApiSidebar(docsDir = process.cwd()) {
	const file = resolve(docsDir, "api/typedoc-sidebar.json");
	return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : [];
}

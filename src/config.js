// Node-side config entry: loaded by VitePress's config bundler, so it must
// stay plain JavaScript (Node does not type-strip inside node_modules) and
// must not import the client theme entry (.vue/.css). Types in config.d.ts.
import { cpSync, existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { searchForWorkspaceRoot } from "vite";
import MarkdownItGitHubAlerts from "markdown-it-github-alerts";

const themeRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** The committed version manifest (docs/versions.json); public/ stays generated. */
const manifestPath = () => resolve(process.cwd(), "versions.json");

/** Serve the manifest at <base>versions.json during dev (the version
 *  switcher fetches it from the docs root). Builds get it via buildEnd. */
const versionManifestPlugin = (base) => ({
	name: "ds-version-manifest",
	configureServer(server) {
		server.middlewares.use((req, res, next) => {
			if (req.url?.split("?")[0] === `${base}versions.json` && existsSync(manifestPath())) {
				res.setHeader("Content-Type", "application/json");
				res.end(readFileSync(manifestPath()));
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
		...config,
		base,
		async buildEnd(siteConfig) {
			// Publish the committed manifest into the built site so the version
			// switcher (which fetches <docsRoot>versions.json) finds it.
			if (existsSync(manifestPath())) {
				cpSync(manifestPath(), join(siteConfig.outDir, "versions.json"));
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
					...new Set(["dynamsoft-vitepress-theme", ...(config.vite?.optimizeDeps?.exclude ?? [])]),
				],
			},
			ssr: {
				...config.vite?.ssr,
				noExternal:
					siteNoExternal === true
						? true
						: [
								"dynamsoft-vitepress-theme",
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

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { searchForWorkspaceRoot } from "vite";
import MarkdownItGitHubAlerts from "markdown-it-github-alerts";

const themeRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Where the fleet's docs are published; sitemap and llms.txt URLs need it. */
const SITE_ORIGIN = "https://www.dynamsoft.com";

/**
 * The committed version manifest (versions.json in the site root); the
 * served copy is generated (dev middleware / buildEnd / build-versions bin).
 * @param {string} root
 */
const manifestIn = (root) => resolve(root, "versions.json");

/** Content types for serving the assembled version tree in dev. */
const MIME = /** @type {Record<string, string>} */ ({
	".html": "text/html",
	".js": "text/javascript",
	".css": "text/css",
	".json": "application/json",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".webp": "image/webp",
	".ico": "image/x-icon",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".ttf": "font/ttf",
	".xml": "application/xml",
	".txt": "text/plain",
});

/**
 * Dev-server support for the versioning model:
 * - serves the manifest at <docsRoot>versions.json (the version switcher
 *   fetches it from the docs root; builds get it via buildEnd instead);
 * - serves other versions' subpaths from the assembled tree that
 *   `ds-docs-build-versions` leaves at <repo>/_site, so the switcher works
 *   in dev — latest stays live, frozen versions are static. Versions not
 *   built yet get a 404 explaining how to build them.
 * @param {string} base current base (the live site)
 * @param {string} docsRoot root of the deployed docs (versioned bases hang off it)
 * @returns {import("vite").Plugin}
 */
const versionsPlugin = (base, docsRoot) => ({
	name: "ds-versions",
	apply: "serve",
	configureServer(server) {
		const root = server.config.root;
		/** `ds-docs-build-versions` assembles into the repository root. */
		const siteTree = (() => {
			try {
				return join(
					execFileSync("git", ["rev-parse", "--show-toplevel"], {
						cwd: root,
						encoding: "utf8",
					}).trim(),
					"_site",
				);
			} catch {
				return resolve(root, "../_site");
			}
		})();

		server.middlewares.use((req, res, next) => {
			const url = req.url?.split("?")[0] ?? "";
			const manifest = manifestIn(root);
			if (!existsSync(manifest)) return next();

			if (url === `${base}versions.json`) {
				res.setHeader("Content-Type", "application/json");
				return res.end(readFileSync(manifest));
			}

			// A versioned subpath other than the live site?
			/** @type {{ versions?: { path: string }[] }} */
			const { versions = [] } = JSON.parse(readFileSync(manifest, "utf8"));
			const hit = versions.find(
				(v) => v.path && `${docsRoot}${v.path}` !== base && url.startsWith(`${docsRoot}${v.path}`),
			);
			if (!hit) return next();

			let file = resolve(siteTree, url.slice(docsRoot.length));
			if (!file.startsWith(siteTree + sep)) return next();
			if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
			if (!existsSync(file)) {
				res.statusCode = 404;
				res.setHeader("Content-Type", "text/plain");
				return res.end(
					`${url} is not in the assembled version tree (${siteTree}).\n` +
						"Run `npm run build:versions` to build the versions designated in versions.json.\n",
				);
			}
			res.setHeader("Content-Type", MIME[extname(file)] ?? "application/octet-stream");
			return res.end(readFileSync(file));
		});
	},
});

/**
 * Wrap a docs site's VitePress config with the fleet-wide Dynamsoft
 * defaults; site-provided values extend or override them.
 *
 * - The dev server may read this theme's checkout (file:-linked installs
 *   resolve imports from the real path, outside the site root) and binds
 *   all interfaces (fleet docs dev happens in containers behind proxied
 *   interfaces).
 * - vue/vitepress are deduped and the theme is added to `ssr.noExternal`:
 *   the theme ships TypeScript/Vue source, so its peer imports must resolve
 *   to the site's single instances (vital for file:/linked installs) and it
 *   must be bundled, not externalized, when installed from a registry.
 * - A sitemap is generated for www.dynamsoft.com and the corporate favicon
 *   is set; a site-provided `sitemap` wins, site `head` entries append.
 *
 * @param {import("vitepress").UserConfig<import("./types.js").DynamsoftThemeConfig>} config
 * @returns {import("vitepress").UserConfig<import("./types.js").DynamsoftThemeConfig>}
 */
export function defineDynamsoftConfig(config) {
	const version = process.env.DOCS_VERSION?.replace(/^\/+|\/+$/g, "") ?? "";
	const docsRoot = config.themeConfig?.docsRoot ?? "/";
	const base = config.base ?? (version ? `${docsRoot}${version}/` : docsRoot);
	const siteUrl = new URL(base, SITE_ORIGIN).href;
	const siteMarkdownConfig = config.markdown?.config;
	const siteNoExternal = config.vite?.ssr?.noExternal;
	// Google Tag Manager
	const gtm = config.themeConfig?.dynamsoftChrome
		? (config.themeConfig.gtm ?? "GTM-538F83")
		: undefined;
	return {
		lastUpdated: true,
		// The sitemap hostname must carry the base path — a sitemap covers the
		// URLs at or below its own location, and the fleet's robots.txt is
		// corporate-owned. Versioned copies are left out of search indexes.
		...(version ? {} : { sitemap: { hostname: siteUrl } }),
		...config,
		base,
		head: [
			["link", { rel: "icon", href: "https://www.dynamsoft.com/favicon.ico" }],
			...(gtm
				? /** @type {import("vitepress").HeadConfig[]} */ ([
						[
							"script",
							{},
							"(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime()," +
								"event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s)," +
								"dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=" +
								"'https://www.googletagmanager.com/gtm.js?id='+i+dl;" +
								`f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtm}');`,
						],
					])
				: []),
			...(config.head ?? []),
		],
		async buildEnd(siteConfig) {
			// Publish the committed manifest into the built site so the version
			// switcher (which fetches <docsRoot>versions.json) finds it.
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
			docsRoot,
			dynamsoftChrome: config.themeConfig?.dynamsoftChrome ?? false,
			...(gtm ? { gtm } : {}),
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
			plugins: [...(config.vite?.plugins ?? []), versionsPlugin(base, docsRoot)],
			server: {
				// Fleet docs dev runs in containers behind proxied interfaces;
				// bind all interfaces by default. A site-provided host wins.
				host: true,
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
					...new Set([
						"@dynamsoft-docs/vitepress-docs",
						...(config.vite?.optimizeDeps?.exclude ?? []),
					]),
				],
			},
			ssr: {
				...config.vite?.ssr,
				noExternal:
					siteNoExternal === true
						? true
						: [
								"@dynamsoft-docs/vitepress-docs",
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
 * Load API references into the side bar instead of in the header like the default.
 *
 * @param {string} [docsDir] docs package directory (defaults to the cwd,
 *   which is where VitePress runs config from)
 * @returns {import("vitepress").DefaultTheme.SidebarItem[]}
 */
export function loadApiSidebar(docsDir = process.cwd()) {
	const file = resolve(docsDir, "api/typedoc-sidebar.json");
	return existsSync(file) ? breakCamelCase(JSON.parse(readFileSync(file, "utf8"))) : [];
}

/** camelCase and ACRONYMFollowed boundaries. */
const CAMEL_BOUNDARY = /(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/g;

/**
 * Offer the sidebar a break opportunity at every word boundary inside an API
 * identifier. An entry like DocumentCorrectionViewToolbarButtonsConfig is one
 * unbreakable word wider than the sidebar column, and the CSS fallback for
 * that (breaking anywhere) splits it mid-word, which is hard to read. `<wbr>`
 * breaks at a word instead, only when the line needs it — and unlike a
 * zero-width space it leaves nothing behind in copied text. VitePress renders
 * sidebar and prev/next labels as HTML, so the element survives to the DOM.
 * @param {import("vitepress").DefaultTheme.SidebarItem[]} items
 * @returns {import("vitepress").DefaultTheme.SidebarItem[]}
 */
const breakCamelCase = (items) =>
	items.map((item) => ({
		...item,
		...(item.text ? { text: item.text.replace(CAMEL_BOUNDARY, "<wbr>") } : {}),
		...(item.items ? { items: breakCamelCase(item.items) } : {}),
	}));

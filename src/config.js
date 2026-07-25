import { execFileSync } from "node:child_process";
import { cpSync, existsSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, resolve, sep } from "node:path";
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
			if (!hit) {
				// Live-site probe from the version switcher: the dev server
				// answers 200 for any path (SPA fallback), so probes carry a
				// header and are answered from the page sources instead.
				// Static versions and production give real statuses anyway.
				if (req.method === "HEAD" && req.headers["x-ds-probe"] && url.startsWith(base)) {
					const rest = decodeURIComponent(url.slice(base.length));
					const page =
						rest === "" || rest.endsWith("/") ? `${rest}index.md` : rest.replace(/\.html$/, ".md");
					// Raw paths must be files: a bare directory without an index
					// page would 404 on the static servers this probe stands in
					// for, so a directory hit here would be a false positive.
					const isFile = (/** @type {string} */ p) => existsSync(p) && statSync(p).isFile();
					const ok =
						existsSync(join(root, page)) ||
						isFile(join(root, rest)) ||
						isFile(join(root, "public", rest));
					res.statusCode = ok ? 200 : 404;
					return res.end();
				}
				return next();
			}

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
		// left out of search indexes.
		...(version ? {} : { sitemap: { hostname: new URL(base, "https://www.dynamsoft.com").href } }),
		...config,
		base,
		head: [
			["link", { rel: "icon", href: "https://www.dynamsoft.com/favicon.ico" }],
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
 * Load API references into the side bar instead of in the header like the default.
 *
 * @param {string} [docsDir] docs package directory (defaults to the cwd,
 *   which is where VitePress runs config from)
 * @returns {import("vitepress").DefaultTheme.SidebarItem[]}
 */
export function loadApiSidebar(docsDir = process.cwd()) {
	const file = resolve(docsDir, "api/typedoc-sidebar.json");
	return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : [];
}

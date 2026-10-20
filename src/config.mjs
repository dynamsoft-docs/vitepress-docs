import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { searchForWorkspaceRoot } from "vite";
import MarkdownItGitHubAlerts from "markdown-it-github-alerts";

const themeRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Origin the docs are published under; the sitemap and llms.txt need absolute URLs. */
const SITE_ORIGIN = "https://www.dynamsoft.com";

/**
 * The committed version manifest. The copy that gets served is generated —
 * see the dev middleware below, buildEnd, and the build-versions bin.
 * @param {string} root
 */
const manifestIn = (root) => resolve(root, "versions.json");

/** Content types for the files served out of the assembled version tree. */
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
 * Makes the version switcher work in dev: serves the manifest, and serves the
 * other versions out of the tree `ds-docs-build-versions` assembles. A version
 * that has not been built yet answers with a 404 saying so.
 * @param {string} base current base (the live site)
 * @param {string} docsRoot root of the deployed docs
 * @returns {import("vite").Plugin}
 */
const versionsPlugin = (base, docsRoot) => ({
	name: "ds-versions",
	apply: "serve",
	configureServer(server) {
		const root = server.config.root;
		/** Where `ds-docs-build-versions` leaves the assembled tree. */
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
						"Run `vp run build:versions` to build the versions designated in versions.json.\n",
				);
			}
			res.setHeader("Content-Type", MIME[extname(file)] ?? "application/octet-stream");
			return res.end(readFileSync(file));
		});
	},
});

// ── Page markdown for agents ─────────────────────────────────────────────
// Every page is published twice: HTML for readers, and markdown for agents at
// the same path with a `.md` extension. Four things point agents at it, since
// none of them is universally respected: a rel="alternate" link on the page,
// llms.txt and llms-full.txt at the site root, the page's own copy and
// open-in-chat actions, and Accept negotiation (see withMarkdownServing).
//
// The markdown is captured as VitePress renders rather than read off disk,
// because VitePress expands `<!--@include-->` first and a page can be nothing
// but an include.

/** Markers the include expansion leaves around what it inserted. */
const INCLUDE_MARKERS = /^[ \t]*<!-- @include-(?:start: .*|end) -->[ \t]*\r?\n?/gm;

/** Comments a page may open with, before its own H1. */
const LEAD_COMMENTS = /^(?:<!--[\s\S]*?-->\s*)+/;

/**
 * One page's published markdown. The title is added only when the page has no
 * H1 of its own — a page that is just an include gets one from what it pulls in.
 * @param {string} src
 * @param {string} [title]
 */
const pageMarkdown = (src, title) => {
	const body = src.replace(INCLUDE_MARKERS, "").trim();
	const titled = body.replace(LEAD_COMMENTS, "").startsWith("# ");
	return !title || titled ? `${body}\n` : `# ${title}\n\n${body}\n`;
};

/**
 * Reading order: shallowest first, index pages ahead of their siblings, then
 * alphabetical.
 * @param {string} a
 * @param {string} b
 */
const byRoute = (a, b) =>
	a.split("/").length - b.split("/").length ||
	Number(!a.endsWith("index.md")) - Number(!b.endsWith("index.md")) ||
	a.localeCompare(b);

/**
 * Source path → published path. The two differ only under `rewrites`.
 * @param {string} page
 * @param {{ map?: Record<string, string | undefined> }} [rewrites]
 */
const published = (page, rewrites) => rewrites?.map?.[page] ?? page;

/**
 * Published markdown path → the page URL a reader would open.
 * @param {string} page
 * @param {boolean} [cleanUrls]
 */
const pageHref = (page, cleanUrls) =>
	page.replace(/(^|\/)index\.md$/, "$1").replace(/\.md$/, cleanUrls ? "" : ".html");

/**
 * Heading for a group of pages in llms.txt; breadcrumbLabels wins if it names
 * the directory.
 * @param {string} dir
 * @param {Record<string, string>} [labels]
 */
const groupLabel = (dir, labels) =>
	labels?.[dir] ??
	dir.replace(/-/g, " ").replace(/\b\w/g, (/** @type {string} */ c) => c.toUpperCase());

/**
 * Write the per-page markdown, llms.txt and llms-full.txt into the built site.
 * @param {import("vitepress").SiteConfig} siteConfig
 * @param {string} siteUrl absolute URL of this build's site root
 * @param {Map<string, string>} captured published path → markdown
 * @param {Map<string, { title?: string; description?: string }>} meta published path → page meta
 */
function writePageMarkdown(siteConfig, siteUrl, captured, meta) {
	const { outDir, cleanUrls, rewrites } = siteConfig;
	const labels = siteConfig.site.themeConfig?.breadcrumbLabels;
	/** @type {{ page: string; title: string; description: string; body: string }[]} */
	const pages = [];

	// siteConfig.pages holds source paths; everything after the renderer is
	// keyed by the published path.
	for (const source of siteConfig.pages) {
		if (source === "404.md") continue;
		const page = published(source, rewrites);
		const src = captured.get(page);
		if (src === undefined) {
			console.warn(`no markdown captured for ${page}; skipping its .md copy`);
			continue;
		}
		const { title, description } = meta.get(page) ?? {};
		const body = pageMarkdown(src, title);
		const file = join(outDir, page);
		mkdirSync(dirname(file), { recursive: true });
		writeFileSync(file, body);
		pages.push({ page, title: title ?? page, description: description ?? "", body });
	}

	// Grouped by directory: the site's own shape, and unlike an authored
	// sidebar it cannot leave a page out.
	pages.sort((a, b) => byRoute(a.page, b.page));
	/** @type {Map<string, typeof pages>} */
	const groups = new Map();
	for (const entry of pages) {
		const dir = entry.page.includes("/") ? entry.page.replace(/\/[^/]*$/, "") : "";
		if (!groups.has(dir)) groups.set(dir, []);
		groups.get(dir)?.push(entry);
	}
	const { title = "Documentation", description = "" } = siteConfig.site;
	const heading = `# ${title}${description ? `\n\n> ${description}` : ""}`;
	const index = [
		heading,
		"Every page of this site is also published as markdown at its own URL with" +
			" a `.md` extension. This file lists them; " +
			`[llms-full.txt](${siteUrl}llms-full.txt) is all of them in one file.`,
		...[...groups.keys()]
			.sort(byRoute)
			.map((dir) =>
				[
					`## ${dir ? groupLabel(dir.split("/").pop() ?? dir, labels) : "Docs"}`,
					...(groups.get(dir) ?? []).map(
						({ page, title: text, description: sub }) =>
							`- [${text}](${siteUrl}${page})${sub ? `: ${sub}` : ""}`,
					),
				].join("\n"),
			),
	];
	writeFileSync(join(outDir, "llms.txt"), `${index.join("\n\n")}\n`);

	// Each section carries its own URL, because the links inside a page are
	// relative to that page.
	const full = pages.map(
		({ page, body }) => `Source: <${siteUrl}${pageHref(page, cleanUrls)}>\n\n${body}`,
	);
	writeFileSync(join(outDir, "llms-full.txt"), `${[heading, ...full].join("\n---\n\n")}\n`);
	console.log(`published ${pages.length} markdown pages, llms.txt and llms-full.txt`);
}

/**
 * Serves the same markdown in dev, so the page actions and `.md` URLs behave
 * locally as they do on the built site.
 * @param {string} base
 * @param {Map<string, string>} captured
 * @param {Map<string, { title?: string }>} meta
 * @returns {import("vite").Plugin}
 */
const pageMarkdownPlugin = (base, captured, meta) => ({
	name: "ds-page-markdown",
	apply: "serve",
	configureServer(server) {
		server.middlewares.use((req, res, next) => {
			const [url = "", query] = (req.url ?? "").split("?");
			// Bare .md URLs only. In dev VitePress loads a page's own module as
			// `<page>.md?import&t=<ms>`, and answering that with markdown breaks
			// the router: every page then renders as 404.
			if (query !== undefined || req.headers["sec-fetch-dest"] === "script") return next();
			if (!url.startsWith(base) || !url.endsWith(".md")) return next();
			const page = decodeURIComponent(url.slice(base.length));
			// Capture happens during the render, so render the page first.
			server
				.transformRequest(`/${page}`)
				.then(() => {
					const src = captured.get(page);
					if (src === undefined) return next();
					res.setHeader("Content-Type", "text/markdown; charset=utf-8");
					res.end(pageMarkdown(src, meta.get(page)?.title));
				})
				.catch(() => next());
		});
	},
});

/**
 * What IIS needs in order to serve the markdown, spliced into the site's
 * web.config as it is published — the committed file is never touched:
 *
 * - a `.md` MIME mapping, or IIS will not serve those files at all;
 * - a rewrite that answers `Accept: text/markdown` with the markdown, which
 *   is also the only way such a request stops being a 406 (IIS checks Accept
 *   against the type it is about to send);
 * - `Vary: Accept`, so a shared cache cannot hand one variant to the wrong
 *   client. CloudFront ignores Vary, so see the README for what it needs.
 *
 * Everything a docs site adds has to survive being *nested* inside another
 * docs site's tree, since IIS merges a directory's config with its parents
 * and rejects the whole subtree over one duplicate key. So the rules are
 * named after this site's base, the header is removed before it is added,
 * and the rules go last, after whatever redirects the site itself keeps.
 * @param {string} xml
 * @param {string} base
 */
function withMarkdownServing(xml, base) {
	// A site that maps .md itself has taken this over.
	if (xml.includes('fileExtension=".md"')) return xml;
	if (!xml.includes("</system.webServer>")) {
		console.warn("web.config has no <system.webServer>; markdown serving not added");
		return xml;
	}
	// One name per site, so a nested site cannot collide with its parent's.
	const site = base.replace(/[^a-z\d]+/gi, "-").replace(/^-|-$/g, "") || "root";
	const negotiate = (
		/** @type {string} */ name,
		/** @type {string} */ match,
		/** @type {string} */ target,
	) => [
		`<rule name="markdown-${name}-${site}" stopProcessing="true">`,
		`\t<match url="${match}" />`,
		'\t<conditions><add input="{HTTP_ACCEPT}" pattern="text/markdown" /></conditions>',
		`\t<action type="Rewrite" url="${target}" />`,
		"</rule>",
	];
	return [
		{
			path: ["rewrite", "rules"],
			lines: [
				"<!-- GENERATED by @dynamsoft-docs/vitepress-docs -->",
				...negotiate("page", "^(.+)\\.html$", "{R:1}.md"),
				...negotiate("index", "^(|.*/)$", "{R:1}index.md"),
			],
		},
		{
			// IIS will not serve an extension it has no MIME type for. The type
			// carries no charset because IIS matches Accept against the whole
			// string: with `; charset=utf-8` in it, a request that asks strictly
			// for `text/markdown` is answered with a 406.
			path: ["staticContent"],
			lines: [
				"<!-- GENERATED by @dynamsoft-docs/vitepress-docs -->",
				'<remove fileExtension=".md" />',
				'<mimeMap fileExtension=".md" mimeType="text/markdown" />',
			],
		},
		{
			// The pages answer on Accept now, so their responses vary by it.
			path: ["httpProtocol", "customHeaders"],
			lines: [
				"<!-- GENERATED by @dynamsoft-docs/vitepress-docs -->",
				'<remove name="Vary" />',
				'<add name="Vary" value="Accept" />',
			],
		},
	].reduce((out, { path, lines }) => insertInto(out, path, lines), xml);
}

/**
 * Add `lines` to `<system.webServer>`, nested inside `path`, reusing whichever
 * of those elements the site's file already has: IIS rejects a second
 * `<staticContent>` (or `<rewrite>`, `<rules>`, …) in the same section. Lines
 * land at the end of the element they join.
 * @param {string} xml
 * @param {string[]} path element names, outermost first
 * @param {string[]} lines
 */
function insertInto(xml, path, lines) {
	/** Nest `lines` in `names`, indented from `depth` tabs. */
	const nest = (/** @type {string[]} */ names, /** @type {number} */ depth) => {
		const indent = (/** @type {number} */ extra) => "\t".repeat(depth + extra);
		const body = lines.map((line) => indent(names.length) + line);
		return [
			...names.map((name, i) => `${indent(i)}<${name}>`),
			...body,
			...names.map((name, i) => `${indent(names.length - 1 - i)}</${names[names.length - 1 - i]}>`),
		].join("\n");
	};
	for (let depth = path.length; depth > 0; depth--) {
		const tag = path[depth - 1];
		if (!xml.includes(`</${tag}>`)) continue;
		// Appended, not prepended: the site's own redirects get first refusal.
		// Two tabs deeper, for <configuration><system.webServer>.
		return xml.replace(
			new RegExp(`([ \\t]*)</${tag}>`),
			(_, indent) => `${nest(path.slice(depth), depth + 2)}\n${indent}</${tag}>`,
		);
	}
	// Swallow the closing tag's indentation so the block keeps its own.
	return xml.replace(
		/([ \t]*)<\/system\.webServer>/,
		(_, indent) => `${nest(path, 2)}\n${indent}</system.webServer>`,
	);
}

const WEB_CONFIG_SKELETON = `<?xml version="1.0" encoding="UTF-8"?>
<!-- GENERATED by @dynamsoft-docs/vitepress-docs — this site keeps no
			web.config of its own; see the theme README. -->
<configuration>
	<system.webServer>
	</system.webServer>
</configuration>
`;

/**
 * Wrap a docs site's VitePress config with the Dynamsoft defaults. Anything
 * the site sets wins, and its `head` entries are appended to ours.
 *
 * The vite settings are the fiddly part. This theme ships TypeScript and Vue
 * source, so it has to be bundled rather than externalized, and vue and
 * vitepress are deduped — otherwise a `file:`-linked checkout ends up with a
 * second copy of each and the site silently falls back to the default theme.
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
	// Filled while VitePress renders; written out by buildEnd, or served by
	// pageMarkdownPlugin in dev.
	const agentMarkdown = config.themeConfig?.agentMarkdown ?? true;
	/** @type {Map<string, string>} */
	const captured = new Map();
	/** @type {Map<string, { title?: string; description?: string }>} */
	const pageMeta = new Map();
	const gtm = config.themeConfig?.dynamsoftChrome
		? (config.themeConfig.gtm ?? "GTM-538F83")
		: undefined;
	return {
		lastUpdated: true,
		// The hostname carries the base path: a sitemap only covers URLs at or
		// below its own location. Versioned copies are left unindexed.
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
		/**
		 * Advertise the page's markdown and collect what llms.txt is built from.
		 * A site's own hook still runs, and its result wins.
		 */
		async transformPageData(pageData, context) {
			if (agentMarkdown && !pageData.isNotFound) {
				pageMeta.set(pageData.relativePath, {
					title: pageData.title,
					description: pageData.description,
				});
				pageData.frontmatter.head = [
					...(pageData.frontmatter.head ?? []),
					[
						"link",
						{
							rel: "alternate",
							type: "text/markdown",
							href: `${base}${pageData.relativePath}`,
						},
					],
				];
			}
			return config.transformPageData?.(pageData, context);
		},
		async buildEnd(siteConfig) {
			// The version switcher fetches this from the docs root.
			const manifest = manifestIn(siteConfig.root);
			if (existsSync(manifest)) cpSync(manifest, join(siteConfig.outDir, "versions.json"));
			const webConfig = resolve(siteConfig.root, "web.config");
			const site = existsSync(webConfig) ? readFileSync(webConfig, "utf8") : undefined;
			if (site !== undefined || agentMarkdown) {
				writeFileSync(
					join(siteConfig.outDir, "web.config"),
					agentMarkdown
						? withMarkdownServing(site ?? WEB_CONFIG_SKELETON, base)
						: /** @type {string} */ (site),
				);
			}
			if (agentMarkdown) writePageMarkdown(siteConfig, siteUrl, captured, pageMeta);
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
				// Runs last, so state.src is the page's markdown with its includes
				// already expanded.
				md.core.ruler.push("ds-capture-markdown", (state) => {
					const { relativePath } = /** @type {{ relativePath?: string }} */ (state.env);
					if (relativePath) captured.set(relativePath, state.src);
				});
				siteMarkdownConfig?.(md);
			},
		},
		vite: {
			...config.vite,
			plugins: [
				...(config.vite?.plugins ?? []),
				versionsPlugin(base, docsRoot),
				...(agentMarkdown ? [pageMarkdownPlugin(base, captured, pageMeta)] : []),
			],
			server: {
				// Docs dev happens in containers behind proxied interfaces.
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
				// Linked installs are excluded for us; git installs are not.
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
 * The generated API reference, for the sidebar rather than the nav.
 * @param {string} [docsDir] docs package directory; defaults to the cwd,
 *   which is where VitePress runs a config from
 * @returns {import("vitepress").DefaultTheme.SidebarItem[]}
 */
export function loadApiSidebar(docsDir = process.cwd()) {
	const file = resolve(docsDir, "api/typedoc-sidebar.json");
	return existsSync(file) ? breakCamelCase(JSON.parse(readFileSync(file, "utf8"))) : [];
}

/** Word boundaries in a camelCase identifier. */
const CAMEL_BOUNDARY = /(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/g;

/**
 * Give the sidebar somewhere to break long API names. An entry like
 * DocumentCorrectionViewToolbarButtonsConfig is a single word wider than the
 * sidebar column, and the CSS fallback splits it mid-word. `<wbr>` breaks at a
 * word instead, and leaves nothing behind in copied text. VitePress renders
 * sidebar labels as HTML, so the element reaches the DOM.
 * @param {import("vitepress").DefaultTheme.SidebarItem[]} items
 * @returns {import("vitepress").DefaultTheme.SidebarItem[]}
 */
const breakCamelCase = (items) =>
	items.map((item) => ({
		...item,
		...(item.text ? { text: item.text.replace(CAMEL_BOUNDARY, "<wbr>") } : {}),
		...(item.items ? { items: breakCamelCase(item.items) } : {}),
	}));

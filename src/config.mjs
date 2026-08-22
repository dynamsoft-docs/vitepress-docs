import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
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

// ── Page markdown for agents ─────────────────────────────────────────────
/**
 * Every page is published twice: as HTML for readers, and as markdown for
 * agents at the same path with a `.md` extension. No single discovery
 * mechanism is honoured by every agent, so they are layered:
 *
 * 1. `<link rel="alternate" type="text/markdown">` on each page,
 * 2. `llms.txt` (the site's map) and `llms-full.txt` (everything in one
 *    file) at the site root — llmstxt.org,
 * 3. the page's own copy/open-in-chat actions (`MarkdownActions.vue`),
 * 4. IIS content negotiation on `Accept: text/markdown` (see the web.config
 *    additions below). This one is also a fix: the fleet's static host
 *    enforces Accept, so an agent asking strictly for markdown gets a bare
 *    406 from every page today.
 *
 * The markdown is captured as VitePress renders (a markdown-it core rule),
 * not read off disk: VitePress expands `<!--@include-->` before markdown-it
 * sees a page, and a page can be nothing but an include (changelog pages
 * are). The rebase markers the expansion leaves behind are stripped here.
 */
const INCLUDE_MARKERS = /^[ \t]*<!-- @include-(?:start: .*|end) -->[ \t]*\r?\n?/gm;

/** Authoring notes a page may open with, ahead of its own H1. */
const LEAD_COMMENTS = /^(?:<!--[\s\S]*?-->\s*)+/;

/**
 * One page's published markdown: includes expanded, leading H1 assured. A
 * page that only includes another file (changelog pages do) has its H1 in
 * the expansion, so the title is prepended only when there is none.
 * @param {string} src
 * @param {string} [title]
 */
const pageMarkdown = (src, title) => {
	const body = src.replace(INCLUDE_MARKERS, "").trim();
	const titled = body.replace(LEAD_COMMENTS, "").startsWith("# ");
	return !title || titled ? `${body}\n` : `# ${title}\n\n${body}\n`;
};

/**
 * Reading order: shallowest first, a directory's index page ahead of its
 * siblings, then alphabetical — the order a reader meets the pages in.
 * @param {string} a
 * @param {string} b
 */
const byRoute = (a, b) =>
	a.split("/").length - b.split("/").length ||
	Number(!a.endsWith("index.md")) - Number(!b.endsWith("index.md")) ||
	a.localeCompare(b);

/**
 * Source path → published path. Identity unless the site sets `rewrites`.
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
 * Directory label for llms.txt groups; breadcrumbLabels names them first.
 * @param {string} dir
 * @param {Record<string, string>} [labels]
 */
const groupLabel = (dir, labels) =>
	labels?.[dir] ??
	dir.replace(/-/g, " ").replace(/\b\w/g, (/** @type {string} */ c) => c.toUpperCase());

/**
 * Write the markdown twins plus llms.txt / llms-full.txt into the built site.
 * @param {import("vitepress").SiteConfig} siteConfig
 * @param {string} siteUrl absolute URL of this build's site root
 * @param {Map<string, string>} captured published path → include-expanded markdown
 * @param {Map<string, { title?: string; description?: string }>} meta published path → page meta
 */
function writePageMarkdown(siteConfig, siteUrl, captured, meta) {
	const { outDir, cleanUrls, rewrites } = siteConfig;
	const labels = siteConfig.site.themeConfig?.breadcrumbLabels;
	/** @type {{ page: string; title: string; description: string; body: string }[]} */
	const pages = [];

	// siteConfig.pages lists source paths; everything downstream of the
	// renderer (captured markdown, page data, the built HTML) is keyed by the
	// published path, which differs when the site sets `rewrites`.
	for (const source of siteConfig.pages) {
		if (source === "404.md") continue;
		const page = published(source, rewrites);
		const src = captured.get(page);
		if (src === undefined) {
			// Only reachable if a page never went through the renderer.
			console.warn(`no markdown captured for ${page}; skipping its .md twin`);
			continue;
		}
		const { title, description } = meta.get(page) ?? {};
		const body = pageMarkdown(src, title);
		const file = join(outDir, page);
		mkdirSync(dirname(file), { recursive: true });
		writeFileSync(file, body);
		pages.push({ page, title: title ?? page, description: description ?? "", body });
	}

	// Grouped by directory — the site's own shape, and complete by
	// construction (an authored sidebar can leave pages out).
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

	// Each page keeps its own URL alongside it: the markdown links inside are
	// relative to the page, not to this file.
	const full = pages.map(
		({ page, body }) => `Source: <${siteUrl}${pageHref(page, cleanUrls)}>\n\n${body}`,
	);
	writeFileSync(join(outDir, "llms-full.txt"), `${[heading, ...full].join("\n---\n\n")}\n`);
	console.log(`published ${pages.length} markdown pages, llms.txt and llms-full.txt`);
}

/**
 * Dev-server twin of the markdown emitted at build time, so the page actions
 * (and an agent pointed at a dev server) work the same locally.
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
			// Only a bare .md URL — what a reader, an agent or the page actions
			// ask for. VitePress fetches a page's own module as
			// `<page>.md?import&t=<ms>` in dev and Vite tags its module requests
			// with a query too; answering one of those with raw markdown breaks
			// the router (the page then renders as 404).
			if (query !== undefined || req.headers["sec-fetch-dest"] === "script") return next();
			if (!url.startsWith(base) || !url.endsWith(".md")) return next();
			const page = decodeURIComponent(url.slice(base.length));
			// The capture rule runs while VitePress renders, so render first —
			// a page that does not exist stays a 404 (transformRequest throws).
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
 * IIS additions the markdown twins need, spliced into the site's web.config
 * as it is published (the committed file is never touched):
 *
 * - a `.md` MIME mapping, without which IIS refuses to serve the twins at
 *   all (404.3 — "extension not configured");
 * - content negotiation: `Accept: text/markdown` on a page URL serves the
 *   twin instead of the HTML, which is also the only way such a request
 *   stops being a 406 (IIS enforces Accept against the response type);
 * - `Vary: Accept`, so a shared cache cannot serve one variant as the other.
 *   CloudFront fronts the fleet and ignores Vary, so its cache key must
 *   include Accept for the negotiation to be safe there — see the README.
 *
 * Rules follow the conventions of the hand-written fleet rules: unique
 * names, patterns anchored, `{DOCUMENT_ROOT}` + this build's base for file
 * probes (so a frozen version's copy probes its own subtree), IIS defaults
 * left implicit.
 * @param {string} xml
 * @param {string} base
 */
function withMarkdownServing(xml, base) {
	// A site that maps .md itself owns the whole arrangement; leave it be.
	if (xml.includes('fileExtension=".md"')) return xml;
	if (!xml.includes("</system.webServer>")) {
		console.warn("web.config has no <system.webServer>; markdown serving not added");
		return xml;
	}
	const negotiate = (
		/** @type {string} */ name,
		/** @type {string} */ match,
		/** @type {string} */ target,
	) => [
		`<rule name="${name}" stopProcessing="true">`,
		`\t<match url="${match}" />`,
		"\t<conditions>",
		'\t\t<add input="{HTTP_ACCEPT}" pattern="text/markdown" />',
		`\t\t<add input="{DOCUMENT_ROOT}${base}${target}" matchType="IsFile" />`,
		"\t</conditions>",
		`\t<action type="Rewrite" url="${target}" />`,
		"</rule>",
	];
	return [
		{
			// Serving a page's markdown twin to agents that ask for markdown.
			path: ["rewrite", "rules"],
			lines: [
				"<!-- GENERATED by @dynamsoft-docs/vitepress-docs -->",
				...negotiate("markdown-page", "^(.+)\\.html$", "{R:1}.md"),
				...negotiate("markdown-index", "^(|.*/)$", "{R:1}index.md"),
			],
		},
		{
			// IIS will not serve an extension it has no MIME type for.
			path: ["staticContent"],
			lines: [
				"<!-- GENERATED by @dynamsoft-docs/vitepress-docs -->",
				'<remove fileExtension=".md" />',
				'<mimeMap fileExtension=".md" mimeType="text/markdown; charset=utf-8" />',
			],
		},
		{
			// The pages now negotiate, so their responses vary by Accept.
			path: ["httpProtocol", "customHeaders"],
			lines: [
				"<!-- GENERATED by @dynamsoft-docs/vitepress-docs -->",
				'<add name="Vary" value="Accept" />',
			],
		},
	].reduce((out, { path, lines }) => insertInto(out, path, lines), xml);
}

/**
 * Add `lines` to `<system.webServer>`, nested in `path` — reusing whichever
 * of those elements the site's own file already has, because IIS rejects a
 * second `<staticContent>` (or `<rewrite>`, `<rules>`, …) in one section.
 * Indentation is rebuilt from the insertion depth.
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
		const tag = `<${path[depth - 1]}>`;
		if (!xml.includes(tag)) continue;
		// Inside an existing element: two tabs for configuration/system.webServer.
		return xml.replace(tag, `${tag}\n${nest(path.slice(depth), depth + 2)}`);
	}
	// Consume the closing tag's own indentation, so the generated block keeps
	// the indentation it was written with.
	return xml.replace(
		/([ \t]*)<\/system\.webServer>/,
		(_, indent) => `${nest(path, 2)}\n${indent}</system.webServer>`,
	);
}

/** Published when a site keeps no web.config of its own. */
const WEB_CONFIG_SKELETON = `<?xml version="1.0" encoding="UTF-8"?>
<!-- GENERATED by @dynamsoft-docs/vitepress-docs — this site keeps no
			web.config of its own; see the theme README. -->
<configuration>
	<system.webServer>
	</system.webServer>
</configuration>
`;

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
	// Markdown for agents, filled while VitePress renders and drained by
	// buildEnd (build) or served by pageMarkdownPlugin (dev).
	const agentMarkdown = config.themeConfig?.agentMarkdown ?? true;
	/** @type {Map<string, string>} */
	const captured = new Map();
	/** @type {Map<string, { title?: string; description?: string }>} */
	const pageMeta = new Map();
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
		/**
		 * Advertise the page's markdown twin and collect what llms.txt is
		 * written from. A site's own hook still runs, and its result wins.
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
			// Publish the committed manifest into the built site so the version
			// switcher (which fetches <docsRoot>versions.json) finds it.
			const manifest = manifestIn(siteConfig.root);
			if (existsSync(manifest)) cpSync(manifest, join(siteConfig.outDir, "versions.json"));
			// The site's web.config, plus the fleet's markdown serving rules.
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
				// Last core rule: state.src is then the page's markdown with its
				// includes expanded — what the .md twins publish.
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

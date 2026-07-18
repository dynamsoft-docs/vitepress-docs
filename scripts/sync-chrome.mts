#!/usr/bin/env node
/**
 * Vendors the corporate header/footer — markup and styling — from
 * Docs-Template-Repo and the shared webres stylesheets into src/chrome/.
 *
 * Markup is read from a local checkout when available (DOCS_TEMPLATE_REPO env
 * var, or ../documentation/Docs-Template-Repo relative to this repo's
 * parent), always from the named branch via `git show`; falls back to GitHub
 * raw. Template-repo stylesheets are read the same way; webres stylesheets
 * are fetched from www.dynamsoft.com.
 *
 * Each stylesheet is transformed so the corporate cascade renders correctly
 * inside a VitePress page without leaking into it:
 *   1. relative url()s are absolutized against their source location
 *      (template-repo assets resolve to GitHub raw — no product-site URLs),
 *   2. rem sizes are converted to px (the fleet sizes rem against its own
 *      html{font-size:10px}, which VitePress does not have),
 *   3. @font-face blocks are hoisted out (they must stay top-level), their
 *      template-repo font URLs retargeted to the shared webres copies
 *      (max-age=86400; GitHub raw serves fonts with max-age=300, so raw URLs
 *      re-download — and go fallback — on nearly every fresh visit; files
 *      missing from webres keep their template URL) and
 *      font-display:optional rewritten to swap (optional locks in the
 *      fallback for the whole visit whenever the font misses first paint),
 *   4. the fleet's bare custom font stacks (font-family:OpenSans-…) get
 *      sans-serif fallbacks so the not-yet-loaded state is never UA serif,
 *   5. :root/html/body selectors are rewritten to :scope,
 *   6. everything is wrapped in `@scope (.ds-corporate) { ... }`.
 *
 * Maintainer-only (not shipped in the npm package), so it can be TypeScript:
 * requires a Node version with type stripping (≥ 23.6; the fleet uses 24).
 * Re-run periodically and commit the diff to pick up upstream chrome changes.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "../src/chrome");
const localRepo =
	process.env.DOCS_TEMPLATE_REPO ?? resolve(here, "../../documentation/Docs-Template-Repo");
const branch = process.env.DOCS_TEMPLATE_BRANCH ?? "main";
const rawBase = `https://raw.githubusercontent.com/dynamsoft-docs/Docs-Template-Repo/${branch}/`;
const webres = "https://www.dynamsoft.com/webres/wwwroot/";

interface HtmlFile {
	src: string;
	dest: string;
}

interface CssSource {
	name: string;
	/** Path inside Docs-Template-Repo, read via git show / GitHub raw. */
	git?: string;
	/** Absolute URL, fetched directly. */
	url?: string;
}

const htmlFiles: HtmlFile[] = [
	{ src: "_includes/page_header.html", dest: "page-header.html" },
	{ src: "_includes/page_footer.html", dest: "page-footer.html" },
];

// The complete stylesheet cascade head.html loads, in order.
const cssSources: CssSource[] = [
	{ name: "dm-style", git: "assets/css/dm-style.min.css" },
	{ name: "bootstrap", git: "assets/css/bootstrap.min.css" },
	{ name: "font-awesome", git: "assets/css/font-awesome.min.css" },
	{ name: "basis-bs", url: `${webres}css/docs/basis-bs.min.css` },
	{ name: "header_bs", url: `${webres}css/header_bs.min.css` },
	{ name: "basis", url: `${webres}css/docs/basis.min.css` },
	{ name: "footer", url: `${webres}css/docs/footer.css` },
];

async function readTemplateFile(src: string): Promise<string> {
	if (existsSync(resolve(localRepo, ".git"))) {
		return execFileSync("git", ["-C", localRepo, "show", `${branch}:${src}`], {
			encoding: "utf8",
			maxBuffer: 16 * 1024 * 1024,
		});
	}
	return fetchText(rawBase + src);
}

async function fetchText(url: string): Promise<string> {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`fetch ${url}: HTTP ${res.status}`);
	return res.text();
}

const transformHtml = (html: string): string =>
	html
		// Same substitution the fleet's dev.sh applies at build time.
		.replaceAll("assetsPath = '/webres/wwwroot'", `assetsPath = '${webres.slice(0, -1)}'`)
		.replaceAll(/\{\{\s*assetsPath\s*\}\}/g, webres.slice(0, -1))
		// Liquid current-year → token substituted at runtime.
		.replaceAll("{{ 'now' | date: '%Y' }}", "%%YEAR%%");

/** Make every relative url() absolute against the stylesheet's own URL. */
const absolutizeUrls = (css: string, sourceUrl: string): string =>
	css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (match, quote, target) => {
		if (/^(data:|https?:|\/\/|#)/i.test(target)) return match;
		return `url(${quote}${new URL(target, sourceUrl).href}${quote})`;
	});

/** The fleet sizes rem against html{font-size:10px}; bake that in as px. */
const remToPx = (css: string): string =>
	css.replace(/([\d.]+)rem\b/g, (_, n) => `${Math.round(Number.parseFloat(n) * 100) * 0.1}px`);

/** @font-face must stay top-level; @scope would silently drop it. */
function hoistFontFaces(css: string): { fontFaces: string[]; rest: string } {
	const fontFaces: string[] = [];
	const rest = css.replace(/@font-face\s*\{[^{}]*\}/g, (block) => {
		fontFaces.push(block);
		return "";
	});
	return { fontFaces, rest };
}

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const rawFontUrl = new RegExp(
	`url\\((['"]?)${escapeRegex(`${rawBase}assets/font-face/`)}([^'")]+)\\1\\)`,
	"g",
);

/**
 * Retarget template-repo font URLs at the shared webres copies where they
 * exist (verified per file with a HEAD probe), and never lock in the
 * fallback: the fleet ships font-display:optional, which skips the font for
 * the entire visit whenever it is not ready within ~100ms of first paint.
 */
async function retargetFontFaces(blocks: string[]): Promise<string[]> {
	const files = new Set<string>();
	for (const block of blocks) {
		for (const match of block.matchAll(rawFontUrl)) files.add(match[2].split(/[?#]/)[0]);
	}
	const onWebres = new Map<string, boolean>();
	for (const file of files) {
		// Missing files redirect to an HTML error page, so exclude only that;
		// webres serves ttf/svg fonts as octet-stream/svg+xml.
		const res = await fetch(`${webres}font-face/${file}`, { method: "HEAD" });
		const found = res.ok && !/text\/html/i.test(res.headers.get("content-type") ?? "");
		onWebres.set(file, found);
		if (!found) console.warn(`font not on webres, keeping template URL: ${file}`);
	}
	return blocks.map((block) =>
		block
			.replace(rawFontUrl, (match, quote, file) =>
				onWebres.get(file.split(/[?#]/)[0])
					? `url(${quote}${webres}font-face/${file}${quote})`
					: match,
			)
			.replace(/font-display\s*:\s*optional/g, "font-display:swap"),
	);
}

/**
 * The fleet declares its custom families bare (font-family:OpenSans-…), so
 * while the font is loading — or if it fails — the browser falls back to
 * the UA default, a serif. Append a sans-serif stack.
 */
const addFontFallbacks = (css: string): string =>
	css.replace(
		/font-family\s*:\s*((["']?)(?:OpenSans|Oswald)-[A-Za-z]+\2)(?=\s*[;}!])/g,
		(_, family) => `font-family:${family},Helvetica,Arial,sans-serif`,
	);

/** :root/html/body can never match inside @scope; retarget the scope root. */
const rescopeRootSelectors = (css: string): string =>
	css.replace(/(^|[{},])\s*(:root|html|body)(?![\w-])/g, "$1:scope");

mkdirSync(outDir, { recursive: true });

for (const file of htmlFiles) {
	const html = transformHtml(await readTemplateFile(file.src));
	writeFileSync(resolve(outDir, file.dest), html);
	console.log(`synced ${file.src} -> ${file.dest} (${html.length} bytes)`);
}

const fontSections: { name: string; fontFaces: string[] }[] = [];
const scopedSections: string[] = [];
for (const source of cssSources) {
	const raw = source.git ? await readTemplateFile(source.git) : await fetchText(source.url ?? "");
	const sourceUrl = source.git ? rawBase + source.git : (source.url ?? "");
	const css = remToPx(absolutizeUrls(raw.replace(/@charset[^;]+;/g, ""), sourceUrl));
	const { fontFaces, rest } = hoistFontFaces(css);
	if (fontFaces.length) fontSections.push({ name: source.name, fontFaces });
	scopedSections.push(
		`/* ${source.name}: ${sourceUrl} */\n@scope (.ds-corporate) {\n${rescopeRootSelectors(addFontFallbacks(rest))}\n}`,
	);
	console.log(`synced css ${source.name} (${raw.length} bytes)`);
}

const fontCss: string[] = [];
for (const section of fontSections) {
	fontCss.push(`/* ${section.name} */\n${(await retargetFontFaces(section.fontFaces)).join("\n")}`);
}

const chromeCss = `/* GENERATED by scripts/sync-chrome.mts — do not edit by hand. */\n\n${fontCss.join("\n\n")}\n\n${scopedSections.join("\n\n")}\n`;
writeFileSync(resolve(outDir, "chrome.css"), chromeCss);
console.log(`wrote chrome.css (${chromeCss.length} bytes)`);

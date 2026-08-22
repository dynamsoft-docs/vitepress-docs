#!/usr/bin/env node
/**
 * Vendors the corporate header and footer — markup and styling — into
 * src/chrome/. Run it periodically to pick up corporate theming changes.
 *
 * Markup and the template stylesheets come from Docs-Template-Repo on GitHub;
 * DOCS_TEMPLATE_BRANCH picks a branch and DOCS_TEMPLATE_REPO reads a local
 * checkout instead. The webres stylesheets come from www.dynamsoft.com.
 *
 * Each stylesheet is then rewritten so the corporate cascade renders inside a
 * VitePress page without leaking into it: url()s absolutized, rem sizes baked
 * to px, @font-face hoisted out and pointed at the webres copies, fallbacks
 * added to the bare font stacks, and the whole thing wrapped in
 * `@scope (.ds-corporate)`. The functions below carry the details.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "../src/chrome");
// Opt in for offline work; GitHub is the default source.
const localRepo = process.env.DOCS_TEMPLATE_REPO;
const branch = process.env.DOCS_TEMPLATE_BRANCH ?? "main";
const rawBase = `https://raw.githubusercontent.com/dynamsoft-docs/Docs-Template-Repo/${branch}/`;
const webres = "https://www.dynamsoft.com/webres/wwwroot/";

interface HtmlFile {
	src: string;
	dest: string;
}

interface CssSource {
	name: string;
	/** Path inside Docs-Template-Repo. */
	git?: string;
	/** Absolute URL, fetched directly. */
	url?: string;
}

const htmlFiles: HtmlFile[] = [
	{ src: "_includes/page_header.html", dest: "page-header.html" },
	{ src: "_includes/page_footer.html", dest: "page-footer.html" },
];

// The stylesheets head.html loads, in the order it loads them.
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
	if (localRepo) {
		if (!existsSync(resolve(localRepo, ".git"))) {
			throw new Error(`DOCS_TEMPLATE_REPO is not a git checkout: ${localRepo}`);
		}
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
		// The same substitution the corporate build applies.
		.replaceAll("assetsPath = '/webres/wwwroot'", `assetsPath = '${webres.slice(0, -1)}'`)
		.replaceAll(/\{\{\s*assetsPath\s*\}\}/g, webres.slice(0, -1))
		// Liquid current-year, substituted at runtime instead.
		.replaceAll("{{ 'now' | date: '%Y' }}", "%%YEAR%%");

/** Make every relative url() absolute against the stylesheet's own URL. */
const absolutizeUrls = (css: string, sourceUrl: string): string =>
	css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (match, quote, target) => {
		if (/^(data:|https?:|\/\/|#)/i.test(target)) return match;
		return `url(${quote}${new URL(target, sourceUrl).href}${quote})`;
	});

/** The corporate CSS sizes rem against a 10px root; bake that in as px. */
const remToPx = (css: string): string =>
	css.replace(/([\d.]+)rem\b/g, (_, n) => `${Math.round(Number.parseFloat(n) * 100) * 0.1}px`);

/** @font-face has to stay top-level; @scope would silently drop it. */
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
 * Point the fonts at the webres copies where they exist, since GitHub caches
 * them for minutes rather than a day. Also drop font-display:optional, which
 * skips the font for the whole visit if it misses first paint.
 */
async function retargetFontFaces(blocks: string[]): Promise<string[]> {
	const files = new Set<string>();
	for (const block of blocks) {
		for (const match of block.matchAll(rawFontUrl)) files.add(match[2].split(/[?#]/)[0]);
	}
	const onWebres = new Map<string, boolean>();
	for (const file of files) {
		// A missing file redirects to an HTML error page, which is the only
		// content type worth rejecting: ttf and svg arrive as other types.
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
 * The corporate CSS names its families bare (font-family:OpenSans-…), so a
 * font that is still loading, or missing, falls back to the browser's serif.
 */
const addFontFallbacks = (css: string): string =>
	css.replace(
		/font-family\s*:\s*((["']?)(?:OpenSans|Oswald)-[A-Za-z]+\2)(?=\s*[;}!])/g,
		(_, family) => `font-family:${family},Helvetica,Arial,sans-serif`,
	);

/** :root, html and body cannot match inside @scope; aim them at the root. */
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

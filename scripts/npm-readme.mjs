#!/usr/bin/env node
/**
 * Turn a docs-site guide page into a README npm can render.
 *
 * npm handles neither site-relative links nor GFM alerts, so this drops the
 * leading authoring comment and frontmatter, points the links at the published
 * pages under the given site root, and downgrades alert markers
 * (`> [!NOTE]`) to bold blockquotes.
 *
 * Meant for a publish workflow, just before `npm pack`, overwriting README.md
 * in the CI workspace — a generated README should not be committed. It has no
 * dependencies, so plain `node` can run it from a checkout.
 *
 * Usage: ds-docs-npm-readme <guide.md> --site <https://…/docs/web/>
 */
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const siteIdx = args.indexOf("--site");
let site = siteIdx === -1 ? "" : (args[siteIdx + 1] ?? "");
const file = args.find((a, i) => !a.startsWith("--") && (siteIdx === -1 || i !== siteIdx + 1));
if (!file || !/^https?:\/\//.test(site)) {
	console.error("usage: ds-docs-npm-readme <guide.md> --site <production docs root URL>");
	process.exit(1);
}
if (!site.endsWith("/")) site += "/";

/** @param {string} kind */
const title = (kind) => kind[0] + kind.slice(1).toLowerCase();

const output = readFileSync(file, "utf8")
	.replace(/^\s*<!--[^]*?-->\s*?\n/, "")
	.replace(/^---\n[^]*?\n---\n/, "")
	.replace(
		/^(\s*>)\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/gm,
		(_, /** @type {string} */ quote, /** @type {string} */ kind) => `${quote} **${title(kind)}**`,
	)
	.replace(
		/\]\(\/([^)\s]*)\)/g,
		(_, /** @type {string} */ path) => `](${site}${path.replace(/\.md(?=$|#)/, ".html")})`,
	);

if (!output.trimStart().startsWith("# ")) {
	console.error(`${file} does not start with a top-level heading`);
	process.exit(1);
}
process.stdout.write(output);

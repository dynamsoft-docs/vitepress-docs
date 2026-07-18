#!/usr/bin/env node
/**
 * Print an npm-renderable README generated from a docs-site guide page.
 *
 * npm renders neither site-relative links nor GFM alert admonitions, so
 * this drops a leading HTML comment (authoring note) and YAML frontmatter,
 * absolutizes site-relative links against the given production site root
 * (mapping `.md` source paths to the published `.html` pages), and
 * downgrades GFM alert markers (`> [!NOTE]` etc.) to plain bold
 * blockquotes (`> **Note**`).
 *
 * Meant to run in a product repo's publish workflow just before `npm pack`,
 * overwriting README.md in the CI workspace only — a generated README
 * should never be tracked in git. Dependency-free, so it also runs with
 * plain `node` straight from a checkout of this repo.
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
		(_, /** @type {string} */ quote, /** @type {string} */ kind) =>
			`${quote} **${title(kind)}**`,
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

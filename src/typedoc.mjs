import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const themeRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The branch being documented: the one ds-docs-build-versions passes in, or
 * whichever is checked out.
 * @param {string} repoRoot
 * @returns {string}
 */
function revision(repoRoot) {
	if (process.env.DOCS_BRANCH) return process.env.DOCS_BRANCH;
	try {
		return execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
			cwd: repoRoot,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		}).trim();
	} catch {
		throw new Error(
			`@dynamsoft-docs/vitepress-docs: git cannot name a revision for ${repoRoot} — set DOCS_BRANCH.`,
		);
	}
}

/**
 * Wrap a docs package's typedoc config with the Dynamsoft defaults; anything
 * the package sets overrides them.
 *
 * Source links follow the branch being documented, which versions.json already
 * names — so nothing here has to be kept in step with the source. That branch
 * has to exist on the repository `repo` names. Path options resolve against
 * the caller's typedoc.config.mjs.
 * @param {import("./types.js").DynamsoftTypedocConfig} [config]
 * @returns {Record<string, unknown>}
 */
export function defineDynamsoftTypedoc(config = {}) {
	const { repo, ...options } = config;
	// The product root, relative to the docs package typedoc runs from.
	const basePath = typeof options.basePath === "string" ? options.basePath : "..";
	const repoRoot = resolve(process.cwd(), basePath);
	const gitRevision =
		typeof options.gitRevision === "string" ? options.gitRevision : revision(repoRoot);
	const sourceLinkTemplate =
		typeof options.sourceLinkTemplate === "string"
			? options.sourceLinkTemplate
			: repo === undefined
				? undefined
				: `https://github.com/${repo}/blob/{gitRevision}/{path}#L{line}`;

	/** @type {Record<string, unknown>} */
	const base = JSON.parse(readFileSync(resolve(themeRoot, "typedoc.base.json"), "utf8"));
	delete base.$schema;
	return {
		...base,
		// We know both values typedoc would otherwise ask git for, and it needs
		// `.git` to be a directory: in a worktree it finds a file, then drops
		// every source link without a word. {path} is rooted at
		// displayBasePath, not basePath as the help says.
		...(sourceLinkTemplate === undefined
			? {}
			: { sourceLinkTemplate, disableGit: true, displayBasePath: repoRoot }),
		...options,
		gitRevision,
	};
}

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const themeRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The branch being documented: the one versions.json tracks for this
 * build, passed by ds-docs-build-versions, or the checked-out branch.
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
 * Wrap a docs package's typedoc config with the fleet-wide Dynamsoft
 * defaults; site-provided values override them.
 *
 * Source links point at the branch being documented, which versions.json
 * already names, so nothing has to be kept in step with the source. That
 * branch must exist on the repository `repo` names.
 *
 * Path-type options (out, docsRoot, basePath, tsconfig, entryPoints)
 * resolve against the caller's typedoc.config.mjs.
 *
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
		// Both values typedoc would go to git for are known, and left to
		// look for a repository itself it needs `.git` to be a directory,
		// finds none, and drops every source link without saying so. Link
		// {path} is rooted at displayBasePath, not basePath as the help says.
		...(sourceLinkTemplate === undefined
			? {}
			: { sourceLinkTemplate, disableGit: true, displayBasePath: repoRoot }),
		...options,
		gitRevision,
	};
}

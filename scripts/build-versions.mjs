#!/usr/bin/env node
/**
 * Build every version designated in the docs version manifest.
 *
 * Run from a docs package directory (the one holding .vitepress/). Reads
 * versions.json: entries carrying a "branch" are built from that
 * branch in a detached git worktree, with DOCS_VERSION set from their
 * "path" so the theme's config factory derives the versioned base. The
 * outputs are assembled under --out together with the manifest itself,
 * ready to serve or FTP-sync as one tree. Entries without a "branch" are
 * listed in the version switcher but not built (frozen copies that live
 * only on the server).
 *
 * Worktrees are created as siblings of the repository root so relative
 * file: dependencies (e.g. ../../vitepress-docs) resolve the
 * same way they do in the primary checkout.
 *
 * Usage: ds-docs-build-versions [--manifest versions.json] [--out <repo>/_site]
 */
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join, relative, resolve } from "node:path";

/** @typedef {{ label: string, path: string, branch?: string }} VersionEntry */

const args = process.argv.slice(2);
/**
 * @param {string} name
 * @param {string} fallback
 * @returns {string}
 */
const opt = (name, fallback) => {
	const i = args.indexOf(`--${name}`);
	return (i === -1 ? undefined : args[i + 1]) ?? fallback;
};

const docsDir = process.cwd();
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
/**
 * @param {string} cmd
 * @param {string[]} argv
 * @param {string} cwd
 * @param {Record<string, string>} [env]
 */
const run = (cmd, argv, cwd, env) =>
	execFileSync(cmd, argv, {
		cwd,
		stdio: "inherit",
		env: env ? { ...process.env, ...env } : process.env,
	});
/**
 * @param {string[]} argv
 * @param {string} [cwd]
 */
const git = (argv, cwd = docsDir) => execFileSync("git", argv, { cwd, encoding: "utf8" }).trim();

const repoRoot = git(["rev-parse", "--show-toplevel"]);
const docsRel = relative(repoRoot, docsDir);
const manifestFile = resolve(docsDir, opt("manifest", "versions.json"));
const outDir = resolve(docsDir, opt("out", join(repoRoot, "_site")));

/** @type {{ versions?: VersionEntry[] }} */
const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
const tracked = (manifest.versions ?? []).filter(
	/** @returns {version is VersionEntry & { branch: string }} */
	(version) => Boolean(version.branch),
);
if (tracked.length === 0) {
	console.error(`no branch-tracked versions in ${manifestFile}`);
	process.exit(1);
}

mkdirSync(outDir, { recursive: true });
for (const [i, version] of tracked.entries()) {
	const worktree = `${repoRoot}-version-build-${i}`;
	console.log(`\n=== ${version.branch} -> /${version.path} ===`);
	rmSync(worktree, { recursive: true, force: true });
	git(["worktree", "add", "--force", "--detach", worktree, version.branch]);
	try {
		const worktreeDocs = join(worktree, docsRel);
		if (!existsSync(join(worktreeDocs, "package.json"))) {
			throw new Error(
				`branch ${version.branch} has no docs toolchain at ${docsRel}/ — ` +
					'track only branches that contain it (or drop "branch" to list without building)',
			);
		}
		run(npm, ["ci"], worktree);
		run(npm, ["ci"], worktreeDocs);
		run(npm, ["run", "build"], worktreeDocs, {
			DOCS_VERSION: (version.path ?? "").replace(/\/+$/, ""),
		});
		const dest = join(outDir, version.path ?? "");
		mkdirSync(dest, { recursive: true });
		cpSync(join(worktreeDocs, ".vitepress/dist"), dest, { recursive: true });
	} finally {
		git(["worktree", "remove", "--force", worktree]);
	}
}

// The manifest of the invoking checkout is authoritative for every version.
cpSync(manifestFile, join(outDir, "versions.json"));
console.log(`\nAssembled ${tracked.length} version(s) into ${outDir}`);

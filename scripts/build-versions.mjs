#!/usr/bin/env node
/**
 * Build every version the docs version manifest designates.
 *
 * Run it from a docs package directory. Each entry in versions.json with a
 * "branch" is built from that branch in a detached git worktree, with
 * DOCS_VERSION set from its "path" so the config factory derives the versioned
 * base. The builds are assembled under --out alongside the manifest, ready to
 * serve or FTP-sync as one tree. Entries without a "branch" appear in the
 * version switcher but are not built: those copies only exist on the server.
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
const vp = process.platform === "win32" ? "vp.cmd" : "vp";
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
		// vp uses the package manager that package.json declares, else the one
		// that the lockfile names. A frozen install fails without a lockfile.
		run(vp, ["install", "--frozen-lockfile"], worktree);
		if (worktreeDocs !== worktree) run(vp, ["install", "--frozen-lockfile"], worktreeDocs);
		run(vp, ["run", "build"], worktreeDocs, {
			DOCS_VERSION: version.path ?? "",
			// Where the API reference points its source links.
			DOCS_BRANCH: version.branch,
		});
		const dest = join(outDir, version.path ?? "");
		mkdirSync(dest, { recursive: true });
		cpSync(join(worktreeDocs, ".vitepress/dist"), dest, { recursive: true });
	} finally {
		git(["worktree", "remove", "--force", worktree]);
	}
}

// The invoking checkout's manifest is the one every version gets.
cpSync(manifestFile, join(outDir, "versions.json"));
console.log(`\nAssembled ${tracked.length} version(s) into ${outDir}`);

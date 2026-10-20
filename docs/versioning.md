# Versioning

The version manifest `versions.json` is in the docs package. It lists the versions of a docs site. Each entry has a label and a subpath. A tracked version also names a branch:

```jsonc
{
	"versions": [
		{ "label": "1.5.0 (latest)", "path": "", "branch": "main" },
		{ "label": "1.4.2", "path": "v1.4/" },
	],
}
```

Each entry has these fields:

- `label` is the text that the version switcher shows.
- `path` is the URL subpath under `docsRoot`. The latest version has `""`. Every other version has a trailing slash.
- `branch` is the git branch that the version builder builds for the version. Only a branch that holds the docs toolchain can be a tracked version. An entry without `branch` appears in the switcher but is not built. Such a copy exists only on the server, as a frozen copy.

## Build every version

The version builder is the command `ds-docs-build-versions`. It builds each tracked version in a detached git worktree. It creates the worktree as a sibling of the root of the repository, so that `file:` dependencies resolve. It builds the version with its subpath as the base.

The builder assembles the results and the manifest into one tree. The default location is `<repo>/_site`. The tree is ready to deploy as a whole.

Each build also gets its tracked branch as `DOCS_BRANCH`. The API reference uses it for the source links. Thus the manifest is the only place that names the branch of a version.

`defineDynamsoftConfig` serves the manifest at `<base>versions.json` in dev. It copies the manifest into single builds with `buildEnd`.

## Develop with the other versions

`vp run dev` serves the current checkout live at the docs root. It serves the other versions as static files from the assembled tree at `<repo>/_site`. Thus the version switcher works in dev. Run `vp run build:versions` once to assemble the tree before you run `vp run dev`.

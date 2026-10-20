# Versioning model

`versions.json` in the docs package designates exactly which branch is
tracked for which version, with which label:

```jsonc
{
	"versions": [
		{ "label": "1.5.0 (latest)", "path": "", "branch": "main" },
		{ "label": "1.4.2", "path": "v1.4/" },
	],
}
```

- `label` — text shown in the version switcher.
- `path` — URL subpath under `docsRoot`: `""` for the root/latest, otherwise
	with a trailing slash.
- `branch` — the git branch built for this version. Only branches containing
	the docs toolchain can be tracked; entries without a `branch` are listed in
	the switcher but not built (frozen copies that live only on the server).

The `ds-docs-build-versions` bin builds every branch-tracked entry in a
detached git worktree (created as a sibling of the repo root so `file:`
dependencies resolve) with its subpath as the base, and assembles the
results plus the manifest into one tree (default `<repo>/_site`), ready to
deploy as a whole. Each build also gets its tracked branch as
`DOCS_BRANCH`, which is where its API reference points its source links
— so the manifest is the only place a version's branch is named.
`defineDynamsoftConfig` serves the manifest at `<base>versions.json` in dev
and copies it into single builds via `buildEnd`.

`vp run dev` serves the **current checkout live** at the docs root and the
**other versions statically** from the assembled tree at `<repo>/_site`, so
the version switcher works in dev — run `vp run build:versions` once to
assemble it first to serve it with `vp run dev`.

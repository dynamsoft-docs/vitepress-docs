# Contributing

This repository is public, and the package is proprietary.

## Set up

1. Install pnpm 12. The `devEngines` field of `package.json` pins it.
2. Run `pnpm install` in the root of the repository.
3. To try a change in a docs site, link the package with `file:`. Follow the
	advice at the end of `docs/setup.md`.

## Check a change

| Command                | Effect                                                         |
| ---------------------- | -------------------------------------------------------------- |
| `vp check`             | Checks the format and the lint rules.                          |
| `pnpm run typecheck`   | Checks the types of the source.                                |
| `pnpm run types`       | Generates `types/` from the JSDoc of the two config factories. |
| `pnpm run sync-chrome` | Vendors the corporate header and footer.                       |

Commit `types/` with the change that alters it, because CI fails when it is
stale. The CI workflow `ci.yml` runs the three checks. The pre-commit hook in
`.vite-hooks/` runs `vp staged`, which formats and lints the staged files.

## Plain JavaScript files

`src/config.mjs` and `src/typedoc.mjs` are deliberately not TypeScript. They
are the only files that bare Node executes. VitePress externalizes bare
specifiers when it loads the config of a site, and typedoc loads
`typedoc.config.mjs` the same way. Node refuses to strip types inside
`node_modules`, so a TypeScript factory would work in a linked checkout and
fail on every git-dependency install. The JSDoc of the two files is the
source of the shipped declarations in `types/`. The public types are in
`src/types.ts`.

## Issues

The issues of the project live in the repository as git-bug objects. List
them with `git bug bug`. Give each issue a `kind`, an `area`, and a
`priority` label.

## Commits

Write each commit message as a [Conventional Commit](https://www.conventionalcommits.org/),
for example `fix(footer): end the sidebar above the footer`. Keep each
commit to one logical change.

## Where facts live

- Problems, requirements, and plans: the issues.
- How to use the package: the files in `docs/`.
- The types of the config factories: the JSDoc of `src/config.mjs` and
	`src/typedoc.mjs`.

## Release

Consumers depend on this repository as a git dependency, so a release is a
git tag. No registry is involved.

1. Raise `version` in `package.json`.
2. Commit the change as `chore: release X.Y.Z`.
3. Tag the commit `vX.Y.Z`.
4. Push the commit and the tag.

A consuming site gets the release when it locks the new tag again.

# Dynamsoft docs toolkit

The terms of the shared theme and toolkit for the documentation sites of Dynamsoft products.

## Language

**Docs site**:
The published documentation site of one product.
_Avoid_: docs project, documentation portal

**Docs package**:
The directory of a product repository that holds the `package.json`, the VitePress config, and the pages of a docs site.
_Avoid_: docs project, docs folder

**Fleet**:
All the docs sites that use this package.
_Avoid_: portfolio, family

**Corporate chrome**:
The header and the footer of www.dynamsoft.com that the theme vendors into each page.
_Avoid_: shell, template, frame

**Version manifest**:
The file `versions.json` in a docs package. It lists the versions of a docs site.
_Avoid_: version file, version list

**Tracked version**:
An entry of the version manifest that names a `branch`. The version builder builds it.
_Avoid_: built version, active version

**Latest version**:
The entry of the version manifest with an empty `path`. It is the docs site at its root.
_Avoid_: current version, main version

**Nested site**:
A docs site that publishes below the directory of another docs site.
_Avoid_: child site, sub-site

**Markdown twin**:
The markdown copy of a page, published next to its HTML.
_Avoid_: raw page, source page

**Version builder**:
The `ds-docs-build-versions` command. It builds every tracked version and assembles one tree.
_Avoid_: multi-build

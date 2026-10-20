# Search indexing

`defineDynamsoftConfig` points `sitemap.hostname` at the site's own URL —
origin *and* base — so `<base>sitemap.xml` lists absolute page URLs under the
docs root. A sitemap covers the URLs at or below its own location, so this
needs nothing from the corporate site root. Two things it cannot do from
here:

- Nothing advertises it: robots.txt is at the domain root, corporate-owned,
	and carries no `Sitemap:` line today.
- Versioned copies are left out on purpose (a `DOCS_VERSION` build gets no
	sitemap), so only "latest" is offered for indexing. Their pages carry
	`<meta name="robots" content="noindex">`, so a crawler that reaches a
	versioned copy by another route does not index it. A copy that an older
	release of this package built has no `noindex`.

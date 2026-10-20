# Search indexing

`defineDynamsoftConfig` sets `sitemap.hostname` to the URL of the site, with the origin and the base. Thus `<base>sitemap.xml` lists absolute page URLs under the docs root. A sitemap covers the URLs at or below its own location, so it needs nothing from the root of the corporate site.

## Advertise the sitemap

Nothing advertises the sitemap. The file `robots.txt` is at the domain root and the corporate site owns it. It has no `Sitemap:` line today.

To advertise a docs sitemap, the owner of `robots.txt` adds one line for each docs site. An example is `Sitemap: https://www.dynamsoft.com/<product>/docs/web/sitemap.xml`. A nested site needs its own line, because the sitemap of the outer site lists only the pages of the outer site.

## Hide the versioned copies

A build with `DOCS_VERSION` has no sitemap on purpose. Thus only the latest version goes to search engines for indexing. The pages of a versioned build carry `<meta name="robots" content="noindex">`. A crawler that reaches a versioned copy by another route does not index it. A copy that an older release of this package built has no `noindex`.

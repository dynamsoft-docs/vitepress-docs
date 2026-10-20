# Markdown for agents

Every page is published twice: as HTML for readers, and as markdown for
agents at the same path with a `.md` extension (`guide/frameworks.html` →
`guide/frameworks.md`). The markdown is what the page *means*, not what its
source file says: it is captured as VitePress renders, so `<!--@include-->`
directives are already expanded (a changelog page is nothing but an include)
and the page's H1 is always there.

No single discovery mechanism is honoured by every agent, so four are
layered:

- `<link rel="alternate" type="text/markdown">` on every page.
- `llms.txt` at the site root: the map, one entry per page, grouped by
	directory and labelled with `breadcrumbLabels`. `llms-full.txt` is every
	page's markdown in one file, each section preceded by its own URL (the
	links inside a page are relative to that page, not to the bundle).
- The page's own actions, top right of the article: "Copy page" copies the
	markdown; the menu offers "View as Markdown", "Open in Claude" and "Open
	in ChatGPT" — the last two hand the assistant the `.md` URL instead of
	pasting a wall of text into the prompt.
- Content negotiation: `Accept: text/markdown` on a page URL serves the
	markdown. This one is also a bug fix — IIS enforces `Accept` against the
	response type, so `curl -H 'Accept: text/markdown' <any docs page>`
	otherwise answers **406 — client browser does not accept the MIME type**,
	which is what an agent asking strictly for markdown gets. It compares
	against the whole configured type, too, so the `.md` mapping deliberately
	carries no `charset`: with one, the same strict request is refused even for
	a `.md` URL. Markdown is read as UTF-8 by convention instead. The rewrite does
	not check that the file exists first: a `{DOCUMENT_ROOT}`-based probe (the
	shape the corporate template's `webp` rule uses) never matched on the live
	server, so the rules run last instead, after whatever redirects the site
	keeps for itself. A page whose markdown is missing — a frozen version
	built by an older release of this package — then answers 404 to a
	markdown-only request instead of sending HTML.

Negotiation and the `.md` MIME mapping are IIS configuration, so `buildEnd`
splices them into the site's `web.config` as it publishes it — the committed
file is never touched, and a site that maps `.md` itself keeps full control.
Both parts are needed: without the MIME mapping IIS refuses to serve a `.md`
file at all (404.3, "extension not configured").

Four caveats, in order of importance:

1. **A docs site can be nested inside another one** — MWC publishes under
	MDS's `code-gallery/`. IIS merges a directory's config with its parents'
	and rejects the entire subtree over a single duplicate key, so everything
	generated here is written to survive that: the rules are named after the
	site's own base, and the `.md` mapping and the `Vary` header are removed
	before they are added. Adding an unqualified rule name is what took the
	MWC subtree down (every URL under it answering with the site's error
	handler, whether the file existed or not).
2. **Deploy to the beta site first.** A `web.config` IIS rejects is a 500.19
	for the whole subtree, and the symptom looks like a missing directory
	rather than an error. Confirm on beta that pages, `.md` URLs and
	negotiation all answer, then deploy to production.
3. **CloudFront ignores `Vary`.** The generated block sets `Vary: Accept`, so
	shared caches that respect it keep the two variants apart, but the
	distribution in front of www.dynamsoft.com decides its own cache key:
	`Accept` has to be part of it, or an agent's markdown response can later
	be served to a browser from the edge. Every docs request probed while this
	was written came back `x-cache: Miss from cloudfront`, so edge caching of
	these paths looks disabled or already header-keyed. Nobody has confirmed
	which.
4. `llms.txt` sits at the docs root, which is as high as a docs site reaches.
	A fleet-wide `/llms.txt` pointing at each product's would have to be owned
	by the corporate site, like robots.txt.

`themeConfig.agentMarkdown: false` publishes HTML only. In dev the twins are
served by a middleware that renders the page first, so the page actions and
`.md` URLs behave the same locally — `llms.txt` is build output only. That
middleware answers bare `.md` URLs only: VitePress loads a page's own module
as `<page>.md?import&t=<ms>` in dev, and serving markdown for those breaks
every page in the site (they render as 404).

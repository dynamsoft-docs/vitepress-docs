# Markdown for agents

The theme publishes every page twice. Readers get HTML. Agents get the markdown twin at the same path with the extension `.md`. For example, `guide/frameworks.html` has the twin `guide/frameworks.md`.

The twin holds what the page means, and not what its source file says. The build captures it as VitePress renders the page. Thus every `<!--@include-->` directive is already expanded. A changelog page consists only of an include, and its twin holds the full changelog. The H1 of the page is always present.

## How an agent finds the twin

No single discovery method works for every agent, so the theme layers four methods:

- Every page has `<link rel="alternate" type="text/markdown">`.
- The file `llms.txt` at the site root is the map. It has one entry for each page, grouped by directory and labelled with `breadcrumbLabels`. The file `llms-full.txt` holds the markdown of every page in one file. Each section starts with its own URL, because the links inside a page are relative to that page and not to the bundle.
- The page actions are at the top right of the article. "Copy page" copies the markdown. The menu offers "View as Markdown", "Open in Claude", and "Open in ChatGPT". The last two give the assistant the `.md` URL and do not paste a long text into the prompt.
- Content negotiation serves the markdown when a request to a page URL has `Accept: text/markdown`.

### Content negotiation

Content negotiation also fixes a fault. IIS checks `Accept` against the type of the response. Thus `curl -H 'Accept: text/markdown' <any docs page>` otherwise answers **406, client browser does not accept the MIME type**. An agent that asks only for markdown gets this answer.

IIS compares the request with the whole configured type. Thus the `.md` mapping has no `charset` on purpose. With a `charset`, the same strict request fails even for a `.md` URL. The twin is read as UTF-8 by convention.

The rewrite rule does not check that the file exists. A probe based on `{DOCUMENT_ROOT}` never matched on the live server. The corporate template uses that shape for its `webp` rule. Thus the rules run last, after the redirects that the site keeps for itself. If the markdown of a page is missing, a markdown-only request gets a 404 and not HTML. This happens for a frozen version that an older release of this package built.

### The `web.config` rules

Negotiation and the `.md` MIME mapping are IIS configuration. The `buildEnd` hook adds them to the `web.config` of the site as it publishes the file. It never changes the committed file. A site that maps `.md` itself keeps full control.

The site needs both parts. Without the MIME mapping, IIS refuses to serve a `.md` file at all (error 404.3, "extension not configured").

## Four caveats

The caveats are in order of importance.

1. **A docs site can be a nested site.** Mobile Web Capture (MWC) publishes under the `code-gallery/` directory of Mobile Document Scanner (MDS). IIS merges the config of a directory with the config of its parents. IIS rejects the whole subtree for a single duplicate key. Thus the generated rules survive nesting. The rules are named after the base of the site. The generator removes the `.md` mapping and the `Vary` header before it adds them. A rule name without a base took the MWC subtree down. Every URL under it then answered with the error handler of the site, whether the file existed or not.
2. **Deploy to the beta site first.** IIS answers a `web.config` that it rejects with error 500.19 for the whole subtree. The symptom looks like a missing directory and not like an error. Confirm on the beta site that pages, `.md` URLs, and negotiation all answer. Then deploy to production.
3. **CloudFront ignores `Vary`.** The generated block sets `Vary: Accept`. Shared caches that respect it keep the two variants apart. The CloudFront distribution in front of www.dynamsoft.com decides its own cache key. The key must include `Accept`. Otherwise the edge can later serve the markdown response of an agent to a browser. Every docs request that we probed answered `x-cache: Miss from cloudfront`. Thus edge caching of these paths looks disabled, or the key already has the header. Nobody has confirmed which.
4. **`llms.txt` sits at the docs root.** A docs site reaches no higher than its root. A fleet-wide `/llms.txt` that points at the file of each product must belong to the corporate site, in the same way as `robots.txt`.

## Turn the twins off

The setting `themeConfig.agentMarkdown: false` publishes HTML only.

In dev, a middleware serves the twins. It renders the page first. Thus the page actions and the `.md` URLs behave in the same way as in the build. The file `llms.txt` exists only in the build output.

The middleware answers only bare `.md` URLs. In dev, VitePress loads the module of a page as `<page>.md?import&t=<ms>`. If the middleware served markdown for those requests, every page of the site would render as a 404.

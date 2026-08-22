// Public types for the config factories, re-exported by index.ts. Type-only,
// so unlike the factories themselves this can be TypeScript (see the README).

import type { DefaultTheme } from "vitepress";

/** Theme config consumed via `defineConfigWithTheme<DynamsoftThemeConfig>`. */
export interface DynamsoftThemeConfig extends DefaultTheme.Config {
	/** Site root of the "latest" docs for this product; versions.json lives here. */
	docsRoot: string;
	/** Render the Dynamsoft corporate header/footer. */
	dynamsoftChrome: boolean;
	/**
	 * Publish every page as markdown as well as HTML, for agents: a `.md` copy
	 * per page, `llms.txt`, `llms-full.txt`, `rel="alternate"` links, IIS
	 * content negotiation, and the page's own copy actions. Defaults to true.
	 */
	agentMarkdown?: boolean;
	/** Breadcrumb labels per path directory, e.g. { api: "API Reference" }. */
	breadcrumbLabels?: Record<string, string>;
	/** Comm100 live-chat overrides; there are shared defaults. */
	comm100?: { siteId?: number; planId?: string };
	/** Google Tag Manager container; there is a shared default. */
	gtm?: string;
}

/**
 * A docs package's typedoc options, plus the one key `defineDynamsoftTypedoc`
 * consumes rather than forwards. Typedoc's own option types are not imported,
 * because this package does not depend on typedoc.
 */
export interface DynamsoftTypedocConfig {
	/** `owner/name` of the GitHub repository source links point at. */
	repo?: string;
	[option: string]: unknown;
}

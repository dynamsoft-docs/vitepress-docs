import type { Theme } from "vitepress";
import type { DefaultTheme } from "vitepress";
// Use corporate fonts
import VPTheme from "vitepress/theme-without-fonts";
import Layout from "./Layout.vue";

import "markdown-it-github-alerts/styles/github-base.css";
import "markdown-it-github-alerts/styles/github-colors-light.css";
import "markdown-it-github-alerts/styles/github-colors-dark-class.css";
import "./styles/custom.css";
import "./styles/doc-skin.css";

/** Theme config consumed via `defineConfigWithTheme<DynamsoftThemeConfig>`. */
export interface DynamsoftThemeConfig extends DefaultTheme.Config {
	/** Site root of the "latest" docs for this product; respect copy of versions.json here. */
	docsRoot: string;
	/** Render the Dynamsoft corporate header/footer. */
	dynamsoftChrome: boolean;
	/** Breadcrumb labels per path directory, e.g. { api: "API Reference" }. */
	breadcrumbLabels?: Record<string, string>;
	/** Comm100 live-chat overrides; the fleet-wide site/plan is the default. */
	comm100?: { siteId?: number; planId?: string };
}

export default {
	extends: VPTheme,
	Layout,
} satisfies Theme;

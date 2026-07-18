import type { Theme } from "vitepress";
import type { DefaultTheme } from "vitepress";
import VPTheme from "vitepress/theme";
import Layout from "./Layout.vue";
// GFM alert styles for the markup produced by markdown-it-github-alerts,
// which `defineDynamsoftConfig` (the ./config export) wires into markdown-it.
// The -class dark variant matches VitePress's `.dark` class on <html>.
import "markdown-it-github-alerts/styles/github-base.css";
import "markdown-it-github-alerts/styles/github-colors-light.css";
import "markdown-it-github-alerts/styles/github-colors-dark-class.css";
import "./styles/custom.css";
import "./styles/doc-skin.css";

/** Theme config consumed via `defineConfigWithTheme<DynamsoftThemeConfig>`. */
export interface DynamsoftThemeConfig extends DefaultTheme.Config {
	/** Site root of the "latest" docs for this product; versions.json lives here. */
	docsRoot: string;
	/** Render the Dynamsoft corporate header/footer. */
	dynamsoftChrome: boolean;
	/** Breadcrumb labels per path directory, e.g. { api: "API Reference" }. */
	breadcrumbLabels?: Record<string, string>;
	/** Comm100 live-chat overrides; the fleet-wide site/plan is the default. */
	comm100?: { siteId?: number; planId?: string };
}

const theme: Theme = {
	extends: VPTheme,
	Layout,
};

export default theme;

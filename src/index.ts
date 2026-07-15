import type { Theme } from "vitepress";
import type { DefaultTheme } from "vitepress";
import VPTheme from "vitepress/theme";
import Layout from "./Layout.vue";
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

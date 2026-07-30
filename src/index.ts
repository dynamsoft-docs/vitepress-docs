import type { Theme } from "vitepress";
// Use corporate fonts
import VPTheme from "vitepress/theme-without-fonts";
import Layout from "./Layout.vue";

import "markdown-it-github-alerts/styles/github-base.css";
import "markdown-it-github-alerts/styles/github-colors-light.css";
import "markdown-it-github-alerts/styles/github-colors-dark-class.css";
import "./styles/custom.css";
import "./styles/doc-skin.css";

export type { DynamsoftThemeConfig } from "./types.js";

export default {
	extends: VPTheme,
	Layout,
} satisfies Theme;

/**
 * Wrap a docs site's VitePress config with the Dynamsoft defaults. Anything
 * the site sets wins, and its `head` entries are appended to ours.
 *
 * The vite settings are the fiddly part. This theme ships TypeScript and Vue
 * source, so it has to be bundled rather than externalized, and vue and
 * vitepress are deduped — otherwise a `file:`-linked checkout ends up with a
 * second copy of each and the site silently falls back to the default theme.
 * @param {import("vitepress").UserConfig<import("./types.js").DynamsoftThemeConfig>} config
 * @returns {import("vitepress").UserConfig<import("./types.js").DynamsoftThemeConfig>}
 */
export declare function defineDynamsoftConfig(config: import("vitepress").UserConfig<import("./types.js").DynamsoftThemeConfig>): import("vitepress").UserConfig<import("./types.js").DynamsoftThemeConfig>;
/**
 * The generated API reference, for the sidebar rather than the nav.
 * @param {string} [docsDir] docs package directory; defaults to the cwd,
 *   which is where VitePress runs a config from
 * @returns {import("vitepress").DefaultTheme.SidebarItem[]}
 */
export declare function loadApiSidebar(docsDir?: string): import("vitepress").DefaultTheme.SidebarItem[];

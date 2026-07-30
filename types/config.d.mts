/**
 * Wrap a docs site's VitePress config with the fleet-wide Dynamsoft
 * defaults; site-provided values extend or override them.
 *
 * - The dev server may read this theme's checkout (file:-linked installs
 *   resolve imports from the real path, outside the site root) and binds
 *   all interfaces (fleet docs dev happens in containers behind proxied
 *   interfaces).
 * - vue/vitepress are deduped and the theme is added to `ssr.noExternal`:
 *   the theme ships TypeScript/Vue source, so its peer imports must resolve
 *   to the site's single instances (vital for file:/linked installs) and it
 *   must be bundled, not externalized, when installed from a registry.
 * - A sitemap is generated for www.dynamsoft.com and the corporate favicon
 *   is set; a site-provided `sitemap` wins, site `head` entries append.
 *
 * @param {import("vitepress").UserConfig<import("./types.js").DynamsoftThemeConfig>} config
 * @returns {import("vitepress").UserConfig<import("./types.js").DynamsoftThemeConfig>}
 */
export function defineDynamsoftConfig(config: import("vitepress").UserConfig<import("./types.js").DynamsoftThemeConfig>): import("vitepress").UserConfig<import("./types.js").DynamsoftThemeConfig>;
/**
 * Load API references into the side bar instead of in the header like the default.
 *
 * @param {string} [docsDir] docs package directory (defaults to the cwd,
 *   which is where VitePress runs config from)
 * @returns {import("vitepress").DefaultTheme.SidebarItem[]}
 */
export function loadApiSidebar(docsDir?: string): import("vitepress").DefaultTheme.SidebarItem[];

# Corporate chrome

The script `scripts/sync-chrome.mts` vendors the corporate header and footer. It extracts the markup and the styles from [Docs-Template-Repo](https://github.com/dynamsoft-docs/Docs-Template-Repo) and from `www.dynamsoft.com`.

## Sync transforms

The sync makes the corporate cascade safe inside a VitePress page. It applies these transforms:

1. It makes every `url()` absolute. The template assets resolve to GitHub raw.
2. It converts `rem` to `px` against the 10px root of the fleet.
3. It hoists the `@font-face` rules and points the font URLs at the shared webres copies. GitHub raw sends `max-age=300`, and the fleet uses `font-display: optional`. Together they made a fresh visit render in the serif font of the browser. Thus the sync rewrites the value to `font-display: swap`.
4. It adds sans-serif fallbacks to the bare custom font stacks of the fleet. It isolates the styles with `@scope (.ds-corporate)`.

## Components

The theme adds these behaviours to the vendored markup:

1. A small shim in `CorporateHeader.vue` reproduces the menu behaviour of the corporate site. Panels toggle on click. The Escape key and a click outside close them. The shim is necessary because the sync does not vendor `layout.js`.
2. The header scrolls away with the page. The VitePress nav bar stays docked at the top of the viewport.
3. Both hosts carry `vp-raw`. This keeps the VitePress router away from the corporate links. The docs are served from www.dynamsoft.com, so every corporate link is same-origin. Without `vp-raw`, the router intercepts a click and renders the 404 page of this site at the corporate URL. The page stays wrong until the reader refreshes.
4. The shims wire the other inert controls of the vendored markup. These are the portal login with a return `callback`, the corporate session, the signed-in account popup with its logout, and the back-to-top control. The theme hides `.xsMenuToggle` and the header search icon. Thus no dead link ships.
5. The mobile hamburger menu is inert, and the theme hides it. VitePress has its own navigation for narrow screens.
6. The footer writes the height of its visible part to `--ds-footer-overlap`. The file `custom.css` ends the sidebar and the page outline above the footer with this value.

## Update the chrome

The styling assets of the chrome (fonts and images) track the upstream source at runtime. The markup and the stylesheet cascade are vendored. Refresh them with this command:

```shell
pnpm run sync-chrome   # re-vendor markup + styles; review and commit the diff
```

The command fetches Docs-Template-Repo from GitHub raw on `main`. The variable `DOCS_TEMPLATE_BRANCH` overrides the branch. To read from a local checkout with `git show` instead, set `DOCS_TEMPLATE_REPO` to its path. Use this for offline work and for work before a push. The command fetches the webres stylesheets from www.dynamsoft.com.

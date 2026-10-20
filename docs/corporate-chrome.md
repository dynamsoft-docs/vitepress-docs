# Corporate chrome

`scripts/sync-chrome.mts` vendors the corporate header and footer. It extracts
the markup and styles from
[Docs-Template-Repo](https://github.com/dynamsoft-docs/Docs-Template-Repo) and
from `www.dynamsoft.com`.

## Sync transforms

The sync makes the corporate cascade safe inside a VitePress page:

1. url() absolutization: template assets resolve to GitHub raw.
2. rem→px against the fleet's 10px root.
3. @font-face hoisting: font URLs retargeted to the shared webres copies.
	GitHub raw's max-age=300 plus the fleet's `font-display: optional` made
	fresh visits render in the UA serif, so the sync rewrites it to
	`font-display: swap`.
4. sans-serif fallbacks on the fleet's bare custom font stacks, and
	`@scope (.ds-corporate)` isolation.

## Components

1. A small shim in `CorporateHeader.vue` reproduces the corporate menu
	behaviour (click-toggled panels, Escape and outside-click close), since
	`layout.js` is not vendored.
2. The header scrolls away with the page while the VitePress nav bar docks at
	the viewport top.
3. Both hosts carry `vp-raw`, which is how the VitePress router is kept from
	hijacking the corporate links. The docs are served from www.dynamsoft.com,
	so every one of them is same-origin, and an intercepted click renders this
	site's 404 at the corporate URL until the reader refreshes.
4. The remaining inert controls in the vendored markup are wired by the same
	shims (portal login carrying a return `callback`, corporate session, the
	signed-in account popup and its logout, back-to-top) or hidden
	(`.xsMenuToggle`, the header search icon), so no dead link ships.
5. The mobile hamburger menu is inert and hidden, because VitePress has its
	own narrow-screen nav.
6. The footer ends the sidebar and the page outline above it. The footer
	writes the height of its visible part to `--ds-footer-overlap`, and
	`custom.css` uses it.

## Updating the chrome

Chrome _styling_ assets (fonts, images) track upstream at runtime; chrome
_markup_ and the stylesheet cascade are vendored. Refresh with:

```shell
pnpm run sync-chrome   # re-vendor markup + styles; review and commit the diff
```

Fetches Docs-Template-Repo from GitHub raw on `main` (`DOCS_TEMPLATE_BRANCH`
overrides the branch); set `DOCS_TEMPLATE_REPO` to a local checkout to read
via `git show` instead (offline/pre-push work). webres stylesheets are
fetched from www.dynamsoft.com.

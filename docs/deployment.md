# Deployment

Docs sites deploy as static trees FTP-synced to the IIS server behind
www.dynamsoft.com. The build/deploy job is owned by this repo's reusable
workflow, `.github/workflows/docs-site.yml`; each product repo keeps a thin
caller owning its triggers (see mds-js's `.github/workflows/docs.yml` for a
working example):

```yaml
jobs:
  docs:
    uses: dynamsoft-docs/vitepress-docs/.github/workflows/docs-site.yml@main
    with:
      deploy: ${{ github.event_name == 'workflow_dispatch' }}
      beta: ${{ inputs.beta || false }}
      server-dir: /www.dynamsoft.com/<product>/docs/web/
    # Explicit, not `secrets: inherit`: inherited secrets do not cross
    # organization boundaries, and product repos live outside
    # dynamsoft-docs — inherit silently passes nothing.
    secrets:
      FTP_DYNAMSOFT_LOCAL_SERVER: ${{ secrets.FTP_DYNAMSOFT_LOCAL_SERVER }}
      FTP_DYNAMSOFT_LOCAL_USER: ${{ secrets.FTP_DYNAMSOFT_LOCAL_USER }}
      FTP_DYNAMSOFT_LOCAL_PASSWORD: ${{ secrets.FTP_DYNAMSOFT_LOCAL_PASSWORD }}
      FTP_TEST_SITE_SERVER: ${{ secrets.FTP_TEST_SITE_SERVER }}
      FTP_TEST_SITE_USER: ${{ secrets.FTP_TEST_SITE_USER }}
      FTP_TEST_SITE_PASSWORD: ${{ secrets.FTP_TEST_SITE_PASSWORD }}
      FTP_TEST_SITE_PORT: ${{ secrets.FTP_TEST_SITE_PORT }}
```

- Without `deploy`, the job builds only the current checkout (push/PR
	verification) and uploads the site as an artifact — no deployment.
- With `deploy` (conventionally `workflow_dispatch`), it builds every
	version designated in `versions.json` via `ds-docs-build-versions` and
	FTP-syncs the assembled tree to `server-dir` — production, or the demo3
	test site behind the "beta" input (separate FTP secrets pair; both pairs
	are passed explicitly by the caller, declared under
	`on.workflow_call.secrets`).
- `uses:` takes an exact ref — no `#semver:` ranges like the
	git dependency — so callers ride `@main`, or pin a release tag at the cost
	of a second version to bump.
- The FTP action's sync state only manages files it uploaded itself:
	pre-existing server content (e.g. frozen Jekyll-era version copies) is
	left untouched. Anything the site must own on the server — IIS
	`web.config` redirects, for instance — lives at the docs package root
	(`<docs>/web.config`), which the config factory publishes into the built
	site at `buildEnd`, like the version manifest, with the fleet's markdown
	serving rules spliced in (Markdown for agents). `public/` is untracked
	scratch space by fleet convention, so deploy files never live there.
- The action keeps its sync state in `.ftp-deploy-sync-state.json` in
	`server-dir`. It deletes what that file lists and the build lacks.
	It deletes a listed folder together with everything inside it.
	Thus a stale entry for the folder of a nested site, such as Mobile Web
	Capture (MWC) under Mobile Document Scanner (MDS), deletes the nested
	site. A local FTP server reproduced this. Nobody has yet confirmed a
	stale entry on the live server. Pass the nested folder as `preserve`
	(`code-gallery/**`, one glob per line, relative to `server-dir`) to
	make the deploy skip it.

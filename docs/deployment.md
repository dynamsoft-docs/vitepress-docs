# Deployment

A docs site deploys as a static tree. An FTP sync copies the tree to the IIS server behind www.dynamsoft.com.

This repository owns the build and deploy job as a reusable workflow, `.github/workflows/docs-site.yml`. Each product repository keeps a thin caller workflow that owns its triggers. The file `.github/workflows/docs.yml` of the mds-js repository is a working example:

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

## What the job does

- Without `deploy`, the job builds only the current checkout. It uploads the site as an artifact and deploys nothing. Use this mode for push and pull request checks.
- With `deploy`, the job builds every version that the version manifest designates. It uses the version builder. Then it syncs the assembled tree to `server-dir` by FTP. Callers conventionally use `workflow_dispatch` for this mode.
- The target is production, or the demo3 test site when the input `beta` is true. The two targets use separate FTP secrets. The caller passes both pairs explicitly, and `on.workflow_call.secrets` declares them.
- The `uses:` line takes an exact ref. It accepts no `#semver:` range like the git dependency. Thus callers use `@main`, or they pin a release tag and bump a second version.

## What the server keeps

The FTP sync manages only the files that it uploaded itself. It leaves other server content untouched. An example is a frozen copy from the Jekyll era. There is one exception, which the next section explains.

A site can own a file on the server. An example is an IIS `web.config` redirect. Put the file at the root of the docs package as `<docs>/web.config`. The config factory publishes it into the built site at `buildEnd`, as it does with the version manifest. It also adds the markdown rules of the fleet. Never put deploy files in `public/`, because the fleet treats that directory as untracked scratch space.

## Nested sites

The action keeps its sync state in the file `.ftp-deploy-sync-state.json` in `server-dir`. It deletes what that file lists and the build lacks. It deletes a listed folder together with everything inside it.

Thus a stale entry for the folder of a nested site deletes the nested site. An example is Mobile Web Capture (MWC) under Mobile Document Scanner (MDS). A local FTP server reproduced this fault. Nobody has yet confirmed a stale entry on the live server.

To protect a nested site, pass its folder as `preserve`. Write one glob on each line, relative to `server-dir`. An example is `code-gallery/**`. The deploy then skips what matches.

The input `preserve` goes to the `exclude` option of the action. An explicit `exclude` replaces the defaults of the action, so each deploy step repeats the defaults. The action never uploads a path that `preserve` matches.

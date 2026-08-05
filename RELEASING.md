# Releasing

Packages are published by `.github/workflows/publish.yml` (`workflow_dispatch`,
inputs `releaseType` = `release` | `canary`, and `version`). It runs
`lerna publish` under **fixed versioning** — every package shares one version
(`lerna.json`) — and authenticates to npm via **OIDC trusted publishing**, so no
npm token is involved. Requires npm ≥ 11.5.1 (the workflow installs it).

## One-time setup (before the first publish)

On npmjs.com, for **each** publishable package under the `@fantoche-dev` org
(2d, cli, core, create, ffmpeg, player, player-react, renderer, ui,
vite-plugin), configure a **trusted publisher**: repository
`fantoche-dev/fantoche`, workflow `publish.yml`. First-ever publishes of a
brand-new package name cannot use OIDC — bootstrap those once locally with
`npm publish --access public` from a built checkout (or temporarily add an
`NPM_TOKEN` + `NODE_AUTH_TOKEN` env to the workflow), then switch to OIDC.

**The first publish is a project decision — coordinate with Daniel before
dispatching anything.**

**Always canary first.** A full release moves the `latest` tag and tags/commits
git — there's no clean undo. Publish a canary, run the [smoke test](#smoke-test)
against it, and only cut the full release once it's green.

## Canary

For testing unreleased changes before a full release. Dispatch the workflow from
any branch (usually the feature branch you want to test):

```
releaseType = canary
version     = <ignored for canary>
```

Runs `lerna publish --canary --force-publish`. Publishes `X.Y.Z-alpha.<build>`
to the `canary` dist-tag. No git commit or tag is created — canaries are
disposable, so cut as many as you need.

**Test it.** Scaffold a fresh project and point it at the canary, then run the
[smoke test](#smoke-test):

```
npm create @fantoche-dev@canary -- --default
cd my-fantoche-project
npx npm-check-updates '/@fantoche-dev/' --target newest --install   # or hand-edit deps to @canary
```

Note the exact canary version from the workflow log (e.g. `0.11.1-alpha.1187`)
and confirm the installed packages match it before testing — a stale cache can
otherwise mask the change you're verifying.

## Full release

If `main` is protected (PR-only), lerna cannot push its version commit directly
to `main` — release from a dedicated branch and merge back via PR. (Until branch
protection is enabled, dispatching from `main` also works; prefer the branch
flow anyway for the clean squash.)

1. **Prep commit** — branch `release-X.Y.Z` off `main`, one commit:

   - `packages/cli/src/index.ts` → `const VERSION = 'X.Y.Z'`
   - `packages/create/templates/default/package.json` → bump the pinned
     `@fantoche-dev/*` deps to `X.Y.Z` (the scaffolder template pins exact
     versions; lerna does not touch it)

2. **Publish** — dispatch the workflow **from `release-X.Y.Z`**:

   ```
   releaseType = release
   version     = X.Y.Z
   ```

   Runs `lerna publish --force-publish --exact X.Y.Z`: versions all packages,
   commits `ci(release): X.Y.Z`, tags `vX.Y.Z`, pushes to the release branch,
   and publishes to the `latest` dist-tag (npm attaches provenance automatically
   when publishing via a trusted publisher).

3. **Merge** — squash-merge `release-X.Y.Z` → `main`. The squash folds the prep
   and `ci(release)` commits into one; `vX.Y.Z` still points at the published
   commit on the release branch.

Then run the [smoke test](#smoke-test) once more against `@latest` to confirm
the published release.

## Smoke test

Run against a canary before releasing, and against `@latest` after. Scaffold a
fresh project (`@canary` or `@latest` as appropriate) and check all three paths
end to end:

```
cd my-fantoche-project
npm install                        # installs cleanly, deps resolve to the version under test
npm run render                     # → output/video.mp4 (non-empty, a few seconds long)
npm start                          # editor dev server boots
```

- **Install** — `npm ls @fantoche-dev/core` reports the expected version, no
  peer/resolution errors.
- **Render** — `npm run render` exits 0 and writes a playable
  `output/video.mp4`. This is the headless path (Puppeteer + Vite + ffmpeg); a
  hang here means editor-only code leaked into the render bundle.
- **Editor** — `npm start` serves the editor (`http://localhost:9000`, HTTP 200)
  and the per-scene plugins resolve (`/@id/@fantoche-dev/2d/editor` → HTTP 200).
  The footer should show the version under test.

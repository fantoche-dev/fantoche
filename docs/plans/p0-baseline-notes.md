# P0 Baseline Verification Notes — Task 2

Date: 2026-08-04
Executor: Claude (Task 1 + Task 2 of `2026-08-04-p0-fork-foundation.md`)
Repo: `/Volumes/SSD EXTERNO/Projetos de Codigo/fantoche` (fresh clone, no changes, no commits)
Upstream HEAD: `b5de67a009a55aa2768a1e178b0446b2479a0b4e` ("docs: add RELEASING.md (#397)", 2026-07-15)
Environment: macOS (Darwin 24.6.0, arm64), Node v24.18.0, Chrome for Testing 150.0.7871.24 (pinned by puppeteer 25.3.0)

## Task 1 status

- Clone: OK — full history (`git rev-parse --is-shallow-repository` → false), branch `main`,
  `git rev-list --count HEAD` → **1143** (plan expected ">2000"; actual upstream history is
  1143 commits, but the heritage chain is intact: earliest commit `3d6e8114` "Initial commit",
  2022-04-11, by aarthificial — full motion-canvas → revideo history). 57 upstream tags present
  locally, NOT pushed anywhere.
- GitHub repo creation + push: **SKIPPED — pending org creation.**
  `gh api /orgs/fantoche-dev` → 404 and `https://github.com/fantoche-dev` → 404
  (org not created yet; Daniel is creating it in parallel). Remotes currently:
  `upstream → https://github.com/midrender/revideo` only. Run Task 1 Step 4–5
  (`gh repo create fantoche-dev/fantoche --public --source=. --remote=origin`,
  `git push origin main`, NO tags) as soon as the org exists.

## Task 2 baseline results

| Step | Result |
|---|---|
| 1. `npm ci` + `npm install --no-save @ffmpeg-installer/ffmpeg @ffprobe-installer/ffprobe` + `npx puppeteer browsers install chrome` | PASS (chrome 150.0.7871.24) |
| 2. `npx lerna run build --ignore @revideo/docs` | PASS — "Successfully ran target build for 10 projects" |
| 3. `npx lerna run test` | PASS — core: 204/204 tests (17 files); 2d: 52/52 tests (10 files) |
| 4. `npm run template:render` | PASS — "Rendered video to output/video.mp4"; artifact at `packages/template/output/video.mp4`, 2,036,259 bytes (> 100 KB). NOTE: plan says `packages/template/out/`; upstream actually writes `packages/template/output/`. |
| 5. `npm run e2e:test` | **FAIL** — see below |

## Step 5 failure detail (e2e golden frames)

Exact error:

```
FAIL  src/rendering.test.ts > Rendering > Animation renders correctly
Error: Expected image to match or be a close match to snapshot but was
0.0029296875% different from snapshot (3 differing pixels).
See diff: packages/e2e/src/__image_snapshots__/__diff_output__/circle-diff.png
Snapshots  1 failed   Test Files  1 failed (1)   Tests  1 failed (1)
```

- `rect.png` golden: matches. `circle.png` golden: 3 differing pixels
  (0.0029296875% of a 102,400-px frame), all on the anti-aliased edge of the
  circle stroke (confirmed by visual inspection of `circle-diff.png`).
- Deterministic: identical 3-pixel result on a second run (not flaky).

## Diagnosis

Cross-platform anti-aliasing variance, not a code regression:

1. Upstream goldens were generated/verified on **ubuntu-latest** (see
   `.github/workflows/verify.yml` — every job runs on Linux). This machine is
   macOS arm64.
2. Upstream CI's "Verify Pull Request" run for the PR that became our exact
   HEAD (`b5de67a`, "docs: add RELEASING.md") concluded **success** on
   2026-07-15 — the goldens are green on Linux at this commit.
3. The plan itself anticipates this: Task 8 Step 4 — "Local macOS pixels may
   differ from CI. … CI is the reference environment" (goldens are to be
   Linux-generated).
4. `jest-image-snapshot` is used with default config in
   `packages/e2e/src/rendering.test.ts` (no `failureThreshold`), so even 1
   differing pixel fails.

## Trivial fixes attempted (per protocol: version pins only)

- Chrome version pin: not applicable — `npx puppeteer browsers install chrome`
  already installs exactly the version pinned by upstream's puppeteer 25.3.0
  (150.0.7871.24), the same version upstream CI fetches. The variance is
  OS-rendering-stack-level (macOS vs Linux font/AA rasterization), not a
  version mismatch.
- Rerun to rule out flakiness: same 3 pixels — deterministic.
- NOT attempted (would violate "no changes before baseline"): adding a
  `failureThreshold` to the snapshot config, regenerating goldens locally.

## Status: STOPPED per plan

Task 2 Step 5 is red on this macOS machine, so per the plan's rule
("a red baseline changes the plan — review with Daniel before proceeding"),
execution stops here. Recommended review outcome options:

- (a) Treat Linux CI as the baseline authority (upstream CI was green at this
  exact commit) and accept the macOS 3-pixel AA variance as a known
  environment limitation, documented here; and/or
- (b) Add a tiny `failureThreshold` (e.g. `failureThresholdType: 'percent',
  failureThreshold: 0.01`) for local dev runs — a semantic change that needs
  Daniel's sign-off since goldens are the compat gate.

Also pending: Task 1 Step 4–5 (repo create + push) once `fantoche-dev` org exists.

# P0 — Fork & Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn `midrender/revideo` into the Fantoche monorepo: full-history fork, telemetry stripped, npm scope renamed, CI green on Linux+macOS, compat goldens passing, repo hygiene in place.

**Architecture:** We fork the existing npm-workspaces + lerna monorepo (16 packages) and change *identity and hygiene only* — no feature work. Every task ends with the tree building and tests passing, so any failure is attributable to the task that introduced it. The P0 gate: fresh clone → `npm ci` → build → `npm run template:render` produces an mp4, zero telemetry references, e2e image snapshots pass.

**Tech Stack:** Node ≥ 22.12, npm workspaces, lerna, Vite, vitest, puppeteer, jest-image-snapshot, GitHub Actions, `gh` CLI.

**Context primer for the executor (read first):**
- Design docs: `docs/01-research.md` … `docs/05-roadmap.md`, `docs/adr/0001…0005` (in this repo after Task 3; until then in `/Volumes/SSD EXTERNO/Projetos de Codigo/fantoche/docs/`).
- Upstream repo: `https://github.com/midrender/revideo` (MIT; default branch `main`).
- Monorepo layout: `packages/{2d,cli,core,create,docs,docs-redirect,e2e,examples,ffmpeg,player,player-react,renderer,telemetry,template,ui,vite-plugin}`.
- Build orchestration: `npx lerna run build --ignore @revideo/docs`; unit tests: `npx lerna run test`; e2e: `npm run e2e:test` (vitest + puppeteer + jest-image-snapshot; scenes in `packages/e2e/tests/scenes/`, registered in `packages/e2e/tests/project.ts`, goldens in `packages/e2e/src/__image_snapshots__/` — the harness renders **frame 0** of each scene as `output/project/<scene>/000000.png`).
- Template render smoke: `npm run template:render` → runs `packages/template/src/render.ts` → `renderVideo()` (puppeteer + in-browser WASM mp4 encoder) → `packages/template/output/video.mp4`.
- Internal deps use exact versions (`"@revideo/core": "0.11.0"`) in published packages and `"*"` in private ones — a global scope-rename sed keeps both consistent. Keep upstream version numbers at P0; first release versioning is a P1 decision (changesets).

**Decisions (resolved 2026-08-04 by Daniel):**
1. Final name: **fantoche** / npm scope **@fantoche** — confirmed.
2. GitHub host: new org **fantoche-dev** (availability verified 2026-08-04;
   Daniel creates the org manually — org creation is a web-only flow).
3. Code of Conduct contact: **danielnichiatta@gmail.com**.

If the `fantoche-dev` org does not exist yet when Task 1 runs, skip the
`gh repo create`/push steps, report it, and complete them as soon as the org
exists. Everything else is decided (see ADRs).

> **Amendment (2026-08-05):** GitHub org `fantoche-dev` and the npm org were
> created today (browser flow, Daniel + Claude). The npm name `fantoche` is
> **not available** on the registry, so the npm org/scope is
> **`fantoche-dev`/`@fantoche-dev`** (Daniel's call — matches the GitHub org).
> The Task 6 rename was re-run as `@fantoche` → `@fantoche-dev` (commit
> `e061ea15`; 291 files, git-grep-based file list excluding root `docs/` only,
> lockfile kept and patched by `npm install`, `node_modules/@fantoche` purged
> so stale imports fail loudly). Unscoped bin names (`fantoche`,
> `create-fantoche`) unchanged. Project/repo name stays **fantoche**.

---

### Task 1: Full-history clone + GitHub repo

**Files:** none (git operations only)

**Step 1: Verify prerequisites**

```bash
node --version   # expect v22.12+ (engines requirement)
gh auth status   # expect: Logged in
```

**Step 2: Move the design-phase folder aside and clone with full history**

```bash
cd "/Volumes/SSD EXTERNO/Projetos de Codigo"
mv fantoche fantoche-design-phase
git clone --origin upstream https://github.com/midrender/revideo fantoche
cd fantoche
```

**Step 3: Verify history and branch**

```bash
git branch --show-current          # expect: main
git rev-list --count HEAD          # expect: ~1143 (full motion-canvas + revideo history; earliest commit 2022-04-11 by aarthificial)
git log --reverse --oneline | head -3   # expect: earliest motion-canvas commits
```

**Step 4: Create the GitHub repo and push (branch only — NOT upstream tags)**

```bash
gh repo create fantoche-dev/fantoche --public --source=. --remote=origin
git push origin main
```

Do **not** run `git push --tags`: upstream's `v0.x` tags would pollute our release history. They remain available locally and via the `upstream` remote.

**Step 5: Verify remotes**

```bash
git remote -v
# expect:
#   origin    https://github.com/fantoche-dev/fantoche.git
#   upstream  https://github.com/midrender/revideo (fetch)
```

---

### Task 2: Baseline verification (BEFORE any change)

Purpose: prove the fork was green at baseline so later failures are attributable. **No commits in this task.**

**Step 1: Install dependencies**

```bash
npm ci
npm install --no-save @ffmpeg-installer/ffmpeg @ffprobe-installer/ffprobe
npx puppeteer browsers install chrome
```

Expected: `npm ci` completes; chrome downloads. (`--no-save` keeps `package.json`/lock clean — upstream CI notes these installers don't auto-install their binaries otherwise.)

**Step 2: Build everything except docs**

```bash
npx lerna run build --ignore @revideo/docs
```

Expected: all packages build. 

**Step 3: Run unit tests**

```bash
npx lerna run test
```

Expected: pass.

**Step 4: Render the template project**

```bash
npm run template:render
ls -la packages/template/output/
```

Expected: `Rendered video to …/video.mp4`; file `packages/template/output/video.mp4` exists and is > 100 KB.

**Step 5: Run e2e image snapshots**

```bash
npm run e2e:test
```

Expected: pass (existing goldens `circle.png`, `rect.png`).

**⚠️ If ANY step fails:** record the exact failure in `docs/plans/p0-baseline-notes.md`, attempt only trivial fixes (version pins), and if still red, STOP and review with Daniel before proceeding — a red baseline changes the plan.

> **Baseline outcome (2026-08-04):** all green except e2e: the `circle` golden
> differs by 3 pixels (0.003%), deterministic, all on the anti-aliased stroke
> edge — macOS-vs-Linux rasterization variance (goldens are Linux-generated;
> upstream CI was green at this exact commit). Full analysis in
> `p0-baseline-notes.md`. **Amendment:** `toMatchImageSnapshot` gets
> `failureThreshold: 20, failureThresholdType: 'pixel'` (unambiguous pixel
> count; 20px on 320×320 = 0.02%) so local macOS runs are meaningful while
> Linux CI remains the reference environment. Applied at the start of Task 3.

---

### Task 3: Import design docs, README, LICENSE attribution chain

**Files:**
- Create: `docs/` (from design-phase folder), `docs/UPSTREAM-REVIDEO-README.md`
- Modify: `README.md`, `LICENSE`

**Step 1: Import the design docs**

```bash
cp -R "../fantoche-design-phase/docs" ./docs
git mv README.md docs/UPSTREAM-REVIDEO-README.md
```

(Upstream has no root `docs/` dir — verify with `git status` that nothing was overwritten.)

**Step 2: Write the new `README.md`**

```markdown
# Fantoche *(working title)*

**Anyone — or any agent — can make a vector character explain something on
video.** Open source (MIT), open document format, local-first, video-first.

> **Status: P0 — fork & foundation.** This is a community fork of
> [Revideo](https://github.com/midrender/revideo) (itself an MIT fork of
> [Motion Canvas](https://github.com/motion-canvas/motion-canvas)). At this
> stage it is Revideo with telemetry removed and a new identity; the product
> layers (declarative document, characters, narration timeline, editor) land
> in later phases — see [docs/05-roadmap.md](docs/05-roadmap.md).

## Why this exists

The design rationale, verified research, and founding decisions live in
[docs/](docs/): research (`01`), vision (`02`), architecture (`03`),
roadmap (`05`), and ADRs (`docs/adr/`).

## Development

Requires Node ≥ 22.12.

```bash
npm ci
npm install --no-save @ffmpeg-installer/ffmpeg @ffprobe-installer/ffprobe
npx puppeteer browsers install chrome     # for rendering/e2e
npx lerna run build --ignore @fantoche/docs
npx lerna run test
npm run template:render                   # renders packages/template to mp4
```

## Attribution

Fantoche stands on two excellent MIT projects: **Motion Canvas** by Jacob
Bielecki and contributors, and **Revideo** by Haven Technologies (Justus
Mattern, Konstantin Höhne) and contributors. The original Revideo README is
preserved at [docs/UPSTREAM-REVIDEO-README.md](docs/UPSTREAM-REVIDEO-README.md).

## License

MIT — see [LICENSE](LICENSE).
```

(Note: until Task 6 the lerna ignore flag is still `@revideo/docs`; the README is written for the end state — acceptable within P0.)

**Step 3: Update `LICENSE` (attribution chain, keep MIT text verbatim)**

Replace only the copyright lines at the top of the MIT license text with:

```
MIT License

Copyright (c) 2022 motion-canvas
Copyright (c) 2024 Haven Technologies, Inc. (Revideo)
Copyright (c) 2026 Fantoche contributors
```

The remainder of the license text stays byte-identical.

**Step 4: Commit**

```bash
git add docs README.md LICENSE
git commit -m "docs: import design docs, new README, license attribution chain"
git push origin main
```

---

### Task 4: Strip telemetry

**Files:**
- Delete: `packages/telemetry/` (entire package), any `packages/docs` telemetry pages
- Modify: `packages/renderer/server/render-video.ts`, `packages/ffmpeg/src/video-frame-extractor.ts`, `packages/ffmpeg/src/ffmpeg-exporter-server.ts`, `packages/vite-plugin/src/partials/metrics.ts` (likely delete), `packages/cli/src/index.ts`, and `package.json` of: `cli`, `create`, `ffmpeg`, `vite-plugin` (+ any other found by grep)

**Step 1: Enumerate every reference (the authoritative list)**

```bash
grep -rn "revideo/telemetry\|sendEvent\|EventName\|posthog" packages \
  --include="*.ts" --include="*.tsx" --include="*.js" --include="*.mjs" \
  --include="*.cjs" --include="*.json" -l | grep -v node_modules
find packages/docs -iname "*telemetry*"
grep -rn "DISABLE_TELEMETRY" packages --include="*.mdx" --include="*.md" -l
```

Known at plan time: imports/calls in `renderer/server/render-video.ts`,
`ffmpeg/src/video-frame-extractor.ts`, `ffmpeg/src/ffmpeg-exporter-server.ts`,
`vite-plugin/src/partials/metrics.ts`, `cli/src/index.ts`,
`packages/create/index.js` (import + 2 call sites); dependency declared
in `cli`, `create`, `ffmpeg`, `vite-plugin` package.jsons. Trust the grep over
this list.

**Step 2: Remove the calls and imports**

In each `.ts` file: delete the `import … from '@revideo/telemetry'` line and every statement using `sendEvent`/`EventName` (e.g., `render-video.ts` has `sendEvent(EventName.RenderStarted)` inside `renderVideoOnPage`, guarded by `if (id === 0)` — delete the whole guarded block). If `vite-plugin/src/partials/metrics.ts` exists solely for telemetry, delete the file and remove its import site(s) (grep `metrics` inside `packages/vite-plugin/src`).

**Step 3: Remove the package and dependency entries**

```bash
git rm -r packages/telemetry
# remove "@revideo/telemetry" lines from the package.json files found in Step 1
# remove telemetry docs pages + DISABLE_TELEMETRY mentions found in Step 1
npm install    # regenerates package-lock without the package
```

**Step 4: Verify zero references, then build + test + render**

```bash
grep -rni "telemetry\|posthog" packages --include="*.ts" --include="*.tsx" --include="*.js" --include="*.mjs" --include="*.cjs" --include="*.json" | grep -v node_modules
# expect: no output
npx lerna run build --ignore @revideo/docs && npx lerna run test
npm run template:render && ls -la packages/template/output/video.mp4
```

Expected: builds pass, tests pass, mp4 renders.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat!: remove telemetry (no phone-home in the community fork)"
git push origin main
```

> **Task 4 outcome + amendment (2026-08-04):** telemetry fully stripped
> (commit `d5dd5454`; grep-clean, build/test/e2e green). During verification a
> **pre-existing upstream race** surfaced: `renderVideoOnPage` awaits
> `page.goto(url)` with the default `waitUntil: 'load'`, which blocks on the
> template's Google-Fonts CSS; when the render finishes first,
> `onRenderComplete` closes the browser while `goto` is pending →
> "Navigating frame was detached". Proven pre-existing via stash A/B (fails
> identically with telemetry intact); the mp4 is written completely every run.
> **Amendment:** one-line fix in `packages/renderer/server/render-video.ts` —
> `page.goto(url, {waitUntil: 'domcontentloaded'})` (module scripts execute
> before DOMContentLoaded, so app bootstrap is still guaranteed; completion is
> signaled explicitly by `onRenderComplete`, never by `load`). First
> cherry-pick candidate for upstream/canvas-commons. The template's network
> font dependency itself is flagged for P1 (offline-first principle,
> ADR 0004 §consequences).
> Review caught a leftover in `packages/create/index.js` (plain JS — grep
> blind spot); fixed and greps widened to `*.js`/`*.mjs`/`*.cjs`.

---

### Task 5: Remove upstream-specific packages and workflows

**Files:**
- Delete: `packages/docs-redirect/` (midrender.com redirect service), `.github/workflows/publish.yml` (publishes to `@revideo` scope), `.github/workflows/docs.yml` (deploys their docs site)

**Step 1: Confirm nothing depends on docs-redirect**

```bash
grep -rn "docs-redirect" package.json packages --include="*.json" | grep -v node_modules | grep -v "packages/docs-redirect"
# expect: no output
```

**Step 2: Delete**

```bash
git rm -r packages/docs-redirect
git rm .github/workflows/publish.yml .github/workflows/docs.yml
```

**Step 3: Verify install/build still green**

```bash
npm install && npx lerna run build --ignore @revideo/docs
```

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove docs-redirect service and upstream publish/docs workflows"
git push origin main
```

---

### Task 6: Rename npm scope `@revideo` → `@fantoche` (single rename — needs FINAL_NAME confirmed)

**Files:** every `package.json`, every `*.ts/*.tsx` import, `packages/cli` bin name, root `package.json` name, repository/homepage URLs. ~All packages.

**Step 1: Global scope rename (macOS sed)**

```bash
grep -rl --exclude-dir=.git --exclude-dir=node_modules -- "@revideo" . | while read -r f; do
  sed -i '' 's|@revideo|@fantoche|g' "$f"
done
grep -rn "@revideo" --exclude-dir=.git --exclude-dir=node_modules . | wc -l   # expect: 0
```

This intentionally also rewrites runtime strings like the exporter name `'@revideo/core/wasm'` → `'@fantoche/core/wasm'` (the registration and the reference rename together, staying consistent).

**Step 2: Rename the CLI binary and root package name**

In `packages/cli/package.json`: `"bin": {"revideo": "dist/index.js"}` → `"bin": {"fantoche": "dist/index.js"}`.
In root `package.json`: `"name": "revideo"` → `"name": "fantoche"`.

**Step 3: Update repo metadata URLs**

```bash
grep -rln --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=packages/docs "midrender/revideo\|re\.video\|midrender\.com" . 
# For each package.json hit: point "repository"/"homepage"/"bugs" at
# https://github.com/fantoche-dev/fantoche
```

`packages/docs` (the Docusaurus site) keeps upstream links for now — its rebrand is P2+ scope; it is excluded from builds.

**Step 4: Reinstall, rebuild, retest, rerender**

```bash
rm -rf node_modules package-lock.json && npm install
npm install --no-save @ffmpeg-installer/ffmpeg @ffprobe-installer/ffprobe
npx lerna run build --ignore @fantoche/docs
npx lerna run test
npm run template:render && ls -la packages/template/output/video.mp4
npm run e2e:test
```

Expected: all green. The e2e snapshots must still pass — the rename must not change rendering output.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat!: rename npm scope @revideo -> @fantoche and rebrand repo identity"
git push origin main
```

> **Task 6 outcome + amendments (2026-08-04):** rename landed green (296
> files; zero `@revideo` left in tracked sources; build/test/render/e2e all
> pass post-reset). Three lessons recorded:
> 1. **The global sed must exclude `docs/`** — it clobbered historical
>    references in the research/ADR/plan record (restored wholesale from the
>    last pre-rename commit in a follow-up commit). Anyone re-running the
>    rename (e.g., after a name change): add `--exclude-dir=docs` to the file
>    list and re-check.
> 2. The system `grep` (ugrep) respects `.gitignore` — verification counts
>    must use `git grep` (tracked files) plus a BSD `/usr/bin/grep` sweep for
>    gitignored caches (`.nx/`, `dist/`, `lib/` were purged and rebuilt).
>    Task 11's gate greps should use `git grep`.
> 3. Identity leftovers found post-sed, fixed in a follow-up commit: the
>    `create-revideo` bin name (→ `create-fantoche`) and bare-word `revideo`
>    in `description`/`author` fields across package.jsons. Informational
>    links to upstream's live docs site in 3 source files were kept
>    deliberately (they document upstream behavior).
>
> **Review findings recorded as P1 preconditions / deferred items:**
> - **P1 publishing precondition — scaffolder templates:**
>   `packages/create/examples` is a git submodule pinned to upstream
>   `redotvideo/examples`; uninitialized, `create-fantoche` ENOENTs; if
>   initialized, it scaffolds `@revideo/*`-scoped projects behind Fantoche
>   branding. Before publishing `@fantoche/create`: fork/vendor the
>   templates, rescope deps to `@fantoche/*`, and recreate submodule
>   materialization (the deleted upstream `publish.yml` was the only place
>   that did `submodules: true` + init/update). `RELEASING.md` is marked
>   superseded pending the P1 release process (changesets).
> - **Public-API bare-word rebrand queue (P1/P2, breaking, needs aliases or
>   migration):** `<revideo-player>` custom element tag (defined in BOTH
>   player and player-react — pre-existing upstream tag-collision quirk),
>   `~/.revideo/settings.json` (needs settings migration), `revideo-*` temp
>   dirs, `revideo:*` vite HMR channel names (internal, both-sides
>   consistent — safe to leave indefinitely).
> - **Lockfile guidance:** Task 6's `rm -rf package-lock.json` floated many
>   transitive deps (verified green, accepted). Future renames should keep
>   the lockfile and let `npm install` patch it.
> - Runtime warnings in `2d/Video.ts` and `ffmpeg/video-frame-extractor.ts`
>   still link `docs.re.video` — revisit when Fantoche docs exist (P2+).

---

### Task 7: CI workflow (Linux + macOS)

**Files:**
- Modify: `.github/workflows/verify.yml` → rename to `.github/workflows/ci.yml`

**Step 1: Write `.github/workflows/ci.yml`** (adapted from upstream `verify.yml`; changes: runs on push to main as well, build+test matrix adds macOS, adds render-smoke and no-telemetry jobs, lerna ignore updated to `@fantoche/docs`)

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request: {}
  workflow_dispatch: {}

env:
  HUSKY: 0

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: {node-version: 22, cache: npm}
      - run: npm ci
      - run: npx eslint "**/*.ts?(x)"
  prettier:
    name: Code style
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: {node-version: 22, cache: npm}
      - run: npm ci
      - run: npm run prettier
  no-telemetry:
    name: No telemetry guard
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: |
          ! grep -rni "telemetry\|posthog" packages \
            --include="*.ts" --include="*.tsx" --include="*.js" \
            --include="*.mjs" --include="*.cjs" --include="*.json"
  build-test:
    name: Build & unit tests (${{ matrix.os }})
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: {node-version: 22, cache: npm}
      - run: npm ci
      - run: npm install --no-save @ffmpeg-installer/ffmpeg @ffprobe-installer/ffprobe
      - run: npx lerna run build --ignore @fantoche/docs
      - run: npx lerna run test
  render-smoke:
    name: Template renders to mp4
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: {node-version: 22, cache: npm}
      - run: npm ci
      - run: npm install --no-save @ffmpeg-installer/ffmpeg @ffprobe-installer/ffprobe
      - run: npx puppeteer browsers install chrome
      - run: npx lerna run build --ignore @fantoche/docs
      - run: npm run template:render
      - name: Assert mp4 exists and is non-trivial
        run: |
          test -s packages/template/output/video.mp4
          ls -la packages/template/output/video.mp4
  e2e:
    name: E2E golden frames
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: {node-version: 22, cache: npm}
      - run: npm ci
      - run: npx puppeteer browsers install chrome
      - run: npm install --no-save @ffmpeg-installer/ffmpeg @ffprobe-installer/ffprobe
      - run: npx lerna run build --ignore @fantoche/docs
      - run: npm run e2e:test
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: image-diffs
          path: packages/e2e/src/__image_snapshots__/__diff_output__
  commitlint:
    name: Commit names
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: {fetch-depth: 0}
      - uses: actions/setup-node@v4
        with: {node-version: 22, cache: npm}
      - run: npm ci
      - run: npx commitlint --from ${{ github.event.pull_request.base.sha }} --verbose
```

**Step 2: Commit and watch the run**

```bash
git rm .github/workflows/verify.yml 2>/dev/null || true
git add .github/workflows/ci.yml
git commit -m "ci: linux+macos build/test matrix, render smoke, e2e goldens, telemetry guard"
git push origin main
gh run watch --exit-status
```

Expected: all jobs green. Known risk: macOS runner and ffmpeg installers — if `@ffmpeg-installer` fails on macos-latest (arm64), add a step `brew install ffmpeg` and set `FFMPEG_PATH`/`FFPROBE_PATH` env instead; document whichever was needed.

---

### Task 8: Compat golden scene (Motion Canvas-heritage generator features)

Purpose: the roadmap gate "renders one known Motion Canvas project and one known Revideo project" maps to: (a) this MC-heritage generator scene in e2e goldens, (b) the Revideo template render-smoke (Task 7). Text nodes are deliberately excluded at P0 (cross-platform font rendering); the full golden corpus with bundled fonts is P1 scope.

**Files:**
- Create: `packages/e2e/tests/scenes/mc-compat.tsx`
- Modify: `packages/e2e/tests/project.ts`
- Create (generated): `packages/e2e/src/__image_snapshots__/mc-compat.png`

**Step 1: Write the scene (exercises Layout/flexbox, signals, spline, gradient — no text)**

```tsx
import {Circle, Layout, Line, Rect, makeScene2D} from '@fantoche/2d';
import {all, createRef, createSignal} from '@fantoche/core';

export default makeScene2D('mc-compat', function* (view) {
  const progress = createSignal(0);
  const circle = createRef<Circle>();

  view.add(
    <Layout layout gap={10} padding={20} direction={'column'} width={300}>
      <Layout gap={10}>
        <Rect size={60} fill={'#e13238'} radius={8} />
        <Rect size={60} fill={'#e6a700'} radius={8} />
        <Rect
          size={60}
          radius={8}
          fill={() => `rgba(50,100,200,${0.5 + progress() * 0.5})`}
        />
      </Layout>
      <Circle
        ref={circle}
        size={80}
        fill={'lightseagreen'}
        end={() => 0.25 + progress() * 0.75}
        lineWidth={8}
        stroke={'#2a2a35'}
      />
      <Line
        points={[
          [-100, 40],
          [0, -40],
          [100, 40],
        ]}
        stroke={'#5c6470'}
        lineWidth={6}
        radius={20}
        endArrow
      />
    </Layout>,
  );

  yield* all(progress(1, 1), circle().scale(1.2, 1));
});
```

**Step 2: Register it in `packages/e2e/tests/project.ts`**

```ts
import mcCompat from './scenes/mc-compat';
// …
scenes: [circle, rect, mcCompat],
```

**Step 3: Run e2e locally — expect the new snapshot to be WRITTEN (first run), existing ones to PASS**

```bash
npm run e2e:test
git status packages/e2e/src/__image_snapshots__
# expect: new file mc-compat.png (locally generated — macOS)
```

**Step 4: Regenerate the golden on Linux (CI is the reference environment)**

Local macOS pixels may differ from CI. Delete the local golden, push, and let CI produce the reference:

```bash
rm packages/e2e/src/__image_snapshots__/mc-compat.png
```

Temporarily add to the `e2e` job in `ci.yml` (after the test step):

```yaml
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: e2e-snapshots
          path: packages/e2e/src/__image_snapshots__
```

```bash
git add -A
git commit -m "test: add mc-compat golden scene (snapshot pending CI generation)"
git push origin main
gh run watch --exit-status         # e2e writes the missing snapshot and passes
gh run download --name e2e-snapshots --dir /tmp/e2e-snapshots
cp /tmp/e2e-snapshots/mc-compat.png packages/e2e/src/__image_snapshots__/
```

**Step 5: Commit the Linux golden, remove the temp artifact step, verify CI compares (not regenerates)**

```bash
# revert the temporary upload-artifact step in ci.yml
git add packages/e2e/src/__image_snapshots__/mc-compat.png .github/workflows/ci.yml
git commit -m "test: commit linux-generated mc-compat golden"
git push origin main
gh run watch --exit-status   # expect: e2e green, comparing against the committed golden
```

---

### Task 9: Contribution hygiene files

**Files:**
- Create: `CONTRIBUTING.md`, `.github/ISSUE_TEMPLATE/bug_report.yml`, `.github/ISSUE_TEMPLATE/feature_request.yml`, `.github/PULL_REQUEST_TEMPLATE.md`

**Step 1: Write `CONTRIBUTING.md`**

```markdown
# Contributing to Fantoche

Thanks for helping! Fantoche is early — the fastest way to help is to pick an
issue labeled `good first issue`, or to open an issue describing what you'd
like to build.

## Ways to contribute (no code required for the first two)

1. **Characters & art** — characters are data (see `docs/03-architecture.md`);
   SVG artists are as valuable as programmers here (from P2 onward).
2. **Docs & examples** — fixes, tutorials, example projects.
3. **TypeScript** — the monorepo (`packages/*`).
4. **C++** — rendering backend work happens upstream in ThorVG first
   (see `docs/adr/0003`), then in our backend seam (from P4 onward).

## Development setup

Node ≥ 22.12 required.

    npm ci
    npm install --no-save @ffmpeg-installer/ffmpeg @ffprobe-installer/ffprobe
    npx puppeteer browsers install chrome
    npx lerna run build --ignore @fantoche/docs
    npx lerna run test          # unit tests
    npm run e2e:test            # golden-frame tests (linux is the reference env)
    npm run template:render     # end-to-end render smoke

## Rules of the road

- **Conventional commits** are enforced (commitlint): `feat: …`, `fix: …`,
  `docs: …`, `test: …`, `chore: …`. Breaking changes: `feat!: …`.
- Every PR must keep CI green (Linux + macOS build/test, render smoke,
  golden frames, no-telemetry guard).
- Golden-frame changes must be regenerated on Linux (CI) and explained in
  the PR description.
- Architecture-level changes need an ADR in `docs/adr/` (copy the format of
  the existing ones) — propose it in an issue first.
- No telemetry. The `no-telemetry` CI job enforces this permanently.
```

**Step 2: Write `.github/ISSUE_TEMPLATE/bug_report.yml`**

```yaml
name: Bug report
description: Something broken
labels: [bug]
body:
  - type: input
    id: version
    attributes:
      label: Version / commit
      placeholder: e.g. main @ abc1234
    validations: {required: true}
  - type: dropdown
    id: area
    attributes:
      label: Area
      options: [rendering/export, editor/preview, 2d components, cli, other]
    validations: {required: true}
  - type: textarea
    id: repro
    attributes:
      label: Minimal reproduction
      description: Smallest scene/project that shows the problem
    validations: {required: true}
  - type: textarea
    id: expected
    attributes: {label: Expected behavior}
    validations: {required: true}
  - type: textarea
    id: actual
    attributes: {label: Actual behavior (include logs/screenshots)}
    validations: {required: true}
```

**Step 3: Write `.github/ISSUE_TEMPLATE/feature_request.yml`**

```yaml
name: Feature request
description: Propose an improvement
labels: [enhancement]
body:
  - type: textarea
    id: problem
    attributes:
      label: Problem
      description: What can't you do today?
    validations: {required: true}
  - type: textarea
    id: proposal
    attributes: {label: Proposed solution}
  - type: textarea
    id: fit
    attributes:
      label: Roadmap fit
      description: See docs/05-roadmap.md — which phase does this belong to?
```

**Step 4: Write `.github/PULL_REQUEST_TEMPLATE.md`**

```markdown
## What & why

## How verified
- [ ] `npx lerna run build --ignore @fantoche/docs` green
- [ ] `npx lerna run test` green
- [ ] Golden frames unchanged (or regenerated on Linux + explained below)

## Golden/format changes (if any)
```

**Step 5: Commit**

```bash
git add CONTRIBUTING.md .github
git commit -m "docs: contributing guide, issue and PR templates"
git push origin main
```

---

### Task 10: Code of Conduct

**Files:**
- Create: `CODE_OF_CONDUCT.md`

**Step 1: Fetch Contributor Covenant 2.1 and set the contact**

```bash
curl -fsSL https://www.contributor-covenant.org/version/2/1/code_of_conduct/code_of_conduct.md -o CODE_OF_CONDUCT.md
sed -i '' 's/\[INSERT CONTACT METHOD\]/danielnichiatta@gmail.com/' CODE_OF_CONDUCT.md
grep -n "danielnichiatta@gmail.com\|INSERT" CODE_OF_CONDUCT.md   # expect: only the substituted line, no INSERT left
```

**Step 2: Commit**

```bash
git add CODE_OF_CONDUCT.md
git commit -m "docs: adopt Contributor Covenant 2.1"
git push origin main
```

---

### Task 11: Final gate — fresh-machine verification

Purpose: execute the P0 gate from `docs/05-roadmap.md` literally, from a clean clone (simulates a new contributor).

**Step 1: Fresh clone in a scratch directory**

```bash
cd "$(mktemp -d)"
git clone https://github.com/fantoche-dev/fantoche
cd fantoche
```

**Step 2: Install, build, test**

```bash
npm ci
npm install --no-save @ffmpeg-installer/ffmpeg @ffprobe-installer/ffprobe
npx puppeteer browsers install chrome
npx lerna run build --ignore @fantoche/docs
npx lerna run test
```

Expected: green with no reference to the old checkout.

**Step 3: Render + verify artifact**

```bash
npm run template:render
test -s packages/template/output/video.mp4 && echo GATE-RENDER-OK
```

Expected: `GATE-RENDER-OK`.

**Step 4: Telemetry + scope checks**

```bash
grep -rni "telemetry\|posthog" packages --include="*.ts" --include="*.tsx" --include="*.js" --include="*.mjs" --include="*.cjs" --include="*.json" | grep -v node_modules | wc -l   # expect: 0
grep -rn "@revideo" --exclude-dir=.git --exclude-dir=node_modules . | wc -l   # expect: 0
```

**Step 5: e2e goldens**

```bash
npm run e2e:test
```

Expected: pass (3 snapshots: circle, rect, mc-compat).

**Step 6: Record completion**

Append a dated "P0 gate passed" entry with the fresh-clone commit hash to `docs/plans/2026-08-04-p0-fork-foundation.md` (this file), commit, push.

---

### Task 12: Manual follow-ups for Daniel (not executable by the engineer)

- [ ] Reserve the npm org/scope `@fantoche` (or final name) — **do this early**, before any public announcement.
- [ ] GitHub repo settings: description, topics (`animation`, `motion-canvas`, `revideo`, `video`, `characters`), enable Issues + Discussions.
- [ ] Branch protection on `main`: require the `CI` checks.
- [ ] Confirm final project name — if it changes, re-run Task 6's sed with the new scope (mechanical) and rename the GitHub repo (redirects preserved).
- [ ] Seed 3–5 `good first issue`s once P1 starts.
```

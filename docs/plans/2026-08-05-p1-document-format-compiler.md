# P1 — Document Format v0 + Compiler Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A versioned, schema-validated JSON document becomes the source of truth for a video: compiled to a timeline IR, evaluated as a pure `state(t)` with O(1) seek, driving the existing 2d scene graph beside legacy generator scenes; rendered headless via `fantoche render doc.json`; semantics pinned by a golden-frame corpus. Plus the release-hygiene preconditions inherited from P0.

**Architecture:** New package `packages/document` (`@fantoche-dev/document`) holds schema (zod v4), compiler (document → IR) and evaluator (`IR × t → FrameState`) — all pure, DOM-free, unit-tested. A new `DocumentScene` (in `packages/document`, subpath export) implements core's `Scene` interface directly: nodes built once, per-frame signal *sets* (no generators), `recalculate()` in O(1) from declared duration. A small, cherry-pickable core change adds an opt-in `Seekable` capability honored by `PlaybackManager.seek` (fast path replaces the frame-step loop). The CLI wraps documents in a generated shim project and reuses `renderVideo()` unchanged.

**Tech Stack:** zod ^4 (schema + `z.toJSONSchema`), vitest, existing core tweening primitives (`timingFunctions`, `deepLerp`, `Vector2.lerp`, `Color.lerp`), commander (CLI), jest-image-snapshot corpus via the e2e harness.

**Decisions taken at plan time (Daniel may veto before execution):**
1. **Scaffolder templates are vendored in-tree** (`packages/create/templates/default`), submodule removed. The 10 other upstream templates (SaaS, AWS Lambda, YouTube Shorts…) are upstream-product-specific and are dropped from the prompt list; a future `fantoche-dev/examples` repo can restore variety. Rationale: self-contained publishable tarball, no submodule machinery, no upstream scope leakage.
2. **Release tooling stays lerna** (fixed versioning, already wired: `lerna.json` `version: 0.11.0`, `.npmrc` `access = public`) — the roadmap's "changesets or equivalent" is satisfied by the equivalent that already works. Publish workflow restored as `workflow_dispatch` with npm OIDC trusted publishing, submodule steps deleted.
3. **Narration timings are explicit in v0** (`start`/`dur` per segment, optional `words[]`). Auto-alignment (WhisperX-class) is P2; the anchor grammar (`intro.word:binária`, `intro.end+0.3`) is fully implemented in P1 against explicit timings, so P2 only swaps the *source* of timings.
4. **Springs are out of the v0 document format** (they are iterative, not closed-form — incompatible with pure `state(t)`; see core `spring.ts`). Named easings only.
5. **`Video`/`Audio` elements are out of v0** (their play model is thread-clock-driven — `Media.play()` installs a reactive `time` signal; frame-exact document control needs design). Recorded as a v0.2 candidate. `Icon` excluded too (hits iconify CDN — offline-first violation).

**Context primer for the executor (read first):**
- Design authority: `docs/adr/0002` (document as source of truth), `docs/adr/0005` (pure pose function, no state machines), `docs/03-architecture.md` §2 (layering), §3.1.
- **Scene machinery facts** (verified 2026-08-05): `Scene` interface at `packages/core/src/scenes/Scene.ts:131-341`; `GeneratorScene` is its only implementation, `Scene2D` its only subclass. `PlaybackManager.seek` (`packages/core/src/app/PlaybackManager.ts:83-109`) resets and then steps `next()` one frame per iteration — the O(t) loop. `PlaybackManager` only calls: `isCached()`, `firstFrame`, `lastFrame`, `reset()`, `next()`, `isFinished()`, `isAfterTransitionIn()`, `canTransitionOut()`, `stopAllMedia()`, `recalculate()`, `reload()`, `slides`. Scenes are instantiated blind via `new description.klass({...})` (`Player.ts:145-161`, `Renderer.ts:92-106`) — **no registry changes needed for a new scene type**. Capability idiom to copy: `Threadable`/`isThreadable` (`packages/core/src/scenes/Threadable.ts:20`).
- **Aux objects a Scene must own** (constructor order matters, copy `GeneratorScene.ts:136-138`): `Variables`, `Shaders` (needs `sharedWebGLContext`), `Slides`; `LifecycleEvents`; the `CachedSceneData` dispatcher must be real (UI timeline reads it). `Player.ts:157`/`Renderer.ts:363` call `scene.variables.updateSignals`; `PlaybackManager.recalculate:136` reads `scene.slides.onChanged.current`.
- **Signals**: `node.x(5)` is a synchronous set returning the owner (`SignalContext.invoke`, `packages/core/src/signals/SignalContext.ts:152-170`); per-frame setting is the engine's own idiom (`Scene2D.next` sets `globalTime` every frame). Identity-equal sets are no-ops — always pass fresh objects/arrays per frame.
- **Node construction requires an active scene context** (`Node.ts:536-551` calls `useScene2D()`); wrap all building/mutation in `this.execute(...)` (never bare in `render()` — computed caches invalidate at the wrong moment otherwise). JSX is optional sugar: `new Rect({...})` ≡ JSX. Stable ids: pass `key`; look up via `Scene2D.getNode(key)` idiom / own registry.
- **Tweening primitives to reuse** (all pure): easings in `packages/core/src/tweening/timingFunctions.ts` (`linear`, `sin`, `easeIn/Out/InOut{Sine,Quad,Cubic,Quart,Quint,Expo,Circ}` + pre-instantiated `easeIn/Out/InOutBack/Bounce/Elastic`); `deepLerp` (`interpolationFunctions.ts:56`, duck-dispatches to `.lerp` on Vector2/Color/BBox/Spacing); `Color.lerp` interpolates LCH.
- **Code node recipes** (`packages/2d/src/lib/components/Code.ts`, `code/*`): instant ops — `code.code(str)`, `code.code.replace(range, str)`, `code.selection(lines(3,5))`. Animated highlight per frame: set `code.oldSelection = code.selection(); code.selection(next); code.selectionProgress(t)` each frame; `null`+clear at end (mirrors `tweenSelection`, `Code.ts:260-271`). Animated diff per frame: `fragments = defaultDiffer(parseCodeScope(A), parseCodeScope(B), tokenize)`, then `code.code({progress: t, fragments})` with a **fresh object each frame**; settle with `code.code(B)`. `lines(3,5)` = `[[3,0],[5,Infinity]]` — **JSON needs a sentinel for Infinity** (use `null` → expand at parse). Highlighter: `Code.defaultHighlighter = new LezerHighlighter(parser)` global static.
- **Latex** is `Img` + MathJax; `tex` hard-swaps (no morphing) — v0 animates transforms/opacity only. **Txt**: `text` and `children` are the same channel; font props come from Layout. **Layout rule**: inside an enabled layout, writing `x`/`y` has no effect — document elements are absolute-positioned unless placed in a `layout` container element.
- **renderVideo facts** (`packages/renderer/server/render-video.ts`): `projectFile` must be **cwd-relative** (L91 does `path.join(cwd, projectFile)` — absolute paths break); `settings.viteConfig.plugins` REPLACES the internal plugins (never pass); `fps`/`resolutionScale` are NOT overridable via `settings.projectSettings` (only `range`, `background`, `size`, `exporter`) → the document's fps must be baked into the generated shim's `makeProject`. Vite `fs.allow` = workspace root of cwd → shim lives at `<cwd>/node_modules/.fantoche/<hash>.ts`. Output: `settings.outFile` (`*.mp4` for wasm exporter) into `settings.outDir ?? './output'`; returns cwd-relative path.
- **Release facts**: upstream `publish.yml` recoverable at `git show a97aea31:.github/workflows/publish.yml` (OIDC trusted publishing, `lerna publish --force-publish --exact <v>` / `--canary`); no changesets anywhere; `packages/cli/src/index.ts:9` hardcodes `VERSION = '0.11.0'` (hand-synced). Publishable: 2d, cli, core, create, ffmpeg, player, player-react, renderer, ui, vite-plugin (all 0.11.0); private: docs, e2e, examples, template. Known packaging bug: `packages/create/index.js` imports `kleur` but `kleur` is missing from its `dependencies`.
- **Submodule state**: `packages/create/examples` uninitialized, gitlink `25dd6b17`, URL `https://github.com/redotvideo/examples` — scaffolder ENOENTs today.
- **Offline-first violations**: `packages/template/src/global.css:1` imports Google Fonts **on the render path**; `packages/ui/src/index.scss:1-2` (editor-only, deferred); `Icon.ts:74` iconify CDN (excluded from v0 doc format).
- Verification pattern: build `npx lerna run build --ignore @fantoche-dev/docs`; unit `npx lerna run test`; e2e `npm run e2e:test` (goldens are Linux-generated; macOS runs must stay within the 20px pixel threshold); render smoke `npm run template:render`.
- Commit style: conventional commits; scope-enum enforced — see Task 1.

---

## Part A — Hygiene & release preconditions

### Task 1: commitlint scopes + land this plan

**Files:**
- Modify: `commitlint.config.js`
- Create: `docs/plans/2026-08-05-p1-document-format-compiler.md` (this file)

**Step 1:** In `commitlint.config.js` `scope-enum`, add `'cli'`, `'template'`, `'document'`, `'deps'`; remove `'legacy'`. Keep the rest.

**Step 2:** Verify: `echo "feat(document): x" | npx commitlint` → passes; `echo "feat(legacy): x" | npx commitlint` → fails.

**Step 3:** Commit both files: `chore: add cli/template/document commit scopes; import P1 plan`

### Task 2: Vendor scaffolder templates in-tree, remove submodule

**Files:**
- Delete: `.gitmodules` entry + gitlink `packages/create/examples`
- Create: `packages/create/templates/default/**` (vendored, rescoped)
- Modify: `packages/create/index.js`, `packages/create/package.json`

**Step 1:** Fetch the upstream `default` template at the pinned commit into a scratch dir:
`git clone --depth 1 https://github.com/redotvideo/examples /tmp/rv-examples && git -C /tmp/rv-examples fetch --depth 1 origin 25dd6b1763a97549b2c3bbe03bdfdf7201d803bb && git -C /tmp/rv-examples checkout 25dd6b17` (fall back to default branch if the pin is unfetchable; record which).

**Step 2:** `git rm --cached packages/create/examples && git rm .gitmodules` (single submodule — remove the file). Copy `/tmp/rv-examples/default` → `packages/create/templates/default`. Audit the copy: rescope `@revideo/*` → `@fantoche-dev/*` in its package.json/imports, pin versions `0.11.0`, remove any telemetry/fonts-CDN references (apply the Task 3 font treatment if it has Google Fonts), verify no `.git` dirs came along.

**Step 3:** Update `packages/create/index.js`: `templates` array → only `{title: 'Default project', value: 'default', startcommands: 'default'}`; `templateDir` resolution `examples/${...}` → `templates/${...}`.

**Step 4:** `packages/create/package.json`: `files: ["index.js", "templates"]`; add `"kleur"` to `dependencies` (fixes the packaging bug).

**Step 5:** Smoke test (this is the acceptance): from a scratch dir, `node "<repo>/packages/create/index.js" --default` with a project name → project scaffolds; `npm install && npm run build` inside it succeeds against workspace versions (`npm pack` the six deps or use `file:` overrides — document what was used). At minimum: scaffold + `grep -r "@revideo" <scaffolded>` → 0.

**Step 6:** Update `CONTRIBUTING.md`/`RELEASING.md` mentions of the submodule. Commit: `feat(create)!: vendor default template in-tree, drop examples submodule`

> **Task 2 outcome + amendment (2026-08-05):** the upstream `default` template
> turned out to depend on remote S3 assets (`revideo-example-assets.s3…`:
> mp4/mp3/logo) — offline-first violation on a bucket we don't control. The
> vendored template was therefore derived from our own `packages/template`
> (post-Task-3, so fonts ship local) instead of the upstream example. Lessons:
> a standalone scaffolded project must NOT have `"type": "module"` (NodeNext
> then demands explicit import extensions; the monorepo template is CJS-typed)
> and MUST declare `@types/node` explicitly (hoisted in the monorepo, absent
> standalone) — both were real bugs caught by the file:-override build
> acceptance (`smoke-test.mjs` scaffold → `npm install` → `tsc` green, zero
> upstream refs). Registry-based install remains verifiable only after first
> publish. Executed after Task 3 (order swapped so the template is born
> offline-first).

### Task 3: Offline fonts for the template (render path)

**Files:**
- Create: `packages/template/src/fonts/roboto-400.woff2`, `roboto-700.woff2`, `packages/template/src/fonts.css`
- Modify: `packages/template/src/global.css`, `packages/template/src/project.ts`

**Step 1:** Download Roboto 400/700 latin woff2 (from the google/fonts repo, OFL) into `packages/template/src/fonts/`. Record exact source URLs + license in a `packages/template/src/fonts/README.md`.

**Step 2:** Replace `global.css`'s `@import url(https://fonts.googleapis.com/...)` with `@font-face` rules pointing at the local woff2 (`font-display: block` — render must not swap mid-frame).

**Step 3:** Verify offline: `npm run template:render` still green; then re-run with network blocked for fonts.googleapis.com (e.g. `127.0.0.1 fonts.googleapis.com` via a temporary `/etc/hosts` entry, or assert via devtools/network log that no fonts request leaves) — record method used. e2e + template goldens unchanged (text scene uses the same Roboto binary — if pixels shift, regenerate goldens on CI per the P0 Task 8 mechanism and explain in the commit).

**Step 4:** Commit: `fix(template): bundle Roboto locally — offline-first render path (ADR 0004 consequence)`

> **Task 3 outcome (2026-08-05):** executed before Task 2 (order swapped so the
> vendored template is born offline-first). Offline verification method: the
> template scene renders no text (Rubik's cube only), so pixel comparison is
> vacuous — verification was (a) `git grep fonts.googleapis` = 0 across
> template+create, (b) `npm run template:render` green with the local
> `@font-face` files in place. `packages/ui`'s Google-Fonts import remains
> (editor-only) — recorded as P2+ debt.

> **Batch A+B Opus review outcomes (2026-08-05):** applied — `sin`/`cos`
> dropped from `EASING_NAMES` (waveform remappers, violate f(0)=0/f(1)=1);
> elements became a `z.discriminatedUnion` with a hand-written recursive
> `DocumentElement` type (only the layout node is hand-typed); union
> validation errors now report only the fewest-issues branch (one typo = one
> error, was 28); the anchor grammar moved from `.refine` to `.regex` so the
> JSON Schema artifact carries the `pattern`; the artifact emitter
> post-processes exact tuple lengths, svg/edit exactly-one-of `oneOf`s,
> stable `$id`/`title`/`$defs.element`, with a drift test pinning the
> committed file to the zod schema; `DOCUMENT_FORMAT_VERSION` moved to
> `version.ts` (import cycle) and the migration walker gained a cycle guard;
> word anchors with offsets warn about the `word:step-1` ambiguity, with a
> table-driven grammar test. **Structural discovery:** core's built `lib/` is
> not plain-node-ESM-resolvable (directory imports) — the root barrel of
> `@fantoche-dev/document` is therefore kept node-safe (no core imports) and
> the evaluator lives under the `./evaluator` subpath, guarded by a
> node-safety test; fixing core's lib for node ESM is recorded as a
> candidate upstream-style fix. Deviation note: element/timeline types live
> in `schema.ts` (no separate `types.ts`). Hygiene: publish workflow gained
> a test gate + template-pin drift guard; scaffolded projects get a
> `.gitignore` (shipped as `_gitignore`); scaffolder smoke test promoted to
> `npm run test:smoke`.

### Task 4: Restore publish workflow (dispatch-only) + rewrite RELEASING.md

**Files:**
- Create: `.github/workflows/publish.yml` (adapted from `git show a97aea31:.github/workflows/publish.yml`)
- Modify: `RELEASING.md` (full rewrite, drop "superseded" banner)

**Step 1:** Adapt the recovered workflow: remove checkout `submodules: true` + the `git submodule init/update` step (submodule is gone after Task 2); `--ignore @revideo/docs` → `--ignore @fantoche-dev/docs`; bot identity → `github-actions[bot]` with `secrets.GITHUB_TOKEN`; keep OIDC (`permissions: id-token: write`) and the release/canary `lerna publish` split; keep `HUSKY: 0`.

**Step 2:** Rewrite RELEASING.md: canary-first policy, version sync duty for `packages/cli/src/index.ts:9` (`VERSION`), the smoke-test checklist (scaffold via `npm create @fantoche-dev`, template render, editor boot), and the **manual precondition**: Daniel must configure npm *trusted publishing* for the `fantoche-dev/fantoche` repo on each `@fantoche-dev/*` package (or add an `NPM_TOKEN` secret and swap the workflow to token auth — document both, prefer OIDC).
- **⚠️ Publishing itself is NOT executed in this plan** — first publish is a Daniel decision (outward-facing). The gate for this task is only: workflow file lints (`gh workflow view` after push), RELEASING.md accurate.

**Step 3:** Commit: `ci: restore npm publish workflow (OIDC, no submodules); rewrite RELEASING.md`

### Task 5: Daniel's manual list (record; not executable by Claude alone)

- [ ] npm trusted publishing config on npmjs.com for the 10 publishable packages (or `NPM_TOKEN` secret).
- [ ] Branch protection on `main` requiring the CI checks (now that CI exists; note lerna's release flow pushes a version commit — upstream dispatched from a `release-X.Y.Z` branch for this reason; RELEASING.md documents it).
- [ ] Approve seeding of 3–5 `good first issue`s (drafts prepared in Part F).

---

## Part B — `@fantoche-dev/document`: schema

### Task 6: Package scaffold

**Files:**
- Create: `packages/document/package.json`, `tsconfig.json`, `vitest.config.ts`, `src/index.ts`

`package.json`: name `@fantoche-dev/document`, version `0.11.0`, `type: module`, build `tsc`, test `vitest run`; deps: `zod@^4`, `@fantoche-dev/core@0.11.0`; peerDeps none yet (2d arrives in Part D). Subpath exports: `.` (schema/compiler/evaluator — DOM-free) and `./scene` (added in Part D). Mirror `packages/cli`'s tsconfig (plain tsc build). Add the package to the root workspace automatically (workspaces glob). Add `document` scope usage note.

**Verify:** `npx lerna run build --ignore @fantoche-dev/docs` builds the new package; `npx lerna run test` picks up an initial trivial test. Commit: `feat(document): scaffold @fantoche-dev/document package`

### Task 7: Schema v0.1 (TDD)

**Files:**
- Create: `packages/document/src/schema.ts`, `src/types.ts`, `src/__tests__/schema.test.ts`

Document v0.1 shape (zod source of truth; illustrative — the task implements exactly this):

```ts
{
  version: '0.1',
  meta: {fps: int 1..120, size: [w,h] positive ints, background?: color string | null,
         duration?: seconds > 0 /* required if it cannot be inferred from timeline+narration */},
  assets?: Record<id, {type: 'image'|'svg'|'audio', src: string}>,
  narration?: {audio?: assetId, segments: [{id, text, start: seconds, dur: seconds,
               words?: [{text, start, dur?}]  /* explicit in v0; P2 supplies from alignment */}]},
  elements: [ /* ordered — z-order; parent nesting via `children` on layout */
    {id, type: 'text',   props: {text, fontFamily?, fontSize?, fill?, textAlign?, x?, y?, ...transform}},
    {id, type: 'rect'|'circle'|'line'|'path'|'polygon', props: {...shape/curve props, points?/data?/sides?}},
    {id, type: 'image',  props: {src /* assetId or path */, width?, height?, ...}},
    {id, type: 'svg',    props: {svg | src: assetId, ...}},
    {id, type: 'latex',  props: {tex, height?, ...}},
    {id, type: 'code',   props: {code, language?, fontSize?, ...}},
    {id, type: 'layout', props: {direction?, gap?, padding?, alignItems?, justifyContent?, width?, height?, ...},
                         children: [elements]},
  ],
  timeline: [
    {at: TimeRef, target: id, set:   {prop: value, ...}},
    {at: TimeRef, target: id, tween: {prop: {to, from?}, ...}, dur: seconds, easing?: EasingName},
    {at: TimeRef, target: codeId, select: RangeSpec, dur?: seconds},
    {at: TimeRef, target: codeId, edit: {replace?: [RangeSpec, string], insert?: [[line,col], string],
                                          remove?: RangeSpec, to?: string /* whole-code diff */}, dur?: seconds},
    {at: TimeRef, block: {src: './file.tsx#exportName', dur: seconds}},
  ],
}
// TimeRef = number(seconds) | `${segId}.start` | `${segId}.end` | `${segId}.word:${word}`
//           each string form optionally suffixed `+${n}` | `-${n}` (seconds)
// RangeSpec = {lines: [from, to|null]} | {word: [line, col, len|null]} | {match: string, which: 'first'|'last'|'all'}
//             (null → Infinity at parse; lines/cols 0-based, end-exclusive — matches code/CodeRange.ts)
// EasingName = 'linear' | 'easeInOutCubic'(default) | ... (exact list = non-parametrized exports of
//              core timingFunctions + pre-instantiated back/bounce/elastic; mapped in compiler)
```

TDD: parse-accept tests (minimal doc; full-feature doc), parse-reject tests with actionable error paths (unknown element type, bad anchor syntax, duplicate ids, tween on unknown target — the last two are compiler concerns, schema only shapes). Export inferred TS types. `validateDocument(json): {ok, doc?} | {ok: false, errors: [{path, message}]}` wrapper (zod issues → JSON-pointer-ish paths).

Commit per green step: `feat(document): document schema v0.1 with validation errors`

### Task 8: Published JSON Schema + migration scaffold

**Files:**
- Create: `packages/document/src/json-schema.ts` (build-time: `z.toJSONSchema(documentSchema)` → emit `packages/document/schema/document-0.1.schema.json`, committed artifact + npm `files` entry)
- Create: `packages/document/src/migrate.ts` + tests: `migrate(unknown): {doc: Document, applied: string[]}` — registry `Record<fromVersion, (doc) => doc>`; v0.1 has an empty chain; unknown version → typed error. Property test: `migrate` idempotent; `parse(serialize(doc))` round-trips (fast-check or a hand-rolled generator over the schema — hand-rolled acceptable at v0.1).

Commit: `feat(document): JSON Schema artifact + version migration scaffold`

---

## Part C — Compiler + evaluator (all pure, all TDD)

### Task 9: Anchor resolution

**Files:** `packages/document/src/compiler/anchors.ts` + tests

`resolveTimeRef(ref, narrationIndex): seconds` — narrationIndex built once from segments (`segId → {start, end, words: Map<word → start>}`). Word refs: first occurrence in the segment; missing segment/word → compile error carrying the timeline item index + the ref string. Offsets applied after base resolution. Tests: numeric passthrough, all anchor forms, ± offsets, ambiguous word (first wins, warning emitted), missing → error.

### Task 10: Lowering to IR

**Files:** `packages/document/src/compiler/compile.ts`, `src/ir.ts` + tests

```ts
interface TimelineIR {
  fps: number; size: [number, number]; background: string | null; durationF: number;
  elements: CompiledElement[];            // flattened build specs: {id, type, props, parentId|null, order}
  tracks: Track[];                        // one per (target, prop) with ≥1 key, keys sorted by t
  codeTracks: CodeTrack[];                // selection/edit ops with resolved ranges & precomputed diffs deferred to runtime
  blocks: BlockIR[];                      // {t0F, t1F, src, exportName}
}
interface Track {target: string; prop: string;
  keys: {tF: number; value: unknown; easing: EasingName;}[];  // value at tF; segment [prev.tF, tF] eases prev→this
  initial: unknown;                       // element prop value at t=0 (from element props or first `set`)
}
```

Rules (tested one by one): `set` → step key (easing `'hold'`); `tween` → segment key with `from` defaulting to the running value (the compiler threads value state per prop — same-prop overlapping tweens are a **compile error**, not last-wins); element `props` provide `initial`; `durationF` = max(explicit meta.duration, last key/block/narration end) × fps, ceil; unknown target id → error with item index; `RangeSpec` `null` → `Infinity` expansion here (IR is not JSON — plain objects with real Infinity are fine in memory; the *serialized* golden IR fixtures use the sentinel).

Commit: `feat(document): compiler — anchors + timeline IR lowering`

### Task 11: Evaluator `state(t)`

**Files:** `packages/document/src/evaluator.ts` + tests

`evaluate(ir, tSeconds): FrameState` where `FrameState = {props: Map<targetId, Map<prop, unknown>>, code: Map<targetId, CodeFrameState>, blocks: ActiveBlock[]}`. Per track: binary search keys (`tF ≤ t`), interpolate within segment via easing map (`EASINGS: Record<EasingName, TimingFunction>` from `@fantoche-dev/core`) + value lerp: numbers via `map`, arrays/colors/strings via `deepLerp`/`Color.lerp` semantics — the evaluator emits *plain values*; node-specific parsing stays in the adapter. `CodeFrameState` = {code|fragments+progress, selection|oldSelection+selectionProgress} mirroring the imperative recipes.

Tests: purity (same ir+t ⇒ deep-equal state, 1000 random t); monotone sweep equals random-access at every frame (the anti-drift property); easing correctness at t=0/mid/1; O(1) microbench — `evaluate` at t=end of a 10-minute 3000-key doc within a fixed budget (assert < 1ms/call on CI-class hardware; record number, don't over-tune).

Commit: `feat(document): pure evaluator state(t) with purity + complexity tests`

---

## Part D — Runtime: DocumentScene beside generator scenes

### Task 12: core — extract `AbstractScene` (mechanical, cherry-pickable)

**Files:** `packages/core/src/scenes/AbstractScene.ts` (new), `GeneratorScene.ts` (shrinks), `index.ts`

Move verbatim from `GeneratorScene`: fields/dispatchers/`lifecycleEvents`/`previous`/media defaults/constructor wiring (`Variables`→`Shaders`→`Slides` order, lines 123-141), `getSize/getRealSize`, state-machine helpers, `isCached`, `execute` (lines 289-347, 358-370). `GeneratorScene extends AbstractScene` keeps `recalculate/next/reset/render/reload` + threading. **Gate for this task: zero behavior change** — full build + unit + e2e + template render green; diff reviewed to be movement-only. Commit: `refactor(core): extract AbstractScene from GeneratorScene (no behavior change)`

### Task 13: core — `Seekable` capability + PlaybackManager fast path

**Files:** `packages/core/src/scenes/Seekable.ts` (new), `scenes/index.ts`, `app/PlaybackManager.ts` + unit test

```ts
export interface Seekable {seekToFrame(frame: number): Promise<void>;}
export function isSeekable(v: any): v is Seekable {return v && typeof v === 'object' && 'seekToFrame' in v;}
```

In `seek()`, after the reset block (line ~101), before the step loop:
```ts
if (this.previousScene === null && isSeekable(this.currentScene) && this.currentScene.isCached() &&
    frame >= this.currentScene.firstFrame && frame <= this.currentScene.lastFrame) {
  this.frame = frame;                       // BEFORE seekToFrame — PlaybackStatus.time reads playback.frame
  await this.currentScene.seekToFrame(frame);
  this.finished = this.currentScene.isFinished();
  return this.finished;
}
```
Mid-transition (`previousScene !== null`) falls through to the loop (correctness over speed; rare). Unit test with a stub Seekable scene: seek(5000) performs exactly one `seekToFrame` call and zero `next()` calls; non-seekable path unchanged (existing tests). Commit: `feat(core): opt-in Seekable scene capability with O(1) seek fast path`

### Task 14: `DocumentScene` + `makeDocumentProject`

**Files:** `packages/document/src/scene/DocumentScene.ts`, `src/scene/makeDocumentScene.ts`, `src/scene/makeDocumentProject.ts`, subpath export `./scene`; add `@fantoche-dev/2d@0.11.0` dep.

`DocumentScene extends AbstractScene implements Scene<CompiledDocument>, Seekable`:
- `recalculate(setFrame)`: O(1) — cached bounds from `ir.durationF`, `setFrame(lastFrame)`, dispatch `recalculated` (Slides listens).
- `reset()`: dispose+rebuild node tree from `ir.elements` inside `execute()` (build map `id → node`; `key: id`), state → `AfterTransitionIn`, dispatch `afterReset`, `applyState(playback.time)`.
- `next()`: `applyState(playback.time)` + finished/canTransitionOut bookkeeping from frame vs `lastFrame`. Idempotent, cheap.
- `seekToFrame(frame)`: `applyState(frame / fps)` inside `execute()`.
- `render(ctx)`: copy the `DependencyContext` drain loop (`GeneratorScene.render` 157-171) + `Scene2D.draw`-style lifecycle dispatches + `view.render(ctx)`. View: own minimal `View2D` creation mirroring `Scene2D.recreateView`.
- `applyState(t)`: `evaluate(ir, t)` → for each (target, prop) set signal via the adapter table (Task 15); fresh objects per frame; code states via the §primer recipes.
- `getMediaAssets/stopAllMedia/adjustVolume`: v0 returns narration audio asset if declared (reuse `Scene2D.ts:166-229` shape) — audio mixing correctness verified in Part F export test.
- `makeDocumentScene(name, doc)` → `{klass: DocumentScene, name, config: compile(validate(doc)), stack, plugins: ['@fantoche-dev/2d/editor']}`; `makeDocumentProject(doc, name?)` → `makeProject({scenes: [makeDocumentScene(...)], settings: {shared: {size, background}, preview: {fps}, rendering: {fps}}})` — **fps baked here** (renderVideo cannot override it).

Test: vitest + the `mockScene2D` idiom (`packages/2d/src/lib/components/__tests__/mockScene2D.ts`) adapted — construct a DocumentScene from a small doc, `seekToFrame` to assorted frames, assert node signal values equal evaluator output; assert `next()` after `seekToFrame` is consistent (no drift). Commit: `feat(document): DocumentScene — O(1) seek scene driving 2d nodes`

> **Tasks 14–16 outcome (2026-08-05):** landed as `packages/document/src/scene`
> (`./scene` subpath; jsdom tests). Deviations/limitations recorded:
> DocumentScene duck-types the Scene2D registry surface (`registerNode`/
> `getNode`) that `useScene2D()` callers actually touch, instead of core
> exposing a formal interface; `getMediaAssets` returns `[]` in v0 (narration
> audio muxing deferred to the corpus/CLI work — documents declare no playable
> media elements); svg elements support inline markup only at runtime
> (asset-file src errors with guidance); code diff fragments are memoized per
> (before, after) pair and re-wrapped fresh per frame per the identity-check
> rule; DOM lib added to the package tsconfig (types only — the node-safety
> test still guards the root barrel at runtime). Block replay is bounded by
> the block window and verified by seek-equals-sweep, backward-seek and
> node-cleanup tests.

### Task 15: Element builders (adapter table)

**Files:** `packages/document/src/scene/builders.ts` + tests

`BUILDERS: Record<ElementType, {build(props, assets): Node; apply(node, prop, value): void}>` — text→`Txt` (prop `text` via `text()`, fonts via Layout signals), rect/circle/line/path/polygon→ respective classes (`points` arrays lerped by evaluator as number-pairs → fresh arrays), image→`Img` (`src` from assetId or path), svg→`SVG`, latex→`Latex`, code→`Code` (+ per-frame code state application incl. `oldSelection`/`selectionProgress` and fresh `{progress, fragments}` objects), layout→`Layout` with children built recursively (document rule: children of a layout are layout-positioned; everything else absolute). Sentinel expansion (`null`→`Infinity`) for ranges. Per-builder unit tests in the mock scene: build → apply a frame → read back signals.

Commit: `feat(document): element builders for the v0 element set`

### Task 16: Code-block escape hatch

**Files:** `packages/document/src/scene/blocks.ts` + tests; compiler already carries `BlockIR`

Semantics (ADR 0002): a block references a generator export with **declared duration**; inside `[t0, t1)` the DocumentScene owns a bounded child runner: entering the window (or seeking into it) resets the block's thread pool and steps `floor((t - t0) × fps)` frames — replay is bounded by block duration, **never** by document length (this is the honest O(1)-relative-to-document claim; record it in the gate). Blocks run in a dedicated child `Node` container; their nodes are disposed on window exit. v0 restriction: block src must be an import path resolvable by vite from the document's project (the shim imports it statically — the CLI shim generator collects block srcs and emits imports; same for the editor usage).

Tests: block runs deterministically on sweep; seeking into the middle of a block equals sweeping into it (golden-compare a frame both ways in the corpus, Part F).

Commit: `feat(document): code-block escape hatch with bounded-window replay`

---

## Part E — CLI

### Task 17: `fantoche render <doc.json>`

**Files:** `packages/cli/src/index.ts` (new subcommand), `packages/cli/src/render-doc.ts` (new); `packages/cli/package.json` (+`@fantoche-dev/document` dep)

Flow: read + `validateDocument` (pretty errors, exit 1) → `migrate` if older version → generate shim at `<cwd>/node_modules/.fantoche/render-<hash>.ts`:
```ts
import {makeDocumentProject} from '@fantoche-dev/document/scene';
/* block imports collected from doc.timeline[].block.src */
const doc = JSON.parse(<escaped JSON string literal>);
export default makeDocumentProject(doc, <name>);
```
→ `renderVideo({projectFile: './node_modules/.fantoche/render-<hash>.ts', settings: {outFile, outDir, workers, logProgress: true, projectSettings: {exporter: {name: '@fantoche-dev/core/wasm'}}}})` → print returned path → `finally` unlink shim. Options: `--out <file.mp4>` (default `<docname>.mp4`), `--out-dir` (default `./output`), `--workers`. Determinism note in help: same doc + assets ⇒ same video (modulo encoder); fps/size come from the document only.

Tests: unit-test shim generation (snapshot the generated source for a fixture doc, hash stability); end-to-end covered by Part F. Also fix while here: `VERSION` still hand-synced — leave, but add a comment pointing at RELEASING.md. Commit: `feat(cli): fantoche render <doc.json> — headless document rendering`

---

## Part F — Golden corpus + the P1 gate

### Task 18: Document corpus in the e2e harness

**Files:** `packages/e2e/documents/*.json` (corpus), `packages/e2e/tests/project.ts` (register document scenes), goldens via the P0 Task 8 CI mechanism

Corpus v0 (each pins a semantic): `text-basics.json`, `shapes-draw-on.json` (`end` 0→1), `layout-flex.json`, `image-svg.json`, `latex.json`, `code-highlight.json` (selection anim), `code-diff.json` (edit `to`), `anchors-narration.json` (explicit segments + word anchors), `block-escape.json`. Register with `makeDocumentScene` beside circle/rect/mc-compat. Goldens: local run writes macOS candidates → delete → CI artifact mechanism from P0 Task 8 (plan doc amendment there documents it) → commit Linux goldens.

Commit: `test(document): golden corpus for document semantics`

### Task 19: The gate document + scrub-vs-export identity + O(1) measurement

**Files:** `packages/e2e/documents/gate.json`, `packages/e2e/src/document-gate.test.ts`, results appended below

- `gate.json`: text + shapes + an image + a `Code` node with an animated highlight + an embedded code block — the roadmap's non-trivial doc, ≥ 20s duration.
- **Scrub-vs-export identity:** render frame k via (a) the image-sequence exporter path (sweep) and (b) a fresh scene + `seekToFrame(k)` (random access), for k ∈ {0, mid, block-interior, last}; assert pixel-identical (threshold 0 — same platform, same code path; any diff is a determinism bug).
- **O(1) seek measured:** with the Player's existing `logger.profile('seek time')` or a direct harness: seek to end-of-document for docs of duration 10s/60s/600s (same content density); assert seek time is flat (< 50ms, and 600s ≤ 2× the 10s time), and assert `next()` call count during seek is 0 (spy) for document scenes. Record numbers here.
- Gate criteria checklist (from `docs/05-roadmap.md` P1) appended to this file with evidence when done.

Commit: `test(document): P1 gate — scrub/export identity + O(1) seek measurements`

### Task 20: Docs + good-first-issues + wrap

- `packages/document/README.md`: format tour, JSON Schema pointer, CLI usage, escape-hatch contract, "what's not in v0" (springs, video/audio elements, icons, auto-alignment → P2).
- Draft 3–5 `good first issue`s (e.g. new easing names, new corpus documents, `--range` flag for CLI render, RangeSpec `match` sugar) — file via `gh` after Daniel approves (Task 5).
- Record P1 gate results; update `docs/05-roadmap.md` checkboxes if any; final full verification: build + unit + e2e + template render + `fantoche render packages/e2e/documents/gate.json`.

---

## Execution order & checkpoints

Batches: **[1–4]** hygiene → checkpoint; **[6–8]** schema → checkpoint; **[9–11]** compiler+evaluator → checkpoint; **[12–13]** core surgery (highest-risk; e2e must stay green) → checkpoint; **[14–16]** runtime → checkpoint; **[17]** CLI; **[18–19]** corpus+gate; **[20]** wrap. Task 5 runs whenever Daniel is available; nothing blocks on it except actual npm publishing and issue filing.

Every task ends with the tree building and tests passing. Golden changes always regenerate on CI (Linux reference) with the P0 Task 8 artifact mechanism.

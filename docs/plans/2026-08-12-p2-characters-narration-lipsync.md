# P2 — Characters, Narration & Lipsync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

## Status — updated 2026-08-18

- **Agora:** Parte A (Tasks 1–7) completa. O gate cego PT-BR rodou duas
  vezes (a rodada 1 caiu por transcrição ≠ áudio; ver
  `docs/lipsync-spike-results.md`) e **ADR 0007 registra o gate em risco**:
  nenhum braço atinge ≥3 em todos os eixos; a P2 embarca autoria manual de
  visemas e o lipsync automático vai a re-spike.
- **Próximo:** decisão de reshape da P2 no checkpoint (fatia vertical com
  autoria manual no caminho do demo) antes de abrir a Parte B.
- **Bloqueio:** nenhum técnico; a decisão de reshape é do Daniel.
- **Última verificação:** 2026-08-18 — cli 40/40 testes; 2026-08-14 — build
  dos 10 pacotes, 434 unitários (seriais), E2E 13 cenas + goldens, lint.

**Goal:** A `character.json` (rig + poses + art slots imported from SVG) becomes a
first-class document citizen: a cast member is posed and gestured from the
narration-anchored timeline, its mouth driven by a viseme track derived from
Portuguese audio, its word timings produced by local forced alignment — the
whole north-star demo rendering offline, end-to-end, with `state(t)` still pure
and seek still O(1).

**Architecture:** Three layers, each pure at its own level. (1) **Import** is
offline and one-shot: the CLI splits the artist's SVG into one inline-markup
sub-SVG per slot, each re-centred so the slot's pivot sits at the sub-SVG's
centre — after which rotation about a pivot is just `rotation` on an ordinary
node. (2) **Compilation** expands a cast member into flat sibling `svg` elements
plus ordinary joint tracks (`ana.arm-l.rotation`), reusing P1's track machinery
unchanged. (3) **Evaluation** gains one new pure stage: the pose evaluator
composes the FK chain with 2×3 matrices and writes world transforms onto the
flat nodes, so draw order (`depth` → `zIndex`) is a poseable parameter that FK
hierarchy could never express (ADR 0006). Narration alignment and lipsync are
**dev-time tools** that emit committed JSON; the render path never shells out.

**Tech Stack:** zod v4 (character schema + JSON Schema artifact),
`@xmldom/xmldom` (SVG splitting, node-safe, CLI-only subpath), commander (CLI),
vitest, jest-image-snapshot corpus via the e2e harness. External **dev-time
only**: WhisperX (Python, BSD-2) for alignment, Rhubarb (C++ CLI, MIT) for the
viseme comparison arm — neither is installed in CI or needed to render.

---

## Decisions taken at plan time (Daniel may veto before execution)

1. **The lipsync spike runs first and standalone.** It is P2's gate risk
   (ADR 0004's Portuguese caveat), and it needs *no* character system: nine
   viseme mouth SVGs stacked as `svg` elements with hold-switched `opacity`
   are expressible in the **P1 format as it exists today**. So the riskiest
   question gets answered with zero new runtime code, and if PT-BR quality
   fails we learn it before a mouth-slot model is built around it.
2. **Slot art is split at import time**, not at compile or render time. The
   runtime's SVG parser **flattens `<g>` groups and discards their ids**
   (`packages/2d/src/lib/components/SVG.ts:665-668` — `getChildrenById` only
   ever finds leaf shapes), so binding a slot to a group through the live node
   is impossible without 2d surgery. Splitting to per-slot inline markup needs
   **no 2d changes at all** and reuses the `svg` element P1 already ships.
3. **Pivot = the sub-SVG's centre.** The importer rewrites each slot's
   `viewBox` so it is symmetric about the pivot; nodes are centre-origin
   (`localToParent` rotates about local 0,0 — `Node.ts:616-625`), so the
   pivot lands exactly on the rotation origin with no per-frame compensation
   and no dependence on measured size.
4. **FK is composed at evaluation time, not baked into keys.** Interpolating
   composed world transforms would move a limb along a chord instead of an
   arc. Tracks carry *joint* params; the pose evaluator composes them per
   frame (O(slots), ~20 matrix multiplies — still O(1) in document length).
5. **Joint scale is uniform (a scalar).** Non-uniform scale in a chain
   produces shear, which cannot be decomposed back into the node's
   `x/y/rotation/scale` signals. Enforced by the character schema.
6. **The pose evaluator uses its own 2×3 matrix helper, not `DOMMatrix`.**
   `@fantoche-dev/document` is node-safe and DOM-free by contract (see its
   `index.ts` header); `DOMMatrix` is not a Node global.
7. **Springs are critically damped only, on scalar numeric props only.**
   Under-damped oscillation and vector springs are deferred. Entry velocity is
   inherited **only from a preceding spring segment** — deriving it from an
   arbitrary named easing would need the timing functions inside the compiler,
   and those live in `@fantoche-dev/core`, which the compiler must not import.
8. **Format version bumps `0.1` → `0.2` with an identity migration.** Every
   addition is optional, so all 0.1 documents are valid 0.2 documents. The
   e2e corpus deliberately **stays on `"version": "0.1"`** so every CI run
   exercises the migration path (`makeDocumentScene` already migrates before
   validating — `makeDocumentScene.ts:24-25`). `schema/document-0.1.schema.json`
   stays committed: published schema artifacts are immutable.
9. **Alignment and lipsync tools are never a CI or render dependency.** Their
   adapters are tested against *committed sample outputs*, not live binaries.
   The derived `*.align.json` / `*.viseme.json` are committed cacheable
   artifacts, exactly as ADR 0004 requires.
10. **`cast` resolution is caller-provided, so the compiler stays pure.**
    `compileDocument(doc, {characters})` takes an already-parsed character map;
    the CLI shim and `project.ts` resolve paths to JSON, mirroring how `blocks`
    are already threaded through `makeDocumentScene`.

---

## Context primer for the executor (read first)

- **Design authority:** `docs/adr/0004` (narration is the spine, PT-BR caveat),
  `docs/adr/0005` (pure pose function, no state machines),
  `docs/p2-design-notes.md` (the three failure modes this plan answers),
  `docs/design-review-2026-08-06.md` §4 (springs/retiming),
  `docs/05-roadmap.md` P2 (the gate), `docs/02-vision.md` §5 (north-star demo).
- **P1 is the substrate — read it, do not re-derive it.**
  `docs/plans/2026-08-05-p1-document-format-compiler.md` (its context primer
  documents the scene machinery, signal idiom and renderVideo constraints;
  all of it still holds).
- **Compiler facts** (verified 2026-08-12):
  - `ANIMATABLE` (`compiler/compile.ts:47-61`) is a per-element-type allow-list
    gating which props a timeline item may drive. Timeline prop names are open
    strings — **anything new must be added here or it is rejected**, and that
    check is a security boundary (it stops documents invoking `dispose`).
  - Overlapping animations on the same `(target, prop)` are a `CompileError`
    (`compile.ts:278-291`). This is what makes the per-prop segment chain
    well-ordered, which is precisely what lets spring entry velocity be baked
    in one pass.
  - `TrackKey.easing` describes travel **from the previous key to this one**;
    `'hold'` means keep the previous value and jump at `tF` (`ir.ts:36-44`).
  - Duration inference: keys/code ops are inclusive (`tF + 1`), block windows
    and `meta.duration` exclusive (`compile.ts:402-433`).
- **Evaluator facts:** `evaluateTrack` (`evaluator.ts:181-197`) binary-searches
  the last key at-or-before the frame and lerps toward the next; `lerpValue`
  (`evaluator.ts:108-141`) extrapolates numbers deliberately (back/elastic
  overshoot must survive) and clamps everything else. `evaluateFrame` is the
  purity boundary — same IR + same frame ⇒ same state, no prior-frame reads.
- **Runtime facts:** `DocumentScene.applyState` (`scene/DocumentScene.ts:246-274`)
  writes `state.props` onto nodes via `applyProp`, which **requires a real
  signal** (`scene/builders.ts:92-101` — checks `'context' in signal`).
  `buildElement` (`builders.ts:24-85`) maps element type → 2d node with
  `key: element.id`. `sortedChildren` sorts siblings by `zIndex`
  (`Node.ts:520-524`) with a stable sort, so equal depth falls back to build
  order. `getMediaAssets` currently returns `[]` (`DocumentScene.ts:199-201`) —
  that is why document renders have no audio today.
- **e2e harness:** documents live in `packages/e2e/documents/*.json`, are
  registered as scenes in `packages/e2e/tests/project.ts`, render as PNG
  sequences and are compared by `packages/e2e/src/rendering.test.ts`. Goldens
  are **Linux-generated** — regenerate via CI artifact, never locally.
  Thresholds: 20px strict on Linux; darwin-only 0.8% allowance on text scenes.
- **Verification pattern:** build `npx lerna run build --ignore @fantoche-dev/docs`;
  unit `npx lerna run test`; e2e `npm run e2e:test`; render smoke
  `npm run template:render`. A single file:
  `cd packages/<pkg> && npx vitest run src/__tests__/<name>.test.ts` —
  **never** `npx vitest … -w <pkg>`: `-w` is vitest's own `--watch`, not npm's
  workspace flag, and the run will hang.
- **Test style:** the suites use `test(...)`, never `it(...)` (83 call sites to
  zero in `packages/document`). The snippets below are illustrative — match the
  repo, not the snippet, wherever the two disagree, and say so in your report.
- **Skills:** @superpowers:test-driven-development for every task below;
  @superpowers:verification-before-completion before any "done" claim.
- Commit style: conventional commits, scope-enum enforced (Task 1).

---

# Part A — Lipsync spike (the gate risk, first)

## Task 1: commitlint scopes + land this plan

**Files:**
- Modify: `commitlint.config.js`
- Create: `docs/plans/2026-08-12-p2-characters-narration-lipsync.md` (this file)

**Step 1:** Add `'character'`, `'lipsync'`, `'narration'` to the `scope-enum`
array (keep it alphabetical; the list currently ends `…'ui', 'vite-plugin'`).

**Step 2:** Verify:
```bash
echo "feat(character): x" | npx commitlint   # passes
echo "feat(rig): x" | npx commitlint         # fails
```

**Step 3:** Commit: `chore: add character/lipsync/narration scopes; import P2 plan`

---

## Task 2: Viseme track format

The single interchange type both spike arms produce, so the blind comparison
compares *quality*, not plumbing.

**Files:**
- Create: `packages/document/src/lipsync/visemes.ts`
- Test: `packages/document/src/__tests__/visemes.test.ts`
- Modify: `packages/document/src/index.ts` (re-export)

**Step 1: Write the failing test**

```ts
import {describe, expect, test} from 'vitest';
import {VISEMES, visemeAt, visemeTrackSchema} from '../lipsync/visemes.js';

describe('viseme track', () => {
  test('accepts the Preston-Blair alphabet and rejects strays', () => {
    expect(VISEMES).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'X']);
    const ok = visemeTrackSchema.safeParse({
      version: '0.1',
      engine: 'rhubarb',
      audio: 'voice.wav',
      cues: [{t: 0, viseme: 'X'}, {t: 0.2, viseme: 'B'}],
    });
    expect(ok.success).toBe(true);
    expect(
      visemeTrackSchema.safeParse({
        version: '0.1', engine: 'rhubarb', audio: 'v.wav',
        cues: [{t: 0, viseme: 'Q'}],
      }).success,
    ).toBe(false);
  });

  test('rejects unsorted cues (hold lookup assumes order)', () => {
    expect(
      visemeTrackSchema.safeParse({
        version: '0.1', engine: 'rhubarb', audio: 'v.wav',
        cues: [{t: 0.5, viseme: 'B'}, {t: 0.2, viseme: 'C'}],
      }).success,
    ).toBe(false);
  });

  test('holds each cue until the next one', () => {
    const cues = [{t: 0, viseme: 'X'}, {t: 0.2, viseme: 'B'}, {t: 0.4, viseme: 'X'}] as const;
    expect(visemeAt([...cues], 0)).toBe('X');
    expect(visemeAt([...cues], 0.19)).toBe('X');
    expect(visemeAt([...cues], 0.2)).toBe('B');
    expect(visemeAt([...cues], 10)).toBe('X');
  });
});
```

**Step 2:** Run `cd packages/document && npx vitest run src/__tests__/visemes.test.ts`
→ FAIL (module not found).

**Step 3: Implement**

```ts
import {z} from 'zod';

/** Preston-Blair / Rhubarb mouth set: A–H plus X (rest). */
export const VISEMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'X'] as const;
export type Viseme = (typeof VISEMES)[number];

export const visemeTrackSchema = z
  .strictObject({
    version: z.literal('0.1'),
    /** Which arm produced this — recorded so tracks stay attributable. */
    engine: z.enum(['rhubarb', 'whisperx']),
    audio: z.string().min(1),
    language: z.string().min(2).optional(),
    cues: z
      .array(z.strictObject({t: z.number().finite().min(0), viseme: z.enum(VISEMES)}))
      .min(1),
  })
  .refine(
    track => track.cues.every((cue, i) => i === 0 || cue.t > track.cues[i - 1].t),
    {message: 'cues must be strictly increasing in t', path: ['cues']},
  );

export type VisemeTrack = z.infer<typeof visemeTrackSchema>;

/** Hold semantics: a cue is in effect until the next one starts. */
export function visemeAt(cues: VisemeTrack['cues'], t: number): Viseme {
  let low = 0, high = cues.length - 1, found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (cues[mid].t <= t) { found = mid; low = mid + 1; } else { high = mid - 1; }
  }
  return found === -1 ? 'X' : cues[found].viseme;
}
```

**Step 4:** Re-run → PASS. Export `VISEMES`, `visemeTrackSchema`, `visemeAt`,
`type VisemeTrack` from `src/index.ts`.

**Step 5:** Commit: `feat(lipsync): viseme track format with hold lookup`

---

## Task 3: Audio + mouth-sheet fixtures  ⚠️ DANIEL-MANUAL

**Files:**
- Create: `packages/e2e/lipsync/pt-br-01.wav`, `pt-br-01.txt`
- Create: `packages/e2e/lipsync/en-01.wav`, `en-01.txt`
- Create: `packages/e2e/lipsync/mouth/{A,B,C,D,E,F,G,H,X}.svg`
- Create: `packages/e2e/lipsync/README.md`

**Step 1:** Daniel records **two ~8s clips** (one PT-BR, one EN), mono 16 kHz
WAV — the format both tools want, and small enough to commit (~250 KB each).
Content must contain bilabials (`p/b/m`) and rounded vowels (`o/u`), the
shapes that expose a bad viseme mapping. Suggested PT-BR line:
*"Bom dia, pessoal. Hoje vamos entender a busca binária, passo a passo."*
Transcripts go in the sibling `.txt`, exactly as spoken.

**Step 2:** Nine mouth SVGs, same canvas size and same coordinate origin, one
per viseme. Ugly-but-distinct is correct here — this is a discrimination test,
not art. Record provenance and licence in `README.md` (the repo is MIT; these
must be ours).

**Step 3:** Verify each SVG parses and they are all the same size:
```bash
node -e "const fs=require('fs');for(const v of 'ABCDEFGHX'){const s=fs.readFileSync(\`packages/e2e/lipsync/mouth/\${v}.svg\`,'utf8');console.log(v, /viewBox=\"([^\"]+)\"/.exec(s)?.[1]);}"
```
Expected: nine identical viewBoxes.

**Step 4:** Commit: `test(lipsync): PT-BR and EN audio fixtures + mouth sheet`

---

## Task 4: Rhubarb adapter (spike arm A)

**Files:**
- Create: `packages/cli/src/lipsync/rhubarb.ts`
- Create: `packages/cli/src/__tests__/fixtures/rhubarb-pt-br-01.json` (committed
  sample of real Rhubarb output — captured once by Daniel, then CI needs no binary)
- Test: `packages/cli/src/__tests__/rhubarb.test.ts`

**Step 1: Write the failing test**

```ts
import {describe, expect, test} from 'vitest';
import {readFileSync} from 'node:fs';
import {parseRhubarbOutput} from '../lipsync/rhubarb.js';

describe('rhubarb adapter', () => {
  test('converts mouthCues to a viseme track', () => {
    const raw = JSON.parse(
      readFileSync(new URL('./fixtures/rhubarb-pt-br-01.json', import.meta.url), 'utf8'),
    );
    const track = parseRhubarbOutput(raw, {audio: 'pt-br-01.wav', language: 'pt'});
    expect(track.engine).toBe('rhubarb');
    expect(track.cues[0].t).toBe(0);
    expect(track.cues.every(c => 'ABCDEFGHX'.includes(c.viseme))).toBe(true);
    expect(track.cues.every((c, i) => i === 0 || c.t > track.cues[i - 1].t)).toBe(true);
  });

  test('drops zero-length cues rather than emitting equal timestamps', () => {
    const track = parseRhubarbOutput(
      {mouthCues: [
        {start: 0, end: 0.1, value: 'X'},
        {start: 0.1, end: 0.1, value: 'B'},
        {start: 0.1, end: 0.3, value: 'C'},
      ]},
      {audio: 'x.wav'},
    );
    expect(track.cues.map(c => c.viseme)).toEqual(['X', 'C']);
  });
});
```

**Step 2:** Run → FAIL.

**Step 3: Implement.** `parseRhubarbOutput(raw, opts)` maps
`{mouthCues: [{start, end, value}]}` → `{version:'0.1', engine:'rhubarb',
audio, language, cues}`, keeping `start` as `t`, dropping any cue whose
`start` is not strictly greater than the previous kept cue's, and validating
the result through `visemeTrackSchema` before returning. Also export
`runRhubarb(wavPath, opts)` which spawns
`rhubarb -f json -r phonetic --machineReadable <wav>` via `node:child_process`,
throws an actionable error if the binary is absent ("Rhubarb not found — see
packages/e2e/lipsync/README.md; the spike needs it, rendering never does"),
and pipes stdout through `parseRhubarbOutput`. **`-r phonetic` is mandatory** —
the default PocketSphinx recognizer is English-only (research §3.3).

**Step 4:** Run → PASS.

**Step 5:** Commit: `feat(lipsync): rhubarb adapter (phonetic mode)`

---

## Task 5: WhisperX adapter + grapheme→viseme map (spike arm B)

**Files:**
- Create: `packages/cli/src/lipsync/whisperx.ts`
- Create: `packages/cli/src/lipsync/viseme-map.ts`
- Create: `scripts/align.py` (thin WhisperX wrapper, dev-time only)
- Create: `packages/cli/src/__tests__/fixtures/whisperx-pt-br-01.json` (committed
  real output)
- Test: `packages/cli/src/__tests__/whisperx.test.ts`

**Step 1: Write the failing test** — assert that (a) the PT map sends `m/b/p`
to `A`, rounded `o/u` to `F`, `f/v` to `G`, and silence gaps longer than 120 ms
to `X`; (b) `charAlignmentToVisemes` collapses consecutive identical visemes
into one cue; (c) the produced track validates against `visemeTrackSchema`.

**Step 2:** Run → FAIL.

**Step 3: Implement.**
- `scripts/align.py`: `whisperx <audio> --language <lang> --align_model <default>
  --return_char_alignments --output_format json` shelled out and normalised to
  `{words: [{text, start, end}], chars: [{char, start, end}]}`. Document in a
  header comment that this file is **never** imported by the runtime.
- `viseme-map.ts`: two explicit `Record<string, Viseme>` maps (`pt`, `en`) over
  graphemes, plus `X` for gaps. Portuguese orthography is close enough to
  phonemic for a first pass; **write that approximation down in the module
  docstring** — the spike exists to find out whether it is good enough.
- `whisperx.ts`: `charAlignmentToVisemes(alignment, {language, audio})` →
  `VisemeTrack`, collapsing runs and inserting `X` for silences ≥120 ms.

**Step 4:** Run → PASS.

**Step 5:** Commit: `feat(lipsync): whisperx char-alignment adapter + PT/EN viseme maps`

---

## Task 6: `fantoche lipsync preview` — viseme track → renderable document

The payoff of Decision 1: this emits a **plain P1 document**, so the spike
renders through the existing pipeline with no runtime changes.

**Files:**
- Create: `packages/document/src/lipsync/preview-doc.ts`
- Modify: `packages/cli/src/index.ts` (new `lipsync` command group)
- Create: `packages/cli/src/lipsync/command.ts`
- Test: `packages/document/src/__tests__/preview-doc.test.ts`

**Step 1: Write the failing test**

```ts
import {describe, expect, test} from 'vitest';
import {compileDocument, validateDocument} from '../index.js';
import {buildVisemePreviewDocument} from '../lipsync/preview-doc.js';

const MOUTHS = Object.fromEntries(
  [...'ABCDEFGHX'].map(v => [v, `<svg viewBox="0 0 100 60"><rect width="100" height="60"/></svg>`]),
);

describe('viseme preview document', () => {
  test('emits one svg element per viseme and hold-switches opacity', () => {
    const doc = buildVisemePreviewDocument({
      track: {version: '0.1', engine: 'rhubarb', audio: 'v.wav',
              cues: [{t: 0, viseme: 'X'}, {t: 0.5, viseme: 'B'}]},
      mouths: MOUTHS, fps: 30, size: [480, 320],
    });
    const validation = validateDocument(doc);
    expect(validation.ok).toBe(true);
    expect(doc.elements).toHaveLength(9);
    // Every cue sets exactly one mouth visible and the previous one hidden.
    const at05 = doc.timeline.filter(i => (i as {at: number}).at === 0.5);
    expect(at05).toHaveLength(2);
    const {ir} = compileDocument(validation.ok ? validation.doc : doc);
    expect(ir.tracks.every(t => t.keys.every(k => k.easing === 'hold'))).toBe(true);
  });

  test('is a pure function of its inputs', () => {
    const args = {track: {version: '0.1', engine: 'rhubarb', audio: 'v.wav',
                          cues: [{t: 0, viseme: 'X'}]} as const,
                  mouths: MOUTHS, fps: 30, size: [480, 320] as [number, number]};
    expect(buildVisemePreviewDocument(args)).toEqual(buildVisemePreviewDocument(args));
  });
});
```

**Step 2:** Run → FAIL.

**Step 3: Implement.** Nine `svg` elements (ids `mouth-A`…`mouth-X`) with inline
markup and `opacity: 0` except the first cue's; for each cue emit one `set`
raising the incoming mouth to `opacity: 1` and one lowering the outgoing one.
`meta.duration` = last cue + 0.5 s. Wire
`fantoche lipsync preview <track.json> --mouths <dir> --out <doc.json>` to write
the document, and `--render` to hand it straight to the existing `renderDoc`.

**Step 4:** Run → PASS.

**Step 5:** Commit: `feat(lipsync): viseme preview document generator + CLI`

---

## Task 7: Blind comparison + ADR 0007  ⚠️ DANIEL-MANUAL (the P2 risk gate)

**Files:**
- Create: `packages/cli/src/lipsync/compare.ts`
- Create: `docs/adr/0007-lipsync-engine.md`
- Create: `docs/lipsync-spike-results.md`

**Step 1:** `fantoche lipsync compare <a.viseme.json> <b.viseme.json> --mouths
<dir> --audio <wav> --out <dir>` renders both to mp4 (muxing the source audio
so the reviewer hears what they see), writes them as `left.mp4`/`right.mp4`
with a **deterministic but hidden** assignment (sorted hash of the two file
names — no `Math.random`, so the run reproduces), and writes `key.json`
recording which arm is which. Print the scoring rubric and *not* the key.

**Step 2:** Daniel scores both arms on both languages (PT-BR is the gate, EN is
the control): closure on bilabials, rounding on `o/u`, jitter, drift over 8 s.
1–5 each.

**Step 3:** Record raw scores in `docs/lipsync-spike-results.md`, then write
**ADR 0007** with the decision and its consequence:
- Rhubarb phonetic wins → adopt it, drop the grapheme map, note the
  Portuguese caveat is resolved by mode, not language support.
- WhisperX wins → adopt it; alignment and lipsync then share one dependency,
  which also simplifies Part D.
- **Neither reaches 3/5 on PT-BR** → ADR 0007 records the P2 gate as *at risk*
  and the fallback: ship manual viseme authoring (the track format already
  supports hand-written cues) and re-spike with a real PT-BR phoneme model.
  Do **not** silently proceed — this is the decision ADR 0004 gated on.

**Step 4:** Commit: `docs(lipsync): ADR 0007 — engine decision from the PT-BR blind spike`

> **CHECKPOINT — report to Daniel before Part B.** The chosen engine decides
> which adapter Part D reuses, and a failed gate changes P2's shape.

---

# Part B — ADR 0006 + character format & import

## Task 8: ADR 0006 — transform hierarchy vs render hierarchy

**Files:**
- Create: `docs/adr/0006-flat-slots-poseable-draw-order.md`
- Modify: `docs/03-architecture.md` (§3.4: point at ADR 0006; §5 open question 2
  is now answered — mark it resolved)

Write up, from `docs/p2-design-notes.md` §2 plus the verified facts here: cut-out
characters need depth swaps that FK cannot express; `zIndex` only sorts among
siblings (`Node.ts:520-524`) and a child can never render behind its parent;
runtime reparenting would break `state(t)` purity. Decision: flat siblings, FK
composed by the pose evaluator, `depth` as a hold-interpolated pose parameter.
Consequences: pivots must be resolved at import (Decision 3), joint scale must
be uniform (Decision 5), and the evaluator gains a bounded O(slots) stage.

**Commit:** `docs(character): ADR 0006 — flat slots with evaluator-composed FK`

---

## Task 9: `character.json` schema

**Files:**
- Create: `packages/document/src/character/schema.ts`
- Modify: `packages/document/scripts/emit-json-schema.mjs`, `packages/document/src/json-schema.ts`
- Test: `packages/document/src/__tests__/character-schema.test.ts`

**Step 1: Write the failing test** covering: a minimal valid character; a slot
whose `parent` does not exist → invalid; a **cycle** in `parent` → invalid; a
pose key naming an unknown slot → invalid; a pose key naming an unknown param
→ invalid; `scale` as a tuple → invalid (Decision 5); `pivot` accepting both
`[x, y]` and the bbox presets.

**Step 2:** Run → FAIL.

**Step 3: Implement**

```ts
export const PIVOT_PRESETS = [
  'center', 'top-center', 'bottom-center', 'left-center', 'right-center',
] as const;

/** Params a pose may drive on a slot. `depth` is always hold-interpolated. */
export const SLOT_PARAMS = ['x', 'y', 'rotation', 'scale', 'opacity', 'depth'] as const;

const slotSchema = z.strictObject({
  /** Element id in the source SVG — the mapping table (design notes §1). */
  element: z.string().min(1),
  parent: idSchema.optional(),
  pivot: z.union([
    z.tuple([z.number().finite(), z.number().finite()]),
    z.enum(PIVOT_PRESETS),
  ]).default('center'),
  /** Uniform only — non-uniform scale shears the FK chain (ADR 0006). */
  rest: z.strictObject({
    rotation: z.number().finite().default(0),
    scale: z.number().finite().positive().default(1),
    depth: z.number().finite().default(0),
  }).default({}),
});

export const characterSchema = z.strictObject({
  version: z.literal('0.1'),
  id: idSchema,
  art: z.strictObject({src: z.string().min(1)}),
  slots: z.record(idSchema, slotSchema),
  poses: z.record(idSchema, z.record(z.string().min(1), z.number().finite())),
  /** viseme letter → element id in the art (the mouth sheet). */
  visemes: z.record(z.enum(VISEMES), z.string().min(1)).optional(),
}).superRefine((doc, ctx) => { /* parent exists; no cycles; pose keys resolve */ });
```

Pose keys are `"<slot>.<param>"`; the `superRefine` splits on the last `.` and
checks both halves. Cycle detection: iterative colour-marking walk over
`parent`, reporting the cycle members in the message.

**Step 4:** Run → PASS. Emit `schema/character-0.1.schema.json` and extend the
existing drift test so a schema change without a regenerated artifact fails CI.

**Step 5:** Commit: `feat(character): character.json schema + JSON Schema artifact`

---

## Task 10: SVG art splitter (the heart of import)

**Files:**
- Create: `packages/document/src/character/split.ts`
- Modify: `packages/document/package.json` (dependency `@xmldom/xmldom`;
  new export subpath `./import`)
- Test: `packages/document/src/__tests__/split.test.ts`

**Step 1: Write the failing test**

```ts
const ART = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <g id="torso"><rect x="80" y="90" width="40" height="70"/></g>
  <g id="arm_x5F_l"><rect x="120" y="95" width="50" height="12"/></g>
  <circle id="pivot-arm-l" cx="122" cy="101" r="1" data-fantoche-pivot="arm-l"/>
</svg>`;

test('extracts one sub-svg per slot, pivot-centred', () => {
  const out = splitArt(ART, {
    'arm-l': {element: 'arm_x5F_l', pivot: [122, 101]},
  });
  const box = /viewBox="([^"]+)"/.exec(out.slots['arm-l'])![1].split(' ').map(Number);
  // viewBox is symmetric about the pivot: centre === pivot, exactly.
  expect(box[0] + box[2] / 2).toBeCloseTo(122, 6);
  expect(box[1] + box[3] / 2).toBeCloseTo(101, 6);
  expect(out.slots['arm-l']).toContain('width="50"');
  expect(out.slots['arm-l']).not.toContain('id="torso"');
});

test('reads pivot markers and strips them from the output', () => {
  const out = splitArt(ART, {'arm-l': {element: 'arm_x5F_l', pivot: 'center'}});
  expect(out.pivots['arm-l']).toEqual([122, 101]);           // marker wins over preset
  expect(out.slots['arm-l']).not.toContain('pivot-arm-l');   // marker never renders
});

test('reports orphans and misses instead of throwing', () => {
  const out = splitArt(ART, {'arm-r': {element: 'nope', pivot: 'center'}});
  expect(out.missing).toEqual(['arm-r']);
  expect(out.orphans).toContain('torso');
});

test('is deterministic', () => {
  const a = splitArt(ART, {'arm-l': {element: 'arm_x5F_l', pivot: 'center'}});
  expect(a).toEqual(splitArt(ART, {'arm-l': {element: 'arm_x5F_l', pivot: 'center'}}));
});
```

**Step 2:** Run → FAIL.

**Step 3: Implement** with `@xmldom/xmldom`'s `DOMParser`/`XMLSerializer`:
1. Parse the art; index every element carrying an `id`.
2. Collect pivot markers — elements with `data-fantoche-pivot="<slot>"` or
   `id="pivot-<slot>"` — reading `cx/cy` (or `x/y`) as the pivot in art
   coordinates. **Markers win over presets**; explicit numeric `pivot` in
   `character.json` wins over markers (it is the documented override).
   Remove every marker from the output.
3. For each slot: serialise the matched element (with inherited `fill`/`stroke`
   /`transform` from its ancestors composed onto it, so the fragment renders
   the same detached as attached), wrap it in a fresh `<svg>` whose `viewBox`
   is **symmetric about the pivot**: with the fragment's bbox half-extents
   `hx = max(|pivot.x − bbox.minX|, |bbox.maxX − pivot.x|)` (same for y), emit
   `viewBox="${px - hx} ${py - hy} ${2 * hx} ${2 * hy}"`. Padding is
   transparent and free; exact centring is what buys pivot-correct rotation.
4. Return `{slots, pivots, missing, orphans}` — never throw on a binding
   mismatch; that is `character check`'s job to report.

Bbox comes from a small `measureFragment` helper handling `rect`, `circle`,
`ellipse`, `line`, `polygon`/`polyline` and `path` (path: parse the `d`
command coordinates and take their extremes — an over-estimate for curves,
which is harmless here because the box is only a window).

**Step 4:** Run → PASS.

**Step 5:** Commit: `feat(character): pivot-centred SVG art splitter`

---

## Task 11: `fantoche character check`

**Files:**
- Create: `packages/cli/src/character/check.ts`
- Modify: `packages/cli/src/index.ts`
- Test: `packages/cli/src/__tests__/character-check.test.ts`

**Step 1: Write the failing test** — a character whose `element` ids no longer
match the art reports each slot as `bound` / `missing` / `orphaned`, and a
missing slot gets a **fuzzy suggestion** (Levenshtein ≤ 40 % of length) naming
the closest orphan; exit code is 1 when anything is unbound.

**Step 2:** Run → FAIL.

**Step 3: Implement** `checkCharacter(characterPath)` returning a structured
report (so the future editor reuses it), plus a printer. Suggestions are what
make re-imported art survivable (design notes §1): mangled ids like
`arm_x5F_l` must suggest `arm-l`, so normalise `_x5F_`/`_`/`-`/case before
scoring.

**Step 4:** Run → PASS.

**Step 5:** Commit: `feat(character): character check with fuzzy rebinding hints`

---

## Task 12: `fantoche character bind` + `import`

**Files:**
- Create: `packages/cli/src/character/bind.ts`, `packages/cli/src/character/import.ts`
- Test: `packages/cli/src/__tests__/character-bind.test.ts`

**Step 1: Write the failing test** — drive the interactive loop with a scripted
input stream (no TTY in CI): given art with three ids and a character missing
two bindings, the answers `1`, `s` (skip) produce a `character.json` with
exactly one new mapping and **no other key reordered or reformatted** (the file
is a user's document, not our output).

**Step 2:** Run → FAIL.

**Step 3: Implement.** `bind` walks unbound slots, lists candidate orphans
ranked by the Task 11 scorer, and writes the mapping back. `import <art.svg>`
scaffolds a `character.json` from the art's top-level group ids (best-effort
first binding) so nobody starts from an empty file. **Neither command ever
edits the SVG** — that is the design-notes §1 rule.

**Step 4:** Run → PASS.

**Step 5:** Commit: `feat(character): interactive bind + import scaffolding`

> **CHECKPOINT — Part B complete.** Art can be bound and split; nothing renders
> yet.

---

# Part C — Pose evaluator & cast compilation

## Task 13: 2×3 matrix helper + FK composition (ADR 0006 core)

**Files:**
- Create: `packages/document/src/character/mat2d.ts`, `packages/document/src/character/pose.ts`
- Test: `packages/document/src/__tests__/pose.test.ts`

**Step 1: Write the failing test**

```ts
import {composeRig} from '../character/pose.js';

const RIG = {
  torso: {parent: null, rest: [100, 100] as const},
  'arm-l': {parent: 'torso', rest: [140, 90] as const},
  hand: {parent: 'arm-l', rest: [180, 90] as const},
};

test('composes FK: rotating a parent carries children along an arc', () => {
  const out = composeRig(RIG, {'arm-l': {rotation: 90}});
  // hand is 40px along +x from arm-l at rest; a 90° turn puts it 40px along +y.
  expect(out.hand.x).toBeCloseTo(140, 6);
  expect(out.hand.y).toBeCloseTo(130, 6);
  expect(out.hand.rotation).toBeCloseTo(90, 6);
});

test('keeps limb length under rotation (the reason FK is not baked into keys)', () => {
  const rest = composeRig(RIG, {});
  const bent = composeRig(RIG, {'arm-l': {rotation: 37}});
  const len = (a: {x: number; y: number}, b: {x: number; y: number}) =>
    Math.hypot(a.x - b.x, a.y - b.y);
  expect(len(bent['arm-l'], bent.hand)).toBeCloseTo(len(rest['arm-l'], rest.hand), 6);
});

test('multiplies scale down the chain and stays shear-free', () => {
  const out = composeRig(RIG, {torso: {scale: 2}, 'arm-l': {scale: 1.5}});
  expect(out.hand.scale).toBeCloseTo(3, 6);
});

test('is pure and allocation-stable across repeated calls', () => {
  expect(composeRig(RIG, {torso: {rotation: 12}})).toEqual(
    composeRig(RIG, {torso: {rotation: 12}}),
  );
});
```

**Step 2:** Run → FAIL.

**Step 3: Implement.** `mat2d.ts`: `[a, b, c, d, e, f]` tuples with
`multiply`, `translate`, `rotate`, `scale`, and `decompose` returning
`{x: e, y: f, rotation: atan2(b, a) in degrees, scale: hypot(a, b)}`.
`pose.ts`:

```
world[slot] = world[parent]
            · T(rest[slot] − rest[parent])   // rest offset, in art coords
            · T(x, y)                        // pose offset
            · R(rotation)
            · S(scale)
```
with roots using `T(rest[slot] − artCentre)`. Slots are visited in topological
order, computed **once** at compile time and stored on the IR, so the
per-frame cost is exactly one pass with no sorting. Return
`Record<slot, {x, y, rotation, scale}>`.

**Step 4:** Run → PASS.

**Step 5:** Commit: `feat(character): pure FK composition over flat slots`

---

## Task 14: Document format 0.2 — `cast`, `pose` items, migration

**Files:**
- Modify: `packages/document/src/schema.ts`, `version.ts`, `migrate.ts`,
  `compiler/compile.ts`, `ir.ts`
- Create: `packages/document/schema/document-0.2.schema.json`
- Test: `packages/document/src/__tests__/cast.test.ts`, extend `migrate.test.ts`

**Step 1: Write the failing test** — a document with
`cast: {ana: {character: 'teacher', x: 0, y: 0, scale: 1}}` and a timeline item
`{at: 'intro.start', target: 'ana', pose: 'wave', dur: 0.5}` compiles to: one
flat `svg` element per slot (ids `ana.torso`, `ana.arm-l`, …, **not** nested);
joint tracks keyed `ana.arm-l` / prop `rotation`; `depth` keys always
`easing: 'hold'` regardless of the item's easing; an unknown pose name is a
`CompileError` naming the character and the available poses; and a 0.1
document still validates through `migrateDocument` with `applied: ['0.1→0.2']`.

**Step 2:** Run → FAIL.

**Step 3: Implement.**
- `version.ts` → `'0.2'`; `MIGRATIONS['0.1'] = {to: '0.2', migrate: doc => doc}`
  with a comment recording *why* it is an identity (all additions optional).
- Schema: `cast` record (character id + transform), `poseItem`
  (`{at, target, pose, dur?, easing?}`), `lipsyncItem`
  (`{at?, target, lipsync: <track asset id>}`).
- `compileDocument(doc, options?: {characters?: Record<string, Character>})`.
  A `cast` entry with no matching character is a `CompileError` telling the
  caller to pass it in — never a silent skip.
- Expansion: for each cast member emit slot elements in **rest-depth order**
  (so equal-depth ties break deterministically via the stable sibling sort),
  then translate each `pose` item into per-`(slot, param)` set/tween events
  fed through the *existing* propEvents machinery — no parallel code path.
- `ANIMATABLE` gains a `slot` entry (`SLOT_PARAMS` only). The cast root gets
  `x`, `y`, `scale`, `rotation`, `opacity`.
- IR gains `rigs: Record<castId, CompiledRig>` (topologically ordered slots +
  rest offsets from Task 13).

**Step 4:** Run → PASS. Regenerate the JSON Schema artifact.

**Step 5:** Commit: `feat(document): format 0.2 — cast, poses, identity migration from 0.1`

---

## Task 15: Evaluator + runtime wiring

**Files:**
- Modify: `packages/document/src/evaluator.ts`, `packages/document/src/scene/DocumentScene.ts`,
  `packages/document/src/scene/makeDocumentScene.ts`
- Test: extend `evaluator.test.ts`, `document-scene.test.ts`

**Step 1: Write the failing test** — `evaluateFrame` on a rigged IR writes
composed world transforms into `state.props` for every slot; a `depth` change
lands as an integer `zIndex` that flips **exactly at** the keyframe (never
mid-tween); seeking backwards to the same frame yields identical state
(the O(1) property must survive the new stage); and the cost of the rig stage
is independent of document length (probe the same frame in an 8 s and a 600 s
document, as the P1 gate did).

**Step 2:** Run → FAIL.

**Step 3: Implement.** In `evaluateFrame`, after prop tracks resolve, run each
rig through `composeRig` using the just-evaluated joint values and write the
decomposed transforms into `props` under the slot node ids. `depth` maps to
`zIndex`. `makeDocumentScene` accepts `characters` and threads it into
`compileDocument`. `DocumentScene` needs **no new node type** — slots are
ordinary `svg` elements already handled by `buildElement`.

**Step 4:** Run → PASS.

**Step 5:** Commit: `feat(document): pose evaluation stage driving flat slot nodes`

---

## Task 16: Reference characters + goldens

**Files:**
- Create: `packages/e2e/characters/teacher/{character.json,teacher.svg}` (+ a
  second, structurally different character — one with a depth-swapping arm)
- Create: `packages/e2e/documents/character-poses.json`
- Modify: `packages/e2e/tests/project.ts`
- Modify: `packages/document/src/character/*` as bugs surface

**Step 1:** Build the two characters through the real CLI path
(`import` → `bind` → `check` clean). Using our own tools here is the point:
if the workflow is bad, we find out now.

**Step 2:** `character-poses.json` must pin the two things unit tests cannot:
a limb rotating about its authored pivot, and an **arm crossing from behind
the torso to in front** at a keyframe (the ADR 0006 payoff).

**Step 3:** Register both, run `npm run e2e:test` locally to confirm rendering,
then **regenerate goldens on CI** (Linux reference; never commit locally
produced goldens — P1 learned this the hard way).

**Step 4:** Verify the depth swap is visible in the golden — a golden that
pins the *absence* of the feature is worse than none (the P1 batch E+F review
caught exactly that failure twice).

**Step 5:** Commit: `test(character): reference cast + pose/depth-swap goldens`

> **CHECKPOINT — Part C complete.** Characters pose and re-order on screen.

---

# Part D — Narration alignment & audio

## Task 17: `fantoche narration align`

**Files:**
- Create: `packages/cli/src/narration/align.ts`
- Test: `packages/cli/src/__tests__/align.test.ts`

**Step 1: Write the failing test** — given committed WhisperX output, the
adapter fills `narration.segments[].words[]` with `{text, start, dur}`,
**matching segments by id** and leaving `text` untouched; word text is
normalised (lowercase, punctuation stripped) so `binária,` anchors as
`binária`; and re-running is idempotent.

**Step 2:** Run → FAIL.

**Step 3: Implement.** `fantoche narration align <doc.json> --audio <wav>
--language pt` runs `scripts/align.py` (Task 5), maps results onto segments,
and writes the document back **preserving key order and formatting**. This is
P1 Decision 3 paying off: the anchor grammar is already fully implemented
against explicit timings, so only the *source* of timings changes here.

**Step 4:** Run → PASS.

**Step 5:** Commit: `feat(narration): forced-alignment word timings via WhisperX`

---

## Task 18: Narration audio reaches the video

**Files:**
- Modify: `packages/document/src/scene/DocumentScene.ts` (`getMediaAssets`),
  `packages/document/src/schema.ts` (audio asset `dur`), `ir.ts`
- Test: extend `document-scene.test.ts`

**Step 1: Write the failing test** — a document with `narration.audio` reports
exactly one `AssetInfo` per frame with `type: 'audio'`, `currentTime` equal to
the scene-local time at that frame, and `duration` from the asset; a document
without narration still reports `[]`.

**Step 2:** Run → FAIL.

**Step 3: Implement** mirroring `Scene2D.getMediaAssets` (`Scene2D.ts:166-200`)
— `{key, type: 'audio', src, playbackRate: 1, volume, currentTime, duration}`.
Add optional `dur` and `volume` to the audio asset schema, defaulting duration
to the last segment's end. This closes P1 good-first-issue #4, which the P2
gate now requires: a silent north-star demo would not be the demo.

**Step 4:** Run → PASS, and verify end-to-end that
`fantoche render` produces an mp4 **with an audio stream**:
```bash
ffprobe -v error -select_streams a -show_entries stream=codec_type -of csv=p=0 output/<name>.mp4
```
Expected: `audio`.

**Step 5:** Commit: `feat(document): mux narration audio into headless renders`

---

## Task 19: Adaptive durations (`dur: {fit}` / `{value, min}`)

**Files:**
- Modify: `packages/document/src/schema.ts`, `compiler/compile.ts`
- Test: `packages/document/src/__tests__/adaptive-dur.test.ts`

**Step 1: Write the failing test** — `dur: {fit: true}` stretches to the next
event on the same `(target, prop)` (or the document end); `dur: {value: 0.8,
min: 0.2}` compresses to the space available but never below `min`; when even
`min` does not fit, the existing overlap `CompileError` fires (retiming that
breaks must fail loudly, not silently truncate); and `block.dur` **rejects**
adaptive forms (block windows bound replay cost and must stay static).

**Step 2:** Run → FAIL.

**Step 3: Implement** as a two-pass compile: resolve every item's `t0` and
group by `(target, prop)` first, then resolve durations against each group's
next start. Design review §4(c) — this is what makes re-recorded narration
compress a gesture instead of colliding with the next one.

**Step 4:** Run → PASS.

**Step 5:** Commit: `feat(document): adaptive tween durations for retimed narration`

---

# Part E — Closed-form springs

## Task 20: Spring easing with compile-time entry-velocity baking

**Files:**
- Modify: `packages/document/src/easings.ts`, `ir.ts`, `compiler/compile.ts`,
  `evaluator.ts`
- Test: `packages/document/src/__tests__/spring.test.ts`

**Step 1: Write the failing test**

```ts
test('lands exactly on the target at the settle frame', () => {
  const {ir} = compileDocument(springDoc({from: 0, to: 100, dur: 0.5}));
  expect(evaluateFrame(ir, 15).props.get('box')!.get('x')).toBeCloseTo(100, 9);
});

test('carries momentum from the previous spring segment', () => {
  // 0→100 then immediately 100→200: the second segment starts already moving,
  // so it overshoots where a fresh spring would not.
  const {ir} = compileDocument(chainedSpringDoc());
  const mid = evaluateFrame(ir, 20).props.get('box')!.get('x') as number;
  const fresh = evaluateFrame(freshIr, 20).props.get('box')!.get('x') as number;
  expect(mid).toBeGreaterThan(fresh);
});

test('is O(1): a probe at frame 300 costs the same in an 8s and a 600s document', () => { /* … */ });

test('rejects springs on non-scalar props with an actionable message', () => {
  expect(() => compileDocument(springDoc({prop: 'scale', to: [2, 2]})))
    .toThrow(/spring.*scalar number/i);
});

test('stays pure: same IR and frame ⇒ identical value', () => { /* … */ });
```

**Step 2:** Run → FAIL.

**Step 3: Implement.**
- `EASING_NAMES` gains `'spring'`; **rewrite the module docstring**, which
  currently states springs are excluded for being iterative — that is exactly
  the claim this task overturns, and a stale comment here would mislead.
- `TrackKey` gains `spring?: {omega: number; v0n: number}` (normalised entry
  velocity, units s⁻¹).
- Compiler, per spring segment on a numeric prop, with `d = to − from`:
  `omega = 6 / dur` (≈98 % settled at `dur`), `v0n = v_prev / d` (0 when the
  previous segment is not a spring, or when `d === 0` — Decision 7).
  Bake, then compute this segment's exit velocity for the next one:
  ```
  c      = omega + v0n
  p(t)   = 1 − (1 + c·t)·e^(−omega·t)
  p'(t)  = (omega·(1 + c·t) − c)·e^(−omega·t)
  norm   = p(dur)                       // normalise so p̂(dur) === 1 exactly
  v_exit = d · p'(dur) / norm
  ```
- Evaluator: when `next.easing === 'spring'`, elapsed seconds are
  `(frame − current.tF) / ir.fps` (**not** the normalised progress the other
  easings use — a spring is defined in real time), and the eased value is
  `p(t)/norm`. Keep `norm` baked on the key so evaluation stays arithmetic.

**Step 4:** Run → PASS.

**Step 5:** Commit: `feat(document): closed-form springs with baked entry velocity`

---

# Part F — North-star demo & P2 gate

## Task 21: The north-star demo document  ⚠️ DANIEL-MANUAL (narration)

**Files:**
- Create: `packages/e2e/demo/north-star/{demo.json,narration.wav,narration.txt}`
- Create: `docs/authoring-guide.md`

**Step 1:** Daniel records ~90 s of PT-BR narration explaining binary search
(vision §5). `fantoche narration align` fills the word timings.

**Step 2:** Author `demo.json`: a cast member who gestures at chosen words,
a diagram built from shapes/arrows, a `Code` walkthrough with an animated
highlight, and the lipsync track from the ADR 0007 engine.

**Step 3:** Render offline and verify **every** gate clause literally:
```bash
fantoche render packages/e2e/demo/north-star/demo.json --out north-star.mp4
ffprobe -v error -show_entries format=duration -show_entries stream=codec_type -of default=nw=1 output/north-star.mp4
```
Expected: ~90 s, both a video and an audio stream.

**Step 4:** Confirm "works offline" honestly — re-render with networking
disabled and confirm byte-identical output. Any CDN font or asset fetch on the
render path is a gate failure, not a footnote (P1 left
`packages/template/src/global.css:1` importing Google Fonts — check the demo
project does not inherit it).

**Step 5:** Write `docs/authoring-guide.md` covering the character workflow,
anchors, poses, and the "keep blocks short" rule.

**Step 6:** Commit: `test(e2e): north-star demo — PT-BR, offline, end-to-end`

---

## Task 22: P2 gate + wrap

**Files:**
- Modify: `docs/05-roadmap.md` (P2 gate outcome), this plan (gate section),
  `packages/document/README.md`

**Step 1:** Record gate evidence against every roadmap P2 clause, in the P1
gate's evidence style — measurements, not adjectives:
- `character.json` format with rig, poses, art slots; 2–3 reference characters.
- Narration track with real word timestamps from local alignment; anchor
  resolution unchanged from P1.
- Lipsync spike outcome and the ADR 0007 decision, with the PT-BR scores.
- North-star demo end-to-end, in Portuguese, offline.
- Seek still O(1) **with rigs** — re-run the P1 measurement with a rigged
  document and state both numbers.

**Step 2:** Full verification, all of it, before any claim:
```bash
npx lerna run build --ignore @fantoche-dev/docs
npx lerna run test
npm run e2e:test
npm run template:render
fantoche render packages/e2e/demo/north-star/demo.json
```

**Step 3:** Draft good-first-issues (viseme sheet contributions, extra pivot
presets, more poses on the reference cast, per-language viseme maps).

**Step 4:** Commit: `docs(character): P2 gate results and authoring docs`

---

## Execution order & checkpoints

Batches: **[1–7]** lipsync spike → **CHECKPOINT (gate risk — stop and report)**;
**[8–12]** ADR + format + import → checkpoint; **[13–16]** evaluator + cast +
goldens → checkpoint; **[17–19]** narration → checkpoint; **[20]** springs;
**[21–22]** demo + gate.

Every task ends with the tree building and tests passing. Golden changes always
regenerate on CI (Linux reference).

Daniel-manual items (unblock early — they gate Tasks 7, 21): audio fixtures
(Task 3), the blind scoring (Task 7), the 90 s demo narration (Task 21),
and installing WhisperX/Rhubarb locally.

## Deferred — recorded, not in P2

- **`builder` DSL subpath** (design review §2) — ergonomics for code-first
  authors; the mechanism already works (`makeDocumentScene` takes any object).
- **Block-length compiler warning** above ~5 s and the retiming-cause hint on
  overlap errors (design review §3 and §4b). Note Task 19 already makes
  retiming collisions fail loudly; only the *wording* is deferred.
- **Under-damped / vector springs**, IK, and the visual binder + pivot gizmo
  (P3 editor v0, per design notes §1 and §3).

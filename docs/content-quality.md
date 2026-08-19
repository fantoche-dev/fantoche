# Content quality — policy, floor, and craft

Fantoche makes a narrated explainer cheap to produce. Cheap production is
exactly the profile platforms now demonetize, so "will this video be any
good?" is a product question here, not only an author question.

Most guidance on this subject is useless because it mixes three things that
have different lifetimes and different owners. This document keeps them apart:

| Layer | Nature | Owner | How it is written down |
| --- | --- | --- | --- |
| **1. Policy** | External, perishable, unappealable | The platform | A **dated snapshot** with quotes and source URLs. Never a spec. |
| **2. Floor** | Internal, measurable | The tool | A **rule with a threshold**, ideally a lint check. |
| **3. Craft** | Editorial, teachable | The author | A **rubric** with a reference implementation. |

Rule of thumb: if it can be quoted, cite and date it. If it can be measured,
make it a check. If it can only be judged, make it a rubric and point at the
north-star demo as the worked example.

---

## 1. Policy snapshot — YouTube

**Read on 2026-08-19 from the live pages listed in §6.** Quotes below are the
platform's words. This table is a snapshot, not a contract: re-read the sources
before any launch, and when this file disagrees with the live page, the live
page wins.

### 1.1 Monetization policies that a Fantoche video can trip

| Policy | What it targets (quoted) | How a Fantoche video trips it | Author rule |
| --- | --- | --- | --- |
| **Generic or repetitive content** | "AI-generated content made with generic or unoriginal templates giving the impression of mass production without adding the creator's original, authentic insights or perspective"; "Image slideshows, templated storylines, or scrolling text with minimal or no narrative, commentary, or educational value" | A cast library + scene templates + agent authoring is a template pipeline. Forty videos where only the numbers in the diagram change is the target case. | The template supplies **form**. You supply the **argument**. Vary substance per video, not parameters. |
| **Reused content** | Not allowed: "content that exclusively features readings of other materials you did not originally create, like text from websites or news feeds" | An agent that turns a docs page or article into narration is, literally, a reading of material you did not create. | The document must carry your explanation, your ordering, and your examples — not a synthesized read-through of a source. |
| **Unsatisfying or off-putting content** | Not allowed: "Content that lacks a clear narrative arc or logical progression, such as videos that stitch together unrelated or inconsistent AI clips" | Beat-salad: visuals that change without progressing. | Every beat must move the argument. See §3. |
| **AI personas related to sensitive topics** | Not monetizable: an AI "doctor" providing "medical diagnoses, health advice, or wellness remedies"; "AI-generated podcast hosts offering financial guidance, investment tips, or wealth management advice"; "AI personas giving legal advice or interpreting laws" | **The sharpest constraint on our core feature.** The rig itself is a synthetic presenter. | The character narrates *your* material. It is never framed as a credentialed authority (no "Dr.", no "advisor") in health, legal, financial, or political content. |
| **Quality principles for kids and family content** | "Deceptively educational" content; "Hard to follow" content — "confusing… due to jumbled storylines, unclear audio, or lack of clear storyline… often the result of mass production or autogeneration" | Applies once a video is marked made-for-kids. | "Unclear audio" and "hard to follow" are §2 floor items that become policy items for this audience. |

Two things the same page explicitly **allows**, which matter to us:

- "Same intro and outro for your videos, but the bulk of your content is
  different", and "a series following a set of characters across episodes…
  in which each video has a distinct storyline, focus, or concept."
  A recurring Fantoche presenter across a series is the allowed case, not the
  prohibited one.
- "Content that expresses your unique creative voice, like using AI to
  visualize a unique character and narrative you invented", and "using AI to
  edit your video scripts or generate a unique background visual."
  An invented vector character presenting an argument you wrote is on the
  permitted side by name.

The line is not *whether* a machine helped. It is whether a person decided
what the video says.

### 1.2 Disclosure of altered or synthetic content

A separate requirement from monetization. Disclosure is required for realistic
content that "makes a real person appear to say or do something they didn't
do", "alters footage of a real event or place", or "generates a realistic scene
that didn't actually occur".

It is **not** required for clearly unrealistic or animated content, nor for
"production assistance, like using generative AI tools to create or improve a
video outline, script, thumbnail, title, or infographic", "caption creation",
"voice or audio repair", or "cloning one's own voice to create voice overs or
dubs".

A stylized vector character is on the exempt side. Two ways to leave it:

1. a voice that is not yours, cloned or synthesized to pass as a real person;
2. photoreal imagery or real footage composited into the document.

The animation exemption covers disclosure only. It grants nothing under §1.1.

Provenance is the author's evidence, and it is a document-level fact: record
where the voice came from and under what licence next to the audio, as
`packages/e2e/demo/north-star/README.md` does for its provisional test voice.

---

## 2. Technical floor

Below this line a video reads as cheap regardless of what it says. These are
project defaults; tune the numbers, but keep them numbers.

### 2.1 Audio — the largest quality signal in a narrated explainer

| Rule | Threshold | Why |
| --- | --- | --- |
| Publish-rate master | 48 kHz; downsample only for alignment | 16 kHz mono is band-limited to 8 kHz — no sibilance, no air. It sounds like a phone call. |
| Integrated loudness | about −14 LUFS | Louder masters get normalized down; quiet masters just stay quiet. |
| True peak | ≤ −1 dBTP, no clipping | Clipping survives every later encode. |
| Trailing silence | ≤ 0.5 s after the last word | Alignment wants a tail; viewers do not. |
| Consistency | one voice, one mic, one room, per video | Recording seams are heard as production failure. |

> **Known defect.** Both north-star narrations —
> `packages/e2e/demo/north-star/narration.wav` (EN, primary) and
> `packages/e2e/demo/north-star-pt-br/narration.wav` (PT-BR control) — are
> 16 kHz mono PCM, the format WhisperX needs, and each `demo.json` also uses
> its WAV as the rendered `voice` asset. The published MP4s therefore carry
> telephone-bandwidth audio. The fix is to keep the master at 48 kHz and
> derive a 16 kHz mono copy for alignment and Rhubarb only. This lands with
> the narration replacement the north-star README already requires, and
> re-alignment invalidates the current mouth tracks and the recorded render
> hashes.

### 2.2 Lipsync — where a cheap video gives itself away

Already the ADR 0007 review rules; repeated here because they are floor, not
taste:

- minimum hold ≥ 3 frames (0.100 s at 30 fps); no one-frame shapes;
- every aligned `/p/`, `/b/`, `/m/` reaches a visible closure (A);
- X only where alignment measured a pause — never synthetic rest;
- no drift: review at document frame rate, not in a scrubbed preview.

### 2.3 Legibility

| Rule | Threshold |
| --- | --- |
| Body text | ≥ 24 px at 1080p (≈2.2% of frame height) |
| Code | ≥ 28 px at 1080p; never a full file on screen |
| Contrast | ≥ 4.5:1 against its actual backdrop |
| Safe margin | 5% of frame on every edge |
| Simultaneous reading | one thing at a time — never animate two elements that both need to be read |

Most viewers watch small. If a frame is unreadable at 360 px wide, it is
unreadable.

### 2.4 Timing

- One segment per sentence or visual beat, about 5–10 s (authoring guide §2).
- Let a motion land and hold ~0.5 s before the next one starts.
- Prefer `{"fit": true}` and `{"value": …, "min": …}` over fixed durations, so
  retiming compresses tempo instead of destroying readability.

### 2.5 Render

- 1080p H.264 + AAC; `--offline` output byte-identical to the normal render.
- Container duration matches narration plus its tail.
- Zero compiler anchor warnings — a warned anchor means a gesture is landing on
  a word the author did not choose.

### 2.6 Enforcement — `fantoche doc check`

Most of §2 is mechanically checkable and now ships behind a document-level
command, alongside `fantoche character check`:

```sh
fantoche doc check demo.json           # warn (exit 0)
fantoche doc check demo.json --strict  # fail (exit 1)
fantoche doc check demo.json --no-audio  # skip the ffmpeg measurement
```

ffmpeg and ffprobe are dev-time tools here, exactly as Rhubarb and WhisperX
are — `doc check` is an authoring command, never a render-time dependency. A
missing encoder skips the audio rules with a warning instead of turning the
rest of the check off.

**Shipped rules**

| Rule | Threshold | Source |
| --- | --- | --- |
| `audio.sample-rate` | ≥ 48 kHz | §2.1 |
| `audio.loudness` | −14 ±1 LUFS (ffmpeg `ebur128`) | §2.1 |
| `audio.true-peak` | ≤ −1 dBFS | §2.1 |
| `audio.trailing-silence` | ≤ 0.5 s after the last aligned word | §2.1 |
| `lipsync.minimum-hold` | every cue held ≥ 0.100 s | §2.2 |
| `lipsync.bilabial-closure` | every word spelled with p/b/m reaches a pressed A | §2.2 |
| `narration.segment-length` | 5–10 s | §2.4 |
| `document.anchor-warning` | zero compiler warnings | §2.5 |

Holds are compared in whole milliseconds. Cue times are authored in ms and
`4.101 - 4.001` is `0.09999999999999964` as a double, so comparing raw
doubles reported all 26 exactly-on-the-floor holds in the north-star track as
violations.

`lipsync.bilabial-closure` is word-level, not phoneme-level: the committed
document carries word alignment, not characters. It cannot say *which*
bilabial in a word closed, and a word whose only `p` is silent is a false
positive. The English north-star clears it 48/48 at zero tolerance, which is
what makes it trustworthy enough to ship.

**Deferred, with the reason**

- **`lipsync.rest-on-pause`** (X only on measured pauses) was built, measured
  and removed. At word granularity it has no discriminating power: the
  reviewed manual track and the untouched automatic draft both put 16 rests
  "inside" a word — the same 16 — because word ends from forced alignment
  overshoot the last phoneme's release, and long compound tokens
  ("thirty-seven", "forty-seven") span real articulation gaps. Deciding this
  rule needs the character-level alignment the document does not carry. A
  check that fires 54 times on a track ADR 0007 certified teaches authors to
  ignore the checker.
- **Frame-level rules** — text size, contrast, safe area (§2.3) — need a
  render pass and follow later.

**Our own demos are not strict-clean yet**, so `--strict` is deliberately not
wired into CI. Measured 2026-08-19:

| Document | Findings |
| --- | --- |
| `north-star/` (EN) | 2 — both the known §2.1 audio defect: 16 kHz, −20.7 LUFS |
| `north-star-pt-br/` | 13 — the same 2, plus 11 `bilabial-closure` |
| `first-slice/` | 11 — audio defect plus 3 `bilabial-closure` |

The EN north-star clears every non-audio rule; its two findings are exactly
the defect this document already recorded, found independently by the
checker. Wiring `--strict` into CI is the natural gate to add *with* the
narration replacement, not before it.

The 11 PT-BR `bilabial-closure` findings are **not** edge artifacts — the
nearest pressed A is 0.06–0.40 s away, outside any defensible tolerance —
and they sit against ADR 0007's recorded "all 108 aligned bilabials on A"
for that track. The two counts measure different populations (93 words
spelled with p/b/m here, 108 aligned bilabial *characters* there), so the
discrepancy needs the PT-BR character alignment to settle. Recorded as open.

Encoding §1 policy in the tool is deliberately **not** done: policy is
external, perishable and unappealable, and encoding it ages badly. Encoding
the floor does not.

## 3. Craft rubric — informative *and* worth watching

No linter reaches this. Keep it short, keep it opinionated, and use
`packages/e2e/demo/north-star/` as the worked example.

1. **One question, stated in the first ten seconds.** North-star: find a number
   without checking every position. If you cannot state the question in one
   sentence, the video is not ready.
2. **Every segment changes the viewer's state** — a new fact, a new visual, or a
   resolved tension. If a segment can be deleted without loss, delete it.
3. **Show the mechanism; do not assert it.** The fifteen-number diagram
   *performing* the halving is the argument. The narration is its caption.
4. **Concrete before abstract.** Fifteen numbers become seven, then three, then
   one — *then* the word "logarithm". Reversing that order is how explainers
   become unwatchable.
5. **One idea per beat.** Let the visual finish before the next claim starts.
6. **Pay off the setup.** Close with the compressed restatement and the
   constraint that limits it ("look at the middle, compare, eliminate half —
   but the list must be sorted").
7. **Personality is in the writing and the timing, not the rig.** A gesture that
   lands on the chosen word is what separates a presenter from a mascot pasted
   onto a slide. This is what word anchors are *for*.
8. **The character is an element, not the point** (`02-vision.md` §3). If a beat
   is better as a full-frame diagram, give it the frame.
9. **No throat-clearing.** No "hi everyone, welcome back", no pre-roll ask for
   subscriptions. Start at the question.

### Smells like slop — a two-minute self-audit

- The narration reads like it was written to be read by a machine: bullet
  cadence, "in this video we will explore", no sentence a person would say.
- Visuals illustrate the words instead of carrying information.
- It is one template with the nouns swapped.
- The presenter gestures on a loop rather than at the argument.
- There is no single frame a viewer would screenshot.
- You cannot name what the viewer can do after watching that they could not do
  before.

---

## 4. What this means for Fantoche as a product

The tool's affordances decide which side of §1.1 its users land on.

- **Templates supply form, never substance.** A scene template that ships with
  its own filled-in content is a slop generator with our name on it.
- **No batch affordance.** "Render fifty videos from a CSV" is the single
  feature most likely to get our users demonetized. It stays out of v1.
- **The cast library carries the sensitive-topics rule.** A rig shipped as
  "Doctor" invites precisely the framing that cannot be monetized. Cast metadata
  should say so where an author will read it.
- **Agent authoring (P5) is the highest-risk surface.** The MCP server should
  make it easy to author *one* good document and awkward to mass-produce near
  identical ones. That is a design constraint on the agent layer, not a
  disclaimer in its docs.

Open decision, worth an ADR: whether §2 ships as advisory warnings or as a hard
gate, and whether any of §1 is encoded at all (for example, refusing to render a
document whose `meta` declares a sensitive-topic subject with a persona framing).
Encoding policy in a tool ages badly; encoding the floor does not.

---

## 5. Pre-publish checklist

- [ ] The video answers one question, stated in the first ten seconds.
- [ ] Every segment changes the viewer's state.
- [ ] Narration is my writing, not a reading of someone else's page.
- [ ] The character never presents as a credentialed expert on health, legal,
      financial, or political matters.
- [ ] The voice is mine, licensed, or my own clone — and its provenance is
      recorded next to the audio.
- [ ] Audio master is 48 kHz, about −14 LUFS, true peak ≤ −1 dBTP.
- [ ] Mouth track reviewed at document fps: closures on `/p/ /b/ /m/`, no
      one-frame shapes, X only on measured pauses.
- [ ] Text and code readable at 360 px wide; 5% safe margins.
- [ ] No two elements demand reading at the same time.
- [ ] Compiler reports zero anchor warnings.
- [ ] `--offline` render is byte-identical.
- [ ] This video is not the previous one with the nouns swapped.

---

## 6. Sources

Read 2026-08-19. Re-verify before each launch; these pages change without
notice, and the section names in §1.1 have already been renamed once.

- YouTube channel monetization policies —
  <https://support.google.com/youtube/answer/1311392>
- Disclosing use of altered or synthetic content —
  <https://support.google.com/youtube/answer/14328491>
- Reused content policy —
  <https://support.google.com/youtube/answer/6013276>
- Best practices for kids and family content —
  <https://support.google.com/youtube/answer/10774223>

/**
 * The language-independent timing layer ADR 0007's re-spike names as the
 * target.
 *
 * Both spike arms fail the same way and for the same reason: they emit a cue
 * per aligned unit, so a fast syllable becomes a one-frame mouth. That is a
 * *timing* defect, not a mapping one — the English control reaches every
 * bilabial closure the map asks for and still jitters. This pass takes any
 * draft track and enforces the §2.2 floor without touching the map.
 *
 * It is deliberately not a smoother: visemes are a discrete alphabet, so
 * there is no shape between two cues to interpolate towards. The only honest
 * operation is to decide which cue in a too-short window survives.
 */

/** A cue as the track format carries it. */
export interface HoldCue {
  t: number;
  viseme: string;
}

/**
 * Which shape wins when two cues cannot both clear the floor.
 *
 * §2.2 names exactly two hard rules — every aligned `p`/`b`/`m` reaches a
 * visible closure, and `X` appears only where alignment measured a pause —
 * so `A` and `X` rank together at the top and neither loses to a neutral
 * mouth. Ranking rests below them cost the English draft 28 of its 63
 * measured pauses; ranking them level keeps all 63 and all 48 closures.
 *
 * Rounding (`F`, `E`) is ADR 0007's second axis and ranks next. Everything
 * else is interchangeable at this resolution: no axis distinguishes them.
 *
 * Nothing here invents a rest — the pass only ever drops cues the draft
 * already carried, so a surviving `X` is one alignment placed.
 */
const PRIORITY = new Map<string, number>([
  ['A', 4],
  ['X', 4],
  ['F', 3],
  ['E', 3],
  ['B', 2],
  ['C', 2],
  ['D', 2],
  ['G', 2],
  ['H', 2],
]);

function priority(viseme: string): number {
  return PRIORITY.get(viseme) ?? 2;
}

/**
 * Select the highest-value subset of cues whose consecutive times are at
 * least `minimumHold` apart, keeping every survivor at its own time.
 *
 * A greedy pass is not enough: the first attempt collapsed each too-short run
 * into its start time and lost 5 of the English north-star's 48 word-level
 * closures, because a winning A slid backwards out of the word it belonged
 * to. Keeping original times means the choice is a weighted selection, so it
 * is solved as one — `best[i]` is the highest total priority of a valid
 * subset ending at cue `i`, and a single moving pointer supplies the running
 * maximum over every cue at least one hold earlier. Linear, and it never
 * moves, merges or invents a cue.
 *
 * Times are compared in whole milliseconds: cue times are authored in ms and
 * `4.101 - 4.001` is `0.09999999999999964` as a double.
 */
export function enforceMinimumHold(
  cues: readonly HoldCue[],
  minimumHold: number,
): HoldCue[] {
  if (cues.length === 0) {
    return [];
  }
  const floorMs = Math.round(minimumHold * 1000);
  const ms = cues.map(cue => Math.round(cue.t * 1000));
  const best = new Array<number>(cues.length).fill(0);
  const previous = new Array<number>(cues.length).fill(-1);

  let candidate = -1; // last index whose time is a full hold before cues[i]
  let bestEarlier = 0;
  let bestEarlierAt = -1;
  let top = 0;
  let topAt = 0;

  for (let i = 0; i < cues.length; i += 1) {
    while (candidate + 1 < i && ms[i] - ms[candidate + 1] >= floorMs) {
      candidate += 1;
      if (best[candidate] > bestEarlier) {
        bestEarlier = best[candidate];
        bestEarlierAt = candidate;
      }
    }
    best[i] = bestEarlier + priority(cues[i].viseme);
    previous[i] = bestEarlierAt;
    if (best[i] > top) {
      top = best[i];
      topAt = i;
    }
  }

  const chosen: HoldCue[] = [];
  for (let i = topAt; i !== -1; i = previous[i]) {
    chosen.push({t: cues[i].t, viseme: cues[i].viseme});
  }
  return chosen.reverse();
}

/** Apply the hold layer to a committed track, writing a new one beside it. */
export async function holdTrack(
  trackPath: string,
  options: {out: string; minHold: string},
): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');
  const {visemeTrackSchema} = await import('@fantoche-dev/document');

  const source = path.resolve(trackPath);
  const out = path.resolve(options.out);
  if (source === out) {
    throw new Error('--out must not overwrite the source track');
  }
  const minHold = Number(options.minHold);
  if (!Number.isFinite(minHold) || minHold <= 0) {
    throw new Error(
      `--min-hold must be a positive number of seconds (got "${options.minHold}")`,
    );
  }

  const parsed = visemeTrackSchema.safeParse(
    JSON.parse(fs.readFileSync(source, 'utf8')),
  );
  if (!parsed.success) {
    throw new Error(
      `Invalid viseme track ${source}: ${parsed.error.issues
        .map(issue => `/${issue.path.join('/')}: ${issue.message}`)
        .join('; ')}`,
    );
  }

  const cues = enforceMinimumHold(parsed.data.cues, minHold);
  const shortest = cues
    .slice(1)
    .reduce((least, cue, i) => Math.min(least, cue.t - cues[i].t), Infinity);
  fs.mkdirSync(path.dirname(out), {recursive: true});
  fs.writeFileSync(out, `${JSON.stringify({...parsed.data, cues}, null, 2)}\n`);
  console.log(
    `${parsed.data.cues.length} cues in, ${cues.length} out; shortest hold ${
      Number.isFinite(shortest) ? Math.round(shortest * 1000) / 1000 : 'n/a'
    } s`,
  );
  console.log(`Wrote ${out}`);
}

import type {Viseme} from '@fantoche-dev/document';

type OrthographicVisemeMap = Readonly<Partial<Record<string, Viseme>>>;

/**
 * Portuguese orthography → Preston-Blair approximation used by spike arm B.
 *
 * This remains deliberately orthographic, not phonemic, but it is not the
 * English table under another name. Accents stay meaningful, `o` and `u` use
 * different rounded mouths, silent `h` has no cue, and contextual matching
 * handles the common digraphs and nasal spelling patterns that would
 * otherwise create visibly false mouth movements. The PT-BR blind gate still
 * decides whether this approximation is good enough; no result may describe
 * it as a phoneme model.
 */
export const PT_VISEME_MAP: OrthographicVisemeMap = {
  a: 'D',
  á: 'D',
  à: 'D',
  â: 'D',
  ã: 'D',
  b: 'A',
  c: 'B',
  ç: 'B',
  d: 'B',
  e: 'C',
  é: 'C',
  ê: 'C',
  f: 'G',
  g: 'B',
  i: 'B',
  í: 'B',
  j: 'B',
  k: 'B',
  l: 'H',
  m: 'A',
  n: 'B',
  o: 'E',
  ó: 'E',
  ô: 'E',
  õ: 'E',
  p: 'A',
  q: 'B',
  r: 'B',
  s: 'B',
  t: 'B',
  u: 'F',
  ú: 'F',
  ü: 'F',
  v: 'G',
  w: 'F',
  x: 'B',
  y: 'B',
  z: 'B',
};

/**
 * English grapheme approximation. Originally the spike's shallow control arm;
 * since the 2026-08-19 English-first content decision it is the primary
 * content language's map and carries its own contextual rules in the matcher
 * (consonant digraphs, double letters, silent word-initial k/w, silent final
 * e). Post-spike additions improve draft quality only: they change no scored
 * result and do not revise ADR 0007 — the shipping path stays manual review.
 * `qu` is deliberately absent: unlike PT que/qui, the English u is a spoken
 * /w/ with visible rounding, so q and u keep separate mouths.
 */
export const EN_VISEME_MAP: OrthographicVisemeMap = {
  a: 'D',
  b: 'A',
  c: 'B',
  d: 'B',
  e: 'C',
  f: 'G',
  g: 'B',
  h: 'B',
  i: 'B',
  j: 'B',
  k: 'B',
  l: 'H',
  m: 'A',
  n: 'B',
  o: 'F',
  p: 'A',
  q: 'B',
  r: 'E',
  s: 'B',
  t: 'B',
  u: 'F',
  v: 'G',
  w: 'F',
  x: 'B',
  y: 'B',
  z: 'B',
};

const PT_DIGRAPH_MAP: Readonly<Record<string, Viseme>> = {
  ch: 'B',
  lh: 'H',
  nh: 'B',
  rr: 'B',
  ss: 'B',
};

const EN_DIGRAPH_MAP: Readonly<Record<string, Viseme>> = {
  ch: 'B',
  ck: 'B',
  ee: 'B',
  oo: 'F',
  ph: 'G',
  sh: 'B',
  th: 'B',
  wh: 'F',
};

/** Word-initial spellings whose first letter is silent: the mouth is the second's. */
const EN_SILENT_INITIAL_MAP: Readonly<Record<string, Viseme>> = {
  kn: 'B',
  wr: 'E',
};

const EN_VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

const PT_VOWELS = new Set([
  'a',
  'á',
  'à',
  'â',
  'ã',
  'e',
  'é',
  'ê',
  'i',
  'í',
  'o',
  'ó',
  'ô',
  'õ',
  'u',
  'ú',
  'ü',
]);

export interface GraphemeVisemeMatch {
  /** Number of aligned character entries represented by this decision. */
  consumed: number;
  /** No visible decision for punctuation, spacing or silent letters. */
  viseme?: Viseme;
}

function normalise(grapheme: string): string {
  return grapheme.normalize('NFC').toLocaleLowerCase('pt-BR');
}

function withoutAccent(grapheme: string): string {
  return normalise(grapheme)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isBareLetter(grapheme: string): boolean {
  return /^[a-z]$/.test(grapheme);
}

/**
 * Whether aligned entries `index` and `index + 1` sit inside one spoken word:
 * temporally joined and both letters. A timed space or punctuation entry is a
 * boundary even when the alignment left no temporal gap around it.
 */
function joinsWithinWord(
  graphemes: readonly string[],
  index: number,
  joinsNext?: readonly boolean[],
): boolean {
  if (index < 0 || index + 1 >= graphemes.length) {
    return false;
  }
  if (joinsNext !== undefined && joinsNext[index] !== true) {
    return false;
  }
  return (
    isBareLetter(withoutAccent(graphemes[index])) &&
    isBareLetter(withoutAccent(graphemes[index + 1]))
  );
}

function hasEarlierVowelInWord(
  graphemes: readonly string[],
  index: number,
  joinsNext?: readonly boolean[],
): boolean {
  for (let i = index; joinsWithinWord(graphemes, i - 1, joinsNext); i -= 1) {
    const grapheme = withoutAccent(graphemes[i - 1]);
    if (EN_VOWELS.has(grapheme) || grapheme === 'y') {
      return true;
    }
  }
  return false;
}

function isNasalSpelling(
  graphemes: readonly string[],
  index: number,
  joinsNext?: readonly boolean[],
): boolean {
  const current = normalise(graphemes[index]);
  const nasal = withoutAccent(graphemes[index + 1] ?? '');
  const after = withoutAccent(graphemes[index + 2] ?? '');
  if (!PT_VOWELS.has(current) || (nasal !== 'm' && nasal !== 'n')) {
    return false;
  }
  if (joinsNext !== undefined && joinsNext[index] !== true) {
    return false;
  }
  // `nh` is a consonant digraph, not a vowel followed by a nasal marker.
  if (
    nasal === 'n' &&
    after === 'h' &&
    (joinsNext === undefined || joinsNext[index + 1] === true)
  ) {
    return false;
  }
  // A temporal boundary after m/n is a word boundary even if the next timed
  // entry is a vowel from the following word.
  if (joinsNext !== undefined && joinsNext[index + 1] !== true) {
    return true;
  }
  // Before another vowel, m/n starts the next consonant rather than closing
  // the current vowel: `cama`, `binária`.
  return !PT_VOWELS.has(normalise(graphemes[index + 2] ?? ''));
}

/**
 * Match one language-specific orthographic unit at `index`.
 *
 * Longest-match is essential for PT: treating `qu` as q+u invents a puckered
 * mouth for a normally silent u, `lh` as l+h invents a second mouth, and a
 * word-final m/n is often the spelling of nasalisation rather than a visible
 * consonant closure.
 */
export function matchGraphemeToViseme(
  graphemes: readonly string[],
  index: number,
  language: string,
  joinsNext?: readonly boolean[],
): GraphemeVisemeMatch {
  if (index < 0 || index >= graphemes.length) {
    throw new RangeError(`grapheme index ${index} is outside the alignment`);
  }
  const baseLanguage = language.split('-')[0].toLowerCase();
  const current = normalise(graphemes[index]);
  if (baseLanguage === 'en') {
    const base = withoutAccent(current);
    const next = withoutAccent(graphemes[index + 1] ?? '');
    const pair = `${base}${next}`;
    if (joinsWithinWord(graphemes, index, joinsNext)) {
      if (!joinsWithinWord(graphemes, index - 1, joinsNext)) {
        const initial = EN_SILENT_INITIAL_MAP[pair];
        if (initial !== undefined) {
          return {consumed: 2, viseme: initial};
        }
      }
      const digraph = EN_DIGRAPH_MAP[pair];
      if (digraph !== undefined) {
        return {consumed: 2, viseme: digraph};
      }
      // A doubled consonant letter is one sound; two cues would strobe.
      if (base === next && !EN_VOWELS.has(base)) {
        return {consumed: 2, viseme: EN_VISEME_MAP[base]};
      }
    }
    // Word-final silent e (time, style) — but not a lone-vowel e (she, be).
    if (
      base === 'e' &&
      !joinsWithinWord(graphemes, index, joinsNext) &&
      hasEarlierVowelInWord(graphemes, index, joinsNext)
    ) {
      return {consumed: 1};
    }
    return {consumed: 1, viseme: EN_VISEME_MAP[base]};
  }
  if (baseLanguage !== 'pt') {
    throw new Error(`No grapheme→viseme map for language "${language}"`);
  }

  const next = withoutAccent(graphemes[index + 1] ?? '');
  const pair = `${withoutAccent(current)}${next}`;
  const digraph = PT_DIGRAPH_MAP[pair];
  const joinsPair = joinsNext === undefined || joinsNext[index] === true;
  if (digraph !== undefined && joinsPair) {
    return {consumed: 2, viseme: digraph};
  }

  // In the common que/qui and gue/gui spellings the u is silent. Cases where
  // it is pronounced remain an acknowledged orthographic approximation.
  const afterPair = withoutAccent(graphemes[index + 2] ?? '');
  if (
    (pair === 'qu' || pair === 'gu') &&
    /^[ei]$/.test(afterPair) &&
    joinsPair &&
    (joinsNext === undefined || joinsNext[index + 1] === true)
  ) {
    return {consumed: 2, viseme: 'B'};
  }

  if (isNasalSpelling(graphemes, index, joinsNext)) {
    return {consumed: 2, viseme: PT_VISEME_MAP[current]};
  }

  // h is deliberately absent: only ch/lh/nh above give it a visible role.
  return {consumed: 1, viseme: PT_VISEME_MAP[current]};
}

/** Map one isolated aligned grapheme; contextual callers should use the matcher. */
export function graphemeToViseme(
  grapheme: string,
  language: string,
): Viseme | undefined {
  return matchGraphemeToViseme([grapheme], 0, language).viseme;
}

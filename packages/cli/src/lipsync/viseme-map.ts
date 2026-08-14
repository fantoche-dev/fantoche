import type {Viseme} from '@fantoche-dev/document';

/**
 * Portuguese grapheme → Preston-Blair approximation used by spike arm B.
 *
 * This is deliberately orthographic, not phonemic. Portuguese spelling is
 * regular enough for a cheap first pass, but context still changes `c`, `g`,
 * `r`, digraphs and nasal vowels. The blind PT-BR gate exists precisely to
 * decide whether that approximation is visually good enough; this table must
 * not be described as a phoneme model if it wins by accident on one sentence.
 */
export const PT_VISEME_MAP: Readonly<Record<string, Viseme>> = {
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

/** English grapheme approximation used as the control arm. */
export const EN_VISEME_MAP: Readonly<Record<string, Viseme>> = {
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

/** Map one aligned grapheme; punctuation and unsupported symbols are skipped. */
export function graphemeToViseme(
  grapheme: string,
  language: string,
): Viseme | undefined {
  const baseLanguage = language.split('-')[0].toLowerCase();
  const map =
    baseLanguage === 'pt'
      ? PT_VISEME_MAP
      : baseLanguage === 'en'
        ? EN_VISEME_MAP
        : undefined;
  if (map === undefined) {
    throw new Error(`No grapheme→viseme map for language "${language}"`);
  }
  const normalised = grapheme
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return normalised.length === 1 ? map[normalised] : undefined;
}

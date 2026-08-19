/**
 * Easing names accepted by the document format. Most map 1:1 onto a pure
 * timing function exported by `@fantoche-dev/core` (tweening/
 * timingFunctions.ts). `spring` is the deliberate exception: the compiler
 * bakes a critically damped closed-form solution and its entry velocity into
 * the IR, so evaluation remains pure and seekable without iterative state.
 * Core's `sin`/`cos` remain excluded: they are waveform remappers, not
 * easings (they violate f(0)=0 / f(1)=1).
 */
export const EASING_NAMES = [
  'linear',
  'easeInSine',
  'easeOutSine',
  'easeInOutSine',
  'easeInQuad',
  'easeOutQuad',
  'easeInOutQuad',
  'easeInCubic',
  'easeOutCubic',
  'easeInOutCubic',
  'easeInQuart',
  'easeOutQuart',
  'easeInOutQuart',
  'easeInQuint',
  'easeOutQuint',
  'easeInOutQuint',
  'easeInExpo',
  'easeOutExpo',
  'easeInOutExpo',
  'easeInCirc',
  'easeOutCirc',
  'easeInOutCirc',
  'easeInBack',
  'easeOutBack',
  'easeInOutBack',
  'easeInBounce',
  'easeOutBounce',
  'easeInOutBounce',
  'easeInElastic',
  'easeOutElastic',
  'easeInOutElastic',
  'spring',
] as const;

export type EasingName = (typeof EASING_NAMES)[number];

export const DEFAULT_EASING: EasingName = 'easeInOutCubic';

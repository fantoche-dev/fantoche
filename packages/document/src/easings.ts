/**
 * Easing names accepted by the document format. Every name maps 1:1 onto a
 * pure timing function exported by `@fantoche-dev/core` (tweening/
 * timingFunctions.ts) — non-parametrized exports plus the pre-instantiated
 * back/bounce/elastic defaults. Springs are deliberately absent: they are
 * iterative, not closed-form, and cannot live behind a pure state(t).
 */
export const EASING_NAMES = [
  'linear',
  'sin',
  'cos',
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
] as const;

export type EasingName = (typeof EASING_NAMES)[number];

export const DEFAULT_EASING: EasingName = 'easeInOutCubic';

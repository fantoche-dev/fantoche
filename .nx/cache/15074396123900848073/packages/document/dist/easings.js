/**
 * Easing names accepted by the document format. Every name maps 1:1 onto a
 * pure timing function exported by `@fantoche-dev/core` (tweening/
 * timingFunctions.ts) — non-parametrized exports plus the pre-instantiated
 * back/bounce/elastic defaults. Springs are deliberately absent: they are
 * iterative, not closed-form, and cannot live behind a pure state(t).
 * Core's `sin`/`cos` are also excluded: they are waveform remappers, not
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
];
export const DEFAULT_EASING = 'easeInOutCubic';
//# sourceMappingURL=easings.js.map
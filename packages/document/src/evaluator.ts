import {
  Color,
  easeInBack,
  easeInBounce,
  easeInCirc,
  easeInCubic,
  easeInElastic,
  easeInExpo,
  easeInOutBack,
  easeInOutBounce,
  easeInOutCirc,
  easeInOutCubic,
  easeInOutElastic,
  easeInOutExpo,
  easeInOutQuad,
  easeInOutQuart,
  easeInOutQuint,
  easeInOutSine,
  easeInQuad,
  easeInQuart,
  easeInQuint,
  easeInSine,
  easeOutBack,
  easeOutBounce,
  easeOutCirc,
  easeOutCubic,
  easeOutElastic,
  easeOutExpo,
  easeOutQuad,
  easeOutQuart,
  easeOutQuint,
  easeOutSine,
  linear,
  map,
  type TimingFunction,
} from '@fantoche-dev/core';
import type {EasingName} from './easings.js';
import type {CodeRange, TimelineIR, Track} from './ir.js';
import type {PropValue} from './schema.js';

export const EASINGS: Record<EasingName, TimingFunction> = {
  linear,
  easeInSine,
  easeOutSine,
  easeInOutSine,
  easeInQuad,
  easeOutQuad,
  easeInOutQuad,
  easeInCubic,
  easeOutCubic,
  easeInOutCubic,
  easeInQuart,
  easeOutQuart,
  easeInOutQuart,
  easeInQuint,
  easeOutQuint,
  easeInOutQuint,
  easeInExpo,
  easeOutExpo,
  easeInOutExpo,
  easeInCirc,
  easeOutCirc,
  easeInOutCirc,
  easeInBack,
  easeOutBack,
  easeInOutBack,
  easeInBounce,
  easeOutBounce,
  easeInOutBounce,
  easeInElastic,
  easeOutElastic,
  easeInOutElastic,
};

export interface CodeFrameState {
  /** Settled text, or an in-flight transition with eased progress. */
  code: string | {from: string; to: string; progress: number};
  selection: {
    ranges: CodeRange[];
    /** Previous selection while a transition is in flight; null otherwise. */
    from: CodeRange[] | null;
    /** Eased progress of the transition; null when settled. */
    progress: number | null;
  };
}

export interface ActiveBlock {
  src: string;
  exportName: string;
  t0F: number;
  t1F: number;
  /** Frames since the block's window opened (integer when frame is). */
  localFrames: number;
}

export interface FrameState {
  /** target id → prop name → plain value. */
  props: Map<string, Map<string, PropValue>>;
  code: Map<string, CodeFrameState>;
  blocks: ActiveBlock[];
}

/**
 * Interpolate two plain document values. Numbers map linearly; equal-length
 * number arrays and point lists go element-wise; strings that parse as
 * colors interpolate in LCH via core's Color; anything else cuts over at 0.5.
 */
export function lerpValue(
  from: PropValue,
  to: PropValue,
  value: number,
): PropValue {
  if (typeof from === 'number' && typeof to === 'number') {
    // Numbers extrapolate: back/elastic/bounce easings deliberately leave
    // [0,1] and their overshoot must survive.
    return map(from, to, value);
  }
  if (Array.isArray(from) && Array.isArray(to) && from.length === to.length) {
    return (from as unknown[]).map((entry, i) =>
      lerpValue(entry as PropValue, (to as unknown[])[i] as PropValue, value),
    ) as PropValue;
  }
  // Non-numeric values cannot extrapolate — clamp the eased progress.
  const clamped = value <= 0 ? 0 : value >= 1 ? 1 : value;
  if (clamped === 0) {
    return from;
  }
  if (clamped === 1) {
    return to;
  }
  if (typeof from === 'string' && typeof to === 'string') {
    // Any pair of color-parseable strings interpolates as color (right for
    // fill/stroke; a text prop tweened between color words would too).
    try {
      return Color.lerp(from, to, clamped).serialize() as string;
    } catch {
      return clamped >= 0.5 ? to : from;
    }
  }
  return clamped >= 0.5 ? to : from;
}

/** Deep-clone array values so callers can never mutate (or alias) the IR. */
function cloneValue(value: PropValue): PropValue {
  if (Array.isArray(value)) {
    return value.map(entry =>
      Array.isArray(entry) ? ([...entry] as [number, number]) : entry,
    ) as PropValue;
  }
  return value;
}

function cloneRanges(ranges: CodeRange[]): CodeRange[] {
  return ranges.map(([from, to]) => [
    [...from] as [number, number],
    [...to] as [number, number],
  ]);
}

/** Index of the last entry with time ≤ frame, or -1. */
function lastAtOrBefore<T>(
  entries: readonly T[],
  frame: number,
  time: (entry: T) => number,
): number {
  let low = 0;
  let high = entries.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (time(entries[mid]) <= frame) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found;
}

function evaluateTrack(track: Track, frame: number): PropValue | undefined {
  const {keys, initial} = track;
  const index = lastAtOrBefore(keys, frame, key => key.tF);
  if (index === -1) {
    // Before the first key the prop is not driven by the track: fall back to
    // the element's own initial prop (undefined = leave the node alone).
    return initial === undefined ? undefined : cloneValue(initial);
  }
  const current = keys[index];
  const next = keys[index + 1];
  if (next === undefined || next.easing === 'hold') {
    return cloneValue(current.value);
  }
  const span = next.tF - current.tF;
  const progress = span === 0 ? 1 : (frame - current.tF) / span;
  return lerpValue(current.value, next.value, EASINGS[next.easing](progress));
}

/**
 * The pure heart of the document pipeline: same IR + same t ⇒ same state,
 * with O(log keys) work per track and no dependence on prior evaluations.
 *
 * Frame-based entry: callers that live in frames (the scene runtime) must
 * use this directly — a frame→seconds→frame round trip loses a frame for
 * ~1% of frames at 30/60fps (123/30*30 = 122.999…).
 */
export function evaluateFrame(ir: TimelineIR, frame: number): FrameState {
  const props = new Map<string, Map<string, PropValue>>();
  for (const track of ir.tracks) {
    const value = evaluateTrack(track, frame);
    if (value === undefined) {
      continue;
    }
    let target = props.get(track.target);
    if (target === undefined) {
      target = new Map();
      props.set(track.target, target);
    }
    target.set(track.prop, value);
  }

  const code = new Map<string, CodeFrameState>();
  for (const track of ir.codeTracks) {
    let codeState: CodeFrameState['code'] = track.initialCode;
    const editIndex = lastAtOrBefore(track.edits, frame, op => op.t0F);
    if (editIndex !== -1) {
      const op = track.edits[editIndex];
      if (frame >= op.t1F) {
        codeState = op.after;
      } else {
        const progress = (frame - op.t0F) / (op.t1F - op.t0F);
        codeState = {
          from: op.before,
          to: op.after,
          progress: EASINGS[op.easing](progress),
        };
      }
    }

    let selection: CodeFrameState['selection'] = {
      ranges: cloneRanges(
        track.initialSelection ?? [
          [
            [0, 0],
            [Infinity, Infinity],
          ],
        ],
      ),
      from: null,
      progress: null,
    };
    const selectIndex = lastAtOrBefore(track.selects, frame, op => op.t0F);
    if (selectIndex !== -1) {
      const op = track.selects[selectIndex];
      if (frame >= op.t1F) {
        selection = {ranges: cloneRanges(op.after), from: null, progress: null};
      } else {
        const progress = (frame - op.t0F) / (op.t1F - op.t0F);
        selection = {
          ranges: cloneRanges(op.after),
          from: cloneRanges(op.before),
          progress: EASINGS[op.easing](progress),
        };
      }
    }

    code.set(track.target, {code: codeState, selection});
  }

  const blocks: ActiveBlock[] = [];
  for (const block of ir.blocks) {
    if (frame >= block.t0F && frame < block.t1F) {
      blocks.push({
        src: block.src,
        exportName: block.exportName,
        t0F: block.t0F,
        t1F: block.t1F,
        localFrames: frame - block.t0F,
      });
    }
  }

  return {props, code, blocks};
}

/** Seconds-based convenience wrapper over {@link evaluateFrame}. */
export function evaluate(ir: TimelineIR, tSeconds: number): FrameState {
  return evaluateFrame(ir, tSeconds * ir.fps);
}

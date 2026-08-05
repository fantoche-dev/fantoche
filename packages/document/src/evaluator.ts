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
  /** Seconds since the block's window opened. */
  localSeconds: number;
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
  if (value <= 0) {
    return from;
  }
  if (value >= 1) {
    return to;
  }
  if (typeof from === 'number' && typeof to === 'number') {
    return map(from, to, value);
  }
  if (Array.isArray(from) && Array.isArray(to) && from.length === to.length) {
    return (from as unknown[]).map((entry, i) =>
      lerpValue(entry as PropValue, (to as unknown[])[i] as PropValue, value),
    ) as PropValue;
  }
  if (typeof from === 'string' && typeof to === 'string') {
    try {
      return Color.lerp(from, to, value).serialize() as string;
    } catch {
      return value >= 0.5 ? to : from;
    }
  }
  return value >= 0.5 ? to : from;
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
    return initial;
  }
  const current = keys[index];
  const next = keys[index + 1];
  if (next === undefined || next.easing === 'hold') {
    return current.value;
  }
  const span = next.tF - current.tF;
  const progress = span === 0 ? 1 : (frame - current.tF) / span;
  return lerpValue(current.value, next.value, EASINGS[next.easing](progress));
}

/**
 * The pure heart of the document pipeline: same IR + same t ⇒ same state,
 * with O(log keys) work per track and no dependence on prior evaluations.
 */
export function evaluate(ir: TimelineIR, tSeconds: number): FrameState {
  const frame = tSeconds * ir.fps;
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
    const edits = track.ops.filter(op => op.kind === 'edit');
    const selects = track.ops.filter(op => op.kind === 'select');

    let codeState: CodeFrameState['code'] = track.initialCode;
    const editIndex = lastAtOrBefore(edits, frame, op => op.t0F);
    if (editIndex !== -1) {
      const op = edits[editIndex];
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
      ranges: track.initialSelection ?? [
        [
          [0, 0],
          [Infinity, Infinity],
        ],
      ],
      from: null,
      progress: null,
    };
    const selectIndex = lastAtOrBefore(selects, frame, op => op.t0F);
    if (selectIndex !== -1) {
      const op = selects[selectIndex];
      if (frame >= op.t1F) {
        selection = {ranges: op.after, from: null, progress: null};
      } else {
        const progress = (frame - op.t0F) / (op.t1F - op.t0F);
        selection = {
          ranges: op.after,
          from: op.before,
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
        localSeconds: (frame - block.t0F) / ir.fps,
      });
    }
  }

  return {props, code, blocks};
}

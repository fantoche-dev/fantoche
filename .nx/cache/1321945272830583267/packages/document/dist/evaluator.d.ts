import { type TimingFunction } from '@fantoche-dev/core';
import type { EasingName } from './easings.js';
import type { CodeRange, TimelineIR } from './ir.js';
import type { PropValue } from './schema.js';
export declare const EASINGS: Record<EasingName, TimingFunction>;
export interface CodeFrameState {
    /** Settled text, or an in-flight transition with eased progress. */
    code: string | {
        from: string;
        to: string;
        progress: number;
    };
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
export declare function lerpValue(from: PropValue, to: PropValue, value: number): PropValue;
/**
 * The pure heart of the document pipeline: same IR + same t ⇒ same state,
 * with O(log keys) work per track and no dependence on prior evaluations.
 *
 * Frame-based entry: callers that live in frames (the scene runtime) must
 * use this directly — a frame→seconds→frame round trip loses a frame for
 * ~1% of frames at 30/60fps (123/30*30 = 122.999…).
 */
export declare function evaluateFrame(ir: TimelineIR, frame: number): FrameState;
/** Seconds-based convenience wrapper over {@link evaluateFrame}. */
export declare function evaluate(ir: TimelineIR, tSeconds: number): FrameState;
//# sourceMappingURL=evaluator.d.ts.map
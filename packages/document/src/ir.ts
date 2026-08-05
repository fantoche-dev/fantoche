import type {EasingName} from './easings.js';
import type {PropValue} from './schema.js';

/**
 * The timeline IR: everything time-resolved to frames, values plain.
 * In-memory only — when IR fixtures are serialized for tests, `Infinity`
 * inside code ranges uses the schema's `null` sentinel.
 */
export interface TimelineIR {
  fps: number;
  size: [number, number];
  background: string | null;
  /** Total duration in frames (inclusive upper bound is durationF - 1). */
  durationF: number;
  elements: CompiledElement[];
  tracks: Track[];
  codeTracks: CodeTrack[];
  blocks: BlockIR[];
  /** Narration audio asset id, when declared. */
  narrationAudio: string | null;
}

export interface CompiledElement {
  id: string;
  type: string;
  props: Record<string, unknown>;
  parentId: string | null;
  /** Build/z order (document order, depth-first). */
  order: number;
}

export interface TrackKey {
  tF: number;
  value: PropValue;
  /**
   * How to travel FROM the previous key TO this one over
   * [previous.tF, this.tF]. 'hold' = keep the previous value and jump at tF.
   */
  easing: EasingName | 'hold';
}

export interface Track {
  target: string;
  prop: string;
  /** Value before the first key; falls back to the first key's value. */
  initial: PropValue | undefined;
  /** Sorted by tF, strictly increasing. */
  keys: TrackKey[];
}

/** [line, column], 0-based; Infinity = end of line / end of code. */
export type CodePoint = [number, number];
/** [from, to], end-exclusive. */
export type CodeRange = [CodePoint, CodePoint];

export type CodeOp =
  | {
      kind: 'edit';
      t0F: number;
      t1F: number;
      easing: EasingName;
      before: string;
      after: string;
    }
  | {
      kind: 'select';
      t0F: number;
      t1F: number;
      easing: EasingName;
      before: CodeRange[];
      after: CodeRange[];
    };

export interface CodeTrack {
  target: string;
  /** The element's initial code text. */
  initialCode: string;
  /** Initial selection; null = everything (no dimming). */
  initialSelection: CodeRange[] | null;
  /** Sorted by t0F; edit intervals never overlap each other. */
  ops: CodeOp[];
}

export interface BlockIR {
  t0F: number;
  t1F: number;
  /** Module path as written in the document (resolved by the shim/editor). */
  src: string;
  exportName: string;
}

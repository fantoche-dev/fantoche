/**
 * The versioned document format, compiler and evaluator.
 *
 * Pure and DOM-free: everything exported here runs in node and the browser.
 * The scene runtime (DocumentScene) lives under the `./scene` subpath export.
 */

export const DOCUMENT_FORMAT_VERSION = '0.1';

export {
  applyInsert,
  applyReplace,
  rangeToIndices,
  resolveRangeSpec,
} from './code-text.js';
export {
  AnchorError,
  buildNarrationIndex,
  resolveTimeRef,
} from './compiler/anchors.js';
export type {NarrationIndex, ResolvedTime} from './compiler/anchors.js';
export {
  CompileError,
  FULL_SELECTION,
  compileDocument,
} from './compiler/compile.js';
export type {CompileResult} from './compiler/compile.js';
export {DEFAULT_EASING, EASING_NAMES} from './easings.js';
export type {EasingName} from './easings.js';
export {EASINGS, evaluate, lerpValue} from './evaluator.js';
export type {ActiveBlock, CodeFrameState, FrameState} from './evaluator.js';
export type {
  BlockIR,
  CodeOp,
  CodePoint,
  CodeRange,
  CodeTrack,
  CompiledElement,
  TimelineIR,
  Track,
  TrackKey,
} from './ir.js';
export {documentJsonSchema} from './json-schema.js';
export {MigrationError, migrateDocument} from './migrate.js';
export type {MigrateResult} from './migrate.js';
export {documentSchema, elementSchema, timelineItemSchema} from './schema.js';
export type {
  FantocheDocument,
  PropValue,
  RangeSpec,
  TimelineItem,
} from './schema.js';
export {isAnchorString, parseAnchor} from './timeref.js';
export type {ParsedAnchor} from './timeref.js';
export {validateDocument} from './validate.js';
export type {ValidateResult, ValidationError} from './validate.js';

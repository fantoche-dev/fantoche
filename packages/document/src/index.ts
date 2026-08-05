/**
 * The versioned document format and compiler.
 *
 * Pure, DOM-free and node-safe: nothing here imports `@fantoche-dev/core`
 * (whose built lib is not plain-node-ESM-resolvable). The evaluator lives
 * under the `./evaluator` subpath; the scene runtime under `./scene`.
 */

export {DOCUMENT_FORMAT_VERSION} from './version.js';

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
export type {
  BlockIR,
  CodePoint,
  CodeRange,
  CodeTrack,
  CompiledElement,
  EditOp,
  SelectOp,
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

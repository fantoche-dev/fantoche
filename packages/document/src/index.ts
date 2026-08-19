/**
 * The versioned document format and compiler.
 *
 * Pure, DOM-free and node-safe: nothing here imports `@fantoche-dev/core`
 * (whose built lib is not plain-node-ESM-resolvable). The evaluator lives
 * under the `./evaluator` subpath; the scene runtime under `./scene`.
 */

export {DOCUMENT_FORMAT_VERSION} from './version.js';

export {CHARACTER_ART_VERSION, characterArtSchema} from './character/art.js';
export type {CharacterArt} from './character/art.js';
export {
  CHARACTER_FORMAT_VERSION,
  PIVOT_PRESETS,
  SLOT_PARAMS,
  characterSchema,
} from './character/schema.js';
export type {Character, CharacterSlot, SlotParam} from './character/schema.js';
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
export type {
  CompileOptions,
  CompileResult,
  ResolvedCharacter,
} from './compiler/compile.js';
export {DEFAULT_EASING, EASING_NAMES} from './easings.js';
export type {EasingName} from './easings.js';
export type {
  BlockIR,
  CodePoint,
  CodeRange,
  CodeTrack,
  CompiledElement,
  CompiledRig,
  CompiledRigSlot,
  EditOp,
  SelectOp,
  TimelineIR,
  Track,
  TrackKey,
} from './ir.js';
export {characterJsonSchema, documentJsonSchema} from './json-schema.js';
export {buildVisemePreviewDocument} from './lipsync/preview-doc.js';
export type {
  VisemePreviewOptions,
  VisemePreviewResult,
} from './lipsync/preview-doc.js';
// VISEME_TRACK_VERSION is *not* DOCUMENT_FORMAT_VERSION: the track format
// versions independently of the document format (see visemes.ts).
export {
  VISEMES,
  VISEME_TRACK_VERSION,
  visemeAt,
  visemeTrackSchema,
} from './lipsync/visemes.js';
export type {Viseme, VisemeTrack} from './lipsync/visemes.js';
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

import type { SceneDescription } from '@fantoche-dev/core';
import type { BlockFactory } from './blocks.js';
import type { DocumentSceneConfig } from './DocumentScene.js';
export interface MakeDocumentSceneOptions {
    /** Escape-hatch runners keyed by the document's `src#export` string. */
    blocks?: Record<string, BlockFactory>;
}
/**
 * Turn a raw document (parsed JSON) into a scene description that plugs into
 * `makeProject` beside generator scenes. Migrates, validates and compiles —
 * throws with actionable paths when the document is invalid.
 */
export declare function makeDocumentScene(name: string, document: unknown, options?: MakeDocumentSceneOptions): SceneDescription<DocumentSceneConfig>;
//# sourceMappingURL=makeDocumentScene.d.ts.map
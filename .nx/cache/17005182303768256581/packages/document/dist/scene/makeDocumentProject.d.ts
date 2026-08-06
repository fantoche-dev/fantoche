import type { Project } from '@fantoche-dev/core';
import type { MakeDocumentSceneOptions } from './makeDocumentScene.js';
/**
 * Wrap a raw document in a ready-to-render project. The document's fps and
 * size are baked into the project settings here — `renderVideo()` cannot
 * override fps, so this is the single source of timing truth.
 */
export declare function makeDocumentProject(document: unknown, name?: string, options?: MakeDocumentSceneOptions): Project;
//# sourceMappingURL=makeDocumentProject.d.ts.map
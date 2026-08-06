import type {SceneDescription} from '@fantoche-dev/core';
import {compileDocument} from '../compiler/compile.js';
import {migrateDocument} from '../migrate.js';
import {validateDocument} from '../validate.js';
import type {BlockFactory} from './blocks.js';
import type {DocumentSceneConfig} from './DocumentScene.js';
import {DocumentScene} from './DocumentScene.js';

export interface MakeDocumentSceneOptions {
  /** Escape-hatch runners keyed by the document's `src#export` string. */
  blocks?: Record<string, BlockFactory>;
}

/**
 * Turn a raw document (parsed JSON) into a scene description that plugs into
 * `makeProject` beside generator scenes. Migrates, validates and compiles —
 * throws with actionable paths when the document is invalid.
 */
export function makeDocumentScene(
  name: string,
  document: unknown,
  options: MakeDocumentSceneOptions = {},
): SceneDescription<DocumentSceneConfig> {
  const migrated = migrateDocument(document);
  const validation = validateDocument(migrated.doc);
  if (!validation.ok) {
    throw new Error(
      `Invalid document "${name}":\n` +
        validation.errors
          .map(error => `  ${error.path}: ${error.message}`)
          .join('\n'),
    );
  }
  const {ir, warnings} = compileDocument(validation.doc);
  return {
    klass: DocumentScene,
    name,
    config: {
      ir,
      assets: validation.doc.assets ?? {},
      warnings,
      blocks: options.blocks,
    },
    stack: new Error().stack,
    plugins: ['@fantoche-dev/2d/editor'],
  };
}

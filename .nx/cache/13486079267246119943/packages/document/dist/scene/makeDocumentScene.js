import { compileDocument } from '../compiler/compile.js';
import { migrateDocument } from '../migrate.js';
import { validateDocument } from '../validate.js';
import { DocumentScene } from './DocumentScene.js';
/**
 * Turn a raw document (parsed JSON) into a scene description that plugs into
 * `makeProject` beside generator scenes. Migrates, validates and compiles —
 * throws with actionable paths when the document is invalid.
 */
export function makeDocumentScene(name, document, options = {}) {
    const migrated = migrateDocument(document);
    const validation = validateDocument(migrated.doc);
    if (!validation.ok) {
        throw new Error(`Invalid document "${name}":\n` +
            validation.errors
                .map(error => `  ${error.path}: ${error.message}`)
                .join('\n'));
    }
    const { ir, warnings } = compileDocument(validation.doc);
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
//# sourceMappingURL=makeDocumentScene.js.map
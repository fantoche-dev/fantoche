import { makeProject } from '@fantoche-dev/core';
import { makeDocumentScene } from './makeDocumentScene.js';
/**
 * Wrap a raw document in a ready-to-render project. The document's fps and
 * size are baked into the project settings here — `renderVideo()` cannot
 * override fps, so this is the single source of timing truth.
 */
export function makeDocumentProject(document, name = 'document', options = {}) {
    const description = makeDocumentScene(name, document, options);
    const { ir } = description.config;
    return makeProject({
        name,
        scenes: [description],
        settings: {
            shared: {
                size: { x: ir.size[0], y: ir.size[1] },
                ...(ir.background !== null ? { background: ir.background } : {}),
            },
            preview: {
                fps: ir.fps,
                resolutionScale: 1,
            },
            rendering: {
                fps: ir.fps,
                resolutionScale: 1,
                colorSpace: 'srgb',
                exporter: {
                    name: '@fantoche-dev/core/wasm',
                },
            },
        },
    });
}
//# sourceMappingURL=makeDocumentProject.js.map
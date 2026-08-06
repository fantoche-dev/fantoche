import { threads } from '@fantoche-dev/core';
/** Registry key for a block: the document's `src#export` string. */
export function blockKey(src, exportName) {
    return `${src}#${exportName}`;
}
/**
 * Hosts the escape-hatch code blocks of a document scene (ADR 0002).
 *
 * Blocks are the one non-pure corner of a document: inside a block's window
 * the generator is replayed from the window start — replay cost is bounded
 * by the BLOCK's duration, never by the document's. Outside the window the
 * block's nodes are removed entirely.
 */
export class BlockHost {
    factories;
    makeContainer;
    exec;
    warn;
    running = null;
    constructor(factories, makeContainer, exec, warn) {
        this.factories = factories;
        this.makeContainer = makeContainer;
        this.exec = exec;
        this.warn = warn;
    }
    /** Bring block state in line with the evaluator's frame state. */
    async sync(active, view, fps) {
        const target = active[0] ?? null;
        const targetKey = target === null ? null : blockKey(target.src, target.exportName);
        if (this.running !== null && this.running.key !== targetKey) {
            this.dispose();
        }
        if (target === null || targetKey === null) {
            return;
        }
        const factory = this.factories[targetKey];
        if (factory === undefined) {
            this.warn(`no runner registered for block "${targetKey}" — pass it via ` +
                'makeDocumentScene(name, doc, {blocks}) (the CLI shim does this automatically)');
            return;
        }
        const targetFrames = Math.floor(target.localSeconds * fps);
        if (this.running !== null && targetFrames < this.running.steppedFrames) {
            // Seeking backward inside the window: bounded replay from the start.
            this.dispose();
        }
        if (this.running === null) {
            const container = this.makeContainer(view);
            this.running = {
                key: targetKey,
                container,
                runner: threads(() => factory(container)),
                steppedFrames: 0,
            };
        }
        while (this.running.steppedFrames < targetFrames) {
            const runner = this.running.runner;
            const result = this.exec(() => runner.next());
            if (result.done) {
                break;
            }
            if (result.value !== null &&
                typeof result.value === 'object' &&
                'then' in result.value) {
                await result.value;
            }
            this.running.steppedFrames++;
        }
    }
    reset() {
        this.dispose();
    }
    dispose() {
        if (this.running !== null) {
            this.running.container.remove();
            this.running.container.dispose();
            this.running = null;
        }
    }
}
//# sourceMappingURL=blocks.js.map
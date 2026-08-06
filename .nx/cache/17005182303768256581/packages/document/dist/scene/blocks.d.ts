import type { Node, View2D } from '@fantoche-dev/2d';
import type { ThreadGenerator } from '@fantoche-dev/core';
import type { ActiveBlock } from '../evaluator.js';
/**
 * A code block's generator: receives a container node parented to the view
 * and animates inside its declared window.
 */
export interface BlockFactory {
    (container: Node): ThreadGenerator;
}
/** Registry key for a block: the document's `src#export` string. */
export declare function blockKey(src: string, exportName: string): string;
/**
 * Hosts the escape-hatch code blocks of a document scene (ADR 0002).
 *
 * Blocks are the one non-pure corner of a document: inside a block's window
 * the generator is replayed from the window start — replay cost is bounded
 * by the BLOCK's duration, never by the document's. Outside the window the
 * block's nodes are removed entirely.
 */
export declare class BlockHost {
    private readonly factories;
    private readonly makeContainer;
    private readonly exec;
    private readonly warn;
    private running;
    constructor(factories: Record<string, BlockFactory>, makeContainer: (view: View2D) => Node, exec: <T>(callback: () => T) => T, warn: (message: string) => void);
    /** Bring block state in line with the evaluator's frame state. */
    sync(active: ActiveBlock[], view: View2D, fps: number): Promise<void>;
    reset(): void;
    dispose(): void;
}
//# sourceMappingURL=blocks.d.ts.map
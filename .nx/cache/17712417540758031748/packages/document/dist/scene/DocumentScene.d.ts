import type { View2D } from '@fantoche-dev/2d';
import { Node } from '@fantoche-dev/2d';
import type { AssetInfo, FullSceneDescription, Scene, Seekable } from '@fantoche-dev/core';
import { AbstractScene } from '@fantoche-dev/core';
import type { TimelineIR } from '../ir.js';
import type { BlockFactory } from './blocks.js';
import type { AssetMap } from './builders.js';
export interface DocumentSceneConfig {
    ir: TimelineIR;
    assets: AssetMap;
    warnings: string[];
    /** Escape-hatch runners keyed by the document's `src#export` string. */
    blocks?: Record<string, BlockFactory>;
}
/**
 * A scene whose state is a pure function of time (ADR 0002): nodes are built
 * once from the compiled document, every frame applies `evaluate(ir, t)` via
 * imperative signal sets, and {@link Seekable} gives O(1) random access —
 * no generator replay. Lives beside generator scenes untouched.
 */
export declare class DocumentScene extends AbstractScene<DocumentSceneConfig> implements Seekable {
    private view;
    private registeredNodes;
    private readonly nodeCounters;
    private nodesById;
    private ir;
    private assets;
    private readonly blockHost;
    private readonly diffCache;
    private readonly warnedProps;
    constructor(description: FullSceneDescription<DocumentSceneConfig>);
    getView(): View2D;
    protected applyReloadConfig(config: DocumentSceneConfig): void;
    recalculate(setFrame: (frame: number) => void): Promise<void>;
    next(): Promise<void>;
    reset(previousScene?: Scene | null): Promise<void>;
    seekToFrame(frame: number): Promise<void>;
    protected draw(context: CanvasRenderingContext2D): Promise<void>;
    registerNode(node: Node, key?: string): [string, () => void];
    getNode(key: unknown): Node | null;
    getMediaAssets(): Array<AssetInfo>;
    adjustVolume(): void;
    private localTime;
    private updateSceneState;
    private recreateView;
    private buildNodes;
    private applyState;
    private applyCodeState;
    private buildDiffFragments;
}
//# sourceMappingURL=DocumentScene.d.ts.map
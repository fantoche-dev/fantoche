import { Node, View2D as View2DClass, defaultDiffer, defaultTokenize, parseCodeScope, } from '@fantoche-dev/2d';
import { AbstractScene, SceneRenderEvent, SceneState, endPlayback, endScene, startPlayback, startScene, } from '@fantoche-dev/core';
import { evaluateFrame } from '../evaluator.js';
import { BlockHost } from './blocks.js';
import { applyProp, buildElement } from './builders.js';
/**
 * A scene whose state is a pure function of time (ADR 0002): nodes are built
 * once from the compiled document, every frame applies `evaluate(ir, t)` via
 * imperative signal sets, and {@link Seekable} gives O(1) random access —
 * no generator replay. Lives beside generator scenes untouched.
 */
export class DocumentScene extends AbstractScene {
    view = null;
    registeredNodes = new Map();
    nodeCounters = new Map();
    nodesById = new Map();
    ir;
    assets;
    built = false;
    blockHost;
    diffCache = new Map();
    warnedProps = new Set();
    constructor(description) {
        super(description);
        this.ir = description.config.ir;
        this.assets = description.config.assets;
        this.blockHost = new BlockHost(description.config.blocks ?? {}, view => {
            const container = this.execute(() => new Node({}));
            view.add(container);
            return container;
        }, callback => this.execute(callback), message => this.logger.warn(message));
        for (const warning of description.config.warnings) {
            this.logger.warn(warning);
        }
        this.recreateView();
    }
    getView() {
        return this.view;
    }
    applyReloadConfig(config) {
        this.ir = config.ir;
        this.assets = config.assets;
        this.diffCache.clear();
    }
    async recalculate(setFrame) {
        const cached = this.cache.current;
        cached.firstFrame = this.playback.frame;
        cached.transitionDuration = 0;
        cached.duration = this.ir.durationF;
        cached.lastFrame = cached.firstFrame + this.ir.durationF;
        this.cached = true;
        this.cache.current = { ...cached };
        setFrame(cached.lastFrame);
        this.recalculated.dispatch();
    }
    async next() {
        await this.applyState(this.playback.frame - this.firstFrame);
        this.updateSceneState(this.playback.frame);
    }
    async reset(previousScene = null) {
        for (const node of this.registeredNodes.values()) {
            try {
                node.dispose();
            }
            catch (error) {
                this.logger.error(error);
            }
        }
        // Reassign (not clear): stale unregister closures must not touch the
        // live map — mirrors Scene2D.reset().
        this.registeredNodes = new Map();
        this.nodeCounters.clear();
        this.nodesById.clear();
        this.blockHost.reset();
        this.previousScene = previousScene;
        this.previousOnTop = false;
        this.recreateView();
        this.buildNodes();
        this.built = true;
        this.state = SceneState.AfterTransitionIn;
        this.afterReset.dispatch();
        await this.applyState(this.playback.frame - this.firstFrame);
        this.updateSceneState(this.playback.frame);
    }
    async seekToFrame(frame) {
        if (!this.built) {
            await this.reset();
        }
        await this.applyState(frame - this.firstFrame);
        this.updateSceneState(frame);
    }
    async draw(context) {
        // The whole draw runs under the scene context: lazy computeds that build
        // nodes (SVG parsing, code measurement) first fire during rendering, and
        // node construction requires useScene2D(). Safe here — draw performs no
        // document-driven signal sets. (Async, so execute() cannot wrap it.)
        startScene(this);
        startPlayback(this.playback);
        try {
            context.save();
            this.renderLifecycle.dispatch([SceneRenderEvent.BeforeRender, context]);
            context.save();
            this.renderLifecycle.dispatch([SceneRenderEvent.BeginRender, context]);
            this.getView()
                .playbackState(this.playback.state)
                .globalTime(this.playback.time)
                .fps(this.playback.fps);
            await this.getView().render(context);
            this.renderLifecycle.dispatch([SceneRenderEvent.FinishRender, context]);
            context.restore();
            this.renderLifecycle.dispatch([SceneRenderEvent.AfterRender, context]);
            context.restore();
        }
        finally {
            endPlayback(this.playback);
            endScene(this);
        }
    }
    // -- Scene2D-compatible node registry (duck-typed via useScene2D) ---------
    registerNode(node, key) {
        const className = node.constructor?.name ?? 'unknown';
        const counter = (this.nodeCounters.get(className) ?? 0) + 1;
        this.nodeCounters.set(className, counter);
        if (key && this.registeredNodes.has(key)) {
            this.logger.error({
                message: `Duplicated node key: "${key}".`,
                inspect: key,
                stack: new Error().stack,
            });
            key = undefined;
        }
        key ??= `${this.name}/${className}[${counter}]`;
        this.registeredNodes.set(key, node);
        const currentNodeMap = this.registeredNodes;
        return [key, () => currentNodeMap.delete(key)];
    }
    getNode(key) {
        if (typeof key !== 'string') {
            return null;
        }
        return this.registeredNodes.get(key) ?? null;
    }
    // -- media (v0: documents declare no playable media elements) -------------
    getMediaAssets() {
        return [];
    }
    adjustVolume() { }
    // -- internals ------------------------------------------------------------
    updateSceneState(frame) {
        if (frame >= this.lastFrame) {
            this.state = SceneState.Finished;
        }
        else if (this.state === SceneState.Finished) {
            this.state = SceneState.AfterTransitionIn;
        }
    }
    recreateView() {
        this.execute(() => {
            const size = this.getSize();
            this.view = new View2DClass({
                position: size.scale(this.resolutionScale / 2),
                scale: this.resolutionScale,
                assetHash: '0',
                size,
            });
            // The document's own background wins over the host project's shared
            // one — a document must look the same in any project it is placed in.
            if (this.ir.background !== null) {
                this.view.fill(this.ir.background);
            }
        });
    }
    buildNodes() {
        this.execute(() => {
            for (const element of this.ir.elements) {
                const node = buildElement(element, this.assets);
                this.nodesById.set(element.id, node);
                const parent = element.parentId === null
                    ? this.view
                    : this.nodesById.get(element.parentId);
                parent.add(node);
            }
        });
    }
    async applyState(localFrame) {
        const state = evaluateFrame(this.ir, localFrame);
        this.execute(() => {
            for (const [targetId, props] of state.props) {
                const node = this.nodesById.get(targetId);
                if (node === undefined) {
                    continue;
                }
                for (const [prop, value] of props) {
                    if (!applyProp(node, prop, value)) {
                        const warnKey = `${targetId}.${prop}`;
                        if (!this.warnedProps.has(warnKey)) {
                            this.warnedProps.add(warnKey);
                            this.logger.warn(`document drives unknown prop "${prop}" on "${targetId}" — ignored`);
                        }
                    }
                }
            }
            for (const [targetId, codeState] of state.code) {
                const node = this.nodesById.get(targetId);
                if (node !== undefined) {
                    this.applyCodeState(node, codeState);
                }
            }
        });
        await this.blockHost.sync(state.blocks, this.getView());
    }
    applyCodeState(code, state) {
        if (typeof state.code === 'string') {
            // Unconditional: comparing parsed() would skip the settle (parsed
            // resolves to the after-text at progress > 0.5, leaving the signal a
            // frozen mid-morph scope forever). The setter no-ops equal raw values.
            code.code(state.code);
        }
        else {
            const { from, to, progress } = state.code;
            const cacheKey = `${from} ${to}`;
            let fragments = this.diffCache.get(cacheKey);
            if (fragments === undefined) {
                // Diff via the code signal's own tween machinery is generator-bound;
                // build fragments once with the 2d differ and drive progress purely.
                const differ = code.code
                    .context;
                void differ;
                fragments = this.buildDiffFragments(code, from, to);
                this.diffCache.set(cacheKey, fragments);
            }
            // Fresh object per frame — signal identity check would no-op otherwise.
            code.code({ progress, fragments });
        }
        const { ranges, from, progress } = state.selection;
        if (progress === null) {
            code.selection(ranges);
            code.selectionProgress(null);
            code.oldSelection = null;
        }
        else {
            code.oldSelection = (from ?? code.selection());
            code.selection(ranges);
            code.selectionProgress(progress);
        }
    }
    buildDiffFragments(code, from, to) {
        const highlighter = code.highlighter();
        const tokenize = highlighter !== null && highlighter.initialize()
            ? (input) => highlighter.tokenize(input)
            : defaultTokenize;
        return defaultDiffer(parseCodeScope(from), parseCodeScope(to), tokenize);
    }
}
//# sourceMappingURL=DocumentScene.js.map
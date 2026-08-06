import type {Code, CodeTag, View2D} from '@fantoche-dev/2d';
import {
  Node,
  View2D as View2DClass,
  defaultDiffer,
  defaultTokenize,
  parseCodeScope,
} from '@fantoche-dev/2d';
import type {
  AssetInfo,
  FullSceneDescription,
  Scene,
  Seekable,
} from '@fantoche-dev/core';
import {AbstractScene, SceneRenderEvent, SceneState} from '@fantoche-dev/core';
import type {CodeFrameState} from '../evaluator.js';
import {evaluateFrame} from '../evaluator.js';
import type {TimelineIR} from '../ir.js';
import type {BlockFactory} from './blocks.js';
import {BlockHost} from './blocks.js';
import type {AssetMap} from './builders.js';
import {applyProp, buildElement} from './builders.js';

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
export class DocumentScene
  extends AbstractScene<DocumentSceneConfig>
  implements Seekable
{
  private view: View2D | null = null;
  private registeredNodes = new Map<string, Node>();
  private readonly nodeCounters = new Map<string, number>();
  private nodesById = new Map<string, Node>();
  private ir: TimelineIR;
  private assets: AssetMap;
  private built = false;
  private readonly blockHost: BlockHost;
  private readonly diffCache = new Map<string, CodeTag[]>();
  private readonly warnedProps = new Set<string>();

  public constructor(description: FullSceneDescription<DocumentSceneConfig>) {
    super(description);
    this.ir = description.config.ir;
    this.assets = description.config.assets;
    this.blockHost = new BlockHost(
      description.config.blocks ?? {},
      view => {
        const container = this.execute(() => new Node({}));
        view.add(container);
        return container;
      },
      callback => this.execute(callback),
      message => this.logger.warn(message),
    );
    for (const warning of description.config.warnings) {
      this.logger.warn(warning);
    }
    this.recreateView();
  }

  public getView(): View2D {
    return this.view!;
  }

  protected applyReloadConfig(config: DocumentSceneConfig) {
    this.ir = config.ir;
    this.assets = config.assets;
    this.diffCache.clear();
  }

  public async recalculate(setFrame: (frame: number) => void): Promise<void> {
    const cached = this.cache.current;
    cached.firstFrame = this.playback.frame;
    cached.transitionDuration = 0;
    cached.duration = this.ir.durationF;
    cached.lastFrame = cached.firstFrame + this.ir.durationF;
    this.cached = true;
    this.cache.current = {...cached};
    setFrame(cached.lastFrame);
    this.recalculated.dispatch();
  }

  public async next(): Promise<void> {
    await this.applyState(this.playback.frame - this.firstFrame);
    this.updateSceneState(this.playback.frame);
  }

  public async reset(previousScene: Scene | null = null): Promise<void> {
    for (const node of this.registeredNodes.values()) {
      try {
        node.dispose();
      } catch (error) {
        this.logger.error(error as Error);
      }
    }
    this.registeredNodes.clear();
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

  public async seekToFrame(frame: number): Promise<void> {
    if (!this.built) {
      await this.reset();
    }
    await this.applyState(frame - this.firstFrame);
    this.updateSceneState(frame);
  }

  protected async draw(context: CanvasRenderingContext2D): Promise<void> {
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

  // -- Scene2D-compatible node registry (duck-typed via useScene2D) ---------

  public registerNode(node: Node, key?: string): [string, () => void] {
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
    return [key, () => currentNodeMap.delete(key!)];
  }

  public getNode(key: unknown): Node | null {
    if (typeof key !== 'string') {
      return null;
    }
    return this.registeredNodes.get(key) ?? null;
  }

  // -- media (v0: documents declare no playable media elements) -------------

  public override getMediaAssets(): Array<AssetInfo> {
    return [];
  }

  public adjustVolume(): void {}

  // -- internals ------------------------------------------------------------

  private updateSceneState(frame: number): void {
    if (frame >= this.lastFrame) {
      this.state = SceneState.Finished;
    } else if (this.state === SceneState.Finished) {
      this.state = SceneState.AfterTransitionIn;
    }
  }

  private recreateView(): void {
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

  private buildNodes(): void {
    this.execute(() => {
      for (const element of this.ir.elements) {
        const node = buildElement(element, this.assets);
        this.nodesById.set(element.id, node);
        const parent =
          element.parentId === null
            ? (this.view! as unknown as Node)
            : this.nodesById.get(element.parentId)!;
        parent.add(node);
      }
    });
  }

  private async applyState(localFrame: number): Promise<void> {
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
              this.logger.warn(
                `document drives unknown prop "${prop}" on "${targetId}" — ignored`,
              );
            }
          }
        }
      }
      for (const [targetId, codeState] of state.code) {
        const node = this.nodesById.get(targetId);
        if (node !== undefined) {
          this.applyCodeState(node as Code, codeState);
        }
      }
    });
    await this.blockHost.sync(state.blocks, this.getView());
  }

  private applyCodeState(code: Code, state: CodeFrameState): void {
    if (typeof state.code === 'string') {
      // Unconditional: comparing parsed() would skip the settle (parsed
      // resolves to the after-text at progress > 0.5, leaving the signal a
      // frozen mid-morph scope forever). The setter no-ops equal raw values.
      code.code(state.code);
    } else {
      const {from, to, progress} = state.code;
      const cacheKey = `${from} ${to}`;
      let fragments = this.diffCache.get(cacheKey);
      if (fragments === undefined) {
        // Diff via the code signal's own tween machinery is generator-bound;
        // build fragments once with the 2d differ and drive progress purely.
        const differ = (code.code as unknown as Record<string, unknown>)
          .context as unknown;
        void differ;
        fragments = this.buildDiffFragments(code, from, to);
        this.diffCache.set(cacheKey, fragments);
      }
      // Fresh object per frame — signal identity check would no-op otherwise.
      code.code({progress, fragments});
    }

    const {ranges, from, progress} = state.selection;
    if (progress === null) {
      code.selection(ranges as never);
      code.selectionProgress(null);
      code.oldSelection = null;
    } else {
      code.oldSelection = (from ?? code.selection()) as never;
      code.selection(ranges as never);
      code.selectionProgress(progress);
    }
  }

  private buildDiffFragments(code: Code, from: string, to: string): CodeTag[] {
    const highlighter = code.highlighter();
    const tokenize =
      highlighter !== null && highlighter.initialize()
        ? (input: string) => highlighter.tokenize(input)
        : defaultTokenize;
    return defaultDiffer(parseCodeScope(from), parseCodeScope(to), tokenize);
  }
}

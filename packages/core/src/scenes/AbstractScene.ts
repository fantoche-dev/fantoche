import type {AssetInfo, Logger, PlaybackStatus} from '../app';
import {EventDispatcher, ValueDispatcher} from '../events';
import type {SignalValue} from '../signals';
import {DependencyContext} from '../signals';
import type {Vector2} from '../types';
import {endPlayback, endScene, startPlayback, startScene} from '../utils';
import {LifecycleEvents} from './LifecycleEvents';
import type {
  CachedSceneData,
  FullSceneDescription,
  Scene,
  SceneDescriptionReload,
  SceneRenderEvent,
} from './Scene';
import {SceneState} from './SceneState';
import {Shaders} from './Shaders';
import {Slides} from './Slides';
import {Variables} from './Variables';

/**
 * Scene-type-agnostic base implementation of the {@link Scene} interface —
 * state machine, event dispatchers, aux objects and render loop, extracted
 * verbatim from {@link GeneratorScene} so that non-generator scene types
 * (e.g. document scenes) can share them.
 */
export abstract class AbstractScene<TConfig> implements Scene<TConfig> {
  public readonly name: string;
  public readonly playback: PlaybackStatus;
  public readonly logger: Logger;
  public readonly shaders: Shaders;
  public readonly slides: Slides;
  public readonly variables: Variables;
  public creationStack?: string;
  public previousOnTop: SignalValue<boolean>;

  public get firstFrame() {
    return this.cache.current.firstFrame;
  }

  public get lastFrame() {
    return this.firstFrame + this.cache.current.duration;
  }

  public get onCacheChanged() {
    return this.cache.subscribable;
  }
  protected readonly cache = new ValueDispatcher<CachedSceneData>({
    firstFrame: 0,
    transitionDuration: 0,
    duration: 0,
    lastFrame: 0,
  });

  public get onReloaded() {
    return this.reloaded.subscribable;
  }
  private readonly reloaded = new EventDispatcher<void>();

  public get onRecalculated() {
    return this.recalculated.subscribable;
  }
  protected readonly recalculated = new EventDispatcher<void>();

  public get onRenderLifecycle() {
    return this.renderLifecycle.subscribable;
  }
  protected readonly renderLifecycle = new EventDispatcher<
    [SceneRenderEvent, CanvasRenderingContext2D]
  >();

  public get onReset() {
    return this.afterReset.subscribable;
  }
  protected readonly afterReset = new EventDispatcher<void>();

  public readonly lifecycleEvents: LifecycleEvents = new LifecycleEvents(this);
  // eslint-disable-next-line @typescript-eslint/naming-convention
  public get LifecycleEvents() {
    this.logger.warn(
      'LifecycleEvents is deprecated. Use lifecycleEvents instead.',
    );
    return this.lifecycleEvents;
  }

  public get previous() {
    return this.previousScene;
  }

  public getMediaAssets(): Array<AssetInfo> {
    return [];
  }

  public stopAllMedia(): void {}

  public abstract adjustVolume(volumeScale: number): void;

  public readonly experimentalFeatures: boolean;

  protected resolutionScale: number;
  protected previousScene: Scene | null = null;
  protected state: SceneState = SceneState.Initial;
  protected cached = false;
  protected size: Vector2;

  public constructor(description: FullSceneDescription<TConfig>) {
    this.name = description.name;
    this.size = description.size;
    this.resolutionScale = description.resolutionScale;
    this.logger = description.logger;
    this.playback = description.playback;
    this.creationStack = description.stack;
    this.experimentalFeatures = description.experimentalFeatures ?? false;

    this.variables = new Variables(this);
    this.shaders = new Shaders(this, description.sharedWebGLContext);
    this.slides = new Slides(this);

    this.previousOnTop = false;
  }

  public async render(context: CanvasRenderingContext2D): Promise<void> {
    let iterations = 0;
    do {
      iterations++;
      await DependencyContext.consumePromises();
      context.save();
      context.clearRect(0, 0, context.canvas.width, context.canvas.height);
      await this.draw(context);
      context.restore();
    } while (DependencyContext.hasPromises() && iterations < 10);

    if (iterations > 1) {
      this.logger.debug(`render iterations: ${iterations}`);
    }
  }

  protected abstract draw(context: CanvasRenderingContext2D): Promise<void>;

  public reload({
    config,
    size,
    stack,
    resolutionScale,
  }: SceneDescriptionReload<TConfig> = {}) {
    if (config) {
      this.applyReloadConfig(config);
    }
    if (size) {
      this.size = size;
    }
    if (resolutionScale) {
      this.resolutionScale = resolutionScale;
    }
    if (stack) {
      this.creationStack = stack;
    }
    this.cached = false;
    this.reloaded.dispatch();
  }

  /** Apply a reloaded config value — scene-type-specific. */
  protected abstract applyReloadConfig(config: TConfig): void;

  public abstract recalculate(setFrame: (frame: number) => void): Promise<void>;

  public abstract next(): Promise<void>;

  public abstract reset(previousScene?: Scene | null): Promise<void>;

  public getSize(): Vector2 {
    return this.size;
  }

  public getRealSize(): Vector2 {
    return this.size.mul(this.resolutionScale);
  }

  public isAfterTransitionIn(): boolean {
    return this.state === SceneState.AfterTransitionIn;
  }

  public canTransitionOut(): boolean {
    return (
      this.state === SceneState.CanTransitionOut ||
      this.state === SceneState.Finished
    );
  }

  public isFinished(): boolean {
    return this.state === SceneState.Finished;
  }

  public enterInitial() {
    if (this.state === SceneState.AfterTransitionIn) {
      this.state = SceneState.Initial;
    } else {
      this.logger.warn(
        `Scene ${this.name} entered initial in an unexpected state: ${this.state}`,
      );
    }
  }

  public enterAfterTransitionIn() {
    if (this.state === SceneState.Initial) {
      this.state = SceneState.AfterTransitionIn;
    } else {
      this.logger.warn(
        `Scene ${this.name} transitioned in an unexpected state: ${this.state}`,
      );
    }
  }

  public enterCanTransitionOut() {
    if (
      this.state === SceneState.AfterTransitionIn ||
      this.state === SceneState.Initial // only on recalculate
    ) {
      this.state = SceneState.CanTransitionOut;
    } else {
      this.logger.warn(
        `Scene ${this.name} was marked as finished in an unexpected state: ${this.state}`,
      );
    }
  }

  public isCached() {
    return this.cached;
  }

  /**
   * Invoke the given callback in the context of this scene.
   *
   * @remarks
   * This method makes sure that the context of this scene is globally available
   * during the execution of the callback.
   *
   * @param callback - The callback to invoke.
   */
  protected execute<T>(callback: () => T): T {
    let result: T;
    startScene(this);
    startPlayback(this.playback);
    try {
      result = callback();
    } finally {
      endPlayback(this.playback);
      endScene(this);
    }

    return result;
  }
}

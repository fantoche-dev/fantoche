import {decorate, threadable} from '../decorators';
import {ValueDispatcher} from '../events';
import {DependencyContext} from '../signals';
import type {Thread, ThreadGenerator} from '../threading';
import {isPromisable, isPromise, threads} from '../threading';
import {AbstractScene} from './AbstractScene';
import type {FullSceneDescription, Scene} from './Scene';
import {SceneState} from './SceneState';
import type {Threadable} from './Threadable';

export interface ThreadGeneratorFactory<T> {
  (view: T): ThreadGenerator;
}

/**
 * The default implementation of the {@link Scene} interface.
 *
 * Uses generators to control the animation.
 */
export abstract class GeneratorScene<T>
  extends AbstractScene<ThreadGeneratorFactory<T>>
  implements Scene<ThreadGeneratorFactory<T>>, Threadable
{
  public get onThreadChanged() {
    return this.thread.subscribable;
  }
  private readonly thread = new ValueDispatcher<Thread | null>(null);

  private runnerFactory: ThreadGeneratorFactory<T>;
  private runner: ThreadGenerator | null = null;
  // TODO(refactor): seems to be unused
  private counters: Record<string, number> = {};

  public constructor(
    description: FullSceneDescription<ThreadGeneratorFactory<T>>,
  ) {
    super(description);
    this.runnerFactory = description.config;
    decorate(this.runnerFactory, threadable(this.name));
  }

  public abstract getView(): T;

  /**
   * Update the view.
   *
   * Invoked after each step of the main generator.
   * Can be used for calculating layout.
   *
   * Can modify the state of the view.
   */
  public update() {
    // do nothing
  }

  protected applyReloadConfig(config: ThreadGeneratorFactory<T>) {
    this.runnerFactory = config;
  }

  public async recalculate(setFrame: (frame: number) => void) {
    const cached = this.cache.current;
    cached.firstFrame = this.playback.frame;
    cached.lastFrame = cached.firstFrame + cached.duration;

    if (this.isCached()) {
      setFrame(cached.lastFrame);
      this.cache.current = {...cached};
      return;
    }

    cached.transitionDuration = -1;
    await this.reset();
    while (!this.canTransitionOut()) {
      if (
        cached.transitionDuration < 0 &&
        this.state === SceneState.AfterTransitionIn
      ) {
        cached.transitionDuration = this.playback.frame - cached.firstFrame;
      }
      setFrame(this.playback.frame + 1);
      await this.next();
    }

    if (cached.transitionDuration === -1) {
      cached.transitionDuration = 0;
    }

    cached.lastFrame = this.playback.frame;
    cached.duration = cached.lastFrame - cached.firstFrame;
    // Prevent the page from becoming unresponsive.
    await new Promise(resolve => setTimeout(resolve, 0));
    this.cached = true;
    this.cache.current = {...cached};
    this.recalculated.dispatch();
  }

  public async next() {
    if (!this.runner) {
      return;
    }

    let result = this.execute(() => this.runner!.next());
    this.update();
    while (result.value) {
      if (isPromisable(result.value)) {
        const value = await result.value.toPromise();
        result = this.execute(() => this.runner!.next(value));
      } else if (isPromise(result.value)) {
        const value = await result.value;
        result = this.execute(() => this.runner!.next(value));
      } else {
        this.logger.warn({
          message: 'Invalid value yielded by the scene.',
          object: result.value,
        });
        result = this.execute(() => this.runner!.next(result.value));
      }
      this.update();
    }

    if (DependencyContext.hasPromises()) {
      const promises = await DependencyContext.consumePromises();
      this.logger.warn({
        message:
          'Tried to access an asynchronous property before the node was ready. ' +
          'Make sure to yield the node before accessing the property.',
        stack: promises[0].stack,
        inspect: promises[0].owner?.key ?? undefined,
      });
    }

    if (result.done) {
      this.state = SceneState.Finished;
    }
  }

  public async reset(previousScene: Scene | null = null) {
    this.counters = {};
    this.previousScene = previousScene;
    this.previousOnTop = false;
    this.runner = threads(
      () => this.runnerFactory(this.getView()),
      thread => {
        this.thread.current = thread;
      },
    );
    this.state = SceneState.AfterTransitionIn;
    this.afterReset.dispatch();
    await this.next();
  }
}

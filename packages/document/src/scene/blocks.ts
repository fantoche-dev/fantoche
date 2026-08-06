import type {Node, View2D} from '@fantoche-dev/2d';
import type {ThreadGenerator} from '@fantoche-dev/core';
import {isPromisable, isPromise, threads} from '@fantoche-dev/core';
import type {ActiveBlock} from '../evaluator.js';

/**
 * A code block's generator: receives a container node parented to the view
 * and animates inside its declared window. Stepping mirrors GeneratorScene's
 * frame semantics: one baseline step on window entry (like reset()'s first
 * next()), then one step per elapsed frame; promisable/promise yields are
 * awaited and fed back, and do NOT count as frames.
 */
export interface BlockFactory {
  (container: Node): ThreadGenerator;
}

/** Registry key for a block: the document's `src#export` string. */
export function blockKey(src: string, exportName: string): string {
  return `${src}#${exportName}`;
}

interface RunningBlock {
  key: string;
  container: Node;
  runner: ThreadGenerator;
  /** Baseline + elapsed frames already stepped. */
  steppedFrames: number;
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
  private running: RunningBlock | null = null;

  public constructor(
    private readonly factories: Record<string, BlockFactory>,
    private readonly makeContainer: (view: View2D) => Node,
    private readonly exec: <T>(callback: () => T) => T,
    private readonly warn: (message: string) => void,
  ) {}

  /** Bring block state in line with the evaluator's frame state. */
  public async sync(active: ActiveBlock[], view: View2D): Promise<void> {
    const target = active[0] ?? null;
    const targetKey =
      target === null ? null : blockKey(target.src, target.exportName);

    if (this.running !== null && this.running.key !== targetKey) {
      this.dispose();
    }
    if (target === null || targetKey === null) {
      return;
    }

    const factory = this.factories[targetKey];
    if (factory === undefined) {
      this.warn(
        `no runner registered for block "${targetKey}" — pass it via ` +
          'makeDocumentScene(name, doc, {blocks}) (the CLI shim does this automatically)',
      );
      return;
    }

    // Baseline step at window entry + one per elapsed local frame.
    const targetFrames = Math.floor(target.localFrames) + 1;
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
      let result = this.exec(() => runner.next());
      while (result.value) {
        if (isPromisable(result.value)) {
          const value = await result.value.toPromise();
          result = this.exec(() => runner.next(value));
        } else if (isPromise(result.value)) {
          const value = await result.value;
          result = this.exec(() => runner.next(value));
        } else {
          result = this.exec(() => runner.next(result.value));
        }
      }
      if (result.done) {
        this.running.steppedFrames = targetFrames;
        break;
      }
      this.running.steppedFrames++;
    }
  }

  public reset(): void {
    this.dispose();
  }

  public dispose(): void {
    if (this.running !== null) {
      this.running.container.remove();
      this.running.container.dispose();
      this.running = null;
    }
  }
}

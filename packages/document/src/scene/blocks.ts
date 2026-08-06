import type {Node, View2D} from '@fantoche-dev/2d';
import type {ThreadGenerator} from '@fantoche-dev/core';
import {threads} from '@fantoche-dev/core';
import type {ActiveBlock} from '../evaluator.js';

/**
 * A code block's generator: receives a container node parented to the view
 * and animates inside its declared window.
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
  /** Frames of the block's window already stepped. */
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
  public async sync(
    active: ActiveBlock[],
    view: View2D,
    fps: number,
  ): Promise<void> {
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
      if (
        result.value !== null &&
        typeof result.value === 'object' &&
        'then' in (result.value as object)
      ) {
        await (result.value as PromiseLike<unknown>);
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

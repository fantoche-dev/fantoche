// @vitest-environment jsdom
// BlockHost stepping semantics (batch E+F review I8): promisable/promise
// yields are awaited, fed back, and do not count as frames.
import type {Node} from '@fantoche-dev/2d';
import {Rect} from '@fantoche-dev/2d';
import type {FullSceneDescription, ThreadGenerator} from '@fantoche-dev/core';
import {PlaybackManager, PlaybackStatus, Vector2} from '@fantoche-dev/core';
import {describe, expect, test} from 'vitest';
import type {DocumentScene, DocumentSceneConfig} from '../scene/index.js';
import {makeDocumentScene} from '../scene/index.js';

const steps: string[] = [];

function* promiseBlock(container: Node): ThreadGenerator {
  const rect = new Rect({width: 10, height: 10, x: 0});
  container.add(rect);
  for (;;) {
    // A promise yield must be awaited, its value fed back, and must NOT
    // consume a frame.
    const fed = (yield Promise.resolve('fed') as never) as unknown;
    steps.push(String(fed));
    rect.x(rect.x() + 1);
    yield;
  }
}

describe('BlockHost stepping', () => {
  test('promise yields are awaited, fed back and frame-neutral', async () => {
    steps.length = 0;
    const doc = {
      version: '0.1',
      meta: {fps: 30, size: [320, 320], duration: 1},
      elements: [],
      timeline: [{at: 0, block: {src: './p.tsx#promiseBlock', dur: 1}}],
    };
    const blocks: Record<string, typeof promiseBlock> = {};
    blocks['./p.tsx#promiseBlock'] = promiseBlock;

    const playback = new PlaybackManager();
    const status = new PlaybackStatus(playback);
    const description = {
      ...makeDocumentScene('block-host', doc, {blocks}),
      size: new Vector2(320, 320),
      resolutionScale: 1,
      playback: status,
    } as unknown as FullSceneDescription<DocumentSceneConfig>;
    const scene = new description.klass(description) as DocumentScene;
    playback.setup([scene as never]);
    await scene.recalculate(() => {});
    await scene.reset();

    await scene.seekToFrame(10);
    const rect = scene
      .getView()
      .findAll((node: Node): node is Rect => node instanceof Rect)[0];
    // Baseline step + 10 elapsed frames = 11 generator frames, one x++ each.
    expect(rect.x()).toBe(11);
    expect(steps.length).toBe(11);
    expect(new Set(steps)).toEqual(new Set(['fed']));
  });
});

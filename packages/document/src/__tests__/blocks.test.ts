// @vitest-environment jsdom
import type {Node} from '@fantoche-dev/2d';
import {Rect} from '@fantoche-dev/2d';
import type {FullSceneDescription, ThreadGenerator} from '@fantoche-dev/core';
import {PlaybackManager, PlaybackStatus, Vector2} from '@fantoche-dev/core';
import {describe, expect, test} from 'vitest';
import type {DocumentScene, DocumentSceneConfig} from '../scene/index.js';
import {makeDocumentScene} from '../scene/index.js';

const doc = {
  version: '0.1',
  meta: {fps: 30, size: [320, 320], duration: 5},
  elements: [],
  timeline: [{at: 1, block: {src: './fx.tsx#slide', dur: 2}}],
};

function* slide(container: Node): ThreadGenerator {
  const rect = new Rect({width: 10, height: 10, x: 0});
  container.add(rect);
  for (;;) {
    rect.x(rect.x() + 1);
    yield;
  }
}

const blockRegistry: Record<string, typeof slide> = {};
blockRegistry['./fx.tsx#slide'] = slide;

function makeScene(): {scene: DocumentScene; playback: PlaybackManager} {
  const playback = new PlaybackManager();
  const status = new PlaybackStatus(playback);
  const description = {
    ...makeDocumentScene('block-test', doc, {blocks: blockRegistry}),
    size: new Vector2(320, 320),
    resolutionScale: 1,
    playback: status,
  } as unknown as FullSceneDescription<DocumentSceneConfig>;
  const scene = new description.klass(description) as DocumentScene;
  playback.setup([scene as never]);
  return {scene, playback};
}

function blockRectX(scene: DocumentScene): number | null {
  const view = scene.getView();
  const rects = view.findAll(
    (node: Node): node is Rect => node instanceof Rect,
  );
  return rects.length > 0 ? (rects[0] as Rect).x() : null;
}

describe('code-block escape hatch', () => {
  test('seeking into the window equals sweeping into it (bounded replay)', async () => {
    const swept = makeScene();
    await swept.scene.recalculate(() => {});
    await swept.scene.reset();
    for (let frame = 0; frame <= 45; frame++) {
      swept.playback.frame = frame;
      await swept.scene.next();
    }
    const sweptX = blockRectX(swept.scene);

    const jumped = makeScene();
    await jumped.scene.recalculate(() => {});
    await jumped.scene.reset();
    await jumped.scene.seekToFrame(45);
    const jumpedX = blockRectX(jumped.scene);

    expect(sweptX).not.toBeNull();
    expect(jumpedX).toBe(sweptX);
  });

  test('backward seeks inside the window replay only the block', async () => {
    const {scene} = makeScene();
    await scene.recalculate(() => {});
    await scene.reset();
    await scene.seekToFrame(80);
    const late = blockRectX(scene);
    await scene.seekToFrame(40);
    const early = blockRectX(scene);
    expect(late).not.toBeNull();
    expect(early).not.toBeNull();
    expect(early!).toBeLessThan(late!);
  });

  test('outside the window the block leaves no nodes behind', async () => {
    const {scene} = makeScene();
    await scene.recalculate(() => {});
    await scene.reset();
    await scene.seekToFrame(45);
    expect(blockRectX(scene)).not.toBeNull();
    await scene.seekToFrame(120);
    expect(blockRectX(scene)).toBeNull();
    await scene.seekToFrame(45);
    expect(blockRectX(scene)).not.toBeNull();
  });
});

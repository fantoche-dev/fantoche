// @vitest-environment jsdom
import type {Rect} from '@fantoche-dev/2d';
import type {FullSceneDescription} from '@fantoche-dev/core';
import {PlaybackManager, PlaybackStatus, Vector2} from '@fantoche-dev/core';
import {beforeEach, describe, expect, test} from 'vitest';
import type {DocumentScene, DocumentSceneConfig} from '../scene/index.js';
import {makeDocumentScene} from '../scene/index.js';

const doc = {
  version: '0.1',
  meta: {fps: 30, size: [320, 320], duration: 4},
  elements: [
    {
      id: 'box',
      type: 'rect',
      props: {x: -100, width: 40, height: 40, fill: '#e13238'},
    },
    {id: 'note', type: 'text', props: {text: 'olá', fontSize: 24, opacity: 1}},
  ],
  timeline: [
    {at: 1, target: 'box', tween: {x: {to: 100}}, dur: 1, easing: 'linear'},
    {at: 3, target: 'note', set: {opacity: 0.25}},
  ],
};

function makeScene(): {scene: DocumentScene; playback: PlaybackManager} {
  const playback = new PlaybackManager();
  const status = new PlaybackStatus(playback);
  const description = {
    ...makeDocumentScene('doc-test', doc),
    size: new Vector2(320, 320),
    resolutionScale: 1,
    playback: status,
  } as unknown as FullSceneDescription<DocumentSceneConfig>;
  const scene = new description.klass(description) as DocumentScene;
  playback.setup([scene as never]);
  return {scene, playback};
}

describe('DocumentScene', () => {
  let scene: DocumentScene;
  let playback: PlaybackManager;

  beforeEach(async () => {
    ({scene, playback} = makeScene());
    await scene.recalculate(() => {});
    await scene.reset();
  });

  test('recalculate is O(1): cached bounds come from the IR, no stepping', () => {
    expect(scene.isCached()).toBe(true);
    expect(scene.firstFrame).toBe(0);
    expect(scene.lastFrame).toBe(120); // meta.duration 4s × 30fps
  });

  test('nodes are built from elements with document ids as keys', () => {
    expect(scene.getNode('box')).not.toBeNull();
    expect(scene.getNode('note')).not.toBeNull();
  });

  test('seekToFrame drives node signals to the evaluated state', async () => {
    await scene.seekToFrame(45); // t = 1.5s, mid-tween
    expect((scene.getNode('box') as Rect).x()).toBeCloseTo(0);

    await scene.seekToFrame(90); // t = 3s, after tween + at the set
    expect((scene.getNode('box') as Rect).x()).toBe(100);
    expect((scene.getNode('note') as Rect).opacity()).toBe(0.25);

    await scene.seekToFrame(0); // back to the start — O(1), no reset needed
    expect((scene.getNode('box') as Rect).x()).toBe(-100);
    expect((scene.getNode('note') as Rect).opacity()).toBe(1);
  });

  test('PlaybackManager takes the Seekable fast path end to end', async () => {
    await playback.seek(60);
    expect(playback.frame).toBe(60);
    expect((scene.getNode('box') as Rect).x()).toBe(100);

    await playback.seek(10); // backward — no replay loop for document scenes
    expect(playback.frame).toBe(10);
    expect((scene.getNode('box') as Rect).x()).toBe(-100);
  });

  test('the scene finishes exactly at its last frame', async () => {
    await scene.seekToFrame(119);
    expect(scene.isFinished()).toBe(false);
  });
});

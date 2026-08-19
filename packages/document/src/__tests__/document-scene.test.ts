// @vitest-environment jsdom
import type {Rect} from '@fantoche-dev/2d';
import type {FullSceneDescription} from '@fantoche-dev/core';
import {PlaybackManager, PlaybackStatus, Vector2} from '@fantoche-dev/core';
import {beforeEach, describe, expect, test} from 'vitest';
import type {DocumentScene, DocumentSceneConfig} from '../scene/index.js';
import {makeDocumentScene} from '../scene/index.js';
import {rigDocument, rigOptions} from './rig-fixture.js';

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

function makeScene(document: unknown = doc): {
  scene: DocumentScene;
  playback: PlaybackManager;
} {
  const playback = new PlaybackManager();
  const status = new PlaybackStatus(playback);
  const description = {
    ...makeDocumentScene('doc-test', document as never),
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

describe('DocumentScene with a character rig', () => {
  test('threads resolved characters and applies FK/zIndex to ordinary SVG nodes', async () => {
    const playback = new PlaybackManager();
    const description = {
      ...makeDocumentScene('rig-test', rigDocument, rigOptions),
      size: new Vector2(320, 320),
      resolutionScale: 1,
      playback: new PlaybackStatus(playback),
    } as unknown as FullSceneDescription<DocumentSceneConfig>;
    const rigScene = new description.klass(description) as DocumentScene;
    playback.setup([rigScene as never]);
    await rigScene.recalculate(() => {});
    await rigScene.reset();

    const hand = rigScene.getNode('ana.hand') as unknown as {
      x(): number;
      y(): number;
      rotation(): number;
    };
    const arm = rigScene.getNode('ana.arm') as unknown as {zIndex(): number};
    expect(hand).not.toBeNull();
    await rigScene.seekToFrame(59);
    expect(arm.zIndex()).toBe(-1);
    await rigScene.seekToFrame(60);
    expect(hand.x()).toBeCloseTo(40, 6);
    expect(hand.y()).toBeCloseTo(30, 6);
    expect(hand.rotation()).toBeCloseTo(90, 6);
    expect(arm.zIndex()).toBe(10);

    await rigScene.seekToFrame(0);
    expect(hand.x()).toBeCloseTo(80, 6);
    expect(hand.y()).toBeCloseTo(-10, 6);
    expect(arm.zIndex()).toBe(-1);
  });
});

describe('narration media assets', () => {
  const narratedDoc = {
    version: '0.2',
    meta: {fps: 30, size: [320, 320], duration: 4},
    assets: {voice: {type: 'audio', src: 'voice.wav', dur: 9.6, volume: 0.9}},
    narration: {
      audio: 'voice',
      segments: [{id: 'intro', text: 'olá', start: 0, dur: 2}],
    },
    elements: [],
    timeline: [],
  };

  test('reports the narration audio with scene-local time, every frame', async () => {
    const {scene, playback} = makeScene(narratedDoc);
    await scene.recalculate(() => {});
    await scene.reset();
    await playback.seek(45); // t = 1.5s at the document's 30fps
    expect(scene.getMediaAssets()).toEqual([
      {
        key: 'doc-test/voice',
        type: 'audio',
        src: 'voice.wav',
        playbackRate: 1,
        volume: 0.9,
        currentTime: 1.5,
        duration: 9.6,
      },
    ]);
    await playback.seek(60);
    expect(scene.getMediaAssets()[0].currentTime).toBe(2);
  });

  test('defaults duration to the last segment end and volume to 1', async () => {
    const document = structuredClone(narratedDoc) as any;
    delete document.assets.voice.dur;
    delete document.assets.voice.volume;
    document.narration.segments.push({
      id: 'body',
      text: 'mundo',
      start: 2.5,
      dur: 1,
    });
    const {scene} = makeScene(document);
    await scene.recalculate(() => {});
    await scene.reset();
    const [asset] = scene.getMediaAssets();
    expect(asset.duration).toBe(3.5);
    expect(asset.volume).toBe(1);
  });

  test('a document without narration audio reports no media', async () => {
    const {scene} = makeScene();
    await scene.recalculate(() => {});
    await scene.reset();
    expect(scene.getMediaAssets()).toEqual([]);
  });
});

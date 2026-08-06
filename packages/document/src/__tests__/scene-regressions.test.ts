// @vitest-environment jsdom
// Regressions from the batch D review: code-signal settling (C1), scene
// finish semantics, and a render smoke test over a no-op 2D context.
import type {Code} from '@fantoche-dev/2d';
import type {FullSceneDescription} from '@fantoche-dev/core';
import {PlaybackManager, PlaybackStatus, Vector2} from '@fantoche-dev/core';
import {describe, expect, test} from 'vitest';
import type {DocumentScene, DocumentSceneConfig} from '../scene/index.js';
import {makeDocumentScene} from '../scene/index.js';

const editDoc = {
  version: '0.1',
  meta: {fps: 30, size: [320, 320], duration: 4},
  elements: [
    {id: 'snippet', type: 'code', props: {code: 'let a = 1;', fontSize: 12}},
  ],
  timeline: [{at: 1, target: 'snippet', edit: {to: 'let a = 2;'}, dur: 1}],
};

function makeScene(document: unknown): {
  scene: DocumentScene;
  playback: PlaybackManager;
} {
  const playback = new PlaybackManager();
  const status = new PlaybackStatus(playback);
  const description = {
    ...makeDocumentScene('regression', document),
    size: new Vector2(320, 320),
    resolutionScale: 1,
    playback: status,
  } as unknown as FullSceneDescription<DocumentSceneConfig>;
  const scene = new description.klass(description) as DocumentScene;
  playback.setup([scene as never]);
  return {scene, playback};
}

describe('code signal settling (review C1)', () => {
  test('sweeping through an edit window settles to a plain scope, equal to a fresh seek', async () => {
    const swept = makeScene(editDoc);
    await swept.scene.recalculate(() => {});
    await swept.scene.reset();
    for (let frame = 0; frame <= 90; frame++) {
      swept.playback.frame = frame;
      await swept.scene.next();
    }
    const sweptCode = swept.scene.getNode('snippet') as Code;
    expect(sweptCode.parsed()).toBe('let a = 2;');
    // The raw signal must be a settled single-fragment scope, not a frozen
    // mid-morph diff at progress ≈ 1.
    expect(sweptCode.code().fragments.length).toBe(1);

    const jumped = makeScene(editDoc);
    await jumped.scene.recalculate(() => {});
    await jumped.scene.reset();
    jumped.playback.frame = 90;
    await jumped.scene.seekToFrame(90);
    const jumpedCode = jumped.scene.getNode('snippet') as Code;
    expect(jumpedCode.parsed()).toBe(sweptCode.parsed());
    expect(jumpedCode.code().fragments.length).toBe(1);
  });

  test('seeking backward out of the window restores the before text', async () => {
    const {scene, playback} = makeScene(editDoc);
    await playback.recalculate();
    await playback.reset();
    await playback.seek(75); // mid-edit
    await playback.seek(10); // before the window
    const code = scene.getNode('snippet') as Code;
    expect(code.parsed()).toBe('let a = 1;');
    expect(code.code().fragments.length).toBe(1);
  });
});

describe('finish semantics', () => {
  test('the scene finishes exactly at its last frame (through playback)', async () => {
    const {scene, playback} = makeScene(editDoc);
    await playback.recalculate();
    await playback.reset();

    await playback.seek(119);
    expect(scene.isFinished()).toBe(false);

    await playback.seek(120);
    expect(scene.isFinished()).toBe(true);
  });
});

describe('render smoke', () => {
  test('render() drains dependencies and dispatches the lifecycle in order', async () => {
    const rectDoc = {
      version: '0.1',
      meta: {fps: 30, size: [320, 320], duration: 1},
      elements: [
        {
          id: 'box',
          type: 'rect',
          props: {width: 40, height: 40, fill: '#e13238'},
        },
      ],
      timeline: [],
    };
    const {scene, playback} = makeScene(rectDoc);
    await playback.recalculate();
    await playback.reset();

    const events: string[] = [];
    scene.onRenderLifecycle.subscribe(([event]) => {
      events.push(String(event));
    });

    // jsdom has no DOMMatrix — a self-returning identity stub is enough for
    // a no-op render pass.
    class StubMatrix {
      public a = 1;
      public b = 0;
      public c = 0;
      public d = 1;
      public e = 0;
      public f = 0;
      public constructor() {
        return new Proxy(this, {
          get(target, prop) {
            if (prop in target) {
              return (target as Record<string | symbol, unknown>)[prop];
            }
            return () => new StubMatrix();
          },
        });
      }
    }
    (globalThis as Record<string, unknown>).DOMMatrix = StubMatrix;

    const noop = () => {};
    const context = new Proxy(
      {canvas: {width: 320, height: 320}},
      {
        get(target, prop) {
          if (prop in target) {
            return (target as Record<string | symbol, unknown>)[prop];
          }
          return noop;
        },
        set() {
          return true;
        },
      },
    ) as unknown as CanvasRenderingContext2D;

    await scene.render(context);
    expect(events.length).toBe(4);
    expect(events).toEqual([...events].sort());
  });
});

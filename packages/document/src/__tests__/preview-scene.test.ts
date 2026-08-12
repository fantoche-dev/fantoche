// @vitest-environment jsdom
import type {Node} from '@fantoche-dev/2d';
import type {FullSceneDescription} from '@fantoche-dev/core';
import {PlaybackManager, PlaybackStatus, Vector2} from '@fantoche-dev/core';
import {beforeEach, describe, expect, test} from 'vitest';
import {buildVisemePreviewDocument} from '../lipsync/preview-doc.js';
import type {Viseme} from '../lipsync/visemes.js';
import {VISEMES} from '../lipsync/visemes.js';
import type {DocumentScene, DocumentSceneConfig} from '../scene/index.js';
import {makeDocumentScene} from '../scene/index.js';

const mouths = Object.fromEntries(
  VISEMES.map(viseme => [
    viseme,
    `<svg viewBox="0 0 100 60"><rect width="100" height="60"/><text>${viseme}</text></svg>`,
  ]),
) as Record<Viseme, string>;

const doc = buildVisemePreviewDocument({
  track: {
    version: '0.1',
    engine: 'rhubarb',
    audio: 'v.wav',
    cues: [
      {t: 0, viseme: 'X'},
      {t: 0.5, viseme: 'B'},
      {t: 1, viseme: 'F'},
    ],
  },
  mouths,
  fps: 30,
  size: [480, 320],
});

/**
 * The claim under test is that this document needs no runtime support: it is
 * built and driven by the same DocumentScene every other document uses.
 */
describe('viseme preview document in the runtime', () => {
  let scene: DocumentScene;

  beforeEach(async () => {
    const playback = new PlaybackManager();
    const description = {
      ...makeDocumentScene('viseme-preview', doc),
      size: new Vector2(480, 320),
      resolutionScale: 1,
      playback: new PlaybackStatus(playback),
    } as unknown as FullSceneDescription<DocumentSceneConfig>;
    scene = new description.klass(description) as DocumentScene;
    playback.setup([scene as never]);
    await scene.recalculate(() => {});
    await scene.reset();
  });

  test('builds one node per mouth and hold-switches their opacity', async () => {
    const opacities = (): number[] =>
      VISEMES.map(viseme => {
        const node = scene.getNode(`mouth-${viseme}`) as Node | null;
        expect(node).not.toBeNull();
        return node!.opacity();
      });

    // X while the first cue holds, then B, then F — one mouth at a time, and
    // no in-between: a crossfade would show two mouths at fractional opacity.
    expect(opacities()).toEqual(VISEMES.map(v => (v === 'X' ? 1 : 0)));
    await scene.seekToFrame(14);
    expect(opacities()).toEqual(VISEMES.map(v => (v === 'X' ? 1 : 0)));
    await scene.seekToFrame(15);
    expect(opacities()).toEqual(VISEMES.map(v => (v === 'B' ? 1 : 0)));
    await scene.seekToFrame(29);
    expect(opacities()).toEqual(VISEMES.map(v => (v === 'B' ? 1 : 0)));
    await scene.seekToFrame(30);
    expect(opacities()).toEqual(VISEMES.map(v => (v === 'F' ? 1 : 0)));
    // Seeking is O(1) and stateless, so going backwards must restore exactly.
    await scene.seekToFrame(15);
    expect(opacities()).toEqual(VISEMES.map(v => (v === 'B' ? 1 : 0)));
  });

  test('runs to the end of the tail the generator asked for', () => {
    expect(scene.lastFrame).toBe(45); // (1s last cue + 0.5s tail) × 30fps
  });
});

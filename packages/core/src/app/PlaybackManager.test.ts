import {describe, expect, test} from 'vitest';
import type {Scene} from '../scenes';
import {PlaybackManager} from './PlaybackManager';

interface StubOptions {
  seekable: boolean;
  firstFrame?: number;
  lastFrame?: number;
}

function makeStubScene({
  seekable,
  firstFrame = 0,
  lastFrame = 6000,
}: StubOptions) {
  const calls = {next: 0, reset: 0, seekToFrame: [] as number[]};
  const scene = {
    firstFrame,
    lastFrame,
    isCached: () => true,
    isFinished: () => false,
    isAfterTransitionIn: () => true,
    canTransitionOut: () => false,
    stopAllMedia: () => {},
    async reset() {
      calls.reset++;
    },
    async next() {
      calls.next++;
    },
    ...(seekable
      ? {
          async seekToFrame(frame: number) {
            calls.seekToFrame.push(frame);
          },
        }
      : {}),
  };
  return {scene: scene as unknown as Scene, calls};
}

describe('PlaybackManager.seek', () => {
  test('seekable scenes jump in O(1): one seekToFrame call, zero next calls', async () => {
    const {scene, calls} = makeStubScene({seekable: true});
    const playback = new PlaybackManager();
    playback.setup([scene]);

    await playback.seek(5000);

    expect(calls.seekToFrame).toEqual([5000]);
    expect(calls.next).toBe(0);
    expect(playback.frame).toBe(5000);
  });

  test('backward seeks on seekable scenes also skip the replay loop', async () => {
    const {scene, calls} = makeStubScene({seekable: true});
    const playback = new PlaybackManager();
    playback.setup([scene]);

    await playback.seek(5000);
    await playback.seek(100);

    expect(calls.seekToFrame).toEqual([5000, 100]);
    expect(calls.next).toBe(0);
    expect(playback.frame).toBe(100);
  });

  test('non-seekable scenes keep the frame-step behavior', async () => {
    const {scene, calls} = makeStubScene({seekable: false});
    const playback = new PlaybackManager();
    playback.setup([scene]);

    await playback.seek(10);

    expect(calls.next).toBe(10);
    expect(playback.frame).toBe(10);
  });

  test('mid-transition falls back to stepping even for seekable scenes', async () => {
    const previous = makeStubScene({seekable: false});
    const {scene, calls} = makeStubScene({seekable: true});
    const playback = new PlaybackManager();
    playback.setup([scene]);
    playback.previousScene = previous.scene;
    playback.frame = 5;

    await playback.seek(8);

    expect(calls.seekToFrame).toEqual([]);
    expect(calls.next).toBeGreaterThan(0);
  });

  test('a seek beyond lastFrame is not fast-pathed', async () => {
    const {scene, calls} = makeStubScene({seekable: true, lastFrame: 50});
    const playback = new PlaybackManager();
    playback.setup([scene]);

    await playback.seek(60);

    expect(calls.seekToFrame).toEqual([]);
    expect(calls.next).toBeGreaterThan(0);
  });
});

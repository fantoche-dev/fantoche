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

  test('backward seeks on seekable scenes skip both the replay loop AND the rebuild', async () => {
    const {scene, calls} = makeStubScene({seekable: true});
    const playback = new PlaybackManager();
    playback.setup([scene]);

    await playback.seek(5000);
    await playback.seek(100);

    expect(calls.seekToFrame).toEqual([5000, 100]);
    expect(calls.next).toBe(0);
    expect(calls.reset).toBe(0);
    expect(playback.frame).toBe(100);
  });

  test('seeking exactly to a scene boundary hands off to the next scene', async () => {
    const first = makeStubScene({seekable: true, firstFrame: 0, lastFrame: 50});
    const second = makeStubScene({
      seekable: false,
      firstFrame: 50,
      lastFrame: 100,
    });
    let firstDone = false;
    (first.scene as unknown as Record<string, unknown>).canTransitionOut = () =>
      firstDone;
    (first.scene as unknown as {next(): Promise<void>}).next = async () => {
      first.calls.next++;
      firstDone = true;
    };
    const playback = new PlaybackManager();
    playback.setup([first.scene, second.scene]);

    const finished = await playback.seek(50);

    // Fast path jumps to 49, the step loop runs the ordinary handoff: the
    // boundary frame belongs to the SECOND scene and playback is not done.
    expect(first.calls.seekToFrame).toEqual([49]);
    expect(playback.currentScene).toBe(second.scene);
    expect(second.calls.reset).toBe(1);
    expect(finished).toBe(false);
    expect(playback.frame).toBe(50);
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

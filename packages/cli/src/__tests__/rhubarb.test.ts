import * as fs from 'fs';
import {describe, expect, test} from 'vitest';
import {parseRhubarbOutput, runRhubarb} from '../lipsync/rhubarb';

describe('Rhubarb adapter', () => {
  test('converts captured phonetic output into a valid viseme track', async () => {
    const raw = JSON.parse(
      fs.readFileSync(
        new URL('./fixtures/rhubarb-pt-br-01.json', import.meta.url),
        'utf8',
      ),
    );
    const track = parseRhubarbOutput(raw, {
      audio: 'pt-br-01.wav',
      language: 'pt',
    });
    expect(track.engine).toBe('rhubarb');
    expect(track.cues[0].t).toBe(0);
    expect(track.cues.length).toBeGreaterThan(20);
    expect(track.cues.every(cue => 'ABCDEFGHX'.includes(cue.viseme))).toBe(
      true,
    );
    expect(
      track.cues.every((cue, i) => i === 0 || cue.t > track.cues[i - 1].t),
    ).toBe(true);

    const {visemeTrackSchema} = await import('@fantoche-dev/document');
    expect(visemeTrackSchema.safeParse(track).success).toBe(true);
  });

  test('drops zero-length and duplicate-start cues', () => {
    const track = parseRhubarbOutput(
      {
        mouthCues: [
          {start: 0, end: 0.1, value: 'X'},
          {start: 0.1, end: 0.1, value: 'B'},
          {start: 0.1, end: 0.3, value: 'C'},
          {start: 0.1, end: 0.4, value: 'D'},
        ],
      },
      {audio: 'x.wav'},
    );
    expect(track.cues).toEqual([
      {t: 0, viseme: 'X'},
      {t: 0.1, viseme: 'C'},
    ]);
  });

  test('rejects malformed output at the offending field', () => {
    expect(() =>
      parseRhubarbOutput(
        {mouthCues: [{start: 0, end: 1, value: 'Q'}]},
        {audio: 'x.wav'},
      ),
    ).toThrow(/mouthCues\[0\]\.value/);
  });

  test('explains that a missing binary is dev-time only', async () => {
    await expect(
      runRhubarb('x.wav', {
        executable: 'fantoche-rhubarb-that-does-not-exist',
      }),
    ).rejects.toThrow(/Rhubarb not found.*rendering never does/);
  });
});

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {afterEach, describe, expect, test, vi} from 'vitest';
import {generateWhisperXTrack} from '../lipsync/generate';

const temporaries: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of temporaries.splice(0)) {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

describe('viseme track generation', () => {
  test('writes a portable WhisperX track ready for comparison', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fantoche-generate-'));
    temporaries.push(dir);
    const audio = path.join(dir, 'voice.wav');
    const alignment = path.join(dir, 'alignment.json');
    const out = path.join(dir, 'tracks', 'whisperx.viseme.json');
    fs.writeFileSync(audio, 'fixture');
    fs.writeFileSync(
      alignment,
      JSON.stringify({
        words: [{text: 'Bom', start: 0, end: 0.3}],
        chars: [
          {char: 'B', start: 0, end: 0.1},
          {char: 'o', start: 0.1, end: 0.2},
          {char: 'm', start: 0.2, end: 0.3},
        ],
      }),
    );
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await generateWhisperXTrack(alignment, {
      audio,
      language: 'pt-BR',
      out,
    });

    const track = JSON.parse(fs.readFileSync(out, 'utf8'));
    expect(track.engine).toBe('whisperx');
    expect(track.audio).toBe('../voice.wav');
    expect(track.language).toBe('pt-BR');
    expect(track.cues.at(-1)).toEqual({t: 0.3, viseme: 'X'});
  });

  test('refuses to overwrite an input artifact', async () => {
    await expect(
      generateWhisperXTrack('alignment.json', {
        audio: 'voice.wav',
        language: 'pt',
        out: 'alignment.json',
      }),
    ).rejects.toThrow(/must not overwrite/);
  });
});

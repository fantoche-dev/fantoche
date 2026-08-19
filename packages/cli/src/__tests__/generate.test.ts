import * as crypto from 'crypto';
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

describe('generation records and reports its evidence', () => {
  function fixture(): {dir: string; audio: string; alignment: string} {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fantoche-evidence-'));
    temporaries.push(dir);
    const audio = path.join(dir, 'voice.wav');
    const alignment = path.join(dir, 'alignment.json');
    fs.writeFileSync(audio, 'fixture-audio-bytes');
    fs.writeFileSync(
      alignment,
      JSON.stringify({
        words: [
          {text: 'Bom', start: 0, end: 0.3},
          {text: 'dia', start: 2.4, end: 2.7},
        ],
        chars: [
          {char: 'B', start: 0, end: 0.1},
          {char: 'o', start: 0.1, end: 0.2},
          {char: 'm', start: 0.2, end: 0.3},
          {char: 'd', start: 2.4, end: 2.5},
          {char: 'i', start: 2.5, end: 2.6},
          {char: 'a', start: 2.6, end: 2.7},
        ],
      }),
    );
    return {dir, audio, alignment};
  }

  test('binds the track to its audio by content digest', async () => {
    const {dir, audio, alignment} = fixture();
    const out = path.join(dir, 'whisperx.viseme.json');
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await generateWhisperXTrack(alignment, {audio, language: 'pt-BR', out});

    const track = JSON.parse(fs.readFileSync(out, 'utf8'));
    expect(track.audioSha256).toBe(
      crypto.createHash('sha256').update(fs.readFileSync(audio)).digest('hex'),
    );
  });

  test('prints the alignment diagnostics that catch a bad run', async () => {
    const {dir, audio, alignment} = fixture();
    const out = path.join(dir, 'whisperx.viseme.json');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await generateWhisperXTrack(alignment, {audio, language: 'pt-BR', out});

    const printed = log.mock.calls.flat().join('\n');
    expect(printed).toMatch(/2 words placed/);
    // 0.3 → 2.4 is the largest silence; a run that dropped a word shows up here.
    expect(printed).toMatch(/largest inter-word gap 2\.1 s/);
  });
});

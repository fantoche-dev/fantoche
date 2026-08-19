import {describe, expect, test} from 'vitest';
import {
  checkAudioFormat,
  parseAudioStream,
  parseLoudnessSummary,
} from '../doc-check/audio';
import {
  checkBilabialClosure,
  checkMinimumHold,
  checkSegmentLength,
  checkTrailingSilence,
} from '../doc-check/checks';
import {collectFindings} from '../doc-check/collect';

const rule = (findings: {rule: string}[]) => findings.map(f => f.rule);

describe('narration segment length', () => {
  test('passes a segment inside the 5–10 s band', () => {
    expect(checkSegmentLength([{id: 'intro', start: 0, dur: 7.2}])).toEqual([]);
  });

  test('flags a segment too long to hold one visual beat', () => {
    const findings = checkSegmentLength([{id: 'wall', start: 0, dur: 18.4}]);
    expect(rule(findings)).toEqual(['narration.segment-length']);
    expect(findings[0].message).toMatch(/wall/);
    expect(findings[0].message).toMatch(/18\.4/);
  });

  test('flags a segment too short to be a beat', () => {
    expect(
      rule(checkSegmentLength([{id: 'blip', start: 0, dur: 1.1}])),
    ).toEqual(['narration.segment-length']);
  });
});

describe('viseme minimum hold', () => {
  test('passes cues held at least three frames', () => {
    expect(
      checkMinimumHold([
        {t: 0, viseme: 'X'},
        {t: 0.12, viseme: 'A'},
        {t: 0.3, viseme: 'D'},
      ]),
    ).toEqual([]);
  });

  test('flags a one-frame mouth shape', () => {
    const findings = checkMinimumHold([
      {t: 0, viseme: 'X'},
      {t: 0.033, viseme: 'A'},
      {t: 0.4, viseme: 'D'},
    ]);
    expect(rule(findings)).toEqual(['lipsync.minimum-hold']);
    expect(findings[0].message).toMatch(/0\.033/);
  });

  test('never flags the last cue, which has no successor to measure', () => {
    expect(checkMinimumHold([{t: 0, viseme: 'X'}])).toEqual([]);
  });

  test('accepts a hold authored at exactly the minimum', () => {
    // 4.101 - 4.001 is 0.09999999999999964 in binary floating point. Cue
    // times are authored in milliseconds, so comparing raw doubles reports
    // every exactly-on-the-floor hold as a violation.
    expect(
      checkMinimumHold([
        {t: 4.001, viseme: 'F'},
        {t: 4.101, viseme: 'B'},
        {t: 4.301, viseme: 'D'},
      ]),
    ).toEqual([]);
  });
});

describe('bilabial closure', () => {
  const segments = [
    {
      id: 'intro',
      start: 0,
      dur: 2,
      words: [
        {text: 'problem', start: 0.0, dur: 0.5},
        {text: 'see', start: 0.6, dur: 0.4},
      ],
    },
  ];

  test('passes when a pressed A lands inside every word carrying p, b or m', () => {
    expect(
      checkBilabialClosure(segments, [
        {t: 0.1, viseme: 'A'},
        {t: 0.65, viseme: 'B'},
      ]),
    ).toEqual([]);
  });

  test('flags a p/b/m word whose span never reaches A', () => {
    const findings = checkBilabialClosure(segments, [
      {t: 0.1, viseme: 'D'},
      {t: 0.65, viseme: 'B'},
    ]);
    expect(rule(findings)).toEqual(['lipsync.bilabial-closure']);
    expect(findings[0].message).toMatch(/problem/);
  });

  test('ignores words with no bilabial to close on', () => {
    expect(
      checkBilabialClosure(
        [
          {
            id: 'x',
            start: 0,
            dur: 1,
            words: [{text: 'see', start: 0, dur: 0.4}],
          },
        ],
        [{t: 0.1, viseme: 'D'}],
      ),
    ).toEqual([]);
  });
});

describe('trailing silence', () => {
  test('passes a tail under half a second', () => {
    expect(checkTrailingSilence(10.3, 10.0)).toEqual([]);
  });

  test('flags a long tail after the last word', () => {
    const findings = checkTrailingSilence(13.2, 10.0);
    expect(rule(findings)).toEqual(['audio.trailing-silence']);
    expect(findings[0].message).toMatch(/3\.2/);
  });
});

describe('ffmpeg loudness summary', () => {
  const summary = [
    '[Parsed_ebur128_0 @ 0x145f06180] Summary:',
    '',
    '  Integrated loudness:',
    '    I:         -20.7 LUFS',
    '    Threshold: -31.2 LUFS',
    '',
    '  Loudness range:',
    '    LRA:         2.4 LU',
    '',
    '  True peak:',
    '    Peak:       -3.3 dBFS',
  ].join('\n');

  test('reads integrated loudness and true peak from the summary block', () => {
    expect(parseLoudnessSummary(summary)).toEqual({
      integratedLufs: -20.7,
      truePeakDb: -3.3,
    });
  });

  test('does not mistake a per-frame progress line for the summary', () => {
    const progress =
      '[Parsed_ebur128_0 @ 0x1] t: 90.3 TARGET:-23 LUFS M: -36.0 S: -22.1 I: -20.7 LUFS LRA: 2.4 LU FTPK: -74.7 dBFS TPK: -3.3 dBFS';
    expect(() => parseLoudnessSummary(progress)).toThrow(/summary/i);
  });

  test('reports silence as an unmeasurable integrated loudness', () => {
    const silent = summary.replace('-20.7 LUFS', '-inf LUFS');
    expect(parseLoudnessSummary(silent).integratedLufs).toBe(-Infinity);
  });
});

describe('ffprobe audio stream', () => {
  // Verbatim ffprobe output shape — its key names, not ours.
  const probe = `{
    "streams": [
      {
        "codec_type": "audio",
        "codec_name": "pcm_s16le",
        "sample_rate": "16000",
        "channels": 1,
        "duration": "90.480000"
      }
    ]
  }`;

  test('reads sample rate, channels and duration', () => {
    expect(parseAudioStream(probe)).toEqual({
      sampleRateHz: 16000,
      channels: 1,
      durationSeconds: 90.48,
    });
  });

  test('refuses a file with no audio stream', () => {
    expect(() =>
      parseAudioStream('{"streams": [{"codec_type": "video"}]}'),
    ).toThrow(/no audio stream/i);
  });
});

describe('audio format floor', () => {
  const clean = {sampleRateHz: 48000, integratedLufs: -14.2, truePeakDb: -1.4};

  test('passes a 48 kHz master at about -14 LUFS under -1 dBTP', () => {
    expect(checkAudioFormat(clean)).toEqual([]);
  });

  test('flags a band-limited master', () => {
    const findings = checkAudioFormat({...clean, sampleRateHz: 16000});
    expect(rule(findings)).toEqual(['audio.sample-rate']);
    expect(findings[0].message).toMatch(/16000/);
  });

  test('flags a master that will be normalized down or stay quiet', () => {
    expect(rule(checkAudioFormat({...clean, integratedLufs: -20.7}))).toEqual([
      'audio.loudness',
    ]);
    expect(rule(checkAudioFormat({...clean, integratedLufs: -8.0}))).toEqual([
      'audio.loudness',
    ]);
  });

  test('flags a true peak that survives every later encode', () => {
    expect(rule(checkAudioFormat({...clean, truePeakDb: -0.2}))).toEqual([
      'audio.true-peak',
    ]);
  });
});

describe('collected findings', () => {
  const doc = {
    narration: {
      audio: 'voice',
      segments: [
        {
          id: 'intro',
          start: 0,
          dur: 7,
          words: [
            {text: 'problem', start: 0.0, dur: 0.5},
            {text: 'solved', start: 1.0, dur: 0.5},
          ],
        },
      ],
    },
  };
  const track = [
    {t: 0.1, viseme: 'A'},
    {t: 1.1, viseme: 'D'},
  ];
  const audio = {
    sampleRateHz: 48000,
    channels: 1,
    durationSeconds: 1.6,
    integratedLufs: -14.1,
    truePeakDb: -1.5,
  };

  test('a clean document produces no findings', () => {
    expect(
      collectFindings({doc, tracks: [track], audio, warnings: []}),
    ).toEqual([]);
  });

  test('a compiler anchor warning becomes a finding', () => {
    const findings = collectFindings({
      doc,
      tracks: [track],
      audio,
      warnings: ['timeline/3/at: "intro.word:middle" matched no word'],
    });
    expect(rule(findings)).toEqual(['document.anchor-warning']);
    expect(findings[0].message).toMatch(/matched no word/);
  });

  test('runs the lipsync rules over every track in the document', () => {
    const findings = collectFindings({
      doc,
      tracks: [track, [...track, {t: 1.12, viseme: 'X'}]],
      audio,
      warnings: [],
    });
    expect(rule(findings)).toContain('lipsync.minimum-hold');
  });

  test('measures the tail against the last aligned word, not the first', () => {
    const findings = collectFindings({
      doc,
      tracks: [track],
      audio: {...audio, durationSeconds: 4.0},
      warnings: [],
    });
    expect(rule(findings)).toEqual(['audio.trailing-silence']);
    expect(findings[0].message).toMatch(/2\.5/);
  });

  test('skips the audio rules when no narration audio was measured', () => {
    expect(
      collectFindings({doc, tracks: [track], audio: undefined, warnings: []}),
    ).toEqual([]);
  });
});

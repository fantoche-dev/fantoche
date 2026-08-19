import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {afterEach, describe, expect, test} from 'vitest';
import {
  alignNarration,
  type AlignmentResult,
  type AlignSegmentInput,
} from '../narration/align';
import alignment from './fixtures/whisperx-pt-br-01.json';

const DOC = {
  version: '0.2',
  meta: {fps: 30, size: [320, 320]},
  narration: {
    segments: [
      {id: 'intro', text: 'Bom dia, pessoal.', start: 0, dur: 1.6},
      {
        id: 'body',
        text: 'Hoje vamos falar de busca binária, passo a passo, com um exemplo bem simples.',
        start: 1.9,
        dur: 6.3,
      },
    ],
  },
  elements: [],
  timeline: [],
};

const dirs: string[] = [];
function writeDoc(doc: unknown = DOC): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fantoche-align-'));
  dirs.push(dir);
  const docPath = path.join(dir, 'doc.json');
  fs.writeFileSync(docPath, `${JSON.stringify(doc, null, 2)}\n`);
  return docPath;
}

afterEach(() => {
  while (dirs.length > 0) {
    fs.rmSync(dirs.pop()!, {recursive: true, force: true});
  }
});

function alignedById(): AlignmentResult {
  // Deliberately reversed: the writer must associate by id, not array order.
  return {
    segments: [
      {id: 'body', words: alignment.words.slice(3)},
      {id: 'intro', words: alignment.words.slice(0, 3)},
    ],
  };
}

const align = async (_segments: readonly AlignSegmentInput[]) => alignedById();

describe('alignNarration', () => {
  test('fills each segment’s words from the alignment, matching by id', async () => {
    const docPath = writeDoc();
    let requests: readonly AlignSegmentInput[] = [];
    await alignNarration(docPath, {
      align: async segments => {
        requests = segments;
        return alignedById();
      },
    });
    expect(requests).toEqual([
      {id: 'intro', text: 'Bom dia, pessoal.'},
      {
        id: 'body',
        text: 'Hoje vamos falar de busca binária, passo a passo, com um exemplo bem simples.',
      },
    ]);

    const doc = JSON.parse(fs.readFileSync(docPath, 'utf8'));
    const intro = doc.narration.segments.find(
      (segment: {id: string}) => segment.id === 'intro',
    );
    expect(intro.text).toBe('Bom dia, pessoal.'); // text untouched
    expect(intro.words).toEqual([
      {text: 'bom', start: 0.08, dur: 0.181},
      {text: 'dia', start: 0.341, dur: 0.24},
      {text: 'pessoal', start: 0.862, dur: 0.661},
    ]);
    const body = doc.narration.segments.find(
      (segment: {id: string}) => segment.id === 'body',
    );
    expect(body.words).toHaveLength(14);
    // Normalised: lowercase, punctuation stripped — `binária,` anchors as
    // `binária`.
    expect(body.words.map((word: {text: string}) => word.text)).toContain(
      'binária',
    );
    expect(
      body.words.some((word: {text: string}) => /[.,]/.test(word.text)),
    ).toBe(false);
  });

  test('is idempotent — a second run leaves the file byte-identical', async () => {
    const docPath = writeDoc();
    await alignNarration(docPath, {align});
    const first = fs.readFileSync(docPath, 'utf8');
    await alignNarration(docPath, {align});
    expect(fs.readFileSync(docPath, 'utf8')).toBe(first);
  });

  test('refuses a transcript that does not match the alignment', async () => {
    const doc = structuredClone(DOC) as any;
    doc.narration.segments[1].text += ' Você olha o meio.';
    const docPath = writeDoc(doc);
    await expect(alignNarration(docPath, {align})).rejects.toThrow(/body/);
  });

  test('preserves every unrelated byte, including compact layout and CRLF', async () => {
    const dir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'fantoche-align-format-'),
    );
    dirs.push(dir);
    const docPath = path.join(dir, 'doc.json');
    const original = [
      '{',
      '\t"version": "0.2",',
      '\t"meta": {"fps":30,"size":[320,320]},',
      '\t"narration": {',
      '\t\t"segments": [',
      '\t\t\t{"id":"intro","text":"Bom dia, pessoal.","start":0,"dur":1.6},',
      '\t\t\t{"id":"body","text":"Hoje vamos falar de busca binária, passo a passo, com um exemplo bem simples.","start":1.9,"dur":6.3,"words":[]}',
      '\t\t]',
      '\t},',
      '\t"elements": [],',
      '\t"timeline": []',
      '}',
      '',
    ].join('\r\n');
    fs.writeFileSync(docPath, original);

    await alignNarration(docPath, {align});

    const result = fs.readFileSync(docPath, 'utf8');
    const expected = original
      .replace(
        '"dur":1.6}',
        `"dur":1.6,"words":${JSON.stringify([
          {text: 'bom', start: 0.08, dur: 0.181},
          {text: 'dia', start: 0.341, dur: 0.24},
          {text: 'pessoal', start: 0.862, dur: 0.661},
        ])}}`,
      )
      .replace(
        '"words":[]',
        `"words":${JSON.stringify(
          alignedById()
            .segments.find(segment => segment.id === 'body')!
            .words.map(word => ({
              text: word.text
                .toLocaleLowerCase()
                .replace(/^[\p{P}\p{S}]+/u, '')
                .replace(/[\p{P}\p{S}]+$/u, ''),
              start: word.start,
              dur: Math.round((word.end - word.start) * 1000) / 1000,
            })),
        )}`,
      );
    expect(result).toBe(expected);
  });

  test('rejects missing, duplicate, and unknown aligned segment ids', async () => {
    const cases: Array<[string, AlignmentResult]> = [
      [
        'missing',
        {segments: alignedById().segments.filter(s => s.id !== 'body')},
      ],
      [
        'duplicate',
        {segments: [...alignedById().segments, alignedById().segments[0]]},
      ],
      [
        'unknown',
        {
          segments: [...alignedById().segments, {id: 'ghost', words: []}],
        },
      ],
    ];
    for (const [kind, result] of cases) {
      const docPath = writeDoc();
      await expect(
        alignNarration(docPath, {align: async () => result}),
      ).rejects.toThrow(new RegExp(kind));
    }
  });

  test('refuses aligned words outside the segment window, naming the fix', async () => {
    const doc = structuredClone(DOC) as any;
    // "hoje" aligns at ~1.9 s — declaring the window after it must refuse
    // rather than silently writing words a `body.start` anchor would sit
    // after. Segment fields are the user's; the error names the fix.
    doc.narration.segments[1].start = 2.5;
    const docPath = writeDoc(doc);
    await expect(alignNarration(docPath, {align: alignedById})).rejects.toThrow(
      /segment "body" declares .* its aligned words span/,
    );
    // The refusal happens before any write.
    const untouched = JSON.parse(fs.readFileSync(docPath, 'utf8'));
    expect(untouched.narration.segments[1].words).toBeUndefined();
  });

  test('refuses a document with no narration', async () => {
    const docPath = writeDoc({...DOC, narration: undefined});
    await expect(alignNarration(docPath, {align})).rejects.toThrow(/narration/);
  });
});

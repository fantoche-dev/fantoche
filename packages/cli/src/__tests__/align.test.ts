import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {afterEach, describe, expect, test} from 'vitest';
import {alignNarration} from '../narration/align';
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

const align = async () => alignment;

describe('alignNarration', () => {
  test('fills each segment’s words from the alignment, matching by id', async () => {
    const docPath = writeDoc();
    await alignNarration(docPath, {align});

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

  test('refuses a document with no narration', async () => {
    const docPath = writeDoc({...DOC, narration: undefined});
    await expect(alignNarration(docPath, {align})).rejects.toThrow(/narration/);
  });
});

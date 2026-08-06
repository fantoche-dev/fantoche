import {describe, expect, test} from 'vitest';
import {generateShim} from '../render-doc';

const doc = {
  version: '0.1',
  meta: {fps: 30, size: [640, 360], duration: 2},
  elements: [],
  timeline: [{at: 1, block: {src: './fx/burst.tsx#confetti', dur: 1}}],
};

describe('generateShim', () => {
  test('inlines the document, imports blocks relative to the shim, and is stable', () => {
    const shim = generateShim(
      doc,
      'demo',
      [{src: './fx/burst.tsx', exportName: 'confetti'}],
      '/work/videos',
      '/work/node_modules/.fantoche',
    );
    expect(shim).toContain(
      `import {makeDocumentProject} from '@fantoche-dev/document/scene';`,
    );
    expect(shim).toContain(
      `import * as block0 from '../../videos/fx/burst.tsx';`,
    );
    expect(shim).toContain(`'./fx/burst.tsx#confetti': block0['confetti'],`);
    expect(shim).toContain(`"fps": 30`);
    expect(shim).toContain(`makeDocumentProject(doc, "demo", {`);

    const again = generateShim(
      doc,
      'demo',
      [{src: './fx/burst.tsx', exportName: 'confetti'}],
      '/work/videos',
      '/work/node_modules/.fantoche',
    );
    expect(again).toBe(shim);
  });

  test('no blocks yields an empty registry', () => {
    const shim = generateShim(
      {...doc, timeline: []},
      'demo',
      [],
      '/w',
      '/w/nm',
    );
    expect(shim).not.toContain('import * as block');
    expect(shim).toContain('blocks: {');
  });
});

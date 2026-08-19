import {describe, expect, test} from 'vitest';
import {splitArt} from '../character/split.js';

const ART = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <g id="torso"><rect x="80" y="90" width="40" height="70"/></g>
  <g id="arm_x5F_l"><rect x="120" y="95" width="50" height="12"/></g>
  <circle id="pivot-arm-l" cx="122" cy="101" r="1" data-fantoche-pivot="arm-l"/>
</svg>`;

describe('splitArt', () => {
  test('extracts one sub-svg per slot, pivot-centred', () => {
    const out = splitArt(ART, {
      'arm-l': {element: 'arm_x5F_l', pivot: [122, 101]},
    });
    const box = /viewBox="([^"]+)"/
      .exec(out.slots['arm-l'])![1]
      .split(' ')
      .map(Number);
    // viewBox is symmetric about the pivot: centre === pivot, exactly.
    expect(box[0] + box[2] / 2).toBeCloseTo(122, 6);
    expect(box[1] + box[3] / 2).toBeCloseTo(101, 6);
    expect(out.slots['arm-l']).toContain('width="50"');
    expect(out.slots['arm-l']).not.toContain('id="torso"');
  });

  test('reads pivot markers and strips them from the output', () => {
    const out = splitArt(ART, {
      'arm-l': {element: 'arm_x5F_l', pivot: 'center'},
    });
    expect(out.pivots['arm-l']).toEqual([122, 101]); // marker wins over preset
    expect(out.slots['arm-l']).not.toContain('pivot-arm-l'); // marker never renders
  });

  test('reports orphans and misses instead of throwing', () => {
    const out = splitArt(ART, {'arm-r': {element: 'nope', pivot: 'center'}});
    expect(out.missing).toEqual(['arm-r']);
    expect(out.orphans).toContain('torso');
  });

  test('is deterministic', () => {
    const a = splitArt(ART, {'arm-l': {element: 'arm_x5F_l', pivot: 'center'}});
    expect(a).toEqual(
      splitArt(ART, {'arm-l': {element: 'arm_x5F_l', pivot: 'center'}}),
    );
  });

  test('measures all transformed corners instead of clipping rotated shapes', () => {
    const out = splitArt(
      `<svg xmlns="http://www.w3.org/2000/svg">
        <g id="diamond" transform="rotate(45)">
          <rect x="-10" y="-10" width="20" height="20"/>
        </g>
      </svg>`,
      {diamond: {element: 'diamond', pivot: [0, 0]}},
    );
    const [, , width, height] = /viewBox="([^"]+)"/
      .exec(out.slots.diamond)![1]
      .split(' ')
      .map(Number);
    expect(width).toBeCloseTo(Math.sqrt(800), 6);
    expect(height).toBeCloseTo(Math.sqrt(800), 6);
  });

  test('resolves pivot markers in art coordinates through ancestor transforms', () => {
    const out = splitArt(
      `<svg xmlns="http://www.w3.org/2000/svg">
        <g transform="translate(100 50)">
          <g id="part"><rect x="-10" y="-5" width="20" height="10"/></g>
          <circle id="pivot-part" cx="0" cy="0" r="1"/>
        </g>
      </svg>`,
      {part: {element: 'part', pivot: 'center'}},
    );
    expect(out.pivots.part).toEqual([100, 50]);
  });

  test('keeps path arcs inside the measured window', () => {
    const out = splitArt(
      `<svg xmlns="http://www.w3.org/2000/svg">
        <path id="arc" d="M0 0 A100 100 0 0 0 200 0"/>
      </svg>`,
      {arc: {element: 'arc', pivot: 'center'}},
    );
    const [, , width, height] = /viewBox="([^"]+)"/
      .exec(out.slots.arc)![1]
      .split(' ')
      .map(Number);
    expect(width).toBeGreaterThanOrEqual(200);
    expect(height).toBeGreaterThanOrEqual(200);
  });

  test('carries presentation inherited from the root svg', () => {
    const out = splitArt(
      `<svg xmlns="http://www.w3.org/2000/svg" fill="#f00" stroke="#00f">
        <g id="part"><rect width="10" height="10"/></g>
      </svg>`,
      {part: {element: 'part', pivot: 'center'}},
    );
    expect(out.slots.part).toContain('fill="#f00"');
    expect(out.slots.part).toContain('stroke="#00f"');
  });
});

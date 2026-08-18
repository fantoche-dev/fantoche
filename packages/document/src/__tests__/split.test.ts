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
});

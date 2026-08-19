import {describe, expect, test} from 'vitest';
import {composeRig} from '../character/pose.js';

const RIG = {
  torso: {parent: null, rest: [100, 100] as const},
  ['arm-l']: {parent: 'torso', rest: [140, 90] as const},
  hand: {parent: 'arm-l', rest: [180, 90] as const},
};

describe('composeRig', () => {
  test('composes FK: rotating a parent carries children along an arc', () => {
    const out = composeRig(RIG, {['arm-l']: {rotation: 90}});
    expect(out.hand.x).toBeCloseTo(140, 6);
    expect(out.hand.y).toBeCloseTo(130, 6);
    expect(out.hand.rotation).toBeCloseTo(90, 6);
  });

  test('keeps limb length under rotation', () => {
    const rest = composeRig(RIG, {});
    const bent = composeRig(RIG, {['arm-l']: {rotation: 37}});
    const len = (a: {x: number; y: number}, b: {x: number; y: number}) =>
      Math.hypot(a.x - b.x, a.y - b.y);
    expect(len(bent['arm-l'], bent.hand)).toBeCloseTo(
      len(rest['arm-l'], rest.hand),
      6,
    );
  });

  test('multiplies uniform scale down the chain and stays shear-free', () => {
    const out = composeRig(RIG, {
      torso: {scale: 2},
      ['arm-l']: {scale: 1.5},
    });
    expect(out.hand.scale).toBeCloseTo(3, 6);
  });

  test('places roots relative to the source art centre', () => {
    const out = composeRig(RIG, {}, [100, 100]);
    expect(out.torso).toMatchObject({x: 0, y: 0});
    expect(out['arm-l']).toMatchObject({x: 40, y: -10});
  });

  test('includes rest rotation and scale before pose deltas', () => {
    const out = composeRig(
      {
        root: {
          parent: null,
          rest: [0, 0] as const,
          rotation: 10,
          scale: 2,
        },
      },
      {root: {rotation: 20, scale: 1.5}},
    );
    expect(out.root.rotation).toBeCloseTo(30, 6);
    expect(out.root.scale).toBeCloseTo(3, 6);
  });

  test('is pure across repeated calls', () => {
    const pose = {torso: {rotation: 12}};
    expect(composeRig(RIG, pose)).toEqual(composeRig(RIG, pose));
    expect(RIG.torso.rest).toEqual([100, 100]);
    expect(pose).toEqual({torso: {rotation: 12}});
  });

  test('rejects a rig that is not in topological order', () => {
    expect(() =>
      composeRig(
        {
          child: {parent: 'root', rest: [10, 0]},
          root: {parent: null, rest: [0, 0]},
        },
        {},
      ),
    ).toThrow(/topological order/);
  });
});

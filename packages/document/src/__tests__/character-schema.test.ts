import {describe, expect, test} from 'vitest';
import {characterSchema} from '../character/schema.js';
import {VISEMES} from '../lipsync/visemes.js';

const minimal = {
  version: '0.1',
  id: 'teacher',
  art: {src: 'teacher.art.json'},
  slots: {
    torso: {element: 'torso'},
    ['arm-l']: {element: 'arm_x5F_l', parent: 'torso', pivot: [122, 101]},
  },
  poses: {
    wave: {['arm-l.rotation']: -30, ['arm-l.depth']: 10},
  },
};

const clone = () => structuredClone(minimal) as Record<string, any>;

describe('characterSchema', () => {
  test('accepts a minimal character and fills slot defaults', () => {
    const result = characterSchema.safeParse(minimal);
    if (!result.success) console.error(result.error.issues);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.slots.torso.pivot).toBe('center');
      expect(result.data.slots.torso.rest).toEqual({
        rotation: 0,
        scale: 1,
        depth: 0,
      });
    }
  });

  test('accepts both pivot forms: [x, y] tuple and bbox presets', () => {
    expect(characterSchema.safeParse(minimal).success).toBe(true); // tuple
    const preset = clone();
    preset.slots['arm-l'].pivot = 'bottom-center';
    expect(characterSchema.safeParse(preset).success).toBe(true);
    const bad = clone();
    bad.slots['arm-l'].pivot = 'middle';
    expect(characterSchema.safeParse(bad).success).toBe(false);
  });

  test('rejects a slot whose parent does not exist', () => {
    const doc = clone();
    doc.slots['arm-l'].parent = 'ghost';
    const result = characterSchema.safeParse(doc);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(JSON.stringify(result.error.issues)).toContain('ghost');
    }
  });

  test('rejects a parent cycle, naming its members', () => {
    const doc = clone();
    doc.slots.torso.parent = 'arm-l'; // torso → arm-l → torso
    const result = characterSchema.safeParse(doc);
    expect(result.success).toBe(false);
    if (!result.success) {
      const text = JSON.stringify(result.error.issues);
      expect(text).toContain('cycle');
      expect(text).toContain('torso');
      expect(text).toContain('arm-l');
    }
  });

  test('rejects a pose key naming an unknown slot', () => {
    const doc = clone();
    doc.poses.wave = {['leg-r.rotation']: 10};
    const result = characterSchema.safeParse(doc);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(JSON.stringify(result.error.issues)).toContain('leg-r');
    }
  });

  test('rejects a pose key naming an unknown param', () => {
    const doc = clone();
    doc.poses.wave = {['arm-l.skew']: 10};
    const result = characterSchema.safeParse(doc);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(JSON.stringify(result.error.issues)).toContain('skew');
    }
  });

  test('rejects non-uniform scale — joint scale is a scalar (ADR 0006)', () => {
    const doc = clone();
    doc.slots.torso.rest = {scale: [2, 1]};
    expect(characterSchema.safeParse(doc).success).toBe(false);
  });

  test('visemes, when present, is the full nine-letter mouth map', () => {
    const full = clone();
    full.visemes = Object.fromEntries(VISEMES.map(v => [v, `mouth-${v}`]));
    const result = characterSchema.safeParse(full);
    if (!result.success) console.error(result.error.issues);
    expect(result.success).toBe(true);

    const partial = clone();
    partial.visemes = {['A']: 'mouth-a'};
    expect(characterSchema.safeParse(partial).success).toBe(false);
  });

  test('rejects unknown top-level keys', () => {
    const doc = clone();
    doc.skeleton = [];
    expect(characterSchema.safeParse(doc).success).toBe(false);
  });
});

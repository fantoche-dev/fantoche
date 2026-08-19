import {CHARACTER_ART_VERSION, characterArtSchema} from '../character/art.js';
import {characterSchema} from '../character/schema.js';

export const rigCharacter = characterSchema.parse({
  version: '0.1',
  id: 'teacher',
  art: {src: 'teacher.art.json'},
  slots: {
    torso: {element: 'torso', pivot: [100, 100]},
    arm: {
      element: 'arm',
      parent: 'torso',
      pivot: [140, 90],
      rest: {depth: -1},
    },
    hand: {element: 'hand', parent: 'arm', pivot: [180, 90]},
  },
  poses: {wave: {'arm.rotation': 90, 'arm.depth': 10}},
});

export const rigArt = characterArtSchema.parse({
  version: CHARACTER_ART_VERSION,
  centre: [100, 100],
  slots: {
    torso: '<svg viewBox="80 80 40 40"><rect width="40" height="40"/></svg>',
    arm: '<svg viewBox="120 80 40 20"><rect width="40" height="20"/></svg>',
    hand: '<svg viewBox="170 80 20 20"><rect width="20" height="20"/></svg>',
  },
  pivots: {torso: [100, 100], arm: [140, 90], hand: [180, 90]},
});

export const rigOptions = {
  characters: {teacher: {character: rigCharacter, art: rigArt}},
};

export const rigDocument = {
  version: '0.2',
  meta: {fps: 30, size: [320, 320], duration: 4},
  cast: {ana: {character: 'teacher'}},
  elements: [],
  timeline: [
    {
      at: 1,
      target: 'ana',
      pose: 'wave',
      dur: 1,
      easing: 'linear',
    },
  ],
};

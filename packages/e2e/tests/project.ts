import {Color, makeProject, Vector2} from '@fantoche-dev/core';

import {characterArtSchema, characterSchema} from '@fantoche-dev/document';
import {makeDocumentScene} from '@fantoche-dev/document/scene';
import './fonts.css';

import teacherCharacterRaw from '../characters/teacher/character.json';
import teacherArtRaw from '../characters/teacher/teacher.art.json';
import anchorsNarrationDoc from '../documents/anchors-narration.json';
import blockEscapeDoc from '../documents/block-escape.json';
import characterPosesDoc from '../documents/character-poses.json';
import codeDiffDoc from '../documents/code-diff.json';
import codeHighlightDoc from '../documents/code-highlight.json';
import gateDoc from '../documents/gate.json';
import imageSvgDoc from '../documents/image-svg.json';
import latexDoc from '../documents/latex.json';
import layoutFlexDoc from '../documents/layout-flex.json';
import shapesDrawOnDoc from '../documents/shapes-draw-on.json';
import textBasicsDoc from '../documents/text-basics.json';
import {slide} from './blocks/fx';
import circle from './scenes/circle';
import mcCompat from './scenes/mc-compat';
import rect from './scenes/rect';

const blocks: Record<string, typeof slide> = {};
blocks['../tests/blocks/fx.tsx#slide'] = slide;

// Parsed once here (defaults filled by the schemas): the compiler is pure
// and receives resolved characters, never file paths.
const characters = {
  teacher: {
    character: characterSchema.parse(teacherCharacterRaw),
    art: characterArtSchema.parse(teacherArtRaw),
  },
};

export default makeProject({
  name: 'project',
  scenes: [
    circle,
    rect,
    mcCompat,
    makeDocumentScene('doc-text-basics', textBasicsDoc),
    makeDocumentScene('doc-shapes-draw-on', shapesDrawOnDoc),
    makeDocumentScene('doc-layout-flex', layoutFlexDoc),
    makeDocumentScene('doc-code-highlight', codeHighlightDoc),
    makeDocumentScene('doc-code-diff', codeDiffDoc),
    makeDocumentScene('doc-latex', latexDoc),
    makeDocumentScene('doc-image-svg', imageSvgDoc),
    makeDocumentScene('doc-anchors-narration', anchorsNarrationDoc),
    makeDocumentScene('doc-block-escape', blockEscapeDoc, {blocks}),
    makeDocumentScene('doc-gate', gateDoc, {blocks}),
    makeDocumentScene('doc-character-poses', characterPosesDoc, {characters}),
  ],
  settings: {
    shared: {
      background: new Color('#FFFFFF'),
      range: [0, Infinity],
      size: new Vector2(320, 320),
    },
    preview: {
      fps: 30,
      resolutionScale: 1,
    },
    rendering: {
      fps: 30,
      resolutionScale: 1,
      colorSpace: 'srgb',
      exporter: {
        name: '@fantoche-dev/core/image-sequence',
        options: {
          fileType: 'image/png',
          quality: 100,
          groupByScene: true,
        },
      },
    },
  },
});

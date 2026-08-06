// @vitest-environment jsdom
import type {Code, Layout, Line, Rect, Txt} from '@fantoche-dev/2d';
import type {FullSceneDescription} from '@fantoche-dev/core';
import {PlaybackManager, PlaybackStatus, Vector2} from '@fantoche-dev/core';
import {describe, expect, test} from 'vitest';
import type {DocumentScene, DocumentSceneConfig} from '../scene/index.js';
import {makeDocumentScene} from '../scene/index.js';

const doc = {
  version: '0.1',
  meta: {fps: 30, size: [320, 320], duration: 2},
  elements: [
    {
      id: 'txt',
      type: 'text',
      props: {
        text: 'olá',
        fontSize: 24,
        fontWeight: 700,
        fill: '#ffffff',
        x: 5,
        opacity: 0.5,
      },
    },
    {
      id: 'box',
      type: 'rect',
      props: {width: 40, height: 30, fill: '#e13238', radius: 4, rotation: 15},
    },
    {
      id: 'dot',
      type: 'circle',
      props: {
        width: 20,
        height: 20,
        startAngle: 10,
        endAngle: 200,
        stroke: '#fff',
        lineWidth: 2,
      },
    },
    {
      id: 'seg',
      type: 'line',
      props: {
        points: [
          [0, 0],
          [10, 10],
        ],
        end: 0.5,
        lineWidth: 3,
        stroke: '#fff',
        endArrow: true,
      },
    },
    {
      id: 'wave',
      type: 'path',
      props: {data: 'M 0 0 L 10 10', stroke: '#fff', lineWidth: 1},
    },
    {
      id: 'hex',
      type: 'polygon',
      props: {sides: 6, width: 30, height: 30, fill: '#5c6470'},
    },
    {
      id: 'pic',
      type: 'image',
      props: {
        src: 'data:image/png;base64,iVBORw0KGgo=',
        width: 16,
        alpha: 0.75,
      },
    },
    {
      id: 'mark',
      type: 'svg',
      props: {svg: '<svg><rect width="10" height="10"/></svg>', width: 10},
    },
    {id: 'tex', type: 'latex', props: {tex: 'x^2', height: 20}},
    {
      id: 'snippet',
      type: 'code',
      props: {
        code: 'let a = 1;',
        fontSize: 12,
        fontFamily: 'monospace',
        fill: '#e6e6e6',
      },
    },
    {
      id: 'row',
      type: 'layout',
      props: {direction: 'row', gap: 8, padding: 4, alignItems: 'center'},
      children: [
        {
          id: 'cell',
          type: 'rect',
          props: {width: 10, height: 10, fill: '#fff'},
        },
      ],
    },
  ],
  timeline: [
    {at: 1, target: 'box', set: {x: 77, fill: '#00ff00'}},
    {
      at: 1,
      target: 'seg',
      set: {
        points: [
          [1, 1],
          [20, 20],
        ],
        end: 1,
      },
    },
    {at: 1, target: 'txt', set: {text: 'mudou'}},
  ],
};

function makeScene(): {scene: DocumentScene; playback: PlaybackManager} {
  const playback = new PlaybackManager();
  const status = new PlaybackStatus(playback);
  const description = {
    ...makeDocumentScene('builders', doc),
    size: new Vector2(320, 320),
    resolutionScale: 1,
    playback: status,
  } as unknown as FullSceneDescription<DocumentSceneConfig>;
  const scene = new description.klass(description) as DocumentScene;
  playback.setup([scene as never]);
  return {scene, playback};
}

describe('element builders', () => {
  test('every v0 element type builds with its constructor props applied', async () => {
    const {scene} = makeScene();
    await scene.recalculate(() => {});
    await scene.reset();

    const txt = scene.getNode('txt') as Txt;
    expect(txt.text()).toBe('olá');
    expect(txt.fontSize()).toBe(24);
    expect(txt.fontWeight()).toBe(700);
    expect(txt.x()).toBe(5);
    expect(txt.opacity()).toBe(0.5);

    // jsdom cannot compute flex layout, so width()/height() (DOM-derived)
    // are unreliable here — assert plain signals instead.
    const box = scene.getNode('box') as Rect;
    expect(box.radius().top).toBe(4);
    expect(box.rotation()).toBe(15);

    const dot = scene.getNode('dot') as unknown as {
      startAngle(): number;
      endAngle(): number;
    };
    expect(dot.startAngle()).toBe(10);
    expect(dot.endAngle()).toBe(200);

    const seg = scene.getNode('seg') as Line;
    expect(seg.parsedPoints().map(p => [p.x, p.y])).toEqual([
      [0, 0],
      [10, 10],
    ]);
    expect(seg.end()).toBe(0.5);

    const hex = scene.getNode('hex') as unknown as {sides(): number};
    expect(hex.sides()).toBe(6);

    const pic = scene.getNode('pic') as unknown as {alpha(): number};
    expect(pic.alpha()).toBe(0.75);

    const snippet = scene.getNode('snippet') as Code;
    expect(snippet.parsed()).toBe('let a = 1;');

    const row = scene.getNode('row') as Layout;
    expect(row.gap.x()).toBe(8);
    expect(row.layout()).toBe(true);
    // Layout children parent into the layout, not the view.
    const cell = scene.getNode('cell') as Rect;
    expect(cell.parent()).toBe(row);
  });

  test('animated props apply through the same nodes', async () => {
    const {scene, playback} = makeScene();
    await playback.recalculate();
    await playback.reset();
    await playback.seek(45);

    const box = scene.getNode('box') as Rect;
    expect(box.x()).toBe(77);
    expect((box.fill() as unknown as {serialize(): string}).serialize()).toBe(
      'rgba(0, 255, 0, 1.000)',
    );
    const seg = scene.getNode('seg') as Line;
    expect(seg.end()).toBe(1);
    expect(seg.parsedPoints().map(p => [p.x, p.y])).toEqual([
      [1, 1],
      [20, 20],
    ]);
    const txt = scene.getNode('txt') as Txt;
    expect(txt.text()).toBe('mudou');
  });
});

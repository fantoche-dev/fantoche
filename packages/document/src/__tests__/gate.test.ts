// @vitest-environment jsdom
// The P1 gate (docs/05-roadmap.md): the real gate document — text, shapes,
// an image, a code node with animated highlight, an embedded code block —
// reaches identical state via monotone sweep and O(1) random access, and
// seek cost is flat in document length.
import type {Node} from '@fantoche-dev/2d';
import {Rect} from '@fantoche-dev/2d';
import type {FullSceneDescription, ThreadGenerator} from '@fantoche-dev/core';
import {PlaybackManager, PlaybackStatus, Vector2} from '@fantoche-dev/core';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe, expect, test} from 'vitest';
import type {DocumentScene, DocumentSceneConfig} from '../scene/index.js';
import {makeDocumentScene} from '../scene/index.js';

const gateDoc = JSON.parse(
  readFileSync(
    resolve(import.meta.dirname, '../../../e2e/documents/gate.json'),
    'utf8',
  ),
);

function* slide(container: Node): ThreadGenerator {
  const rect = new Rect({width: 40, height: 40, x: -60, fill: '#e13238'});
  container.add(rect);
  for (;;) {
    rect.x(rect.x() + 4);
    rect.rotation(rect.rotation() + 6);
    yield;
  }
}
const blocks: Record<string, typeof slide> = {};
blocks['../tests/blocks/fx.tsx#slide'] = slide;

function makeScene(document: unknown = gateDoc): {
  scene: DocumentScene;
  playback: PlaybackManager;
} {
  const playback = new PlaybackManager();
  const status = new PlaybackStatus(playback);
  const description = {
    ...makeDocumentScene('gate', document, {blocks}),
    size: new Vector2(320, 320),
    resolutionScale: 1,
    playback: status,
  } as unknown as FullSceneDescription<DocumentSceneConfig>;
  const scene = new description.klass(description) as DocumentScene;
  playback.setup([scene as never]);
  return {scene, playback};
}

// jsdom has no canvas, so Code text measurement cannot run — compare the
// document-DRIVEN channels (what applyState sets). Pixel identity from equal
// signals is the renderer's determinism, pinned separately by CI goldens.
function elementStates(scene: DocumentScene): Record<string, unknown> {
  const grab = (id: string, props: string[]) => {
    const node = scene.getNode(id) as unknown as Record<
      string,
      () => unknown
    > | null;
    return props.map(prop => node?.[prop]?.call(node));
  };
  const snippet = scene.getNode('snippet') as unknown as {
    parsed(): string;
    selection(): unknown;
    selectionProgress(): number | null;
  };
  const blockRects = scene
    .getView()
    .findAll((node: Node): node is Rect => node instanceof Rect)
    .filter(rect => !['bar', 'half'].includes(rect.key))
    .map(rect => [
      Math.round(rect.x() * 1e6) / 1e6,
      Math.round(rect.rotation() * 1e6) / 1e6,
    ]);
  return {
    title: grab('title', ['opacity', 'y']),
    bar: grab('bar', ['x', 'y']),
    half: grab('half', ['opacity']),
    pic: grab('pic', ['x', 'opacity']),
    snippet: {
      parsed: snippet.parsed(),
      selection: snippet.selection(),
      selectionProgress: snippet.selectionProgress(),
    },
    blockRects,
  };
}

describe('P1 gate', () => {
  // Scope note: the props comparison shares evaluateFrame between both paths
  // (true by construction); the REAL coverage is the Code signal state and
  // the block-created nodes, which take genuinely different code paths.
  test('random access equals a monotone sweep at every probe frame (incl. block interior)', async () => {
    // Probes: initial, mid-selection, mid-tween, mid-edit, block interior, last.
    const probes = [0, 68, 128, 172, 214, 239];

    const swept = makeScene();
    await swept.scene.recalculate(() => {});
    await swept.scene.reset();
    const sweptStates = new Map<number, Record<string, unknown>>();
    for (let frame = 0; frame <= 239; frame++) {
      swept.playback.frame = frame;
      await swept.scene.next();
      if (probes.includes(frame)) {
        sweptStates.set(frame, elementStates(swept.scene));
      }
    }

    for (const frame of probes) {
      const jumped = makeScene();
      await jumped.scene.recalculate(() => {});
      await jumped.scene.reset();
      jumped.playback.frame = frame;
      await jumped.scene.seekToFrame(frame);
      expect(elementStates(jumped.scene), `frame ${frame}`).toEqual(
        sweptStates.get(frame),
      );
    }
  }, 60000);

  test('seek cost is flat in document length (measured)', async () => {
    const longDoc = JSON.parse(JSON.stringify(gateDoc));
    // Stretch to 600s with 300 extra keyframes — 75× the gate's duration.
    longDoc.meta.duration = 600;
    for (let i = 0; i < 300; i++) {
      longDoc.timeline.push({
        at: 8 + i * 1.97,
        target: 'bar',
        tween: {x: {to: (i % 2) * 40 - 20}},
        dur: 1,
      });
    }

    const short = makeScene();
    await short.scene.recalculate(() => {});
    await short.scene.reset();
    const long = makeScene(longDoc);
    await long.scene.recalculate(() => {});
    await long.scene.reset();

    const time = async (scene: DocumentScene, frame: number) => {
      await scene.seekToFrame(frame); // warmup
      const start = performance.now();
      for (let i = 0; i < 50; i++) {
        await scene.seekToFrame(frame - (i % 2));
      }
      return (performance.now() - start) / 50;
    };

    // Same probe frame in both docs: content is identical there, so the
    // long doc's 300 extra keyframes isolate the binary-search term.
    const shortMs = await time(short.scene, 230);
    const longMs = await time(long.scene, 230);
    console.log(
      `gate seek: 8s doc=${shortMs.toFixed(3)}ms 600s doc=${longMs.toFixed(3)}ms`,
    );
    expect(longMs).toBeLessThan(20);
    expect(longMs).toBeLessThan(Math.max(shortMs * 10, 5));
  }, 60000);

  test('PlaybackManager never steps a document scene during seek', async () => {
    const {scene, playback} = makeScene();
    await playback.recalculate();
    await playback.reset();
    let nextCalls = 0;
    const originalNext = scene.next.bind(scene);
    scene.next = async () => {
      nextCalls++;
      await originalNext();
    };
    await playback.seek(200);
    await playback.seek(30);
    expect(nextCalls).toBe(0);
    expect(playback.frame).toBe(30);
  });
});

import * as fs from 'fs';
import {toMatchImageSnapshot} from 'jest-image-snapshot';
import {afterAll, beforeAll, describe, expect, test} from 'vitest';
import type {App} from './app';
import {start} from './app';

expect.extend({toMatchImageSnapshot});

describe('Rendering', () => {
  let app: App | undefined;

  beforeAll(async () => {
    app = await start();
  });

  afterAll(async () => {
    // Optional, because `start()` throwing leaves this undefined: teardown
    // then threw a TypeError of its own, and that second failure is the one
    // that gets read. A Chrome that would not launch reported as
    // "cannot read properties of undefined" sends whoever is on the failure
    // looking in the wrong place entirely.
    await app?.stop();
  });

  test('Animation renders correctly', async () => {
    // For the type checker, not for the runtime: a failing `beforeAll` aborts
    // the suite before any test body runs.
    if (app === undefined) {
      throw new Error('the app did not start — see the beforeAll failure');
    }
    await app.page.click('#render');
    await app.page.waitForSelector('#render:not([data-rendering="true"])');

    const images = await readOutputFiles();
    // A scene that fails mid-render just stops producing output — assert the
    // full roster so missing scenes fail loudly instead of passing silently.
    const expectedScenes = [
      'circle',
      'rect',
      'mc-compat',
      'doc-text-basics',
      'doc-shapes-draw-on',
      'doc-layout-flex',
      'doc-code-highlight',
      'doc-latex',
      'doc-image-svg',
      'doc-anchors-narration',
      'doc-block-escape',
      'doc-code-diff',
      'doc-gate',
    ];
    const rendered = images.map(image => image.name);
    for (const scene of expectedScenes) {
      expect(rendered).toContain(scene);
    }
    // Goldens are Linux-generated; on Linux (CI, the reference environment)
    // the diff is ~0 and the strict pixel budget applies everywhere. Text
    // rasterization differs between CoreText and FreeType even with
    // identical font binaries (measured worst case 0.6%), so text-bearing
    // scenes get a percent allowance ONLY off-Linux, keeping local macOS
    // runs meaningful without costing CI rigor.
    const textScenes = new Set([
      'doc-text-basics',
      'doc-code-highlight',
      'doc-code-diff',
      'doc-latex',
      'doc-gate',
    ]);
    const strict = {
      failureThreshold: 20,
      failureThresholdType: 'pixel' as const,
    };
    for (const {name, content} of images) {
      const base = name.replace(/-mid$/, '');
      expect(content).toMatchImageSnapshot({
        customSnapshotIdentifier: name,
        ...(process.platform !== 'linux' && textScenes.has(base)
          ? {failureThreshold: 0.8, failureThresholdType: 'percent' as const}
          : strict),
      });
    }
  });
});

async function readOutputFiles() {
  const files = await fs.promises.readdir('./output/project');
  const images: {name: string; content: Buffer}[] = [];
  for (const file of files) {
    const stat = await fs.promises.stat(`./output/project/${file}`);
    if (!stat.isDirectory()) {
      continue;
    }
    const frames = (await fs.promises.readdir(`./output/project/${file}`))
      .filter(frame => frame.endsWith('.png'))
      .sort();
    if (frames.length === 0) {
      continue;
    }
    images.push({
      name: file,
      content: await fs.promises.readFile(
        `./output/project/${file}/${frames[0]}`,
      ),
    });
    // Animated scenes also pin their middle frame — first frames are mostly
    // initial state and would leave tween/selection rendering unpinned.
    if (frames.length > 4) {
      const mid = frames[Math.floor(frames.length / 2)];
      images.push({
        name: `${file}-mid`,
        content: await fs.promises.readFile(`./output/project/${file}/${mid}`),
      });
    }
  }
  return images;
}

import * as fs from 'fs';
import {toMatchImageSnapshot} from 'jest-image-snapshot';
import {afterAll, beforeAll, describe, expect, test} from 'vitest';
import type {App} from './app';
import {start} from './app';

expect.extend({toMatchImageSnapshot});

describe('Rendering', () => {
  let app: App;

  beforeAll(async () => {
    app = await start();
  });

  afterAll(async () => {
    await app.stop();
  });

  test('Animation renders correctly', async () => {
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
      'doc-gate',
    ];
    const rendered = images.map(image => image.name);
    for (const scene of expectedScenes) {
      expect(rendered).toContain(scene);
    }
    for (const {name, content} of images) {
      expect(content).toMatchImageSnapshot({
        customSnapshotIdentifier: name,
        failureThreshold: 20,
        failureThresholdType: 'pixel',
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

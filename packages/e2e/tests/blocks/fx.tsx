import type {Node} from '@fantoche-dev/2d';
import {Rect} from '@fantoche-dev/2d';
import type {ThreadGenerator} from '@fantoche-dev/core';

/**
 * Corpus escape-hatch block: a rect sliding one pixel per frame — trivially
 * deterministic, so seek-vs-sweep golden comparisons stay honest.
 */
export function* slide(container: Node): ThreadGenerator {
  const rect = new Rect({
    width: 40,
    height: 40,
    x: -60,
    y: 0,
    fill: '#e13238',
    radius: 6,
  });
  container.add(rect);
  for (;;) {
    rect.x(rect.x() + 4);
    rect.rotation(rect.rotation() + 6);
    yield;
  }
}

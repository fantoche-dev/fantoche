import {DOMParser, XMLSerializer, type Element} from '@xmldom/xmldom';
import {CHARACTER_ART_VERSION, type CharacterArt} from './art.js';
import type {PIVOT_PRESETS} from './schema.js';

export type PivotPreset = (typeof PIVOT_PRESETS)[number];

export interface SplitSlotSpec {
  /** Element id in the art this slot binds to. */
  element: string;
  /** Explicit `[x, y]` wins over a marker; a preset yields to a marker. */
  pivot: readonly [number, number] | PivotPreset;
}

export interface SplitResult extends CharacterArt {
  /**
   * Slot id → self-contained sub-SVG markup whose `viewBox` is symmetric
   * about the slot's pivot, so the pivot sits exactly at the fragment's
   * centre — rotation about the pivot is then plain `rotation` (ADR 0006).
   */
  slots: Record<string, string>;
  /** Slot id → resolved pivot, in art coordinates. */
  pivots: Record<string, [number, number]>;
  /** Slots whose bound element id does not exist in the art. */
  missing: string[];
  /** Art element ids no slot binds (pivot markers excluded). */
  orphans: string[];
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Discover the source art's direct child groups for `character import`
 * scaffolding. Nested ids are implementation details of a slot and must not
 * become independent bindings merely because the drawing tool named them.
 */
export function listTopLevelGroupIds(art: string): string[] {
  const doc = new DOMParser().parseFromString(art, 'image/svg+xml');
  const root = doc.documentElement as Element;
  const ids: string[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < root.childNodes.length; index++) {
    const node = root.childNodes[index];
    if (node.nodeType !== 1) {
      continue;
    }
    const element = node as unknown as Element;
    const id = element.getAttribute('id');
    if (
      element.tagName !== 'g' ||
      id === null ||
      id === '' ||
      /^pivot-/.test(id) ||
      element.getAttribute('data-fantoche-pivot') !== null ||
      seen.has(id)
    ) {
      continue;
    }
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

/**
 * Split character art into one pivot-centred sub-SVG per slot.
 *
 * Never throws on a binding mismatch — misses and orphans are reported for
 * `character check` to present. The art itself is never modified (design
 * notes §1: broken bindings are fixed by remapping, not by editing art).
 */
export function splitArt(
  art: string,
  slots: Record<string, SplitSlotSpec>,
): SplitResult {
  const doc = new DOMParser().parseFromString(art, 'image/svg+xml');
  const all = Array.from(doc.getElementsByTagName('*')) as Element[];

  const byId = new Map<string, Element>();
  for (const el of all) {
    const id = el.getAttribute('id');
    if (id !== null && id !== '' && !byId.has(id)) {
      byId.set(id, el);
    }
  }

  // Pivot markers: data-fantoche-pivot="<slot>" or id="pivot-<slot>".
  // Coordinates from cx/cy (circle-like) or x/y. Stripped before any slot
  // serialisation — a marker never renders.
  const markers = new Map<string, [number, number]>();
  const markerIds = new Set<string>();
  for (const el of all) {
    const slot =
      el.getAttribute('data-fantoche-pivot') ??
      /^pivot-(.+)$/.exec(el.getAttribute('id') ?? '')?.[1] ??
      null;
    if (slot === null) {
      continue;
    }
    const x = readNumber(el, 'cx') ?? readNumber(el, 'x');
    const y = readNumber(el, 'cy') ?? readNumber(el, 'y');
    if (x !== undefined && y !== undefined && !markers.has(slot)) {
      markers.set(slot, apply(elementMatrix(el), [x, y]));
    }
    const id = el.getAttribute('id');
    if (id !== null) {
      markerIds.add(id);
    }
    el.parentNode?.removeChild(el);
  }

  const result: SplitResult = {
    version: CHARACTER_ART_VERSION,
    centre: measureArtCentre(doc.documentElement as Element),
    slots: {},
    pivots: {},
    missing: [],
    orphans: [],
  };
  const serializer = new XMLSerializer();

  for (const [slotId, spec] of Object.entries(slots)) {
    const source = byId.get(spec.element);
    if (source === undefined || markerIds.has(spec.element)) {
      result.missing.push(slotId);
      continue;
    }

    const fragment = detach(source);
    const markup = serializer.serializeToString(fragment);
    const bbox = measureFragment(fragment);
    const pivot = resolvePivot(spec.pivot, markers.get(slotId), bbox);

    const hx = Math.max(
      Math.abs(pivot[0] - bbox.minX),
      Math.abs(bbox.maxX - pivot[0]),
    );
    const hy = Math.max(
      Math.abs(pivot[1] - bbox.minY),
      Math.abs(bbox.maxY - pivot[1]),
    );
    const width = 2 * (hx > 0 ? hx : 1);
    const height = 2 * (hy > 0 ? hy : 1);
    const viewBox = `${pivot[0] - width / 2} ${pivot[1] - height / 2} ${width} ${height}`;

    result.slots[slotId] =
      `<svg xmlns="${SVG_NS}" viewBox="${viewBox}">${markup}</svg>`;
    result.pivots[slotId] = pivot;
  }

  const bound = new Set(Object.values(slots).map(spec => spec.element));
  for (const [id, el] of byId) {
    if (bound.has(id) || markerIds.has(id) || hasBoundAncestor(el, bound)) {
      continue;
    }
    result.orphans.push(id);
  }
  result.orphans.sort();

  return result;
}

function measureArtCentre(root: Element): [number, number] {
  const viewBox = numbersIn(root.getAttribute('viewBox') ?? '');
  if (viewBox.length === 4 && viewBox[2] > 0 && viewBox[3] > 0) {
    return [viewBox[0] + viewBox[2] / 2, viewBox[1] + viewBox[3] / 2];
  }
  const box = measureFragment(root);
  return [(box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2];
}

/**
 * Clone the element with its inherited presentation composed on, so the
 * fragment renders the same detached as it did attached: ancestor
 * `transform`s are prepended to the element's own, and the nearest
 * ancestor `fill`/`stroke` fills in only where the element has none.
 */
function detach(source: Element): Element {
  const clone = source.cloneNode(true) as Element;

  const transforms: string[] = [];
  for (const ancestor of ancestorsOf(source)) {
    const transform = ancestor.getAttribute('transform');
    if (transform !== null && transform !== '') {
      transforms.unshift(transform);
    }
    for (const attr of ['fill', 'stroke'] as const) {
      const value = ancestor.getAttribute(attr);
      if (value !== null && value !== '' && clone.getAttribute(attr) === null) {
        clone.setAttribute(attr, value);
      }
    }
  }

  const own = clone.getAttribute('transform');
  const composed = [
    ...transforms,
    ...(own !== null && own !== '' ? [own] : []),
  ];
  if (composed.length > 0) {
    clone.setAttribute('transform', composed.join(' '));
  }
  return clone;
}

function* ancestorsOf(el: Element): Generator<Element> {
  // Nearest ancestor first, including the root <svg>: presentation properties
  // inherit from it too, and an SVG 2 root may itself carry a transform.
  let node = el.parentNode;
  while (node !== null && node.nodeType === 1) {
    yield node as Element;
    node = node.parentNode;
  }
}

/** Compose an element's own transform and every ancestor transform. */
function elementMatrix(el: Element): Affine {
  let matrix = IDENTITY;
  const chain = [...ancestorsOf(el)].reverse();
  chain.push(el);
  for (const member of chain) {
    matrix = multiply(matrix, parseTransform(member.getAttribute('transform')));
  }
  return matrix;
}

function hasBoundAncestor(el: Element, bound: Set<string>): boolean {
  for (const ancestor of ancestorsOf(el)) {
    const id = ancestor.getAttribute('id');
    if (id !== null && bound.has(id)) {
      return true;
    }
  }
  return false;
}

function resolvePivot(
  spec: SplitSlotSpec['pivot'],
  marker: [number, number] | undefined,
  bbox: BBox,
): [number, number] {
  if (Array.isArray(spec)) {
    return [spec[0], spec[1]]; // explicit numbers: the documented override
  }
  if (marker !== undefined) {
    return marker; // marker wins over presets
  }
  const cx = (bbox.minX + bbox.maxX) / 2;
  const cy = (bbox.minY + bbox.maxY) / 2;
  switch (spec as PivotPreset) {
    case 'top-center':
      return [cx, bbox.minY];
    case 'bottom-center':
      return [cx, bbox.maxY];
    case 'left-center':
      return [bbox.minX, cy];
    case 'right-center':
      return [bbox.maxX, cy];
    default:
      return [cx, cy];
  }
}

// ---------------------------------------------------------------------------
// Fragment measurement: shape coordinate extremes in art coordinates. Path
// curves use their control points too — an over-estimate, harmless because
// the box is only a window (transparent padding is free).
// ---------------------------------------------------------------------------

interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Affine 2×3: [a, b, c, d, e, f] as in SVG `matrix(...)`. */
type Affine = readonly [number, number, number, number, number, number];

const IDENTITY: Affine = [1, 0, 0, 1, 0, 0];

function measureFragment(root: Element): BBox {
  const points: [number, number][] = [];
  visit(root, parseTransform(root.getAttribute('transform')));
  if (points.length === 0) {
    return {minX: 0, minY: 0, maxX: 0, maxY: 0};
  }
  const xs = points.map(p => p[0]);
  const ys = points.map(p => p[1]);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };

  function visit(el: Element, matrix: Affine): void {
    const local = shapePoints(el);
    for (const point of local) {
      points.push(apply(matrix, point));
    }
    for (let i = 0; i < el.childNodes.length; i++) {
      const child = el.childNodes[i];
      if (child.nodeType !== 1) {
        continue;
      }
      const childEl = child as unknown as Element;
      visit(
        childEl,
        multiply(matrix, parseTransform(childEl.getAttribute('transform'))),
      );
    }
  }
}

function shapePoints(el: Element): [number, number][] {
  const n = (name: string) => readNumber(el, name) ?? 0;
  switch (el.tagName) {
    case 'rect':
      return corners(n('x'), n('y'), n('width'), n('height'));
    case 'circle':
      return corners(
        n('cx') - n('r'),
        n('cy') - n('r'),
        2 * n('r'),
        2 * n('r'),
      );
    case 'ellipse':
      return corners(
        n('cx') - n('rx'),
        n('cy') - n('ry'),
        2 * n('rx'),
        2 * n('ry'),
      );
    case 'line':
      return [
        [n('x1'), n('y1')],
        [n('x2'), n('y2')],
      ];
    case 'polygon':
    case 'polyline':
      return pairs(numbersIn(el.getAttribute('points') ?? ''));
    case 'path':
      return pathPoints(el.getAttribute('d') ?? '');
    default:
      return [];
  }
}

function corners(
  x: number,
  y: number,
  width: number,
  height: number,
): [number, number][] {
  return [
    [x, y],
    [x + width, y],
    [x, y + height],
    [x + width, y + height],
  ];
}

function numbersIn(text: string): number[] {
  return (text.match(/-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g) ?? []).map(
    Number,
  );
}

function pairs(values: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < values.length; i += 2) {
    out.push([values[i], values[i + 1]]);
  }
  return out;
}

/**
 * Walk a path `d`, absolutising relative commands by tracking the current
 * point. Control points count as points (over-estimate, see above).
 */
function pathPoints(d: string): [number, number][] {
  const out: [number, number][] = [];
  const commands = d.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g);
  if (commands === null) {
    return out;
  }
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let previous = '';
  let cubicControl: [number, number] | undefined;
  let quadraticControl: [number, number] | undefined;
  for (const command of commands) {
    const op = command[0];
    const args = numbersIn(command.slice(1));
    const relative = op === op.toLowerCase();
    const push = (px: number, py: number) => {
      x = px;
      y = py;
      out.push([x, y]);
    };
    switch (op.toUpperCase()) {
      case 'M':
        for (let i = 0; i + 1 < args.length; i += 2) {
          push(
            relative ? x + args[i] : args[i],
            relative ? y + args[i + 1] : args[i + 1],
          );
          if (op.toUpperCase() === 'M' && i === 0) {
            startX = x;
            startY = y;
          }
          previous = i === 0 ? 'M' : 'L';
        }
        cubicControl = undefined;
        quadraticControl = undefined;
        break;
      case 'L':
        for (let i = 0; i + 1 < args.length; i += 2) {
          push(
            relative ? x + args[i] : args[i],
            relative ? y + args[i + 1] : args[i + 1],
          );
        }
        previous = 'L';
        cubicControl = undefined;
        quadraticControl = undefined;
        break;
      case 'H':
        for (const value of args) {
          push(relative ? x + value : value, y);
        }
        previous = 'H';
        cubicControl = undefined;
        quadraticControl = undefined;
        break;
      case 'V':
        for (const value of args) {
          push(x, relative ? y + value : value);
        }
        previous = 'V';
        cubicControl = undefined;
        quadraticControl = undefined;
        break;
      case 'C':
        for (let i = 0; i + 5 < args.length; i += 6) {
          const base: [number, number] = [x, y];
          const first = absolute(base, args[i], args[i + 1], relative);
          const second = absolute(base, args[i + 2], args[i + 3], relative);
          out.push(first, second);
          push(
            relative ? x + args[i + 4] : args[i + 4],
            relative ? y + args[i + 5] : args[i + 5],
          );
          cubicControl = second;
          previous = 'C';
        }
        quadraticControl = undefined;
        break;
      case 'S':
        for (let i = 0; i + 3 < args.length; i += 4) {
          const base: [number, number] = [x, y];
          const first: [number, number] =
            (previous === 'C' || previous === 'S') && cubicControl !== undefined
              ? [2 * x - cubicControl[0], 2 * y - cubicControl[1]]
              : [x, y];
          const second = absolute(base, args[i], args[i + 1], relative);
          out.push(first, second);
          push(
            relative ? x + args[i + 2] : args[i + 2],
            relative ? y + args[i + 3] : args[i + 3],
          );
          cubicControl = second;
          previous = 'S';
        }
        quadraticControl = undefined;
        break;
      case 'Q':
        for (let i = 0; i + 3 < args.length; i += 4) {
          const base: [number, number] = [x, y];
          const control = absolute(base, args[i], args[i + 1], relative);
          out.push(control);
          push(
            relative ? x + args[i + 2] : args[i + 2],
            relative ? y + args[i + 3] : args[i + 3],
          );
          quadraticControl = control;
          previous = 'Q';
        }
        cubicControl = undefined;
        break;
      case 'T':
        for (let i = 0; i + 1 < args.length; i += 2) {
          const control: [number, number] =
            (previous === 'Q' || previous === 'T') &&
            quadraticControl !== undefined
              ? [2 * x - quadraticControl[0], 2 * y - quadraticControl[1]]
              : [x, y];
          out.push(control);
          push(
            relative ? x + args[i] : args[i],
            relative ? y + args[i + 1] : args[i + 1],
          );
          quadraticControl = control;
          previous = 'T';
        }
        cubicControl = undefined;
        break;
      case 'A':
        for (let i = 0; i + 6 < args.length; i += 7) {
          const end: [number, number] = [
            relative ? x + args[i + 5] : args[i + 5],
            relative ? y + args[i + 6] : args[i + 6],
          ];
          out.push(
            ...arcEnvelope(
              [x, y],
              end,
              args[i],
              args[i + 1],
              args[i + 2],
              args[i + 3] !== 0,
              args[i + 4] !== 0,
            ),
          );
          push(...end);
          previous = 'A';
        }
        cubicControl = undefined;
        quadraticControl = undefined;
        break;
      case 'Z':
        x = startX;
        y = startY;
        previous = 'Z';
        cubicControl = undefined;
        quadraticControl = undefined;
        break;
    }
  }
  return out;
}

/**
 * Conservative envelope for an SVG elliptical arc. The full corrected
 * ellipse is used rather than only the selected arc: transparent padding is
 * harmless, while an endpoint-only box can clip an entire semicircle.
 */
function arcEnvelope(
  start: readonly [number, number],
  end: readonly [number, number],
  rawRx: number,
  rawRy: number,
  rotation: number,
  largeArc: boolean,
  sweep: boolean,
): [number, number][] {
  let rx = Math.abs(rawRx);
  let ry = Math.abs(rawRy);
  if ((start[0] === end[0] && start[1] === end[1]) || rx === 0 || ry === 0) {
    return [start.slice() as [number, number], end.slice() as [number, number]];
  }

  const phi = (rotation * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (start[0] - end[0]) / 2;
  const dy = (start[1] - end[1]) / 2;
  const xPrime = cos * dx + sin * dy;
  const yPrime = -sin * dx + cos * dy;

  const radiiScale =
    (xPrime * xPrime) / (rx * rx) + (yPrime * yPrime) / (ry * ry);
  if (radiiScale > 1) {
    const factor = Math.sqrt(radiiScale);
    rx *= factor;
    ry *= factor;
  }

  const numerator = Math.max(
    0,
    rx * rx * ry * ry - rx * rx * yPrime * yPrime - ry * ry * xPrime * xPrime,
  );
  const denominator = rx * rx * yPrime * yPrime + ry * ry * xPrime * xPrime;
  const sign = largeArc === sweep ? -1 : 1;
  const coefficient =
    denominator === 0 ? 0 : sign * Math.sqrt(numerator / denominator);
  const cxPrime = coefficient * ((rx * yPrime) / ry);
  const cyPrime = coefficient * (-(ry * xPrime) / rx);
  const cx = cos * cxPrime - sin * cyPrime + (start[0] + end[0]) / 2;
  const cy = sin * cxPrime + cos * cyPrime + (start[1] + end[1]) / 2;

  const extentX = Math.hypot(rx * cos, ry * sin);
  const extentY = Math.hypot(rx * sin, ry * cos);
  return corners(cx - extentX, cy - extentY, 2 * extentX, 2 * extentY);
}

function absolute(
  base: readonly [number, number],
  px: number,
  py: number,
  relative: boolean,
): [number, number] {
  return relative ? [base[0] + px, base[1] + py] : [px, py];
}

function parseTransform(text: string | null): Affine {
  if (text === null || text.trim() === '') {
    return IDENTITY;
  }
  let matrix = IDENTITY;
  for (const match of text.matchAll(/([a-zA-Z]+)\s*\(([^)]*)\)/g)) {
    const args = numbersIn(match[2]);
    matrix = multiply(matrix, transformToAffine(match[1], args));
  }
  return matrix;
}

function transformToAffine(op: string, args: number[]): Affine {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  switch (op) {
    case 'matrix':
      return args.length === 6 ? (args as unknown as Affine) : IDENTITY;
    case 'translate':
      return [1, 0, 0, 1, args[0] ?? 0, args[1] ?? 0];
    case 'scale':
      return [args[0] ?? 1, 0, 0, args[1] ?? args[0] ?? 1, 0, 0];
    case 'rotate': {
      const angle = rad(args[0] ?? 0);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const rotation: Affine = [cos, sin, -sin, cos, 0, 0];
      if (args.length >= 3) {
        return multiply(multiply([1, 0, 0, 1, args[1], args[2]], rotation), [
          1,
          0,
          0,
          1,
          -args[1],
          -args[2],
        ]);
      }
      return rotation;
    }
    case 'skewX':
      return [1, 0, Math.tan(rad(args[0] ?? 0)), 1, 0, 0];
    case 'skewY':
      return [1, Math.tan(rad(args[0] ?? 0)), 0, 1, 0, 0];
    default:
      return IDENTITY;
  }
}

function multiply(m: Affine, n: Affine): Affine {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

function apply(m: Affine, point: readonly [number, number]): [number, number] {
  return [
    m[0] * point[0] + m[2] * point[1] + m[4],
    m[1] * point[0] + m[3] * point[1] + m[5],
  ];
}

function readNumber(el: Element, name: string): number | undefined {
  const raw = el.getAttribute(name);
  if (raw === null || raw.trim() === '') {
    return undefined;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

import {
  applyInsert,
  applyReplace,
  CodeRangeError,
  resolveRangeSpec,
} from '../code-text.js';
import {DEFAULT_EASING, type EasingName} from '../easings.js';
import type {
  BlockIR,
  CodeRange,
  CodeTrack,
  CompiledElement,
  EditOp,
  SelectOp,
  TimelineIR,
  Track,
  TrackKey,
} from '../ir.js';
import type {FantocheDocument, PropValue, RangeSpec} from '../schema.js';
import {AnchorError, buildNarrationIndex, resolveTimeRef} from './anchors.js';

export class CompileError extends Error {
  public constructor(
    message: string,
    /** JSON-pointer-ish location in the source document. */
    public readonly path: string,
  ) {
    super(`${path}: ${message}`);
    this.name = 'CompileError';
  }
}

export interface CompileResult {
  ir: TimelineIR;
  warnings: string[];
}

const TRANSFORM_PROPS = ['x', 'y', 'scale', 'rotation', 'opacity', 'zIndex'];
const SHAPE_PROPS = ['fill', 'stroke', 'lineWidth'];
const SIZE_PROPS = ['width', 'height'];

/**
 * Animated (set/tween) props allowed per element type. The schema whitelists
 * ELEMENT props; timeline records are open strings, and without this check a
 * valid document could invoke arbitrary node methods (dispose, remove, …).
 */
const ANIMATABLE: Record<string, ReadonlySet<string>> = Object.fromEntries(
  Object.entries({
    text: ['text', 'fontSize', 'fontWeight', ...SHAPE_PROPS],
    rect: ['radius', ...SIZE_PROPS, ...SHAPE_PROPS],
    circle: ['startAngle', 'endAngle', ...SIZE_PROPS, ...SHAPE_PROPS],
    line: ['points', 'start', 'end', 'arrowSize', 'radius', ...SHAPE_PROPS],
    path: ['data', 'start', 'end', ...SHAPE_PROPS],
    polygon: ['sides', 'radius', ...SIZE_PROPS, ...SHAPE_PROPS],
    image: ['alpha', ...SIZE_PROPS],
    svg: [...SIZE_PROPS],
    latex: [...SIZE_PROPS],
    code: ['fontSize', 'fill'],
    layout: ['gap', 'padding', ...SIZE_PROPS],
  }).map(([type, props]) => [type, new Set([...TRANSFORM_PROPS, ...props])]),
);

/** The whole code is "selected" — nothing is dimmed. */
export const FULL_SELECTION: CodeRange[] = [
  [
    [0, 0],
    [Infinity, Infinity],
  ],
];

interface RawElement {
  id: string;
  type: string;
  props: Record<string, unknown>;
  children?: RawElement[];
}

type RawItem = Record<string, unknown> & {at: number | string};

interface PropEvent {
  itemIndex: number;
  t0: number;
  t1: number;
  kind: 'set' | 'tween';
  value: PropValue;
  from?: PropValue;
  easing: EasingName;
}

export function compileDocument(doc: FantocheDocument): CompileResult {
  const warnings: string[] = [];
  const fps = doc.meta.fps;
  const toFrame = (seconds: number) => Math.round(seconds * fps);
  const narrationIndex = buildNarrationIndex(doc.narration);

  // -- elements ------------------------------------------------------------
  const elements: CompiledElement[] = [];
  const byId = new Map<string, CompiledElement>();
  let order = 0;
  const walk = (list: RawElement[], parentId: string | null, path: string) => {
    list.forEach((element, i) => {
      const elementPath = `${path}/${i}`;
      if (byId.has(element.id)) {
        throw new CompileError(
          `duplicate element id "${element.id}"`,
          elementPath,
        );
      }
      const compiled: CompiledElement = {
        id: element.id,
        type: element.type,
        props: element.props,
        parentId,
        order: order++,
      };
      elements.push(compiled);
      byId.set(element.id, compiled);
      if (element.children !== undefined) {
        walk(element.children, element.id, `${elementPath}/children`);
      }
    });
  };
  walk(doc.elements as unknown as RawElement[], null, '/elements');
  for (const element of elements) {
    if (element.type === 'svg' && element.props.src !== undefined) {
      throw new CompileError(
        'svg asset-file sources are reserved for a future version — the v0 ' +
          'runtime only renders inline markup (props.svg)',
        `/elements: element "${element.id}" props.src`,
      );
    }
  }

  // -- timeline ------------------------------------------------------------
  const propEvents = new Map<string, PropEvent[]>();
  interface RawCodeOp {
    itemIndex: number;
    t0: number;
    t1: number;
    easing: EasingName;
    select?: RangeSpec[];
    edit?: {
      to?: string;
      replace?: [RangeSpec, string];
      insert?: [[number, number], string];
      remove?: RangeSpec;
    };
  }
  const codeOps = new Map<string, RawCodeOp[]>();
  const blocks: BlockIR[] = [];

  const requireTarget = (item: RawItem, index: number): CompiledElement => {
    const target = byId.get(item.target as string);
    if (target === undefined) {
      throw new CompileError(
        `unknown target "${item.target}"`,
        `/timeline/${index}/target`,
      );
    }
    return target;
  };

  (doc.timeline as unknown as RawItem[]).forEach((item, index) => {
    const path = `/timeline/${index}`;
    let t0: number;
    try {
      const resolved = resolveTimeRef(item.at, narrationIndex);
      t0 = resolved.seconds;
      for (const warning of resolved.warnings) {
        warnings.push(`${path}/at: ${warning}`);
      }
    } catch (error) {
      if (error instanceof AnchorError) {
        throw new CompileError(error.message, `${path}/at`);
      }
      throw error;
    }
    const dur = typeof item.dur === 'number' ? item.dur : 0;
    const easing = (item.easing as EasingName | undefined) ?? DEFAULT_EASING;

    if ('set' in item || 'tween' in item) {
      const target = requireTarget(item, index);
      const entries =
        'set' in item
          ? Object.entries(item.set as Record<string, PropValue>).map(
              ([prop, value]) => ({kind: 'set', prop, value}) as const,
            )
          : Object.entries(
              item.tween as Record<string, {to: PropValue; from?: PropValue}>,
            ).map(([prop, spec]) => ({kind: 'tween', prop, ...spec}) as const);
      for (const entry of entries) {
        if (!ANIMATABLE[target.type]?.has(entry.prop)) {
          throw new CompileError(
            `"${entry.prop}" is not an animatable prop of ${target.type} ` +
              `element "${target.id}"`,
            `${path}/${'set' in item ? 'set' : 'tween'}/${entry.prop}`,
          );
        }
        const key = `${target.id}\u0000${entry.prop}`;
        const events = propEvents.get(key) ?? [];
        events.push(
          entry.kind === 'set'
            ? {
                itemIndex: index,
                t0,
                t1: t0,
                kind: 'set',
                value: entry.value,
                easing,
              }
            : {
                itemIndex: index,
                t0,
                t1: t0 + dur,
                kind: 'tween',
                value: entry.to,
                from: entry.from,
                easing,
              },
        );
        propEvents.set(key, events);
      }
    } else if ('select' in item || 'edit' in item) {
      const target = requireTarget(item, index);
      if (target.type !== 'code') {
        throw new CompileError(
          `"${target.id}" is a ${target.type} element — select/edit only apply to code elements`,
          `${path}/target`,
        );
      }
      const ops = codeOps.get(target.id) ?? [];
      ops.push({
        itemIndex: index,
        t0,
        t1: t0 + dur,
        easing,
        select:
          'select' in item
            ? Array.isArray(item.select)
              ? (item.select as RangeSpec[])
              : [item.select as RangeSpec]
            : undefined,
        edit: 'edit' in item ? (item.edit as RawCodeOp['edit']) : undefined,
      });
      codeOps.set(target.id, ops);
    } else if ('block' in item) {
      const block = item.block as {src: string; dur: number};
      const hash = block.src.lastIndexOf('#');
      blocks.push({
        t0F: toFrame(t0),
        t1F: toFrame(t0 + block.dur),
        src: block.src.slice(0, hash),
        exportName: block.src.slice(hash + 1),
      });
    }
  });

  // -- prop tracks ---------------------------------------------------------
  const tracks: Track[] = [];
  for (const [key, events] of propEvents) {
    const [target, prop] = key.split('\u0000');
    events.sort((a, b) => a.t0 - b.t0 || a.itemIndex - b.itemIndex);
    const initial = (byId.get(target)!.props as Record<string, PropValue>)[
      prop
    ];
    const keys: TrackKey[] = [];
    let running: PropValue | undefined = initial;
    let activeUntil = -Infinity;
    let activeItem = -1;
    const pushKey = (next: TrackKey) => {
      const last = keys[keys.length - 1];
      if (last !== undefined && last.tF === next.tF) {
        keys[keys.length - 1] = next;
      } else {
        keys.push(next);
      }
    };
    for (const event of events) {
      if (
        event.t0 < activeUntil ||
        (event.kind === 'set' && event.t0 <= activeUntil)
      ) {
        throw new CompileError(
          `overlapping animations for "${target}.${prop}" — this item ` +
            `collides with /timeline/${activeItem}` +
            (event.kind === 'set'
              ? " (a set exactly at a tween's end erases its destination; move it at least one frame later)"
              : ''),
          `/timeline/${event.itemIndex}`,
        );
      }
      if (event.kind === 'set') {
        pushKey({tF: toFrame(event.t0), value: event.value, easing: 'hold'});
        running = event.value;
      } else {
        const from = event.from ?? running;
        const t0F = toFrame(event.t0);
        if (from === undefined) {
          warnings.push(
            `/timeline/${event.itemIndex}: tween of "${target}.${prop}" has ` +
              `no from-value (no element prop, no earlier item, no from:) — ` +
              `it will snap at the end instead of animating`,
          );
        } else if (keys[keys.length - 1]?.tF !== t0F) {
          // Never clobber an existing key: it already carries the correct
          // value AND the incoming easing (zero-gap tween chaining).
          pushKey({tF: t0F, value: from, easing: 'hold'});
        }
        pushKey({
          tF: toFrame(event.t1),
          value: event.value,
          easing: event.easing,
        });
        running = event.value;
        activeUntil = event.t1;
        activeItem = event.itemIndex;
      }
    }
    tracks.push({target, prop, initial, keys});
  }

  // -- code tracks ---------------------------------------------------------
  const codeTracks: CodeTrack[] = [];
  for (const [target, rawOps] of codeOps) {
    const element = byId.get(target)!;
    const initialCode = (
      (element.props.code as string | undefined) ?? ''
    ).replace(/\r\n/g, '\n');
    const initialSelectionSpec = element.props.selection as
      | RangeSpec
      | undefined;
    rawOps.sort((a, b) => a.t0 - b.t0 || a.itemIndex - b.itemIndex);

    let text = initialCode;
    let selection: CodeRange[] =
      initialSelectionSpec !== undefined
        ? resolveRangeSpec(initialSelectionSpec, text)
        : FULL_SELECTION;
    const initialSelection =
      initialSelectionSpec !== undefined ? selection : null;
    let lastEditEnd = -Infinity;
    const edits: EditOp[] = [];
    const selects: SelectOp[] = [];

    for (const raw of rawOps) {
      const path = `/timeline/${raw.itemIndex}`;
      try {
        if (raw.edit !== undefined) {
          if (raw.t0 < lastEditEnd) {
            throw new CompileError(
              `overlapping code edits on "${target}"`,
              path,
            );
          }
          const before = text;
          if (raw.edit.to !== undefined) {
            text = raw.edit.to.replace(/\r\n/g, '\n');
          } else if (raw.edit.replace !== undefined) {
            const [spec, replacement] = raw.edit.replace;
            for (const range of resolveRangeSpec(spec, text).reverse()) {
              text = applyReplace(text, range, replacement);
            }
          } else if (raw.edit.insert !== undefined) {
            text = applyInsert(text, raw.edit.insert[0], raw.edit.insert[1]);
          } else if (raw.edit.remove !== undefined) {
            for (const range of resolveRangeSpec(
              raw.edit.remove,
              text,
            ).reverse()) {
              text = applyReplace(text, range, '');
            }
          }
          edits.push({
            t0F: toFrame(raw.t0),
            t1F: toFrame(raw.t1),
            easing: raw.easing,
            before,
            after: text,
          });
          lastEditEnd = raw.t1;
        } else if (raw.select !== undefined) {
          const before = selection;
          selection = raw.select.flatMap(spec => resolveRangeSpec(spec, text));
          selects.push({
            t0F: toFrame(raw.t0),
            t1F: toFrame(raw.t1),
            easing: raw.easing,
            before,
            after: selection,
          });
        }
      } catch (error) {
        if (error instanceof CodeRangeError) {
          throw new CompileError(error.message, path);
        }
        throw error;
      }
    }
    codeTracks.push({target, initialCode, initialSelection, edits, selects});
  }

  // -- duration ------------------------------------------------------------
  // meta.duration and block windows are exclusive bounds; keyframes and code
  // ops are inclusive endpoints — the frame where they settle must render.
  let durationF =
    doc.meta.duration !== undefined ? Math.ceil(doc.meta.duration * fps) : 0;
  for (const track of tracks) {
    for (const key of track.keys) {
      durationF = Math.max(durationF, key.tF + 1);
    }
  }
  for (const track of codeTracks) {
    for (const op of [...track.edits, ...track.selects]) {
      durationF = Math.max(durationF, op.t1F + 1);
    }
  }
  const sortedBlocks = [...blocks].sort((a, b) => a.t0F - b.t0F);
  for (let i = 1; i < sortedBlocks.length; i++) {
    if (sortedBlocks[i].t0F < sortedBlocks[i - 1].t1F) {
      throw new CompileError(
        `block windows overlap ("${sortedBlocks[i - 1].src}#${sortedBlocks[i - 1].exportName}" ` +
          `and "${sortedBlocks[i].src}#${sortedBlocks[i].exportName}") — ` +
          'the runtime hosts one block at a time',
        '/timeline',
      );
    }
  }
  for (const block of blocks) {
    durationF = Math.max(durationF, block.t1F);
  }
  for (const segment of narrationIndex.segments.values()) {
    durationF = Math.max(durationF, toFrame(segment.end));
  }
  if (durationF <= 0) {
    throw new CompileError(
      'cannot infer duration — set meta.duration or add timed content',
      '/meta',
    );
  }

  return {
    ir: {
      fps,
      size: doc.meta.size,
      background: doc.meta.background ?? null,
      durationF,
      elements,
      tracks,
      codeTracks,
      blocks: sortedBlocks,
      narrationAudio: doc.narration?.audio ?? null,
    },
    warnings,
  };
}

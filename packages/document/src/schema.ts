import {z} from 'zod';
import {EASING_NAMES} from './easings.js';
import {isAnchorString} from './timeref.js';

/** Entity ids: usable as node keys and anchor segment names. */
export const idSchema = z
  .string()
  .regex(
    /^[A-Za-z_][A-Za-z0-9_-]*$/,
    'ids start with a letter or _ and contain only letters, digits, _ and -',
  );

const seconds = z.number().finite().min(0);
const positiveSeconds = z.number().finite().positive();

export const timeRefSchema = z.union([
  seconds,
  z.string().refine(isAnchorString, {
    message:
      'not a valid anchor — expected "segment.start", "segment.end" or "segment.word:<word>", optionally followed by +/-<seconds>',
  }),
]);

const easingSchema = z.enum(EASING_NAMES);

/** Values carried by set/tween items: primitives, vectors, point lists. */
const propValueSchema = z.union([
  z.number().finite(),
  z.string(),
  z.boolean(),
  z.null(),
  z.array(z.number().finite()),
  z.array(z.tuple([z.number().finite(), z.number().finite()])),
]);

// ---------------------------------------------------------------------------
// Code ranges (mirrors @fantoche-dev/2d code/CodeRange.ts semantics:
// 0-based lines and columns, exclusive end; `null` means "to the end").
// ---------------------------------------------------------------------------

const lineNumber = z.number().int().min(0);

export const rangeSpecSchema = z.union([
  z.strictObject({
    lines: z.tuple([lineNumber, z.union([lineNumber, z.null()])]),
  }),
  z.strictObject({
    word: z.union([
      z.tuple([lineNumber, lineNumber]),
      z.tuple([
        lineNumber,
        lineNumber,
        z.union([z.number().int().positive(), z.null()]),
      ]),
    ]),
  }),
  z.strictObject({
    match: z.string().min(1),
    which: z.enum(['first', 'last', 'all']).default('first'),
  }),
]);

// ---------------------------------------------------------------------------
// Elements
// ---------------------------------------------------------------------------

const transformProps = {
  x: z.number().finite().optional(),
  y: z.number().finite().optional(),
  scale: z
    .union([
      z.number().finite(),
      z.tuple([z.number().finite(), z.number().finite()]),
    ])
    .optional(),
  rotation: z.number().finite().optional(),
  opacity: z.number().min(0).max(1).optional(),
  zIndex: z.number().finite().optional(),
};

const shapeProps = {
  fill: z.string().nullable().optional(),
  stroke: z.string().nullable().optional(),
  lineWidth: z.number().finite().min(0).optional(),
};

const sizeProps = {
  width: z.number().finite().positive().optional(),
  height: z.number().finite().positive().optional(),
};

const textElement = z.strictObject({
  id: idSchema,
  type: z.literal('text'),
  props: z.strictObject({
    text: z.string(),
    fontFamily: z.string().optional(),
    fontSize: z.number().finite().positive().optional(),
    fontWeight: z.number().int().min(100).max(900).optional(),
    textAlign: z.enum(['left', 'center', 'right']).optional(),
    ...shapeProps,
    ...transformProps,
  }),
});

const rectElement = z.strictObject({
  id: idSchema,
  type: z.literal('rect'),
  props: z.strictObject({
    radius: z
      .union([
        z.number().finite().min(0),
        z.tuple([
          z.number().finite().min(0),
          z.number().finite().min(0),
          z.number().finite().min(0),
          z.number().finite().min(0),
        ]),
      ])
      .optional(),
    ...sizeProps,
    ...shapeProps,
    ...transformProps,
  }),
});

const circleElement = z.strictObject({
  id: idSchema,
  type: z.literal('circle'),
  props: z.strictObject({
    startAngle: z.number().finite().optional(),
    endAngle: z.number().finite().optional(),
    closed: z.boolean().optional(),
    ...sizeProps,
    ...shapeProps,
    ...transformProps,
  }),
});

const lineElement = z.strictObject({
  id: idSchema,
  type: z.literal('line'),
  props: z.strictObject({
    points: z.array(z.tuple([z.number().finite(), z.number().finite()])).min(2),
    radius: z.number().finite().min(0).optional(),
    startArrow: z.boolean().optional(),
    endArrow: z.boolean().optional(),
    arrowSize: z.number().finite().positive().optional(),
    /** Percent-draw clip, 0..1 — animate for draw-on effects. */
    start: z.number().min(0).max(1).optional(),
    end: z.number().min(0).max(1).optional(),
    ...shapeProps,
    ...transformProps,
  }),
});

const pathElement = z.strictObject({
  id: idSchema,
  type: z.literal('path'),
  props: z.strictObject({
    data: z.string().min(1),
    start: z.number().min(0).max(1).optional(),
    end: z.number().min(0).max(1).optional(),
    ...shapeProps,
    ...transformProps,
  }),
});

const polygonElement = z.strictObject({
  id: idSchema,
  type: z.literal('polygon'),
  props: z.strictObject({
    sides: z.number().int().min(3).optional(),
    radius: z.number().finite().min(0).optional(),
    ...sizeProps,
    ...shapeProps,
    ...transformProps,
  }),
});

const imageElement = z.strictObject({
  id: idSchema,
  type: z.literal('image'),
  props: z.strictObject({
    /** Asset id or a path relative to the document. */
    src: z.string().min(1),
    alpha: z.number().min(0).max(1).optional(),
    ...sizeProps,
    ...transformProps,
  }),
});

const svgElement = z
  .strictObject({
    id: idSchema,
    type: z.literal('svg'),
    props: z.strictObject({
      /** Inline SVG markup… */
      svg: z.string().min(1).optional(),
      /** …or an asset id of type "svg". Exactly one of the two. */
      src: z.string().min(1).optional(),
      ...sizeProps,
      ...transformProps,
    }),
  })
  .refine(el => (el.props.svg === undefined) !== (el.props.src === undefined), {
    message:
      'svg elements need exactly one of props.svg (inline markup) or props.src (asset id)',
    path: ['props'],
  });

const latexElement = z.strictObject({
  id: idSchema,
  type: z.literal('latex'),
  props: z.strictObject({
    tex: z.string().min(1),
    ...sizeProps,
    ...transformProps,
  }),
});

const codeElement = z.strictObject({
  id: idSchema,
  type: z.literal('code'),
  props: z.strictObject({
    code: z.string(),
    fontSize: z.number().finite().positive().optional(),
    fontFamily: z.string().optional(),
    selection: rangeSpecSchema.optional(),
    ...transformProps,
  }),
});

const layoutElement = z.strictObject({
  id: idSchema,
  type: z.literal('layout'),
  props: z.strictObject({
    direction: z
      .enum(['row', 'row-reverse', 'column', 'column-reverse'])
      .optional(),
    gap: z.number().finite().min(0).optional(),
    padding: z.number().finite().min(0).optional(),
    alignItems: z
      .enum(['center', 'start', 'end', 'stretch', 'baseline'])
      .optional(),
    justifyContent: z
      .enum([
        'center',
        'start',
        'end',
        'space-between',
        'space-around',
        'space-evenly',
      ])
      .optional(),
    ...sizeProps,
    ...transformProps,
  }),
  get children() {
    return z.array(elementSchema);
  },
});

export const elementSchema: z.ZodType<unknown> = z.union([
  textElement,
  rectElement,
  circleElement,
  lineElement,
  pathElement,
  polygonElement,
  imageElement,
  svgElement,
  latexElement,
  codeElement,
  layoutElement,
]);

// ---------------------------------------------------------------------------
// Narration + assets
// ---------------------------------------------------------------------------

const wordSchema = z.strictObject({
  text: z.string().min(1),
  start: seconds,
  dur: positiveSeconds.optional(),
});

const segmentSchema = z.strictObject({
  id: idSchema,
  text: z.string(),
  start: seconds,
  dur: positiveSeconds,
  words: z.array(wordSchema).optional(),
});

const narrationSchema = z.strictObject({
  audio: idSchema.optional(),
  segments: z.array(segmentSchema),
});

const assetSchema = z.strictObject({
  type: z.enum(['image', 'audio', 'svg']),
  src: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Timeline items
// ---------------------------------------------------------------------------

const setItem = z.strictObject({
  at: timeRefSchema,
  target: idSchema,
  set: z.record(z.string().min(1), propValueSchema),
});

const tweenItem = z.strictObject({
  at: timeRefSchema,
  target: idSchema,
  tween: z.record(
    z.string().min(1),
    z.strictObject({to: propValueSchema, from: propValueSchema.optional()}),
  ),
  dur: positiveSeconds,
  easing: easingSchema.optional(),
});

const selectItem = z.strictObject({
  at: timeRefSchema,
  target: idSchema,
  select: z.union([rangeSpecSchema, z.array(rangeSpecSchema)]),
  dur: positiveSeconds.optional(),
});

const editItem = z
  .strictObject({
    at: timeRefSchema,
    target: idSchema,
    edit: z.strictObject({
      /** Whole-code replacement, diffed token-wise when animated. */
      to: z.string().optional(),
      replace: z.tuple([rangeSpecSchema, z.string()]).optional(),
      insert: z
        .tuple([z.tuple([lineNumber, lineNumber]), z.string()])
        .optional(),
      remove: rangeSpecSchema.optional(),
    }),
    dur: positiveSeconds.optional(),
  })
  .refine(
    item =>
      [
        item.edit.to,
        item.edit.replace,
        item.edit.insert,
        item.edit.remove,
      ].filter(op => op !== undefined).length === 1,
    {
      message: 'edit needs exactly one of: to, replace, insert, remove',
      path: ['edit'],
    },
  );

const blockItem = z.strictObject({
  at: timeRefSchema,
  block: z.strictObject({
    src: z
      .string()
      .regex(
        /^.+#[A-Za-z_$][A-Za-z0-9_$]*$/,
        'block src must be "<module path>#<export name>"',
      ),
    dur: positiveSeconds,
  }),
});

export const timelineItemSchema = z.union([
  setItem,
  tweenItem,
  selectItem,
  editItem,
  blockItem,
]);

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export const documentSchema = z.strictObject({
  version: z.literal('0.1'),
  meta: z.strictObject({
    fps: z.number().int().min(1).max(120),
    size: z.tuple([z.number().int().positive(), z.number().int().positive()]),
    background: z.string().nullable().optional(),
    duration: positiveSeconds.optional(),
  }),
  assets: z.record(idSchema, assetSchema).optional(),
  narration: narrationSchema.optional(),
  elements: z.array(elementSchema),
  timeline: z.array(timelineItemSchema),
});

export type FantocheDocument = z.infer<typeof documentSchema>;
export type TimelineItem = z.infer<typeof timelineItemSchema>;
export type RangeSpec = z.infer<typeof rangeSpecSchema>;
export type PropValue = z.infer<typeof propValueSchema>;

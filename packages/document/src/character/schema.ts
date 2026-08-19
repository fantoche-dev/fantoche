import {z} from 'zod';
import {VISEMES} from '../lipsync/visemes.js';
import {idSchema} from '../schema.js';

/**
 * The character format's own version — independent of the document format.
 * A character is a document too (architecture §3.4): rig + poses + art
 * slots, imported from SVG, rendered as flat sibling nodes (ADR 0006).
 */
export const CHARACTER_FORMAT_VERSION = '0.1';

export const PIVOT_PRESETS = [
  'center',
  'top-center',
  'bottom-center',
  'left-center',
  'right-center',
] as const;

/** Params a pose may drive on a slot. `depth` is always hold-interpolated. */
export const SLOT_PARAMS = [
  'x',
  'y',
  'rotation',
  'scale',
  'opacity',
  'depth',
] as const;

const slotSchema = z.strictObject({
  /** Element id in the source SVG — the mapping table (design notes §1). */
  element: z.string().min(1),
  parent: idSchema.optional(),
  pivot: z
    .union([
      z.tuple([z.number().finite(), z.number().finite()]),
      z.enum(PIVOT_PRESETS),
    ])
    .default('center'),
  /** Uniform `scale` only — non-uniform scale shears the FK chain (ADR 0006). */
  rest: z
    .strictObject({
      rotation: z.number().finite().default(0),
      scale: z.number().finite().positive().default(1),
      depth: z.number().finite().default(0),
    })
    .default({rotation: 0, scale: 1, depth: 0}),
});

export const characterSchema = z
  .strictObject({
    version: z.literal(CHARACTER_FORMAT_VERSION),
    id: idSchema,
    /** Path to the generated, render-ready `*.art.json` sidecar. */
    art: z.strictObject({src: z.string().min(1)}),
    slots: z.record(idSchema, slotSchema),
    poses: z.record(idSchema, z.record(z.string().min(1), z.number().finite())),
    /** Viseme letter → element id in the art (the mouth sheet). All nine. */
    visemes: z.record(z.enum(VISEMES), z.string().min(1)).optional(),
  })
  .superRefine((doc, ctx) => {
    for (const [slotId, slot] of Object.entries(doc.slots)) {
      if (slot.parent !== undefined && !(slot.parent in doc.slots)) {
        ctx.addIssue({
          code: 'custom',
          path: ['slots', slotId, 'parent'],
          message: `slot "${slotId}" names parent "${slot.parent}", which is not a slot`,
        });
      }
    }

    for (const cycle of findParentCycles(doc.slots)) {
      ctx.addIssue({
        code: 'custom',
        path: ['slots'],
        message: `parent cycle: ${cycle.join(' → ')} → ${cycle[0]}`,
      });
    }

    for (const [poseId, params] of Object.entries(doc.poses)) {
      for (const key of Object.keys(params)) {
        const split = key.lastIndexOf('.');
        if (split <= 0 || split === key.length - 1) {
          ctx.addIssue({
            code: 'custom',
            path: ['poses', poseId, key],
            message: `pose key "${key}" must be "<slot>.<param>"`,
          });
          continue;
        }
        const slotId = key.slice(0, split);
        const param = key.slice(split + 1);
        if (!(slotId in doc.slots)) {
          ctx.addIssue({
            code: 'custom',
            path: ['poses', poseId, key],
            message: `pose "${poseId}" drives unknown slot "${slotId}"`,
          });
        } else if (!(SLOT_PARAMS as readonly string[]).includes(param)) {
          ctx.addIssue({
            code: 'custom',
            path: ['poses', poseId, key],
            message: `pose "${poseId}" drives unknown param "${param}" — slots support ${SLOT_PARAMS.join(', ')}`,
          });
        }
      }
    }
  });

export type Character = z.infer<typeof characterSchema>;
export type CharacterSlot = z.infer<typeof slotSchema>;
export type SlotParam = (typeof SLOT_PARAMS)[number];

/**
 * Iterative colour-marking walk over `parent` links. Each cycle is reported
 * once, as the member list in walk order.
 */
function findParentCycles(
  slots: Record<string, {parent?: string}>,
): string[][] {
  const colour = new Map<string, 'gray' | 'black'>();
  const cycles: string[][] = [];
  for (const start of Object.keys(slots)) {
    if (colour.has(start)) {
      continue;
    }
    const path: string[] = [];
    let node: string | undefined = start;
    while (node !== undefined && node in slots && !colour.has(node)) {
      colour.set(node, 'gray');
      path.push(node);
      node = slots[node].parent;
    }
    if (node !== undefined && colour.get(node) === 'gray') {
      cycles.push(path.slice(path.indexOf(node)));
    }
    for (const member of path) {
      colour.set(member, 'black');
    }
  }
  return cycles;
}

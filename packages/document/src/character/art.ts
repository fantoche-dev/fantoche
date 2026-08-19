import {z} from 'zod';
import {idSchema} from '../schema.js';

/** The generated art sidecar versions independently of character.json. */
export const CHARACTER_ART_VERSION = '0.1';

/**
 * Render-ready output of SVG import. Kept beside `character.json` as
 * `*.art.json`, so the pure compiler receives data and never reads files.
 */
export const characterArtSchema = z
  .strictObject({
    version: z.literal(CHARACTER_ART_VERSION),
    centre: z.tuple([z.number().finite(), z.number().finite()]),
    slots: z.record(idSchema, z.string().min(1)),
    pivots: z.record(
      idSchema,
      z.tuple([z.number().finite(), z.number().finite()]),
    ),
  })
  .superRefine((art, ctx) => {
    for (const slotId of Object.keys(art.slots)) {
      if (!(slotId in art.pivots)) {
        ctx.addIssue({
          code: 'custom',
          path: ['pivots', slotId],
          message: `art slot "${slotId}" has no resolved pivot`,
        });
      }
    }
    for (const slotId of Object.keys(art.pivots)) {
      if (!(slotId in art.slots)) {
        ctx.addIssue({
          code: 'custom',
          path: ['slots', slotId],
          message: `pivot "${slotId}" has no art slot`,
        });
      }
    }
  });

export type CharacterArt = z.infer<typeof characterArtSchema>;

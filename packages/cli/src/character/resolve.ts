import {
  characterArtSchema,
  characterSchema,
  visemeTrackSchema,
  type Character,
  type CharacterArt,
  type VisemeTrack,
} from '@fantoche-dev/document';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface ResolvedCastAssets {
  characters: Record<string, {character: Character; art: CharacterArt}>;
  lipsync: Record<string, VisemeTrack>;
}

/**
 * Resolve a document's `character` and `lipsync` assets into the maps
 * `compileDocument` expects (plan Decision 10: the CLI shim resolves paths
 * to JSON; the pure compiler never reads files). Paths resolve relative to
 * the document; a character's art sidecar resolves relative to the
 * character file, mirroring `character import`.
 */
export function resolveCastAssets(
  doc: {assets?: Record<string, {type: string; src: string}>},
  docDir: string,
): ResolvedCastAssets {
  const resolved: ResolvedCastAssets = {characters: {}, lipsync: {}};
  for (const [assetId, asset] of Object.entries(doc.assets ?? {})) {
    if (asset.type === 'character') {
      const characterPath = path.resolve(docDir, asset.src);
      const character = parseWith(
        characterSchema,
        characterPath,
        `character asset "${assetId}"`,
      );
      if (character.id !== assetId) {
        throw new Error(
          `character asset "${assetId}" resolves to character id "${character.id}" — ` +
            `the asset id must equal the character's id (cast members reference both)`,
        );
      }
      const sidecarPath = path.resolve(
        path.dirname(characterPath),
        character.art.src,
      );
      if (!fs.existsSync(sidecarPath)) {
        throw new Error(
          `character "${assetId}" has no art sidecar at ${sidecarPath} — ` +
            `run: fantoche character import <art.svg> ${asset.src}`,
        );
      }
      const art = parseWith(
        characterArtSchema,
        sidecarPath,
        `art sidecar of character "${assetId}"`,
      );
      resolved.characters[assetId] = {character, art};
    } else if (asset.type === 'lipsync') {
      const trackPath = path.resolve(docDir, asset.src);
      resolved.lipsync[assetId] = parseWith(
        visemeTrackSchema,
        trackPath,
        `lipsync asset "${assetId}"`,
      );
    }
  }
  return resolved;
}

function parseWith<T>(
  schema: {
    safeParse: (input: unknown) => {
      success: boolean;
      data?: T;
      error?: {issues: {path: PropertyKey[]; message: string}[]};
    };
  },
  filePath: string,
  label: string,
): T {
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(
      `${label}: could not read ${filePath}: ${(error as Error).message}`,
    );
  }
  const result = schema.safeParse(raw);
  if (!result.success || result.data === undefined) {
    const details = (result.error?.issues ?? [])
      .map(issue => `  /${issue.path.map(String).join('/')}: ${issue.message}`)
      .join('\n');
    throw new Error(`${label} is invalid (${filePath}):\n${details}`);
  }
  return result.data;
}

/**
 * `fantoche doc check` — the enforcement half of `docs/content-quality.md` §2.
 *
 * Warn by default, fail under `--strict`. The split matters: the floor is a
 * project default and an author may knowingly ship under it, but our own
 * demos run strict in CI, so a regression there is a build failure rather
 * than a line of scrollback nobody reads.
 *
 * §1 policy is deliberately NOT encoded here. Policy is external, perishable
 * and unappealable; encoding it in a tool ages badly. Encoding the floor does
 * not.
 */

import * as fs from 'fs';
import * as path from 'path';
import {measureAudio} from './audio.js';
import type {CheckedCue, CheckedSegment, Finding} from './checks.js';
import {collectFindings} from './collect.js';

export interface DocCheckOptions {
  strict?: boolean;
  /**
   * `--no-audio` skips the ffmpeg measurement; every other rule still runs.
   * Named `audio`, not `noAudio`: that is commander's shape for a `--no-`
   * flag — it negates a boolean of the base name rather than defining the
   * `no` one, so reading `noAudio` measured the audio anyway.
   */
  audio?: boolean;
  ffmpeg?: string;
  ffprobe?: string;
}

/**
 * Locate ffmpeg/ffprobe the way the rest of the project does: an explicit
 * flag wins, then the `FFMPEG_PATH`/`FFPROBE_PATH` variables the ffmpeg
 * package already honours, then the installer package, then PATH.
 */
async function resolveBinary(
  override: string | undefined,
  envVar: string,
  installer: string,
  fallback: string,
): Promise<string> {
  if (override !== undefined) {
    return override;
  }
  const fromEnv = process.env[envVar];
  if (fromEnv !== undefined && fromEnv !== '') {
    return fromEnv;
  }
  try {
    const resolved = (await import(installer)) as {path?: string};
    return resolved.path ?? fallback;
  } catch {
    return fallback;
  }
}

function report(
  findings: readonly Finding[],
  strict: boolean,
  audioMeasured: boolean,
): void {
  // "clears the floor" must not be claimable by a run whose audio rules never
  // executed — a skipped encoder would otherwise read as a pass.
  const scope = audioMeasured
    ? 'the §2 floor'
    : 'every §2 rule that ran (audio rules were skipped)';
  if (findings.length === 0) {
    console.log(`doc check: no findings — the document clears ${scope}.`);
    return;
  }
  const byRule = new Map<string, Finding[]>();
  for (const finding of findings) {
    byRule.set(finding.rule, [...(byRule.get(finding.rule) ?? []), finding]);
  }
  const label = strict ? 'error' : 'warning';
  for (const [rule, group] of byRule) {
    console.error(`${label}: ${rule} (${group.length})`);
    // A jittery track can carry hundreds of identical-shaped findings; the
    // count above is the measurement, the sample is the way in.
    for (const finding of group.slice(0, 5)) {
      console.error(`  ${finding.message}`);
    }
    if (group.length > 5) {
      console.error(`  … and ${group.length - 5} more`);
    }
  }
  console.error(
    `\ndoc check: ${findings.length} finding(s) across ${byRule.size} rule(s). See docs/content-quality.md §2.`,
  );
}

export async function docCheck(
  docPath: string,
  options: DocCheckOptions,
): Promise<void> {
  const {
    validateDocument,
    migrateDocument,
    MigrationError,
    compileDocument,
    visemeTrackSchema,
  } = await import('@fantoche-dev/document');
  const {resolveCastAssets} = await import('../character/resolve.js');

  const resolvedDocPath = path.resolve(docPath);
  const docDir = path.dirname(resolvedDocPath);
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(resolvedDocPath, 'utf8'));
  } catch (error) {
    console.error(`Could not read document: ${(error as Error).message}`);
    process.exit(1);
  }

  let migrated;
  try {
    migrated = migrateDocument(raw);
  } catch (error) {
    if (error instanceof MigrationError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }

  const validation = validateDocument(migrated.doc);
  if (!validation.ok) {
    console.error('Invalid document:');
    for (const issue of validation.errors) {
      console.error(`  ${issue.path}: ${issue.message}`);
    }
    process.exit(1);
  }
  const doc = validation.doc as {
    narration?: {audio?: string; segments: CheckedSegment[]};
    assets?: Record<string, {type: string; src: string}>;
  };

  let resolved;
  try {
    resolved = resolveCastAssets(
      raw as {assets?: Record<string, {type: string; src: string}>},
      docDir,
    );
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }

  let warnings: string[] = [];
  try {
    warnings = compileDocument(validation.doc, resolved).warnings;
  } catch (error) {
    console.error(`Could not compile document: ${(error as Error).message}`);
    process.exit(1);
  }

  // Every lipsync asset, not only the one the cast happens to wear: a track
  // committed beside the document is a claim about this document's audio.
  const tracks: CheckedCue[][] = Object.values(resolved.lipsync).map(track =>
    visemeTrackSchema.parse(track).cues.map(cue => ({...cue})),
  );

  let audio;
  const audioAsset =
    doc.narration?.audio === undefined
      ? undefined
      : doc.assets?.[doc.narration.audio];
  if (options.audio !== false && audioAsset?.type === 'audio') {
    const audioPath = path.resolve(docDir, audioAsset.src);
    try {
      audio = await measureAudio(audioPath, {
        ffmpeg: await resolveBinary(
          options.ffmpeg,
          'FFMPEG_PATH',
          '@ffmpeg-installer/ffmpeg',
          'ffmpeg',
        ),
        ffprobe: await resolveBinary(
          options.ffprobe,
          'FFPROBE_PATH',
          '@ffprobe-installer/ffprobe',
          'ffprobe',
        ),
      });
    } catch (error) {
      // A missing encoder must not turn every other rule off silently.
      console.error(
        `warning: audio rules skipped — ${(error as Error).message}`,
      );
    }
  }

  const findings = collectFindings({doc, tracks, audio, warnings});
  report(findings, options.strict === true, audio !== undefined);
  if (findings.length > 0 && options.strict === true) {
    process.exit(1);
  }
}

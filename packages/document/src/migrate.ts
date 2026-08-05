import {DOCUMENT_FORMAT_VERSION} from './index.js';

export class MigrationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'MigrationError';
  }
}

type RawDocument = Record<string, unknown>;
type Migration = {to: string; migrate: (doc: RawDocument) => RawDocument};

/**
 * Version-keyed migration chain. When format 0.2 lands, register
 * `'0.1': {to: '0.2', migrate: doc => ({...})}` here — documents are walked
 * version by version until they reach DOCUMENT_FORMAT_VERSION.
 */
const MIGRATIONS: Record<string, Migration> = {};

export interface MigrateResult {
  doc: RawDocument;
  /** Version hops applied, e.g. ['0.1→0.2']. Empty when already current. */
  applied: string[];
}

export function migrateDocument(input: unknown): MigrateResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new MigrationError('document must be a JSON object');
  }
  let doc = input as RawDocument;
  const applied: string[] = [];
  for (;;) {
    const version = doc.version;
    if (typeof version !== 'string') {
      throw new MigrationError('document has no string "version" field');
    }
    if (version === DOCUMENT_FORMAT_VERSION) {
      return {doc, applied};
    }
    const migration = MIGRATIONS[version];
    if (migration === undefined) {
      throw new MigrationError(
        `unknown document version "${version}" — this build understands ` +
          `${DOCUMENT_FORMAT_VERSION} and can migrate from: ` +
          `${Object.keys(MIGRATIONS).join(', ') || '(none yet)'}`,
      );
    }
    doc = {...migration.migrate(doc), version: migration.to};
    applied.push(`${version}→${migration.to}`);
  }
}

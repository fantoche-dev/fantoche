import { DOCUMENT_FORMAT_VERSION } from './version.js';
export class MigrationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'MigrationError';
    }
}
/**
 * Version-keyed migration chain. When format 0.2 lands, register
 * `'0.1': {to: '0.2', migrate: doc => ({...})}` here — documents are walked
 * version by version until they reach DOCUMENT_FORMAT_VERSION.
 */
const MIGRATIONS = {};
export function migrateDocument(input) {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
        throw new MigrationError('document must be a JSON object');
    }
    let doc = input;
    const applied = [];
    const visited = new Set();
    for (;;) {
        const version = doc.version;
        if (typeof version !== 'string') {
            throw new MigrationError('document has no string "version" field');
        }
        if (version === DOCUMENT_FORMAT_VERSION) {
            return { doc, applied };
        }
        if (visited.has(version)) {
            throw new MigrationError(`migration cycle detected at version "${version}"`);
        }
        visited.add(version);
        const migration = MIGRATIONS[version];
        if (migration === undefined) {
            throw new MigrationError(`unknown document version "${version}" — this build understands ` +
                `${DOCUMENT_FORMAT_VERSION} and can migrate from: ` +
                `${Object.keys(MIGRATIONS).join(', ') || '(none yet)'}`);
        }
        doc = { ...migration.migrate(doc), version: migration.to };
        applied.push(`${version}→${migration.to}`);
    }
}
//# sourceMappingURL=migrate.js.map
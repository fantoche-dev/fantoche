export declare class MigrationError extends Error {
    constructor(message: string);
}
type RawDocument = Record<string, unknown>;
export interface MigrateResult {
    doc: RawDocument;
    /** Version hops applied, e.g. ['0.1→0.2']. Empty when already current. */
    applied: string[];
}
export declare function migrateDocument(input: unknown): MigrateResult;
export {};
//# sourceMappingURL=migrate.d.ts.map
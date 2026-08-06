type JsonObject = Record<string, unknown>;
/**
 * The published JSON Schema for the document format — the artifact agents
 * and editors point their validators at. Emitted to
 * `schema/document-<version>.schema.json` by `npm run schema:emit`; a test
 * pins the committed artifact to this function's output.
 *
 * zod's emitter drops some constraints, so this post-processes the output:
 * exact tuple lengths, the svg/edit exactly-one-of rules, a stable `$defs`
 * name for the recursive element, and `$id`/`title`. The anchor grammar
 * survives natively (it is a `.regex()`, emitted as `pattern`).
 */
export declare function documentJsonSchema(): JsonObject;
export {};
//# sourceMappingURL=json-schema.d.ts.map
import { z } from 'zod';
import { documentSchema } from './schema.js';
import { DOCUMENT_FORMAT_VERSION } from './version.js';
const SCHEMA_ID = `https://raw.githubusercontent.com/fantoche-dev/fantoche/main/packages/document/schema/document-${DOCUMENT_FORMAT_VERSION}.schema.json`;
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
export function documentJsonSchema() {
    const schema = z.toJSONSchema(documentSchema, {
        target: 'draft-2020-12',
        io: 'input',
    });
    walk(schema, node => {
        // zod emits tuples as bare prefixItems — pin their exact length.
        if (Array.isArray(node.prefixItems) && node.items === undefined) {
            node.items = false;
            node.minItems = node.prefixItems.length;
            node.maxItems = node.prefixItems.length;
        }
        const properties = node.properties;
        if (properties !== undefined) {
            // svg props: exactly one of svg/src (a zod .refine the emitter drops).
            if ('svg' in properties &&
                'src' in properties &&
                !('type' in properties)) {
                node.oneOf = [
                    { required: ['svg'], not: { required: ['src'] } },
                    { required: ['src'], not: { required: ['svg'] } },
                ];
            }
            // edit: exactly one operation.
            const editOps = ['to', 'replace', 'insert', 'remove'];
            if (editOps.every(op => op in properties) && !('at' in properties)) {
                node.oneOf = editOps.map(op => ({
                    required: [op],
                    not: {
                        anyOf: editOps
                            .filter(other => other !== op)
                            .map(other => ({ required: [other] })),
                    },
                }));
            }
        }
    });
    // Stable name for the recursive element definition.
    const defs = schema.$defs;
    if (defs !== undefined) {
        const generated = Object.keys(defs).filter(key => /^__schema\d+$/.test(key));
        if (generated.length === 1) {
            defs.element = defs[generated[0]];
            delete defs[generated[0]];
            walk(schema, node => {
                if (node.$ref === `#/$defs/${generated[0]}`) {
                    node.$ref = '#/$defs/element';
                }
            });
        }
    }
    return {
        $id: SCHEMA_ID,
        title: `Fantoche document format ${DOCUMENT_FORMAT_VERSION}`,
        ...schema,
    };
}
function walk(node, visit) {
    if (Array.isArray(node)) {
        for (const entry of node) {
            walk(entry, visit);
        }
        return;
    }
    if (typeof node === 'object' && node !== null) {
        visit(node);
        for (const value of Object.values(node)) {
            walk(value, visit);
        }
    }
}
//# sourceMappingURL=json-schema.js.map
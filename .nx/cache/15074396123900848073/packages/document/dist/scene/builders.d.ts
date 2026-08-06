import type { Node } from '@fantoche-dev/2d';
import type { CompiledElement } from '../ir.js';
export type AssetMap = Record<string, {
    type: string;
    src: string;
}>;
/**
 * Construct the 2d node for a compiled element. Nodes get `key: element.id`
 * so the scene's node registry resolves document ids directly. Props pass
 * through by name — the schema already whitelists them per element type.
 */
export declare function buildElement(element: CompiledElement, assets: AssetMap): Node;
/**
 * Imperatively set one animated prop. Signals are invokable properties, so
 * `node[prop](value)` is a synchronous set; unknown props warn via the
 * returned flag so the scene can log once per (element, prop).
 */
export declare function applyProp(node: Node, prop: string, value: unknown): boolean;
//# sourceMappingURL=builders.d.ts.map
import type {Node} from '@fantoche-dev/2d';
import {
  Circle,
  Code,
  Img,
  Latex,
  Layout,
  Line,
  Path,
  Polygon,
  Rect,
  SVG,
  Txt,
} from '@fantoche-dev/2d';
import type {CompiledElement} from '../ir.js';

export type AssetMap = Record<string, {type: string; src: string}>;

/**
 * Construct the 2d node for a compiled element. Nodes get `key: element.id`
 * so the scene's node registry resolves document ids directly. Props pass
 * through by name — the schema already whitelists them per element type.
 */
export function buildElement(element: CompiledElement, assets: AssetMap): Node {
  const props = {...element.props, key: element.id};
  switch (element.type) {
    case 'text': {
      const {text, ...rest} = props as unknown as {text: string} & Record<
        string,
        unknown
      >;
      return new Txt({...rest, text});
    }
    case 'rect':
      return new Rect(props);
    case 'circle':
      return new Circle(props);
    case 'line':
      return new Line(props as ConstructorParameters<typeof Line>[0]);
    case 'path':
      return new Path(props as ConstructorParameters<typeof Path>[0]);
    case 'polygon':
      return new Polygon(props);
    case 'image': {
      const {src, ...rest} = props as unknown as {src: string} & Record<
        string,
        unknown
      >;
      return new Img({...rest, src: assets[src]?.src ?? src});
    }
    case 'svg': {
      const {svg, src, ...rest} = props as {
        svg?: string;
        src?: string;
      } & Record<string, unknown>;
      if (svg === undefined) {
        throw new Error(
          `svg element "${element.id}": asset-file sources (src: "${src}") ` +
            'are not supported by the v0 runtime yet — inline the markup in props.svg',
        );
      }
      return new SVG({...rest, svg});
    }
    case 'latex':
      return new Latex(props as ConstructorParameters<typeof Latex>[0]);
    case 'code': {
      const {
        code,
        selection: _selection,
        ...rest
      } = props as unknown as {
        code: string;
        selection?: unknown;
      } & Record<string, unknown>;
      // The initial selection is applied by applyCodeState at t=0.
      return new Code({...rest, code});
    }
    case 'layout':
      return new Layout({...props, layout: true});
    default:
      throw new Error(
        `element "${element.id}" has unknown type "${element.type}"`,
      );
  }
}

/**
 * Imperatively set one animated prop. Signals are invokable properties, so
 * `node[prop](value)` is a synchronous set; unknown props warn via the
 * returned flag so the scene can log once per (element, prop).
 */
export function applyProp(node: Node, prop: string, value: unknown): boolean {
  const signal = (node as unknown as Record<string, unknown>)[prop];
  // Signals are invokable objects carrying a context — plain methods
  // (dispose, remove, …) are not, and must never be callable from documents.
  if (typeof signal !== 'function' || !('context' in signal)) {
    return false;
  }
  (signal as unknown as (value: unknown) => void).call(node, value);
  return true;
}

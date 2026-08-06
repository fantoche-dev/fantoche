import { Circle, Code, Img, Latex, Layout, Line, Path, Polygon, Rect, SVG, Txt, } from '@fantoche-dev/2d';
/**
 * Construct the 2d node for a compiled element. Nodes get `key: element.id`
 * so the scene's node registry resolves document ids directly. Props pass
 * through by name — the schema already whitelists them per element type.
 */
export function buildElement(element, assets) {
    const props = { ...element.props, key: element.id };
    switch (element.type) {
        case 'text': {
            const { text, ...rest } = props;
            return new Txt({ ...rest, text });
        }
        case 'rect':
            return new Rect(props);
        case 'circle':
            return new Circle(props);
        case 'line':
            return new Line(props);
        case 'path':
            return new Path(props);
        case 'polygon':
            return new Polygon(props);
        case 'image': {
            const { src, ...rest } = props;
            return new Img({ ...rest, src: assets[src]?.src ?? src });
        }
        case 'svg': {
            const { svg, src, ...rest } = props;
            if (svg === undefined) {
                throw new Error(`svg element "${element.id}": asset-file sources (src: "${src}") ` +
                    'are not supported by the v0 runtime yet — inline the markup in props.svg');
            }
            return new SVG({ ...rest, svg });
        }
        case 'latex':
            return new Latex(props);
        case 'code': {
            const { code, selection: _selection, ...rest } = props;
            // The initial selection is applied by applyCodeState at t=0.
            return new Code({ ...rest, code });
        }
        case 'layout':
            return new Layout({ ...props, layout: true });
        default:
            throw new Error(`element "${element.id}" has unknown type "${element.type}"`);
    }
}
/**
 * Imperatively set one animated prop. Signals are invokable properties, so
 * `node[prop](value)` is a synchronous set; unknown props warn via the
 * returned flag so the scene can log once per (element, prop).
 */
export function applyProp(node, prop, value) {
    const signal = node[prop];
    if (typeof signal !== 'function') {
        return false;
    }
    signal.call(node, value);
    return true;
}
//# sourceMappingURL=builders.js.map
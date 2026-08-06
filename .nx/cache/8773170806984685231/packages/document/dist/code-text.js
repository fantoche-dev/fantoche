export class CodeRangeError extends Error {
    constructor(message) {
        super(message);
        this.name = 'CodeRangeError';
    }
}
function pointToIndex(code, point) {
    const [line, column] = point;
    const lines = code.split('\n');
    if (line === Infinity || line >= lines.length) {
        return code.length;
    }
    let index = 0;
    for (let i = 0; i < line; i++) {
        index += lines[i].length + 1;
    }
    const lineLength = lines[line].length;
    return (index + (column === Infinity ? lineLength : Math.min(column, lineLength)));
}
export function rangeToIndices(code, range) {
    const from = pointToIndex(code, range[0]);
    const to = pointToIndex(code, range[1]);
    return from <= to ? [from, to] : [to, from];
}
function indexToPoint(code, index) {
    const before = code.slice(0, index);
    const line = (before.match(/\n/g) ?? []).length;
    const lastNewline = before.lastIndexOf('\n');
    return [line, index - lastNewline - 1];
}
/** Expand a schema RangeSpec (with null sentinels) against a code string. */
export function resolveRangeSpec(spec, code) {
    if ('lines' in spec) {
        const [from, to] = spec.lines;
        return [
            [
                [from, 0],
                [to === null ? Infinity : to, Infinity],
            ],
        ];
    }
    if ('word' in spec) {
        const [line, column, length] = spec.word.length === 3 ? spec.word : [...spec.word, null];
        return [
            [
                [line, column],
                [
                    line,
                    length === null || length === undefined ? Infinity : column + length,
                ],
            ],
        ];
    }
    const matches = [];
    let searchIndex = 0;
    for (;;) {
        const found = code.indexOf(spec.match, searchIndex);
        if (found === -1) {
            break;
        }
        matches.push([
            indexToPoint(code, found),
            indexToPoint(code, found + spec.match.length),
        ]);
        searchIndex = found + Math.max(spec.match.length, 1);
    }
    if (matches.length === 0) {
        throw new CodeRangeError(`pattern "${spec.match}" not found in code`);
    }
    switch (spec.which) {
        case 'all':
            return matches;
        case 'last':
            return [matches[matches.length - 1]];
        default:
            return [matches[0]];
    }
}
export function applyReplace(code, range, text) {
    const [from, to] = rangeToIndices(code, range);
    return code.slice(0, from) + text + code.slice(to);
}
export function applyInsert(code, point, text) {
    const index = pointToIndex(code, point);
    return code.slice(0, index) + text + code.slice(index);
}
//# sourceMappingURL=code-text.js.map
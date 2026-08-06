import { documentSchema } from './schema.js';
export function validateDocument(input) {
    const result = documentSchema.safeParse(input);
    if (result.success) {
        return { ok: true, doc: result.data };
    }
    return { ok: false, errors: flattenIssues(result.error) };
}
/**
 * Flatten zod issues to path+message pairs. Union failures report only the
 * branch(es) with the fewest problems — the branch the author most likely
 * meant — instead of the full wall of every branch's complaints.
 */
function flattenIssues(error) {
    const out = flatten(error.issues, []);
    const seen = new Set();
    return out.filter(entry => {
        const key = `${entry.path}\u0000${entry.message}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}
function flatten(issues, prefix) {
    const out = [];
    for (const issue of issues) {
        const path = [...prefix, ...issue.path];
        const unionErrors = issue.errors;
        if (issue.code === 'invalid_union' &&
            Array.isArray(unionErrors) &&
            unionErrors.length > 0) {
            const branches = unionErrors
                .map(branch => flatten(branch, path))
                .filter(branch => branch.length > 0);
            if (branches.length === 0) {
                out.push(toError(path, issue.message));
                continue;
            }
            const minLength = Math.min(...branches.map(branch => branch.length));
            for (const branch of branches) {
                if (branch.length === minLength) {
                    out.push(...branch);
                }
            }
        }
        else {
            out.push(toError(path, issue.message));
        }
    }
    return out;
}
function toError(path, message) {
    return { path: `/${path.map(String).join('/')}`, message };
}
//# sourceMappingURL=validate.js.map
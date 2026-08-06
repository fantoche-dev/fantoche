export declare class AnchorError extends Error {
    constructor(message: string);
}
interface NarrationWordsInput {
    text: string;
    start: number;
    dur?: number;
}
interface NarrationSegmentInput {
    id: string;
    text: string;
    start: number;
    dur: number;
    words?: NarrationWordsInput[];
}
export interface NarrationIndex {
    segments: Map<string, {
        start: number;
        end: number;
        /** word text → starts of every occurrence, in narration order. */
        words: Map<string, number[]> | null;
    }>;
}
export declare function buildNarrationIndex(narration: {
    segments: NarrationSegmentInput[];
} | undefined): NarrationIndex;
export interface ResolvedTime {
    seconds: number;
    warnings: string[];
}
export declare function resolveTimeRef(ref: number | string, index: NarrationIndex): ResolvedTime;
export {};
//# sourceMappingURL=anchors.d.ts.map
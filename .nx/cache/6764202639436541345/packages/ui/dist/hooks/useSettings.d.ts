export declare function useSharedSettings(): {
    background: import('@fantoche/core').Color;
    range: [number, number];
    size: import('@fantoche/core').Vector2;
};
export declare function usePreviewSettings(): {
    background: import('@fantoche/core').Color;
    range: [number, number];
    size: import('@fantoche/core').Vector2;
} & {
    fps: number;
    resolutionScale: number;
};
export declare function useRenderingSettings(): {
    background: import('@fantoche/core').Color;
    range: [number, number];
    size: import('@fantoche/core').Vector2;
} & {
    exporter: import('@fantoche/core').ExporterSettings;
    fps: number;
    resolutionScale: number;
    colorSpace: import('@fantoche/core').CanvasColorSpace;
};
//# sourceMappingURL=useSettings.d.ts.map
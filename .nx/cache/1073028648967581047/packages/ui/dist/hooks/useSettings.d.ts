export declare function useSharedSettings(): {
    background: import('@fantoche-dev/core').Color;
    range: [number, number];
    size: import('@fantoche-dev/core').Vector2;
};
export declare function usePreviewSettings(): {
    background: import('@fantoche-dev/core').Color;
    range: [number, number];
    size: import('@fantoche-dev/core').Vector2;
} & {
    fps: number;
    resolutionScale: number;
};
export declare function useRenderingSettings(): {
    background: import('@fantoche-dev/core').Color;
    range: [number, number];
    size: import('@fantoche-dev/core').Vector2;
} & {
    exporter: import('@fantoche-dev/core').ExporterSettings;
    fps: number;
    resolutionScale: number;
    colorSpace: import('@fantoche-dev/core').CanvasColorSpace;
};
//# sourceMappingURL=useSettings.d.ts.map
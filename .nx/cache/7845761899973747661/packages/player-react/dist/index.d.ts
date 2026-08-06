import type { Player as CorePlayer, Project } from '@fantoche/core';
import type * as React from 'react';
import './index.css';
interface RevideoPlayerProps {
    playing?: string;
    variables?: string;
    looping?: string;
    width?: number;
    height?: number;
    quality?: number;
    fps?: number;
    volume?: number;
}
declare module 'react' {
    namespace JSX {
        interface IntrinsicElements {
            'revideo-player': RevideoPlayerProps & React.ComponentProps<'div'>;
        }
    }
}
interface PlayerProps {
    project: Project;
    controls?: boolean;
    variables?: Record<string, any>;
    playing?: boolean;
    currentTime?: number;
    volume?: number;
    looping?: boolean;
    fps?: number;
    width?: number;
    height?: number;
    quality?: number;
    timeDisplayFormat?: 'MM:SS' | 'MM:SS.mm' | 'MM:SS.m';
    onDurationChange?: (duration: number) => void;
    onTimeUpdate?: (currentTime: number) => void;
    onPlayerReady?: (player: CorePlayer) => void;
    onPlayerResize?: (rect: DOMRectReadOnly) => void;
}
export declare function Player({ project, controls, variables, playing, currentTime, volume, looping, fps, width, height, quality, timeDisplayFormat, onDurationChange, onTimeUpdate, onPlayerReady, onPlayerResize, }: PlayerProps): React.JSX.Element;
export {};
//# sourceMappingURL=index.d.ts.map
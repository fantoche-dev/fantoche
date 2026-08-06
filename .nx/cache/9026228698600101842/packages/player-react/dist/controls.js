import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { MutedSoundIcon, PauseButton, PlayButton, SoundIcon } from './icons';
import { getFormattedTime } from './utils';
function PlayPause({ playing, setPlaying, }) {
    return (_jsx("button", { type: "button", className: "p-1", onClick: () => setPlaying(!playing), children: playing ? _jsx(PauseButton, {}) : _jsx(PlayButton, {}) }));
}
function VolumeSlider({ volume, setVolume, }) {
    const [isHovering, setIsHovering] = useState(false);
    const [isInteracting, setIsInteracting] = useState(false);
    const [previousVolume, setPreviousVolume] = useState(1);
    const handleIconClick = () => {
        if (volume > 0) {
            setPreviousVolume(volume);
            setVolume(0);
        }
        else {
            setVolume(previousVolume);
        }
    };
    return (_jsxs("div", { className: "flex items-center space-x-2 relative", onMouseEnter: () => setIsHovering(true), onMouseLeave: () => {
            if (!isInteracting) {
                setIsHovering(false);
            }
        }, children: [_jsx("div", { className: "w-6 h-6 flex items-center justify-center cursor-pointer", onClick: handleIconClick, children: volume === 0 ? _jsx(MutedSoundIcon, {}) : _jsx(SoundIcon, {}) }), (isHovering || isInteracting) && (_jsx("div", { className: "flex items-center h-1.5 whitespace-nowrap", children: _jsxs("div", { className: "relative w-20 h-1.5 bg-gray-300 rounded-full", children: [_jsx("div", { className: "absolute top-0 left-0 h-full bg-gray-100 rounded-full", style: { width: `${volume * 100}%` } }), _jsx("input", { type: "range", min: 0, max: 1, step: 0.01, value: volume, onChange: e => {
                                const newVolume = Number(e.target.value);
                                setVolume(newVolume);
                                if (newVolume > 0) {
                                    setPreviousVolume(newVolume);
                                }
                            }, onMouseDown: () => setIsInteracting(true), onMouseUp: () => setIsInteracting(false), onMouseLeave: () => setIsInteracting(false), className: "absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer" })] }) }))] }));
}
function Timeline({ currentTime, duration, setCurrentTime, }) {
    const progressPercentage = (currentTime / duration) * 100;
    return (_jsxs("div", { className: "relative flex-1 w-full h-1.5 bg-gray-300 rounded-full overflow-hidden", children: [_jsx("div", { className: "absolute top-0 left-0 h-full bg-gray-100", style: { width: `${progressPercentage}%` } }), _jsx("input", { type: "range", value: currentTime, min: 0, max: duration, step: 0.01, className: "absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer", onChange: event => setCurrentTime(Number(event.target.value)) })] }));
}
export function Controls({ duration, playing, setPlaying, currentTime, setForcedTime, timeDisplayFormat, volume, setVolume, }) {
    return (_jsxs("div", { className: "text-white p-4 flex-col space-y-2 bg-gradient-to-t from-gray-500 to-transparent", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(PlayPause, { playing: playing, setPlaying: setPlaying }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(VolumeSlider, { volume: volume, setVolume: setVolume }), _jsx("div", { children: _jsx("span", { children: getFormattedTime(currentTime, duration, timeDisplayFormat) }) })] }), _jsx("div", { className: "flex-grow" })] }), _jsx(Timeline, { currentTime: currentTime, duration: duration, setCurrentTime: setForcedTime })] }));
}
//# sourceMappingURL=controls.js.map
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoFrameExtractor = void 0;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const uuid_1 = require("uuid");
const settings_1 = require("./settings");
const utils_1 = require("./utils");
const ffmpeg = require("fluent-ffmpeg");
/**
 * Walks through a video file and extracts frames.
 */
class VideoFrameExtractor {
    constructor(filePath, startTime, fps, duration) {
        this.ffmpegPath = settings_1.ffmpegSettings.getFfmpegPath();
        this.buffer = Buffer.alloc(0);
        this.bufferOffset = 0;
        // Images are buffered in memory until they are requested.
        this.imageBuffers = [];
        this.lastImage = null;
        this.framesProcessed = 0;
        this.width = 0;
        this.height = 0;
        this.frameSize = 0;
        this.codec = null;
        this.process = null;
        this.terminated = false;
        this.state = 'processing';
        this.filePath = filePath;
        this.downloadedFilePath = VideoFrameExtractor.downloadedVideoMap.get(filePath)?.localPath;
        this.startTimeOffset = VideoFrameExtractor.downloadedVideoMap.get(filePath)
            ?.startTimeOffset;
        this.startTime = startTime;
        this.duration = duration;
        this.toTime = this.getEndTime(this.startTime);
        this.fps = fps;
        (0, utils_1.getVideoMetadata)(this.downloadedFilePath).then(metadata => {
            this.width = metadata.width;
            this.height = metadata.height;
            this.frameSize = this.width * this.height * 4;
            this.buffer = Buffer.alloc(this.frameSize);
            this.codec = metadata.codec;
            if (this.startTime >= this.duration) {
                this.process = this.createFfmpegProcessToExtractFirstFrame(this.downloadedFilePath, this.codec);
                return;
            }
            this.process = this.createFfmpegProcess(this.startTime - this.startTimeOffset, this.toTime, this.downloadedFilePath, this.fps, this.codec);
        });
    }
    static downloadVideoChunk(url, startTime, endTime) {
        const outputDir = path.join(os.tmpdir(), `revideo-decoder-chunks`);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(url, (err, metadata) => {
                if (err) {
                    reject(err);
                    return;
                }
                const format = metadata.format.format_name?.split(',')[-1] || 'mp4';
                const outputFileName = `chunk_${(0, uuid_1.v4)()}.${format}`;
                const outputPath = path.join(outputDir, outputFileName);
                const toleranceInSeconds = 0.5;
                const adjustedStartTime = Math.max(startTime - toleranceInSeconds, 0);
                ffmpeg(url)
                    .setFfmpegPath(settings_1.ffmpegSettings.getFfmpegPath())
                    .inputOptions([
                    `-ss ${adjustedStartTime}`,
                    `-to ${endTime + toleranceInSeconds}`,
                ])
                    .outputOptions(['-c copy'])
                    .output(outputPath)
                    .on('end', () => {
                    this.downloadedVideoMap.set(url, {
                        localPath: outputPath,
                        startTimeOffset: adjustedStartTime,
                    });
                    resolve(outputPath);
                })
                    .on('error', err => reject(err))
                    .run();
            });
        });
    }
    getTime() {
        return this.startTime + this.framesProcessed / this.fps;
    }
    getLastTime() {
        return this.startTime + (this.framesProcessed - 1) / this.fps;
    }
    getLastFrame() {
        return this.lastImage;
    }
    getWidth() {
        return this.width;
    }
    getHeight() {
        return this.height;
    }
    getEndTime(startTime) {
        return Math.min(startTime + VideoFrameExtractor.chunkLengthInSeconds, this.duration);
    }
    getArgs(codec, range, fps) {
        const inputOptions = [];
        const outputOptions = [];
        inputOptions.push('-loglevel', settings_1.ffmpegSettings.getLogLevel());
        if (range) {
            inputOptions.push(...['-ss', range[0].toFixed(2), '-to', range[1].toFixed(2)]);
        }
        if (codec === 'vp9') {
            inputOptions.push('-vcodec', 'libvpx-vp9');
        }
        if (fps) {
            outputOptions.push('-vf', `fps=fps=${fps}`);
        }
        if (!range) {
            outputOptions.push('-vframes', '1');
        }
        outputOptions.push('-f', 'rawvideo');
        outputOptions.push('-pix_fmt', 'rgba');
        return { inputOptions, outputOptions };
    }
    createFfmpegProcess(startTime, toTime, filePath, fps, codec) {
        const { inputOptions, outputOptions } = this.getArgs(codec, [startTime, toTime], fps);
        const process = ffmpeg(filePath)
            .setFfmpegPath(this.ffmpegPath)
            .inputOptions(inputOptions)
            .outputOptions(outputOptions)
            .on('end', () => {
            this.handleClose(0);
        })
            .on('error', err => {
            this.handleError(err);
        })
            .on('stderr', stderrLine => {
            console.log(stderrLine);
        });
        const ffstream = process.pipe();
        ffstream.on('data', (data) => {
            this.processData(data);
        });
        return process;
    }
    /**
     * We call this in the case that the time requested is greater than the
     * duration of the video. In this case, we want to display the first frame
     * of the video.
     *
     * Note: This does NOT match the behavior of the old implementation
     * inside of 2d/src/lib/components/Video.ts. In the old implementation, the
     * last frame is shown instead of the first frame.
     */
    createFfmpegProcessToExtractFirstFrame(filePath, codec) {
        const { inputOptions, outputOptions } = this.getArgs(codec, undefined, undefined);
        const process = ffmpeg(filePath)
            .setFfmpegPath(this.ffmpegPath)
            .inputOptions(inputOptions)
            .outputOptions(outputOptions)
            .on('end', () => {
            this.handleClose(0);
        })
            .on('error', err => {
            this.handleError(err);
        })
            .on('stderr', stderrLine => {
            console.log(stderrLine);
        });
        const ffstream = process.pipe();
        ffstream.on('data', (data) => {
            this.processData(data);
        });
        return process;
    }
    processData(data) {
        let dataOffset = 0;
        while (dataOffset < data.length) {
            const remainingSpace = this.frameSize - this.bufferOffset;
            const chunkSize = Math.min(remainingSpace, data.length - dataOffset);
            data.copy(this.buffer, this.bufferOffset, dataOffset, dataOffset + chunkSize);
            this.bufferOffset += chunkSize;
            dataOffset += chunkSize;
            // We have a complete frame
            if (this.bufferOffset === this.frameSize) {
                this.imageBuffers.push(Buffer.from(this.buffer)); // Create a copy
                this.bufferOffset = 0; // Reset buffer for next frame
            }
        }
    }
    async popImage() {
        if (this.imageBuffers.length) {
            const image = this.imageBuffers.shift();
            this.framesProcessed++;
            this.lastImage = image;
            return image;
        }
        if (this.state === 'error') {
            throw new Error('An error occurred while extracting the video frames.');
        }
        // If the video is done and there are no more frames to extract, return the last frame.
        if (this.state === 'done' && this.toTime >= this.duration) {
            return this.lastImage;
        }
        // If there are more frames to extract, request the next chunk.
        if (this.state === 'done') {
            this.startTime = this.toTime;
            this.toTime = Math.min(this.startTime + VideoFrameExtractor.chunkLengthInSeconds, this.duration);
            if (!this.codec) {
                throw new Error("Can't extract frames without a codec. This error should never happen.");
            }
            this.process = this.createFfmpegProcess(this.startTime, this.toTime, this.downloadedFilePath, this.fps, this.codec);
            this.state = 'processing';
        }
        while (this.imageBuffers.length < 1) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        const image = this.imageBuffers.shift();
        this.framesProcessed++;
        this.lastImage = image;
        return image;
    }
    handleClose(code) {
        this.state = code === 0 ? 'done' : 'error';
    }
    async handleError(err) {
        const code = err.code;
        if (this.terminated) {
            return;
        }
        if (code === 'ENOENT') {
            throw new Error('Error: ffmpeg not found. Make sure ffmpeg is installed on your system.');
        }
        else if (err.message.includes('SIGSEGV')) {
            throw new Error(`Error: Segmentation fault when running ffmpeg. This is a common issue on Linux, you might be able to fix it by installing nscd ('sudo apt-get install nscd'). For more information, see https://docs.re.video/common-issues/ffmpeg/`);
        }
        else {
            throw new Error(`An ffmpeg error occurred while fetching frames from source video ${this.filePath}: ${err}`);
        }
    }
    destroy() {
        this.terminated = true;
        this.process?.kill('SIGTERM');
    }
}
exports.VideoFrameExtractor = VideoFrameExtractor;
VideoFrameExtractor.chunkLengthInSeconds = 5;
VideoFrameExtractor.downloadedVideoMap = new Map();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlkZW8tZnJhbWUtZXh0cmFjdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL3ZpZGVvLWZyYW1lLWV4dHJhY3Rvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSx1Q0FBeUI7QUFDekIsdUNBQXlCO0FBQ3pCLDJDQUE2QjtBQUM3QiwrQkFBa0M7QUFDbEMseUNBQTBDO0FBQzFDLG1DQUF5QztBQUN6Qyx3Q0FBeUM7QUFJekM7O0dBRUc7QUFDSCxNQUFhLG1CQUFtQjtJQW1DOUIsWUFDRSxRQUFnQixFQUNoQixTQUFpQixFQUNqQixHQUFXLEVBQ1gsUUFBZ0I7UUFwQ0QsZUFBVSxHQUFHLHlCQUFjLENBQUMsYUFBYSxFQUFFLENBQUM7UUFNckQsV0FBTSxHQUFXLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDakMsaUJBQVksR0FBVyxDQUFDLENBQUM7UUFFakMsMERBQTBEO1FBQ2xELGlCQUFZLEdBQWEsRUFBRSxDQUFDO1FBQzVCLGNBQVMsR0FBa0IsSUFBSSxDQUFDO1FBT2hDLG9CQUFlLEdBQVcsQ0FBQyxDQUFDO1FBRTVCLFVBQUssR0FBVyxDQUFDLENBQUM7UUFDbEIsV0FBTSxHQUFXLENBQUMsQ0FBQztRQUNuQixjQUFTLEdBQVcsQ0FBQyxDQUFDO1FBQ3RCLFVBQUssR0FBa0IsSUFBSSxDQUFDO1FBQzVCLFlBQU8sR0FBZ0MsSUFBSSxDQUFDO1FBQzVDLGVBQVUsR0FBWSxLQUFLLENBQUM7UUFhbEMsSUFBSSxDQUFDLEtBQUssR0FBRyxZQUFZLENBQUM7UUFDMUIsSUFBSSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7UUFDekIsSUFBSSxDQUFDLGtCQUFrQixHQUFHLG1CQUFtQixDQUFDLGtCQUFrQixDQUFDLEdBQUcsQ0FDbEUsUUFBUSxDQUNULEVBQUUsU0FBbUIsQ0FBQztRQUN2QixJQUFJLENBQUMsZUFBZSxHQUFHLG1C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
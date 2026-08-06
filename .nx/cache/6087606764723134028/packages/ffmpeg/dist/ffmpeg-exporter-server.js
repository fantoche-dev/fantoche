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
exports.FFmpegExporterServer = exports.extensions = void 0;
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const image_stream_1 = require("./image-stream");
const settings_1 = require("./settings");
const ffmpeg = require("fluent-ffmpeg");
const pixelFormats = {
    mp4: 'yuv420p',
    webm: 'yuva420p',
    proRes: 'yuva444p10le',
};
exports.extensions = {
    mp4: 'mp4',
    webm: 'webm',
    proRes: 'mov',
};
/**
 * The server-side implementation of the FFmpeg video exporter.
 */
class FFmpegExporterServer {
    constructor(settings) {
        if (settings.exporter.name !== '@fantoche-dev/core/ffmpeg') {
            throw new Error('Invalid exporter');
        }
        this.settings = settings;
        this.format = settings.exporter.options.format;
        this.jobFolder = path.join(os.tmpdir(), `revideo-${this.settings.name}-${settings.hiddenFolderId}`);
        this.stream = new image_stream_1.ImageStream();
        ffmpeg.setFfmpegPath(settings_1.ffmpegSettings.getFfmpegPath());
        this.command = ffmpeg();
        // Input image sequence
        this.command
            .input(this.stream)
            .inputFormat('image2pipe')
            .inputFps(settings.fps);
        // Output settings
        const size = {
            x: Math.round(settings.size.x * settings.resolutionScale),
            y: Math.round(settings.size.y * settings.resolutionScale),
        };
        this.command
            .output(path.join(this.jobFolder, `visuals.${exports.extensions[this.format]}`))
            .outputOptions([`-pix_fmt ${pixelFormats[this.format]}`, '-shortest'])
            .outputFps(settings.fps)
            .size(`${size.x}x${size.y}`);
        if (this.format === 'proRes') {
            this.command.outputOptions(['-c:v prores_ks', '-profile:v 4444']);
        }
        this.command.outputOptions(['-movflags +faststart']);
        this.promise = new Promise((resolve, reject) => {
            this.command.on('end', () => resolve()).on('error', reject);
        });
    }
    async start() {
        this.command.run();
    }
    async handleFrame({ data }) {
        const base64Data = data.slice(data.indexOf(',') + 1);
        this.stream.pushImage(Buffer.from(base64Data, 'base64'));
    }
    async end(result) {
        this.stream.pushImage(null);
        if (result === 1) {
            try {
                this.command.kill('SIGKILL');
                await this.promise;
            }
            catch {
                // ignore errors caused by killing the ffmpeg process
            }
        }
        else {
            await this.promise;
        }
    }
    async kill() {
        try {
            this.command.kill('SIGKILL');
            await this.promise;
        }
        catch (_) {
            return;
        }
    }
}
exports.FFmpegExporterServer = FFmpegExporterServer;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmZtcGVnLWV4cG9ydGVyLXNlcnZlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9mZm1wZWctZXhwb3J0ZXItc2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUtBLHVDQUF5QjtBQUN6QiwyQ0FBNkI7QUFDN0IsaURBQTJDO0FBQzNDLHlDQUEwQztBQUMxQyx3Q0FBeUM7QUFRekMsTUFBTSxZQUFZLEdBQW9EO0lBQ3BFLEdBQUcsRUFBRSxTQUFTO0lBQ2QsSUFBSSxFQUFFLFVBQVU7SUFDaEIsTUFBTSxFQUFFLGNBQWM7Q0FDdkIsQ0FBQztBQUVXLFFBQUEsVUFBVSxHQUFvRDtJQUN6RSxHQUFHLEVBQUUsS0FBSztJQUNWLElBQUksRUFBRSxNQUFNO0lBQ1osTUFBTSxFQUFFLEtBQUs7Q0FDZCxDQUFDO0FBRUY7O0dBRUc7QUFDSCxNQUFhLG9CQUFvQjtJQVEvQixZQUFtQixRQUFnQztRQUNqRCxJQUFJLFFBQVEsQ0FBQyxRQUFRLENBQUMsSUFBSSxLQUFLLDJCQUEyQixFQUFFLENBQUM7WUFDM0QsTUFBTSxJQUFJLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1FBQ3RDLENBQUM7UUFFRCxJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQztRQUN6QixJQUFJLENBQUMsTUFBTSxHQUFHLFFBQVEsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQztRQUUvQyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQ3hCLEVBQUUsQ0FBQyxNQUFNLEVBQUUsRUFDWCxXQUFXLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxJQUFJLFFBQVEsQ0FBQyxjQUFjLEVBQUUsQ0FDM0QsQ0FBQztRQUNGLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSwwQkFBVyxFQUFFLENBQUM7UUFFaEMsTUFBTSxDQUFDLGFBQWEsQ0FBQyx5QkFBYyxDQUFDLGFBQWEsRUFBRSxDQUFDLENBQUM7UUFDckQsSUFBSSxDQUFDLE9BQU8sR0FBRyxNQUFNLEVBQUUsQ0FBQztRQUV4Qix1QkFBdUI7UUFDdkIsSUFBSSxDQUFDLE9BQU87YUFDVCxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQzthQUNsQixXQUFXLENBQUMsWUFBWSxDQUFDO2FBQ3pCLFFBQVEsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7UUFFMUIsa0JBQWtCO1FBQ2xCLE1BQU0sSUFBSSxHQUFHO1lBQ1gsQ0FBQyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsUUFBUSxDQUFDLGVBQWUsQ0FBQztZQUN6RCxDQUFDLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsZUFBZSxDQUFDO1NBQzFELENBQUM7UUFDRixJQUFJLENBQUMsT0FBTzthQUNULE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsV0FBVyxrQkFBVSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7YUFDdkUsYUFBYSxDQUFDLENBQUMsWUFBWSxZQUFZLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUUsV0FBVyxDQUFDLENBQUM7YUFDckUsU0FBUyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUM7YUFDdkIsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUUvQixJQUFJLElBQUksQ0FBQyxNQUFNLEtBQUssUUFBUSxFQUFFLENBQUM7WUFDN0IsSUFBSSxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQyxnQkFBZ0IsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDLENBQUM7UUFDcEUsQ0FBQztRQUVELElBQUksQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUMsc0JBQXNCLENBQUMsQ0FBQyxDQUFDO1FBQ3JELElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxPQUFPLENBQU8sQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUU7WUFDbkQsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsS0FBSyxFQUFFLEdBQUcsRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxNQUFNLENBQUMsQ0FBQztRQUM5RCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFTSxLQUFLLENBQUMsS0FBSztRQUNoQixJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDO0lBQ3JCLENBQUM7SUFFTSxLQUFLLENBQUMsV0FBVyxDQUFDLEVBQUMsSUFBSSxFQUFpQjtRQUM3QyxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDckQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQztJQUMzRCxDQUFDO0lBRU0sS0FBSyxDQUFDLEdBQUcsQ0FBQyxNQUFzQjtRQUNyQyxJQUFJLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUM1QixJQUFJLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUNqQixJQUFJLENBQUM7Z0JBQ0gsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7Z0JBQzdCLE1BQU0sSUFBSSxDQUFDLE9BQU8sQ0FBQztZQUNyQixDQUFDO1lBQUMsTUFBTSxDQUFDO2dCQUNQLHFEQUFxRDtZQUN2RCxDQUFDO1FBQ0gsQ0FBQzthQUFNLENBQUM7WUFDTixNQUFNLElBQUksQ0FBQyxPQUFPLENBQUM7UUFDckIsQ0FBQztJQUNILENBQUM7SUFFTSxLQUFLLENBQUMsSUFBSTtRQUNmLElBQUksQ0FBQztZQUNILElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQzdCLE1BQU0sSUFBSSxDQUFDLE9BQU8sQ0FBQztRQUNyQixDQUFDO1FBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNYLE9BQU87UUFDVCxDQUFDO0lBQ0gsQ0FBQztDQUNGO0FBbkZELG9EQW1GQyJ9
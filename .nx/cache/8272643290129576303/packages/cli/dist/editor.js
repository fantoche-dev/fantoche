"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.launchEditor = launchEditor;
const vite_plugin_1 = __importDefault(require("@fantoche-dev/vite-plugin"));
const vite_1 = require("vite");
async function launchEditor(projectPath, port) {
    const server = await (0, vite_1.createServer)({
        configFile: false,
        plugins: [
            (0, vite_plugin_1.default)({
                project: projectPath,
                buildForEditor: false,
            }),
        ],
        build: {
            minify: false,
            rollupOptions: {
                output: {
                    entryFileNames: '[name].js',
                },
            },
        },
        server: {
            port: parseInt(port),
        },
    });
    return server.listen();
}

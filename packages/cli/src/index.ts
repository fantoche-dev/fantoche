#!/usr/bin/env node

import {Command} from 'commander';
import {importCharacter} from './character/import';
import {launchEditor} from './editor';
import {lipsyncPreview} from './lipsync/command';
import {lipsyncCompare} from './lipsync/compare';
import {generateRhubarbTrack, generateWhisperXTrack} from './lipsync/generate';
import {renderDoc} from './render-doc';
import {createServer} from './server/index';

const program = new Command();

// Hand-synced at release time — see RELEASING.md step 1.
const VERSION = '0.11.0';

program
  .name('fantoche')
  .description('CLI to interact with the fantoche service')
  .version(VERSION);

program
  .command('serve')
  .description(
    'Exposes a render endpoint to render videos from a project file. Automatically rebuilds the project when the project file changes. Use for local development.',
  )
  .option(
    '--projectFile <path>',
    'Path to the project file',
    './src/project.ts',
  )
  .option('--port <number>', 'Port on which to start the server', '4000')
  .action(async options => {
    const {projectFile, port} = options;
    process.env.PROJECT_FILE = projectFile;
    process.env.REVIDEO_PORT = port;

    createServer().listen(port, () => {
      console.log(`Server listening on port ${port}`);
      console.log();
    });
  });

program
  .command('editor')
  .description('Start the fantoche editor')
  .option(
    '--projectFile <path>',
    'Path to the project file',
    './src/project.ts',
  )
  .option('--port <number>', 'Port on which to start the server', '9000')
  .action(async options => {
    const editor = await launchEditor(options.projectFile, options.port);
    console.log(`Editor running on port ${editor.config.server.port}`);
  });

program
  .command('render')
  .description(
    'Render a fantoche document (.json) to video, headless. The document is ' +
      'the source of truth: fps and size come from its meta. Deterministic — ' +
      'same document and assets produce the same video.',
  )
  .argument('<doc>', 'Path to the document .json file')
  .option('--out <file.mp4>', 'Output file name (default: <doc name>.mp4)')
  .option('--out-dir <dir>', 'Output directory', './output')
  .option('--workers <n>', 'Number of parallel render workers')
  .action(renderDoc);

const character = program
  .command('character')
  .description('Dev-time character rig tools. Never a render-time dependency.');

character
  .command('import')
  .description(
    'Split character art into the render-ready *.art.json sidecar named by ' +
      'character.art.src. Minimal and non-interactive; the SVG is never modified.',
  )
  .argument('<art.svg>', 'Path to the character art SVG')
  .argument('<character.json>', 'Path to the character definition')
  .action((artPath: string, characterPath: string) => {
    const report = importCharacter(artPath, characterPath);
    console.log(`wrote ${report.sidecarPath}`);
    if (report.orphans.length > 0) {
      console.log(`unbound art ids: ${report.orphans.join(', ')}`);
    }
  });

const lipsync = program
  .command('lipsync')
  .description('Dev-time lipsync tools. Never a render-time dependency.');

lipsync
  .command('preview')
  .description(
    'Turn a viseme track (.json) into a renderable document: nine stacked ' +
      'mouth SVGs whose opacity is hold-switched, one cue at a time.',
  )
  .argument('<track>', 'Path to the viseme track .json file')
  .requiredOption('--mouths <dir>', 'Directory holding A.svg … X.svg')
  .requiredOption('--out <doc.json>', 'Document file to write')
  .option('--fps <n>', 'Frames per second of the preview', '30')
  .option('--size <WxH>', 'Preview canvas size', '480x320')
  .option('--render', 'Render the document to video once written')
  .option('--out-dir <dir>', 'Output directory for --render', './output')
  .option('--workers <n>', 'Number of parallel render workers for --render')
  .action(lipsyncPreview);

lipsync
  .command('rhubarb')
  .description('Generate a viseme track with dev-time Rhubarb phonetic mode.')
  .argument('<wav>', 'Source WAV')
  .requiredOption('--language <tag>', 'Language tag recorded in the track')
  .requiredOption('--out <json>', 'Output viseme track')
  .action((wav, options) => generateRhubarbTrack(wav, options));

lipsync
  .command('whisperx')
  .description('Convert scripts/align.py output into a viseme track.')
  .argument('<alignment>', 'Normalised word/character alignment JSON')
  .requiredOption('--audio <wav>', 'Source WAV recorded in the track')
  .requiredOption('--language <tag>', 'Language tag recorded in the track')
  .requiredOption('--out <json>', 'Output viseme track')
  .action((alignment, options) => generateWhisperXTrack(alignment, options));

lipsync
  .command('compare')
  .description(
    'Render two tracks against the same mouth sheet and audio with a stable, hidden left/right assignment.',
  )
  .argument('<a>', 'First viseme track')
  .argument('<b>', 'Second viseme track')
  .requiredOption('--mouths <dir>', 'Directory holding A.svg … X.svg')
  .requiredOption('--audio <wav>', 'Audio heard in both comparison videos')
  .requiredOption(
    '--out <dir>',
    'Directory for left.mp4, right.mp4 and key.json',
  )
  .option('--fps <n>', 'Frames per second of both previews', '60')
  .option('--size <WxH>', 'Preview canvas size', '480x320')
  .option('--workers <n>', 'Number of parallel render workers')
  .action((a, b, options) => lipsyncCompare(a, b, options));

program.parse(process.argv);

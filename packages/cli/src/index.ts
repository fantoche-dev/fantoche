#!/usr/bin/env node

import {Command} from 'commander';
import {bindCharacter} from './character/bind';
import {checkCharacter, printCharacterCheck} from './character/check';
import {importCharacter} from './character/import';
import {launchEditor} from './editor';
import {lipsyncPreview} from './lipsync/command';
import {lipsyncCompare} from './lipsync/compare';
import {generateRhubarbTrack, generateWhisperXTrack} from './lipsync/generate';
import {alignNarration} from './narration/align';
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
  .option(
    '--offline',
    'Block external HTTP(S) while keeping the local render server available',
  )
  .action(renderDoc);

const narration = program
  .command('narration')
  .description('Dev-time narration tools. Never a render-time dependency.');

narration
  .command('align')
  .description(
    'Fill narration.segments[].words[] with forced-alignment timings. The ' +
      "segments' text is the transcript and is aligned verbatim, never altered.",
  )
  .argument('<doc.json>', 'Document whose narration to align')
  .requiredOption('--audio <wav>', 'Narration audio file')
  .requiredOption('--language <tag>', 'Language tag, e.g. pt-BR')
  .option('--python <path>', 'Python with whisperx (default: $WHISPERX_PYTHON)')
  .option('--model-dir <dir>', 'Model cache (default: $WHISPERX_MODEL_DIR)')
  .option('--script <path>', 'Override the bundled scripts/align.py')
  .action(async (docPath: string, options) => {
    await alignNarration(docPath, {
      audio: options.audio,
      language: options.language,
      python: options.python,
      modelDir: options.modelDir,
      script: options.script,
    });
    console.log(`aligned ${docPath}`);
  });

const character = program
  .command('character')
  .description('Dev-time character rig tools. Never a render-time dependency.');

character
  .command('check')
  .description(
    'Compare character.json bindings with the current source SVG and suggest likely remaps.',
  )
  .argument('<character.json>', 'Path to the character definition')
  .option(
    '--art <art.svg>',
    'Source SVG when it does not share the *.art.json sidecar stem',
  )
  .action((characterPath: string, options: {art?: string}) => {
    process.exitCode = printCharacterCheck(
      checkCharacter(characterPath, {artPath: options.art}),
    );
  });

character
  .command('bind')
  .description(
    'Interactively repair missing slot bindings; writes character.json, never the SVG.',
  )
  .argument('<character.json>', 'Path to the character definition')
  .option(
    '--art <art.svg>',
    'Source SVG when it does not share the *.art.json sidecar stem',
  )
  .action(async (characterPath: string, options: {art?: string}) => {
    const report = await bindCharacter(characterPath, {
      artPath: options.art,
    });
    console.log(
      `updated ${report.updated.length} binding(s); skipped ${report.skipped.length}`,
    );
  });

character
  .command('import')
  .description(
    'Scaffold character.json when absent, then split SVG art into its render-ready *.art.json sidecar.',
  )
  .argument('<art.svg>', 'Path to the character art SVG')
  .argument(
    '[character.json]',
    'Existing definition, or scaffold target (default: sibling character.json)',
  )
  .action((artPath: string, characterPath?: string) => {
    const report = importCharacter(artPath, characterPath);
    if (report.createdCharacter) {
      console.log(`scaffolded ${report.characterPath}`);
    }
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

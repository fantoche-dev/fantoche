#!/usr/bin/env node

import {Command} from 'commander';
import {launchEditor} from './editor';
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

program.parse(process.argv);

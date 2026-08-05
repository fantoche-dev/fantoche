import {renderVideo} from '@fantoche-dev/renderer';

async function render() {
  console.log('Rendering video...');

  const file = await renderVideo({
    projectFile: './src/project.ts',
    settings: {
      logProgress: true,
      projectSettings: {
        exporter: {
          name: '@fantoche-dev/core/wasm',
        },
      },
    },
  });

  console.log(`Rendered video to ${file}`);
}

render();

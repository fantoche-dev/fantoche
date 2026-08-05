module.exports = {
  extends: ['@commitlint/config-conventional'],
  ignores: [commit => commit.includes('[skip ci]')],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        '2d',
        'cli',
        'core',
        'create',
        'deps',
        'docs',
        'document',
        'e2e',
        'examples',
        'ffmpeg',
        'player',
        'player-react',
        'renderer',
        'template',
        'ui',
        'vite-plugin',
      ],
    ],
  },
};

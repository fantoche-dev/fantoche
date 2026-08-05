import fs from 'fs';
import path from 'path';

export function getVersions() {
  return {
    core: loadVersion('@fantoche-dev/core'),
    two: loadVersion('@fantoche-dev/2d'),
    ui: loadVersion('@fantoche-dev/ui'),
    vitePlugin: loadVersion('@fantoche-dev/vite-plugin'),
  };
}

function loadVersion(module: string): string | null {
  try {
    const modulePath = path.dirname(require.resolve(`${module}/package.json`));
    const packageJsonPath = path.resolve(modulePath, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath).toString());
    return packageJson.version ?? null;
  } catch (_) {
    return null;
  }
}

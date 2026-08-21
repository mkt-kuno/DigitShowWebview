import type { ElectrobunConfig } from 'electrobun';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

// Note: `scripts` is a top-level field in ElectrobunConfig (not nested under
// `build`). The CLI reads `config.scripts[hookName]` directly when running
// preBuild/postBuild/postWrap/postPackage hooks.
const config: ElectrobunConfig = {
  app: {
    name: 'DigitShowWebview',
    identifier: 'sh.digitshow.webview',
    version: pkg.version,
  },
  scripts: {
    // Run Vite build first so dist/ is up to date before electrobun copies it.
    preBuild: 'bun run build',
  },
  build: {
    bun: {
      entrypoint: 'src/electrobun/main.ts',
    },
    views: {
      // The mainview view loads the built SPA. The copy rule below mirrors
      // dist/ into views/mainview/ so `views://mainview/index.html` resolves
      // to the SPA's index.html.
      mainview: {
        entrypoint: 'src/electrobun/view.ts',
      },
    },
    copy: {
      // Mirror the entire Vite build output into the mainview view directory.
      // SPA uses base: '/' so absolute asset paths resolve cleanly under views://mainview/.
      'dist': 'views/mainview',
    },
  },
};

export default config;

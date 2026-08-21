import { BrowserWindow } from 'electrobun/bun';

// Single-window desktop app that loads the built SPA from the views:// scheme.
// The views directory is populated at build time by electrobun.config.ts's
// `copy` rule, which mirrors dist/ into views/mainview/.

new BrowserWindow({
  title: 'DigitShowWebview',
  url: 'views://mainview/index.html',
  frame: {
    x: 0,
    y: 0,
    width: 1280,
    height: 800,
  },
});

console.log('[electrobun] DigitShowWebview window opened');

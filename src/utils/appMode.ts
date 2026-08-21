// How this page is being served — the single source of truth for "am I running
// inside the desktop launcher?".
//
// This used to be `location.hostname === '127.0.0.1'`, which was true only
// because the launcher bound the loopback interface and nothing else did. The
// server states the mode instead of the client guessing it: the launcher
// injects a <meta name="msl-runtime"> marker into the index.html it serves, and
// nothing else does. Static deployments (custom domain hosting, `vite dev`,
// `vite preview`) ship the repo's index.html unmodified and so have no marker.
export type AppRuntime =
  /** Plain web deployment: custom domain hosting, `vite dev`. */
  | 'web'
  /** Served by the desktop launcher exe. */
  | 'launcher';

const RUNTIME_META = 'msl-runtime';

const readRuntime = (): AppRuntime => {
  if (typeof document === 'undefined') return 'web';
  const marker = document.querySelector(`meta[name="${RUNTIME_META}"]`)?.getAttribute('content');
  return marker === 'launcher' ? marker : 'web';
};

export const APP_RUNTIME: AppRuntime = readRuntime();

/** True when the desktop launcher is serving this page. */
export const isLauncherMode = APP_RUNTIME === 'launcher';

/**
 * True wherever the launcher is serving the page. This is the Service Worker /
 * caching question: the launcher's no-store headers make the SW unwanted.
 */
export const isLauncherServed = isLauncherMode;

export const isSupportedBrowser = (): boolean => typeof window !== 'undefined';
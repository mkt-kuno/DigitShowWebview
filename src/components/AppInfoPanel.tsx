import { useEffect, useState } from 'react';
import { FloatingWindow } from './FloatingWindow';
import { checkForAppUpdate, isUpdateCheckSupported, type UpdateCheckResult } from '../utils/swUpdate';

const DEP_VERSIONS: Record<string, string | undefined> = JSON.parse(
  import.meta.env.VITE_DEP_VERSIONS ?? '{}',
);

const LIBRARIES = [
  { name: 'React', pkg: 'react', license: 'MIT' },
  { name: 'React DOM', pkg: 'react-dom', license: 'MIT' },
  { name: 'Plotly.js', pkg: 'plotly.js', license: 'MIT' },
  { name: 'react-plotly.js', pkg: 'react-plotly.js', license: 'MIT' },
  { name: 'react-rnd', pkg: 'react-rnd', license: 'MIT' },
  { name: 'Tailwind CSS', pkg: 'tailwindcss', license: 'MIT' },
  { name: 'Vite', pkg: 'vite', license: 'MIT' },
  { name: 'TypeScript', pkg: 'typescript', license: 'Apache-2.0' },
  { name: 'Iosevka', pkg: '@fontsource/iosevka', license: 'OFL-1.1' },
].map((lib) => ({ ...lib, version: DEP_VERSIONS[lib.pkg] ?? 'unknown' }));

const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? 'unknown';
const APP_NAME = 'DigitShowWebview';

// The update itself is always confirmed by the window.confirm() prompt that the
// check raises; these lines only report what the check found, since a button
// with no visible outcome reads as broken.
const UPDATE_STATUS: Record<UpdateCheckResult, string> = {
  unsupported: 'Updates are not managed in this build.',
  suspended: 'Disconnect the device to check for updates.',
  prompted: 'A new version is available.',
  downloading: 'Downloading a new version… you will be asked to reload when it is ready.',
  'up-to-date': 'You are running the latest version.',
  failed: 'Update check failed. Check your network connection.',
};

export function AppInfoPanel({
  open,
  onClose,
  connected = false,
}: {
  open: boolean;
  onClose: () => void;
  // Applying an update reloads the page, which would drop the connection and
  // stop the polling — so while a device is connected there is nothing to
  // check for.
  connected?: boolean;
}) {
  const [checking, setChecking] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);

  // Same code path as the startup check (utils/swUpdate.ts): a ready new
  // version raises the identical consent prompt, declining leaves it waiting.
  const handleCheckForUpdates = async () => {
    setChecking(true);
    setUpdateStatus(null);
    try {
      setUpdateStatus(UPDATE_STATUS[await checkForAppUpdate()]);
    } finally {
      setChecking(false);
    }
  };

  // Drop the last check's result on connect: it would otherwise reappear as
  // stale text once the device is disconnected again.
  useEffect(() => {
    if (connected) setUpdateStatus(null);
  }, [connected]);

  return (
    <FloatingWindow open={open} onClose={onClose} title="Application Info" defaultWidth={384} defaultHeight={560}>
      <div className="flex flex-col gap-4 p-2 text-sm text-slate-700 dark:text-slate-200">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
          <h3 className="mb-1 text-base font-bold text-emerald-600 dark:text-emerald-400">
            {APP_NAME}
          </h3>
          <dl className="space-y-1">
            <div className="flex justify-between">
              <dt className="text-slate-500 dark:text-slate-400">Version</dt>
              <dd translate="no" className="font-mono font-semibold">v{APP_VERSION}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500 dark:text-slate-400">Author</dt>
              <dd>
                <a
                  href="https://github.com/mkt-kuno"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-600 hover:underline dark:text-emerald-400"
                >
                  Makoto KUNO
                </a>
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500 dark:text-slate-400">License</dt>
              <dd>MIT</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500 dark:text-slate-400">Repository</dt>
              <dd>
                <a
                  href="https://github.com/mkt-kuno/DigitShowWebview"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-600 hover:underline dark:text-emerald-400"
                >
                  GitHub
                </a>
              </dd>
            </div>
          </dl>

          {isUpdateCheckSupported() && (
            <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-700">
              <button
                type="button"
                onClick={() => void handleCheckForUpdates()}
                disabled={checking || connected}
                title={connected ? 'Disconnect the device first — applying an update reloads the app' : undefined}
                className="w-full rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-emerald-950 shadow hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {checking ? 'Checking…' : 'Check for Updates'}
              </button>
              {(connected || updateStatus) && (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {connected ? UPDATE_STATUS.suspended : updateStatus}
                </p>
              )}
            </div>
          )}
        </div>

        <div>
          <h4 className="mb-2 font-semibold text-slate-800 dark:text-slate-100">Libraries</h4>
          <ul className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800">
            {LIBRARIES.map((lib) => (
              <li
                key={lib.name}
                translate="no"
                className="flex items-center justify-between rounded px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-700/50"
              >
                <span className="font-medium">{lib.name}</span>
                <span className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="rounded bg-slate-200 px-1.5 py-0.5 font-mono dark:bg-slate-700">
                    v{lib.version}
                  </span>
                  <span className="rounded border border-slate-300 px-1.5 py-0.5 dark:border-slate-600">
                    {lib.license}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </FloatingWindow>
  );
}

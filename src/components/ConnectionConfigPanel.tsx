import { useEffect, useState } from 'react';
import { FloatingWindow } from './FloatingWindow';
import { buildBaseUrl, isValidIp } from '../apiConfig';
import type { ConnectionConfig } from '../types';

export function ConnectionConfigPanel({
  open,
  onClose,
  config,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  config: ConnectionConfig;
  onSave: (next: ConnectionConfig) => void;
}) {
  const [ip, setIp] = useState(config.ip);
  const [port, setPort] = useState(String(config.port));
  const [pollIntervalMs, setPollIntervalMs] = useState(config.pollIntervalMs);
  const [error, setError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (open) {
      setIp(config.ip);
      setPort(String(config.port));
      setPollIntervalMs(config.pollIntervalMs);
      setError(null);
      setTestStatus(null);
    }
  }, [open, config]);

  useEffect(() => {
    if (!open) return;
    if (!isValidIp(ip)) return;
    const portNum = Number(port);
    if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) return;
    const timer = setTimeout(() => {
      onSave({ ip, port: portNum, useHttps: false, pollIntervalMs });
      setError(null);
    }, 300);
    return () => clearTimeout(timer);
  }, [open, ip, port, pollIntervalMs, onSave]);

  const handleTest = async () => {
    setError(null);
    setTestStatus(null);
    if (!isValidIp(ip)) { setError('Invalid IP or hostname'); return; }
    const portNum = Number(port);
    if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) { setError('Invalid port'); return; }
    const url = `${buildBaseUrl({ ip, port: portNum, useHttps: false, pollIntervalMs })}/v1/health`;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3000);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      if (res.ok) setTestStatus({ ok: true, message: `OK ${res.status}` });
      else setTestStatus({ ok: false, message: `HTTP ${res.status}` });
    } catch (err) {
      setTestStatus({ ok: false, message: (err as Error).message ?? 'Failed' });
    }
  };

  return (
    <FloatingWindow open={open} onClose={onClose} title="Connection Config" defaultWidth={420} defaultHeight={420}>
      <div className="flex flex-col gap-3 p-3 text-sm text-slate-700 dark:text-slate-200">
        <label className="flex flex-col gap-1">
          <span>IP / Hostname</span>
          <input
            type="text"
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span>Port</span>
          <input
            type="number"
            min={1}
            max={65535}
            value={port}
            onChange={(e) => setPort(e.target.value)}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span>Polling Rate</span>
          <select
            value={pollIntervalMs}
            onChange={(e) => setPollIntervalMs(Number(e.target.value))}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value={1000}>1000 ms (1 Hz)</option>
            <option value={2000}>2000 ms (0.5 Hz)</option>
            <option value={5000}>5000 ms (0.2 Hz)</option>
          </select>
        </label>
        {error && (
          <p className="text-red-600 dark:text-red-400">{error}</p>
        )}
        {testStatus && (
          <p className={testStatus.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
            {testStatus.ok ? '✓ ' : '✗ '}{testStatus.message}
          </p>
        )}
        <div className="flex justify-end">
          <button type="button" className="button-secondary" onClick={handleTest}>Test Connection</button>
        </div>
      </div>
    </FloatingWindow>
  );
}

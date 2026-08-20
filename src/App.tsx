import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChartPanel } from './components/ChartPanel';
import { CollapseButton } from './components/CollapseButton';
import { HamburgerMenu } from './components/HamburgerMenu';
import { AppInfoPanel } from './components/AppInfoPanel';
import { ConnectionConfigPanel } from './components/ConnectionConfigPanel';
import { FooterBar } from './components/FooterBar';
import { useChartAxes } from './hooks/useChartAxes';
import { useTheme } from './hooks/useTheme';
import { loadConfig, resolveApiUrl, saveConfig } from './apiConfig';
import { AI_CHANNELS, AO_CHANNELS, PARAM_CHANNELS } from './constants';
import type { ApiData, ApiPreview, ConnectionConfig, DataPoint } from './types';

type Heartbeat = { running: boolean; info: string };

const pad = (n: number) => n.toString().padStart(2, '0');

const num = (v: unknown): number => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const parsed = Number(v);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

/**
 * Normalize the /v1/ response into our ApiData shape.
 *
 * The DigitShowModbus backend returns each channel as a { label, value } object:
 *   { raw: { "00": { label: "00:LoadCell(i16)", value: -28.8671875 }, ... }, ... }
 *
 * One `as` cast, one extraction loop per field. No recursive unwrapping.
 */
function normalizeV1(raw: unknown): ApiData {
  if (!raw || typeof raw !== 'object') {
    return { raw: {}, phy: {}, par: {}, out: {}, label: {} };
  }

  // One cast to the expected backend shape.
  type BackendChannel = { value: number | string | null; label?: string };
  type BackendV1 = {
    raw?: Record<string, BackendChannel>;
    phy?: Record<string, BackendChannel>;
    par?: Record<string, BackendChannel>;
    out?: Record<string, BackendChannel>;
    label?: Record<string, string>;
  };
  const v = raw as BackendV1;

  // One extractor shared by all four fields.
  const extract = (map: BackendV1['raw'], round: boolean) => {
    const values: Record<string, number> = {};
    const labels: Record<string, string> = {};
    if (!map) return { values, labels };
    for (const [k, ch] of Object.entries(map)) {
      const num = typeof ch.value === 'number' ? ch.value : Number(ch.value);
      if (Number.isFinite(num)) values[k] = round ? Math.round(num) : num;
      if (typeof ch.label === 'string' && ch.label.length > 0) {
        labels[k] = ch.label;
      }
    }
    return { values, labels };
  };

  // Raw is int16 register value — round to integer. Phy/Par/Out are floats.
  const rawF = extract(v.raw, true);
  const phyF = extract(v.phy, false);
  const parF = extract(v.par, false);
  const outF = extract(v.out, false);

  // Build the combined label map keyed by `prefix_NN`.
  const label: Record<string, string> = {};
  for (const [k, l] of Object.entries(rawF.labels)) label[`raw_${k}`] = l;
  for (const [k, l] of Object.entries(phyF.labels)) label[`phy_${k}`] = l;
  for (const [k, l] of Object.entries(parF.labels)) label[`par_${k}`] = l;
  for (const [k, l] of Object.entries(outF.labels)) label[`out_${k}`] = l;
  // Backfill from top-level `label` field if present (preserves earlier behaviour).
  if (v.label && typeof v.label === 'object') {
    for (const [k, val] of Object.entries(v.label)) {
      if (typeof val === 'string') label[k] = val;
    }
  }

  return {
    raw: rawF.values,
    phy: phyF.values,
    par: parF.values,
    out: outF.values,
    label,
  };
}

/**
 * Normalize the /v1/preview response to { data: Record<string, number[]> }.
 * Handles:
 *   1. { data: { time: [...], raw_00: [...], ... } }
 *   2. { time: [...], raw_00: [...], ... }               (flat)
 *   3. { raw_00: { data: [...], label: '...' }, ... }     (per-key wrapper)
 */
function normalizePreview(raw: unknown): Record<string, (number | null)[]> {
  const result: Record<string, (number | null)[]> = {};
  if (!raw || typeof raw !== 'object') return result;

  const obj = raw as Record<string, unknown>;
  const flat: Record<string, unknown> = {};

  if (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)) {
    Object.assign(flat, obj.data as Record<string, unknown>);
  }

  for (const [k, v] of Object.entries(obj)) {
    if (k === 'data' || k === 'label' || k === 'labels') continue;
    if (v && typeof v === 'object' && !Array.isArray(v) && 'data' in (v as object)) {
      flat[k] = (v as { data: unknown }).data;
    } else if (Array.isArray(v)) {
      flat[k] = v;
    }
  }

for (const [k, v] of Object.entries(flat)) {
    if (Array.isArray(v)) {
      const isRaw = k.startsWith('raw_');
      result[k] = v.map((n) => {
        const num = typeof n === 'number' ? n : Number(n);
        if (!Number.isFinite(num)) return null;
        // Raw is int16 — round to integer; everything else stays float.
        return isRaw ? Math.round(num) : num;
      });
    }
  }

  return result;
}

const axisOptions = [
  { key: 'time', label: 'time' },
  ...Array.from({ length: AI_CHANNELS }, (_, idx) => ({
    key: `raw_${pad(idx)}`,
    label: `raw_${pad(idx)}`,
  })),
  ...Array.from({ length: AI_CHANNELS }, (_, idx) => ({
    key: `phy_${pad(idx)}`,
    label: `phy_${pad(idx)}`,
  })),
  ...Array.from({ length: PARAM_CHANNELS }, (_, idx) => ({
    key: `par_${pad(idx)}`,
    label: `par_${pad(idx)}`,
  })),
];
const axisOptionKeys = new Set(axisOptions.map((o) => o.key));

function getLevelColor(ratio: number): { bar: string; text: string } {
  if (ratio > 0.95) return { bar: 'bg-red-500 dark:bg-red-400', text: 'text-red-600 dark:text-red-400' };
  if (ratio > 0.8) return { bar: 'bg-amber-500 dark:bg-amber-400', text: 'text-amber-600 dark:text-amber-400' };
  return { bar: 'bg-emerald-500 dark:bg-emerald-400', text: 'text-emerald-600 dark:text-emerald-400' };
}

async function fetchWithTimeout(url: string, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { signal: controller.signal }); } finally { clearTimeout(id); }
}

export default function App() {
  const { isDarkMode, toggleTheme } = useTheme();

  const [connection, setConnection] = useState<ConnectionConfig>(() => loadConfig());
  const [data, setData] = useState<ApiData>({ raw: {}, phy: {}, par: {}, out: {}, label: {} });
  const [preview, setPreview] = useState<ApiPreview | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [appInfoOpen, setAppInfoOpen] = useState(false);
  const [connOpen, setConnOpen] = useState(false);
  const [aiCollapsed, setAiCollapsed] = useState(false);
  const [aoCollapsed, setAoCollapsed] = useState(true);
  const [paramCollapsed, setParamCollapsed] = useState(true);
  const [heartbeat, setHeartbeat] = useState<Heartbeat | null>(null);
  const [responseTimeMs, setResponseTimeMs] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);

  const configRef = useRef(connection);
  configRef.current = connection;
  const axes = useChartAxes(axisOptionKeys);

  const selectedPreviewAxes = useMemo(() => {
    const s = new Set<string>();
    const all = [
      axes.chart1X, axes.chart1Y,
      axes.chart2X, axes.chart2Y,
      axes.chart3X, axes.chart3Y,
      axes.chart4X, axes.chart4Y,
    ];
    for (const a of all) {
      if (a) s.add(a);
    }
    return s;
  }, [
    axes.chart1X, axes.chart1Y,
    axes.chart2X, axes.chart2Y,
    axes.chart3X, axes.chart3Y,
    axes.chart4X, axes.chart4Y,
  ]);

  const lastPollFailedRef = useRef(false);

  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    const poll = async () => {
      const cycleStart = Date.now();
      try {
        const dataRes = await fetchWithTimeout(resolveApiUrl(configRef.current, '/v1/'));
        if (!dataRes.ok) throw new Error(`v1 HTTP ${dataRes.status}`);
        const dataJson = await dataRes.json();
        if (!cancelled) {
          setData(normalizeV1(dataJson));
        }

        const previewFields = Array.from(selectedPreviewAxes).join('&');
        const previewUrl = `${resolveApiUrl(configRef.current, '/v1/preview')}?${previewFields}`;
        const previewRes = await fetchWithTimeout(previewUrl);
        if (!previewRes.ok) throw new Error(`preview HTTP ${previewRes.status}`);
        const previewJson = await previewRes.json();
        if (!cancelled) {
          setPreview({ data: normalizePreview(previewJson) });
        }

        const cycleTime = Date.now() - cycleStart;
        if (!cancelled) setResponseTimeMs(cycleTime);

        if (!cancelled) {
          setHeartbeat({ running: true, info: 'Connected' });
          lastPollFailedRef.current = false;
        }
      } catch {
        if (!cancelled) {
          lastPollFailedRef.current = true;
          setHeartbeat({ running: false, info: 'Disconnected' });
        }
      }
    };
    void poll();
    const id = setInterval(poll, connection.pollIntervalMs);
    return () => { cancelled = true; clearInterval(id); };
  }, [connection, connected, selectedPreviewAxes]);

  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    let timeoutId: number | null = null;

    const probe = async () => {
      if (cancelled || !lastPollFailedRef.current) return;
      try {
        const res = await fetchWithTimeout(resolveApiUrl(configRef.current, '/v1/health'));
        if (cancelled) return;
        if (res.ok) {
          setHeartbeat({ running: true, info: 'Connected' });
          lastPollFailedRef.current = false;
          return;
        }
      } catch {
      }
      if (!cancelled) timeoutId = window.setTimeout(probe, 5000);
    };

    const interval = window.setInterval(() => {
      if (lastPollFailedRef.current) probe();
    }, 1000);

    return () => {
      cancelled = true;
      if (timeoutId !== null) clearTimeout(timeoutId);
      clearInterval(interval);
    };
  }, [connection, connected]);

  const handleConnectionSave = useCallback((next: ConnectionConfig) => {
    saveConfig(next);
    setConnection(next);
  }, []);

  const handleConnect = useCallback(() => {
    setConnected(true);
  }, []);

  const handleDisconnect = useCallback(() => {
    setConnected(false);
    setHeartbeat(null);
    setData({ raw: {}, phy: {}, par: {}, out: {}, label: {} });
    setPreview(null);
    setResponseTimeMs(null);
  }, []);

  const handleMenuSelect = useCallback((item: string) => {
    if (item === 'appInfo') setAppInfoOpen(true);
    else if (item === 'connection') setConnOpen(true);
  }, []);


  const chartDataPoints = useMemo<DataPoint[]>(() => {
    if (!preview || !preview.data) return [];
    const timeArr = preview.data['time'] ?? [];
    const safeGet = (k: string): (number | null)[] => {
      const arr = preview.data[k];
      return Array.isArray(arr) ? arr : [];
    };
    const len = timeArr.length;
    const points: DataPoint[] = [];
    for (let i = 0; i < len; i++) {
      const ts = timeArr[i] ?? 0;
      const aiRaw = new Float32Array(AI_CHANNELS);
      const aiPhysical = new Float32Array(AI_CHANNELS);
      const param = new Float32Array(PARAM_CHANNELS);
      for (let c = 0; c < AI_CHANNELS; c++) {
        const key = pad(c);
        aiRaw[c] = num(safeGet(`raw_${key}`)[i]);
        aiPhysical[c] = num(safeGet(`phy_${key}`)[i]);
      }
      for (let c = 0; c < PARAM_CHANNELS; c++) {
        const key = pad(c);
        param[c] = num(safeGet(`par_${key}`)[i]);
      }
      points.push({ seq: i, timestamp: ts, aiRaw, aiPhysical, param });
    }
    return points;
  }, [preview]);

  const chartAxisLabels = useMemo<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    const label = data.label ?? {};
    for (let i = 0; i < AI_CHANNELS; i++) {
      const lbl = label[`raw_${pad(i)}`];
      if (lbl) m[`raw_${pad(i)}`] = lbl;
      const lbl2 = label[`phy_${pad(i)}`];
      if (lbl2) m[`phy_${pad(i)}`] = lbl2;
    }
    for (let i = 0; i < PARAM_CHANNELS; i++) {
      const lbl = label[`par_${pad(i)}`];
      if (lbl) m[`par_${pad(i)}`] = lbl;
    }
    return m;
  }, [data.label]);

  const getAiLabel = (idx: number): string => {
    const label = data.label ?? {};
    const key = pad(idx);
    return label[`phy_${key}`] ?? label[`raw_${key}`] ?? '';
  };
  const getAoLabel = (idx: number): string => {
    const label = data.label ?? {};
    return label[`out_${pad(idx)}`] ?? '';
  };
  const getParLabel = (idx: number): string => {
    const label = data.label ?? {};
    return label[`par_${pad(idx)}`] ?? '';
  };

  const labelSpan = (specLabel: string, title: string, value: string): ReactNode => {
    let display: string;
    if (!connected) {
      display = specLabel;
    } else if (value) {
      display = value;
    } else {
      display = 'Label';
    }
    return (
      <span
        title={title}
        translate="no"
        className="min-w-0 flex-1 truncate rounded border border-slate-200 bg-white px-1 text-center text-xs leading-none text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
      >
        {display}
      </span>
    );
  };

  return (
    <div>
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/50 backdrop-blur dark:border-slate-800 dark:bg-slate-950/50">
        <div className="px-2 py-1">
          <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0">
              <h1 className="hidden text-lg font-bold leading-tight lg:block">
                <a
                  href="https://github.com/KikuchiMakoto/DigitShowWebview"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-600 hover:underline dark:text-emerald-400"
                >
                  DigitShowWebview
                </a>
              </h1>
              <div
                role="status"
                aria-live="polite"
                className="flex flex-wrap items-baseline gap-x-3 gap-y-0 text-[0.7rem] leading-tight text-slate-600 dark:text-slate-400"
              >
                <span className="tabular-nums">
                  Host/IP: {connection.ip}
                </span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Port: {connection.port} ({connection.useHttps ? 'HTTPS' : 'HTTP'})
                </span>
              </div>
            </div>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
              {connected ? (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="button-touch button-secondary min-w-[6rem] border-amber-400 text-amber-700 hover:border-amber-500 dark:border-amber-500/60 dark:text-amber-300"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConnect}
                  className="button-touch button-primary min-w-[6rem]"
                >
                  Connect
                </button>
              )}
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                className="button-secondary button-compact flex items-center justify-center"
                aria-label="Open menu"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
            </div>
          </header>
        </div>
      </div>

      <div className="space-y-1 p-1.5">
        <section className="card card-tight">
          <div className="mb-px flex items-center justify-between">
            <h2 className="text-lg font-semibold leading-none">Analog Input ({AI_CHANNELS})</h2>
            <CollapseButton collapsed={aiCollapsed} onToggle={() => setAiCollapsed((v) => !v)} label="Analog Input" />
          </div>
          {!aiCollapsed && (
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-8 xl:grid-cols-8">
            {Array.from({ length: AI_CHANNELS }, (_, idx) => {
              const key = pad(idx);
              const raw = num(data.raw[key]);
              const phy = num(data.phy[key]);
              const aiRatio = Math.min(1, Math.abs(raw) / 32767);
              const { bar: aiMeterColor, text: aiTextColor } = getLevelColor(aiRatio);
              const aiMeterHeight = Math.max(2, aiRatio * 100);
              const aiLabel = getAiLabel(idx);
              return (
              <div
                key={idx}
                translate="no"
                className="flex min-w-0 rounded border border-slate-200 bg-slate-100 dark:border-slate-700/50 dark:bg-slate-900/60"
              >
                <div className="min-w-0 flex-1 px-1 py-0.5">
                  <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-700">
                    {labelSpan(`CH ${pad(idx)}`, aiLabel, aiLabel)}
                  </div>
                  <div className="space-y-0 pt-px text-base leading-none">
                    <div className="flex justify-between items-center leading-none">
                      <span className="shrink-0 text-sm text-slate-600 font-medium dark:text-slate-300 leading-none">Raw</span>
                      <span className={`text-xl font-bold leading-none tabular-nums ${aiTextColor}`}>
                        {raw}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-px border-t border-slate-200 dark:border-slate-700 leading-none">
                      <span className="shrink-0 text-sm text-slate-600 font-medium dark:text-slate-300 leading-none">Phy</span>
                      <span className={`text-xl font-bold leading-none tabular-nums ${aiTextColor}`}>
                        {phy.toFixed(3)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex w-1 items-end overflow-hidden rounded-r">
                  <div className={`w-full ${aiMeterColor}`} style={{ height: `${aiMeterHeight}%` }} />
                </div>
              </div>
              );
            })}
          </div>
          )}
        </section>

        <section className="card card-tight">
          <div className="mb-px flex items-center justify-between">
            <h2 className="text-lg font-semibold leading-none">Analog Output ({AO_CHANNELS})</h2>
            <CollapseButton collapsed={aoCollapsed} onToggle={() => setAoCollapsed((v) => !v)} label="Analog Output" />
          </div>
          {!aoCollapsed && (
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-8 xl:grid-cols-8">
            {Array.from({ length: AO_CHANNELS }, (_, idx) => {
              const v = num(data.out[pad(idx)]);
              const aoMeterHeight = Math.max(2, Math.min(1, Math.abs(v) / 10) * 100);
              const aoLabel = getAoLabel(idx);
              return (
              <div
                key={idx}
                translate="no"
                className="flex min-w-0 rounded border border-slate-200 bg-slate-100 dark:border-slate-700/50 dark:bg-slate-900/60"
              >
                <div className="min-w-0 flex-1 px-1 py-0.5">
                  <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-700">
                    {labelSpan(`CH ${idx}`, aoLabel, aoLabel)}
                  </div>
                  <div className="pt-px text-base leading-none">
                    <div className="flex items-center justify-between leading-none">
                      <span className="shrink-0 text-sm font-medium text-slate-600 dark:text-slate-300 leading-none">V</span>
                      <span className="text-xl font-bold leading-none tabular-nums text-sky-600 dark:text-sky-400">
                        {v.toFixed(3)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex w-1 items-end overflow-hidden rounded-r">
                  <div className="w-full bg-sky-500" style={{ height: `${aoMeterHeight}%` }} />
                </div>
              </div>
              );
            })}
          </div>
          )}
        </section>

        <section className="card card-tight">
          <div className="mb-px flex items-center justify-between">
            <h2 className="text-lg font-semibold leading-none">Parameter ({PARAM_CHANNELS})</h2>
            <CollapseButton collapsed={paramCollapsed} onToggle={() => setParamCollapsed((v) => !v)} label="Parameter" />
          </div>
          {!paramCollapsed && (
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-8 xl:grid-cols-8">
            {Array.from({ length: PARAM_CHANNELS }, (_, idx) => {
              const v = num(data.par[pad(idx)]);
              const parLabel = getParLabel(idx);
              return (
              <div
                key={idx}
                translate="no"
                className="min-w-0 rounded border border-slate-200 bg-slate-100 px-1 py-0.5 dark:border-slate-700/50 dark:bg-slate-900/60"
              >
                <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-700">
                  {labelSpan(`CH ${pad(idx)}`, parLabel, parLabel)}
                </div>
                <div className="pt-px text-base leading-none">
                  <div className="flex items-center justify-between gap-1 leading-none">
                    <span className="shrink-0 text-sm font-medium text-slate-600 dark:text-slate-300 leading-none">Val</span>
                    <span
                      title={String(v)}
                      className="min-w-0 truncate text-right text-xl font-bold leading-none tabular-nums text-emerald-600 dark:text-emerald-400"
                    >
                      {v.toFixed(3)}
                    </span>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
          )}
        </section>

        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-4">
          <ChartPanel
            color="#34d399"
            dataPoints={chartDataPoints}
            displayRevision={0}
            axisOptions={axisOptions}
            axisLabels={chartAxisLabels}
            xAxis={axes.chart1X}
            yAxis={axes.chart1Y}
            isDarkMode={isDarkMode}
            onXAxisChange={axes.setChart1X}
            onYAxisChange={axes.setChart1Y}
          />
          <ChartPanel
            color="#60a5fa"
            dataPoints={chartDataPoints}
            displayRevision={0}
            axisOptions={axisOptions}
            axisLabels={chartAxisLabels}
            xAxis={axes.chart2X}
            yAxis={axes.chart2Y}
            isDarkMode={isDarkMode}
            onXAxisChange={axes.setChart2X}
            onYAxisChange={axes.setChart2Y}
          />
          <ChartPanel
            color="#f472b6"
            dataPoints={chartDataPoints}
            displayRevision={0}
            axisOptions={axisOptions}
            axisLabels={chartAxisLabels}
            xAxis={axes.chart3X}
            yAxis={axes.chart3Y}
            isDarkMode={isDarkMode}
            onXAxisChange={axes.setChart3X}
            onYAxisChange={axes.setChart3Y}
          />
          <ChartPanel
            color="#fbbf24"
            dataPoints={chartDataPoints}
            displayRevision={0}
            axisOptions={axisOptions}
            axisLabels={chartAxisLabels}
            xAxis={axes.chart4X}
            yAxis={axes.chart4Y}
            isDarkMode={isDarkMode}
            onXAxisChange={axes.setChart4X}
            onYAxisChange={axes.setChart4Y}
          />
        </div>
      </div>

      <HamburgerMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onSelectItem={handleMenuSelect}
        isDarkMode={isDarkMode}
        onToggleTheme={toggleTheme}
      />
      <AppInfoPanel open={appInfoOpen} onClose={() => setAppInfoOpen(false)} />
      <ConnectionConfigPanel
        open={connOpen}
        onClose={() => setConnOpen(false)}
        config={connection}
        onSave={handleConnectionSave}
      />
      <FooterBar heartbeat={heartbeat} responseTimeMs={responseTimeMs} />
    </div>
  );
}

import {
  type CSSProperties,
  type ComponentType,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { type Config, type Data, type Layout } from 'plotly.js';
import { Plot } from '../plotly';
import { DataPoint } from '../types';

interface AxisOption {
  key: string;
  label: string;
}

interface ChartPanelProps {
  color: string;
  dataPoints: DataPoint[];
  displayRevision: number;
  axisOptions: AxisOption[];
  axisLabels: Record<string, string>;
  xAxis: string;
  yAxis: string;
  isDarkMode: boolean;
  onXAxisChange: (value: string) => void;
  onYAxisChange: (value: string) => void;
}

type PlotProps = {
  data: Data[];
  layout: Partial<Layout>;
  config: Partial<Config>;
  style?: CSSProperties;
  onInitialized?: (figure: unknown, graphDiv: HTMLElement) => void;
  onUpdate?: (figure: unknown, graphDiv: HTMLElement) => void;
};

const NormalizedPlot = Plot as ComponentType<PlotProps>;

export const PLOT_HEIGHT = '240px';

function releaseWebglContext(graphDiv: HTMLElement) {
  for (const canvas of Array.from(graphDiv.querySelectorAll('canvas'))) {
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as
      | WebGLRenderingContext
      | WebGL2RenderingContext
      | null;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

type AxisDescriptor =
  | { kind: 'time' }
  | { kind: 'raw'; index: number }
  | { kind: 'phy'; index: number }
  | { kind: 'par'; index: number };

function parseAxisKey(key: string): AxisDescriptor {
  if (key === 'time') return { kind: 'time' };
  if (key.startsWith('raw_')) return { kind: 'raw', index: Number(key.slice(4)) };
  if (key.startsWith('phy_')) return { kind: 'phy', index: Number(key.slice(4)) };
  if (key.startsWith('par_')) return { kind: 'par', index: Number(key.slice(4)) };
  return { kind: 'time' };
}

function resolveAxisValue(point: DataPoint, desc: AxisDescriptor): number {
  switch (desc.kind) {
    case 'time': return point.timestamp;
    case 'raw': return point.aiRaw[desc.index];
    case 'phy': return point.aiPhysical[desc.index];
    case 'par': return point.param[desc.index];
  }
}

function paddedRange(min: number, max: number, fraction: number): [number, number] | null {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  const span = max - min;
  const pad = span > 0 ? span * fraction : Math.abs(max) * fraction || 1;
  return [min - pad, max + pad];
}

function ChartPanelComponent({
  color,
  dataPoints,
  displayRevision,
  axisOptions,
  axisLabels,
  xAxis,
  yAxis,
  isDarkMode,
  onXAxisChange,
  onYAxisChange,
}: ChartPanelProps) {
  const xDesc = useMemo(() => parseAxisKey(xAxis), [xAxis]);
  const yDesc = useMemo(() => parseAxisKey(yAxis), [yAxis]);

  const graphDivRef = useRef<HTMLElement | null>(null);

  const handleGraphDiv = useCallback((_figure: unknown, graphDiv: HTMLElement) => {
    const previous = graphDivRef.current;
    if (previous && previous !== graphDiv) releaseWebglContext(previous);
    graphDivRef.current = graphDiv;
  }, []);

  useEffect(
    () => () => {
      if (graphDivRef.current) releaseWebglContext(graphDivRef.current);
      graphDivRef.current = null;
    },
    [],
  );

  const palette = useMemo(
    () =>
      isDarkMode
        ? {
            paper: '#0f172a',
            plot: '#1e293b',
            grid: '#334155',
            text: '#cbd5e1',
          }
        : {
            paper: '#f8fafc',
            plot: '#ffffff',
            grid: '#e2e8f0',
            text: '#0f172a',
          },
    [isDarkMode],
  );

  const isEmpty = dataPoints.length === 0;

  const plot = useMemo((): { traces: Data[]; xRange: [number, number] | null; yRange: [number, number] | null } => {
    if (isEmpty) return { traces: [], xRange: null, yRange: null };
    const n = dataPoints.length;
    const xData = new Float64Array(n);
    const yData = new Float64Array(n);
    let xMin = Infinity;
    let xMax = -Infinity;
    let yMin = Infinity;
    let yMax = -Infinity;
    for (let i = 0; i < n; i++) {
      const p = dataPoints[i];
      const xv = resolveAxisValue(p, xDesc);
      const yv = resolveAxisValue(p, yDesc);
      xData[i] = xv;
      yData[i] = yv;
      if (Number.isFinite(xv)) {
        if (xv < xMin) xMin = xv;
        if (xv > xMax) xMax = xv;
      }
      if (Number.isFinite(yv)) {
        if (yv < yMin) yMin = yv;
        if (yv > yMax) yMax = yv;
      }
    }

    return {
      traces: [
        {
          x: xData,
          y: yData,
          type: 'scattergl' as const,
          mode: 'lines' as const,
          line: { color, width: 1.5 },
          name: `${yAxis} vs ${xAxis}`,
          hoverinfo: 'skip' as const,
        },
      ],
      xRange: paddedRange(xMin, xMax, 0.1),
      yRange: paddedRange(yMin, yMax, 0.05),
    };
  }, [displayRevision, color, xDesc, yDesc, xAxis, yAxis, dataPoints, isEmpty]);

  const axisTitle = (key: string): string =>
    key === 'time' ? 'Timestamp' : (axisLabels[key] ?? '');

  const plotLayout = useMemo(
    () => ({
      autosize: true,
      paper_bgcolor: palette.paper,
      plot_bgcolor: palette.plot,
      font: { color: palette.text, size: 10 },
      xaxis: {
        title: { text: axisTitle(xAxis), font: { size: 11 } },
        gridcolor: palette.grid,
        type: xAxis === 'time' ? ('date' as const) : ('linear' as const),
        ...(plot.xRange
          ? { range: plot.xRange, autorange: false as const }
          : { autorange: true as const }),
      },
      yaxis: {
        title: { text: axisTitle(yAxis), font: { size: 11 } },
        gridcolor: palette.grid,
        ...(plot.yRange
          ? { range: plot.yRange, autorange: false as const }
          : { autorange: true as const }),
      },
      margin: {
        t: 8,
        r: 12,
        b: axisTitle(xAxis) ? 36 : 20,
        l: axisTitle(yAxis) ? 52 : 40,
      },
      hovermode: false as const,
      uirevision: `${xAxis}-${yAxis}`,
      datarevision: displayRevision,
    }),
    [xAxis, yAxis, palette, displayRevision, plot, axisLabels],
  );

  const plotConfig = useMemo<Partial<Config>>(
    () => ({
      displayModeBar: 'hover',
      responsive: true,
      displaylogo: false,
      scrollZoom: true,
      doubleClick: 'reset',
      modeBarButtonsToRemove: [
        'select2d',
        'lasso2d',
        'hoverClosestCartesian',
        'hoverCompareCartesian',
        'toggleSpikelines',
      ],
    }),
    [],
  );

  return (
    <section className="card card-tight space-y-0.5">
      <div className="flex items-center gap-1.5">
        <label className="text-[0.7rem] leading-none text-slate-400">X:</label>
        <select
          value={xAxis}
          onChange={(e) => onXAxisChange(e.target.value)}
          className="rounded border border-slate-300 bg-white px-1.5 py-0 text-xs leading-tight text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          aria-label="X axis"
        >
          {axisOptions.map((opt) => (
            <option key={opt.key} value={opt.key}>
              {opt.label}
            </option>
          ))}
        </select>
        <label className="text-[0.7rem] leading-none text-slate-400">Y:</label>
        <select
          value={yAxis}
          onChange={(e) => onYAxisChange(e.target.value)}
          className="rounded border border-slate-300 bg-white px-1.5 py-0 text-xs leading-tight text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          aria-label="Y axis"
        >
          {axisOptions
            .filter((opt) => opt.key !== 'time')
            .map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
        </select>
      </div>
      {isEmpty ? (
        <div className="flex items-center justify-center text-sm text-slate-400" style={{ height: PLOT_HEIGHT }}>
          No data — connect device and start polling
        </div>
      ) : (
        <div translate="no">
          <NormalizedPlot
            data={plot.traces}
            layout={plotLayout}
            config={plotConfig}
            style={{ width: '100%', height: PLOT_HEIGHT }}
            onInitialized={handleGraphDiv}
            onUpdate={handleGraphDiv}
          />
        </div>
      )}
    </section>
  );
}

export const ChartPanel = memo(ChartPanelComponent);
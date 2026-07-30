import { memo, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Data, Layout } from 'plotly.js';
import { fetchWithTimeout, generateId, PLOTLY_INTERVAL } from './utils';

const Plot = lazy(() => import('./Plot'));

const fields = ['time', ...[16, 16, 32].flatMap((n, t) => Array.from({ length: n }, (_, i) => `${['raw', 'phy', 'param'][t]}_${i.toString().padStart(2, '0')}`))];

type Card = { id: string; x: string; y: string };
type ChartSeries = { x: number[]; y: (number | null)[]; xLabel: string; yLabel: string };

const EMPTY_SERIES: ChartSeries = { x: [], y: [], xLabel: 'x', yLabel: 'y' };
const PLOT_CONFIG = { displayModeBar: false };

const hasWebGLSupport = () => {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
};

const calcRange = (values: (number | null)[]) => {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (value == null || !Number.isFinite(value)) continue;
    if (value < min) min = value;
    if (value > max) max = value;
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) return undefined;
  const range = max - min;
  const margin = range * 0.05 || 1;
  return [min - margin, max + margin];
};

const sameNumberArray = (a: number[], b: number[]) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

const sameNullableNumberArray = (a: (number | null)[], b: (number | null)[]) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

const sameSeries = (a: ChartSeries | undefined, b: ChartSeries | undefined) => {
  if (!a || !b) return false;
  return a.xLabel === b.xLabel
    && a.yLabel === b.yLabel
    && sameNumberArray(a.x, b.x)
    && sameNullableNumberArray(a.y, b.y);
};

const Select = memo(({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <select value={value} onChange={e => onChange(e.target.value)} className="text-black bg-white rounded px-2 py-1">
    {fields.map(f => <option key={f} value={f}>{f.replace(/^param_/, 'par_')}</option>)}
  </select>
));

const ChartCard = memo(({ card, onRemove, onUpdate, data, xLabel, yLabel, webglEnabled }: {
  card: Card;
  onRemove: (id: string) => void;
  onUpdate: (id: string, axis: 'x' | 'y', v: string) => void;
  data: { x: number[]; y: (number | null)[] };
  xLabel: string;
  yLabel: string;
  webglEnabled: boolean;
}) => {
  const xRange = useMemo(() => calcRange(data.x), [data.x]);
  const yRange = useMemo(() => calcRange(data.y), [data.y]);

  const traceType = webglEnabled ? 'scattergl' : 'scatter';

  const plotData = useMemo<Data[]>(
    () => [{ x: data.x, y: data.y, type: traceType, mode: 'lines', line: { color: '#1f77b4', width: 2 }, connectgaps: true }],
    [data.x, data.y, traceType]
  );

  const layout = useMemo<Partial<Layout>>(() => ({
    autosize: true,
    margin: { l: 70, r: 20, t: 20, b: 40 },
    xaxis: { title: { text: xLabel }, range: xRange, zeroline: false, linecolor: 'black', linewidth: 1, mirror: true, ticks: 'outside' as const },
    yaxis: { title: { text: yLabel }, range: yRange, zeroline: false, linecolor: 'black', linewidth: 1, mirror: true, ticks: 'outside' as const },
    paper_bgcolor: 'white',
    plot_bgcolor: 'white'
  }), [xLabel, xRange, yLabel, yRange]);

  return (
    <div className="border border-white/10 rounded p-2">
      <div className="flex items-center gap-2 mb-2">
        <label className="flex items-center gap-2">X:<Select value={card.x} onChange={v => onUpdate(card.id, 'x', v)} /></label>
        <label className="flex items-center gap-2">Y:<Select value={card.y} onChange={v => onUpdate(card.id, 'y', v)} /></label>
        <button onClick={() => onRemove(card.id)} className="ml-auto">✕</button>
      </div>
      <div className="bg-white rounded aspect-[4/3]">
        <Suspense fallback={<div className="flex items-center justify-center h-64 text-gray-500">Loading chart...</div>}>
          <Plot
            data={plotData}
            layout={layout}
            config={PLOT_CONFIG}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler
          />
        </Suspense>
      </div>
    </div>
  );
});

const loadCardsFromCookie = (): Card[] => {
  try {
    const cookie = document.cookie.split('; ').find(row => row.startsWith('chartCards='));
    if (cookie) {
      const data = JSON.parse(decodeURIComponent(cookie.split('=')[1]));
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch (e) {
    console.error('Failed to load chart cards from cookie', e);
  }
  return [{ id: generateId(), x: 'time', y: 'raw_00' }];
};

const saveCardsToCookie = (cards: Card[]) => {
  try {
    const data = JSON.stringify(cards.map(c => ({ id: c.id, x: c.x, y: c.y })));
    document.cookie = `chartCards=${encodeURIComponent(data)}; path=/; max-age=31536000`;
  } catch (e) {
    console.error('Failed to save chart cards to cookie', e);
  }
};

export const ChartPreviewArea = () => {
  const [cards, setCards] = useState<Card[]>(() => loadCardsFromCookie());
  const [chartData, setChartData] = useState<Record<string, ChartSeries>>({});
  const [webglEnabled] = useState(() => hasWebGLSupport());
  const requestInFlight = useRef(false);

  useEffect(() => {
    saveCardsToCookie(cards);
  }, [cards]);

  useEffect(() => {
    let active = true;
    const update = async () => {
      if (!active || requestInFlight.current) return;
      if (!cards.length) {
        setChartData({});
        return;
      }

      requestInFlight.current = true;
      const params = [...new Set(cards.flatMap(c => [c.x, c.y]))].join('&');
      try {
        const res = await fetchWithTimeout(`/v1/preview${params ? '?' + params : ''}`);
        if (!active || !res.ok) return;
        const json = await res.json();
        const data_list: Record<string, number[]> = {};
        const labels: Record<string, string> = {};

        if (json?.data) {
          Object.assign(data_list, json.data);
          if (json.label) Object.entries(json.label).forEach(([k, v]) => { labels[k] = String(v); });
        } else {
          Object.entries(json).forEach(([k, v]) => {
            const obj = v as { data?: number[]; label?: string };
            if (obj?.data) data_list[k] = obj.data;
            if (obj?.label) labels[k] = String(obj.label);
          });
        }

        const nextData = Object.fromEntries(cards.map(c => {
          const xSource = data_list[c.x] ?? [];
          const ySource = data_list[c.y] ?? [];
          const len = Math.min(xSource.length, ySource.length);
          const x = xSource.slice(0, len).map(Number);
          const y = ySource.slice(0, len).map(v => {
            const num = Number(v);
            return Number.isFinite(num) ? num : null;
          });

          return [c.id, {
            x,
            y,
            xLabel: labels[c.x] ?? c.x,
            yLabel: labels[c.y] ?? c.y
          }];
        })) as Record<string, ChartSeries>;

        setChartData(prev => {
          const prevKeys = Object.keys(prev);
          const nextKeys = Object.keys(nextData);
          if (prevKeys.length !== nextKeys.length) return nextData;

          for (let i = 0; i < nextKeys.length; i += 1) {
            const key = nextKeys[i];
            if (!sameSeries(prev[key], nextData[key])) return nextData;
          }
          return prev;
        });
      } catch (err) {
        console.error('preview fetch error', err);
      } finally {
        requestInFlight.current = false;
      }
    };
    update();
    const id = setInterval(update, PLOTLY_INTERVAL);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [cards]);

  const updateCardAxis = useCallback((id: string, axis: 'x' | 'y', v: string) => {
    setCards(prev => prev.map(c => (c.id === id ? { ...c, [axis]: v } : c)));
  }, []);

  const removeCard = useCallback((id: string) => {
    setCards(prev => prev.filter(c => c.id !== id));
  }, []);

  const addCard = useCallback(() => {
    setCards(prev => [...prev, { id: generateId(), x: 'time', y: 'raw_00' }]);
  }, []);

  return (
    <div className="border border-white/40 rounded-lg mb-2">
      <div className="font-bold px-3 py-1 border-b border-white/40 relative">
        Charts
        <span className="ml-3 text-xs font-normal opacity-80">{webglEnabled ? 'GPU: WebGL enabled' : 'GPU: fallback (scatter)'}</span>
        <button onClick={addCard} className="absolute right-2 top-1/2 -translate-y-1/2">＋</button>
      </div>
      <div className="p-2 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(c => (
          <ChartCard
            key={c.id}
            card={c}
            onRemove={removeCard}
            onUpdate={updateCardAxis}
            data={chartData[c.id] ?? EMPTY_SERIES}
            xLabel={chartData[c.id]?.xLabel ?? c.x}
            yLabel={chartData[c.id]?.yLabel ?? c.y}
            webglEnabled={webglEnabled}
          />
        ))}
      </div>
    </div>
  );
};

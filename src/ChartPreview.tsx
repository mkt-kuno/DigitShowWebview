import { useState, useEffect, lazy, Suspense } from 'react';
import { fetchWithTimeout, generateId, CHART_INTERVAL } from './utils';

const Plot = lazy(() => import('./Plot'));

const fields = ['time', ...[16, 16, 32].flatMap((n, t) => Array.from({ length: n }, (_, i) => `${['raw', 'phy', 'param'][t]}_${i.toString().padStart(2, '0')}`))];

type Card = { id: string; x: string; y: string };

const Select = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <select value={value} onChange={e => onChange(e.target.value)} className="text-black bg-white rounded px-2 py-1">
    {fields.map(f => <option key={f} value={f}>{f}</option>)}
  </select>
);

const ChartCard = ({ card, onRemove, onUpdate, data, xLabel, yLabel }: {
  card: Card;
  onRemove: (id: string) => void;
  onUpdate: (id: string, axis: 'x' | 'y', v: string) => void;
  data: { x: number[]; y: (number | null)[] };
  xLabel: string;
  yLabel: string;
}) => {
  const calcRange = (values: (number | null)[]) => {
    const valid = values.filter((v): v is number => v != null && Number.isFinite(v));
    if (valid.length === 0) return undefined;
    const min = Math.min(...valid);
    const max = Math.max(...valid);
    const range = max - min;
    const margin = range * 0.05 || 1;
    return [min - margin, max + margin];
  };

  const xRange = calcRange(data.x);
  const yRange = calcRange(data.y);

  return (
    <div className="border border-white/10 rounded p-2">
      <div className="flex items-center gap-2 mb-2">
        <label className="flex items-center gap-2">X:<Select value={card.x} onChange={v => onUpdate(card.id, 'x', v)} /></label>
        <label className="flex items-center gap-2">Y:<Select value={card.y} onChange={v => onUpdate(card.id, 'y', v)} /></label>
        <button onClick={() => onRemove(card.id)} className="ml-auto">✕</button>
      </div>
      <div className="bg-white rounded aspect-4/3">
        <Suspense fallback={<div className="flex items-center justify-center h-64 text-gray-500">Loading chart...</div>}>
          <Plot
            data={[{ x: data.x, y: data.y, type: 'scattergl', mode: 'lines', line: { color: '#1f77b4', width: 2 }, connectgaps: true }]}
            layout={{
              autosize: true,
              margin: { l: 70, r: 20, t: 20, b: 40 },
              xaxis: { title: { text: xLabel }, range: xRange, zeroline: false, linecolor: 'black', linewidth: 1, mirror: true, ticks: 'outside' },
              yaxis: { title: { text: yLabel }, range: yRange, zeroline: false, linecolor: 'black', linewidth: 1, mirror: true, ticks: 'outside' },
              paper_bgcolor: 'white',
              plot_bgcolor: 'white'
            }}
            config={{ displayModeBar: false }}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler
          />
        </Suspense>
      </div>
    </div>
  );
};

export const ChartPreviewArea = () => {
  const [cards, setCards] = useState<Card[]>([{ id: generateId(), x: 'time', y: 'raw_00' }]);
  const [chartData, setChartData] = useState<Record<string, { x: number[]; y: (number | null)[]; xLabel: string; yLabel: string }>>({});

  useEffect(() => {
    let mounted = true;
    const update = async () => {
      if (!cards.length) return;
      const params = [...new Set(cards.flatMap(c => [c.x, c.y]))].join('&');
      try {
        const res = await fetchWithTimeout(`/v1/preview${params ? '?' + params : ''}`);
        if (!mounted || !res.ok) return;
        const json = await res.json();
        const lists: Record<string, number[]> = {};
        const labels: Record<string, string> = {};

        if (json?.list) {
          Object.assign(lists, json.list);
          if (json.label) Object.entries(json.label).forEach(([k, v]) => { labels[k] = String(v); });
        } else {
          Object.entries(json).forEach(([k, v]) => {
            const obj = v as { list?: number[]; label?: string };
            if (obj?.list) lists[k] = obj.list;
            if (obj?.label) labels[k] = String(obj.label);
          });
        }

        setChartData(Object.fromEntries(cards.map(c => [c.id, {
          x: lists[c.x]?.slice(0, Math.min(lists[c.x]?.length ?? 0, lists[c.y]?.length ?? 0)).map(Number) ?? [],
          y: lists[c.y]?.slice(0, Math.min(lists[c.x]?.length ?? 0, lists[c.y]?.length ?? 0)).map(v => v == null || !Number.isFinite(+v) ? null : +v) ?? [],
          xLabel: labels[c.x] ?? c.x,
          yLabel: labels[c.y] ?? c.y
        }])));
      } catch (err) {
        console.error('preview fetch error', err);
      }
    };
    update();
    const id = setInterval(update, CHART_INTERVAL);
    return () => { mounted = false; clearInterval(id); };
  }, [cards]);

  const update = (id: string, axis: 'x' | 'y', v: string) => setCards(prev => prev.map(c => c.id === id ? { ...c, [axis]: v } : c));

  return (
    <div className="border border-white/40 rounded-lg mb-2">
      <div className="font-bold px-3 py-1 border-b border-white/40 relative">
        Charts
        <button onClick={() => setCards(p => [...p, { id: generateId(), x: 'time', y: 'raw_00' }])} className="absolute right-2 top-1/2 -translate-y-1/2">＋</button>
      </div>
      <div className="p-2 grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {cards.map(c => (
          <ChartCard
            key={c.id}
            card={c}
            onRemove={id => setCards(p => p.filter(c => c.id !== id))}
            onUpdate={update}
            data={chartData[c.id] ?? { x: [], y: [] }}
            xLabel={chartData[c.id]?.xLabel ?? c.x}
            yLabel={chartData[c.id]?.yLabel ?? c.y}
          />
        ))}
      </div>
    </div>
  );
};

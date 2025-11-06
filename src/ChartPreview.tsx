import { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
import { fetchWithTimeout, generateId, CHART_INTERVAL } from './utils';

const fields = [
  'time',
  ...Array.from({ length: 16 }, (_, i) => `raw_${String(i).padStart(2, '0')}`),
  ...Array.from({ length: 16 }, (_, i) => `phy_${String(i).padStart(2, '0')}`),
  ...Array.from({ length: 32 }, (_, i) => `param_${String(i).padStart(2, '0')}`),
];

type Card = { id: string; x: string; y: string };

interface ChartCardProps {
  card: Card;
  onRemove: (id: string) => void;
  onUpdateX: (id: string, x: string) => void;
  onUpdateY: (id: string, y: string) => void;
  data: { x: number[]; y: (number | null)[] };
  xLabel: string;
  yLabel: string;
}

const ChartCard = ({ card, onRemove, onUpdateX, onUpdateY, data, xLabel, yLabel }: ChartCardProps) => (
  <div className="border border-white/10 rounded p-2">
    <div className="flex items-center gap-2 mb-2">
      <label className="flex items-center gap-2">
        X:
        <select
          value={card.x}
          onChange={e => onUpdateX(card.id, e.target.value)}
          className="text-black bg-white rounded px-2 py-1"
        >
          {fields.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </label>
      <label className="flex items-center gap-2">
        Y:
        <select
          value={card.y}
          onChange={e => onUpdateY(card.id, e.target.value)}
          className="text-black bg-white rounded px-2 py-1"
        >
          {fields.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </label>
      <button onClick={() => onRemove(card.id)} className="ml-auto">✕</button>
    </div>
    <div className="bg-white rounded">
      <Plot
        data={[
          {
            x: data.x,
            y: data.y,
            type: 'scattergl',
            mode: 'lines',
            line: { color: '#1f77b4', width: 2 },
            connectgaps: true,
          },
        ]}
        layout={{
          autosize: true,
          margin: { l: 40, r: 20, t: 20, b: 40 },
          xaxis: { title: { text: xLabel } },
          yaxis: { title: { text: yLabel } },
          paper_bgcolor: 'white',
          plot_bgcolor: 'white',
        }}
        config={{ displayModeBar: false }}
        style={{ width: '100%', height: '100%' }}
        useResizeHandler
      />
    </div>
  </div>
);

export const ChartPreviewArea = () => {
  const [cards, setCards] = useState<Card[]>([{ id: generateId(), x: 'time', y: 'raw_00' }]);
  const [chartData, setChartData] = useState<Record<string, { x: number[]; y: (number | null)[]; xLabel: string; yLabel: string }>>({});

  useEffect(() => {
    let isMounted = true;

    const fetchAndUpdate = async () => {
      if (cards.length === 0) return;
      
      const needed = new Set<string>();
      cards.forEach(c => { needed.add(c.x); needed.add(c.y); });
      const params = Array.from(needed).join('&');
      const url = params ? `/v1/preview?${params}` : `/v1/preview`;

      try {
        const res = await fetchWithTimeout(url);
        if (!isMounted || !res.ok) return;
        const json = await res.json();
        const lists: Record<string, number[]> = {};
        const labelMap: Record<string, string> = {};

        if (json && typeof json === 'object') {
          if (json.list) {
            Object.assign(lists, json.list);
            if (json.label && typeof json.label === 'object' && !Array.isArray(json.label)) {
              Object.entries(json.label).forEach(([k, v]) => { labelMap[k] = String(v); });
            }
          } else {
            Object.entries(json).forEach(([k, v]) => {
              if (v && typeof v === 'object') {
                if (Array.isArray((v as { list?: unknown }).list)) lists[k] = (v as { list: number[] }).list;
                if ((v as { label?: unknown }).label !== undefined) labelMap[k] = String((v as { label: string }).label);
              }
            });
          }
        }

        const newChartData: Record<string, { x: number[]; y: (number | null)[]; xLabel: string; yLabel: string }> = {};
        cards.forEach(card => {
          const xArr = lists[card.x];
          const yArr = lists[card.y];

          const xData: number[] = [];
          const yData: (number | null)[] = [];
          
          if (Array.isArray(xArr) && Array.isArray(yArr)) {
            const len = Math.min(xArr.length, yArr.length);
            for (let i = 0; i < len; i++) {
              const xVal = Number(xArr[i]);
              const yValRaw = yArr[i];
              const yVal = (yValRaw === null || yValRaw === undefined || (typeof yValRaw === 'number' && !Number.isFinite(yValRaw))) ? null : Number(yValRaw);
              xData.push(xVal);
              yData.push(yVal);
            }
          }

          newChartData[card.id] = {
            x: xData,
            y: yData,
            xLabel: labelMap[card.x] || card.x,
            yLabel: labelMap[card.y] || card.y,
          };
        });

        setChartData(newChartData);
      } catch (err) {
        console.error('preview fetch error', err);
      }
    };

    fetchAndUpdate();
    const id = setInterval(fetchAndUpdate, CHART_INTERVAL);
    return () => {
      isMounted = false;
      clearInterval(id);
    };
  }, [cards]);

  const addCard = () => {
    setCards(prev => [...prev, { id: generateId(), x: 'time', y: 'raw_00' }]);
  };

  const removeCard = (id: string) => {
    setCards(prev => prev.filter(c => c.id !== id));
  };

  const updateX = (id: string, x: string) => {
    setCards(prev => prev.map(c => c.id === id ? { ...c, x } : c));
  };

  const updateY = (id: string, y: string) => {
    setCards(prev => prev.map(c => c.id === id ? { ...c, y } : c));
  };

  return (
    <div className="border border-white/40 rounded-lg mb-2">
      <div className="font-bold px-3 py-1 border-b border-white/40 relative">
        Charts
        <button
          onClick={addCard}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-inherit bg-transparent border-0 cursor-pointer"
          aria-label="Add chart card"
        >
          ＋
        </button>
      </div>
      <div className="p-2 grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {cards.map(card => (
          <ChartCard
            key={card.id}
            card={card}
            onRemove={removeCard}
            onUpdateX={updateX}
            onUpdateY={updateY}
            data={chartData[card.id] || { x: [], y: [] }}
            xLabel={chartData[card.id]?.xLabel || card.x}
            yLabel={chartData[card.id]?.yLabel || card.y}
          />
        ))}
      </div>
    </div>
  );
};

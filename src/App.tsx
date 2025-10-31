import { useState, useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

const ENDPOINT = "/v1/";
const TIMEOUT_MS = 5000;
const POLL_INTERVAL = 200;
const CHART_INTERVAL = 2000;

// Utility functions
const fetchWithTimeout = async (url: string, timeout = TIMEOUT_MS) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

// Simple storage with cookie fallback (for environments where localStorage is blocked)
const setCookie = (name: string, value: string, days = 365) => {
  try {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
  } catch {}
};

const getCookie = (name: string): string | null => {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
};

const storage = {
  get(key: string): string | null {
    try {
      const v = window.localStorage.getItem(key);
      if (v !== null) return v;
    } catch {}
    return getCookie(key);
  },
  set(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
    } catch {}
    setCookie(key, value);
  }
};

type DisplayValue = { text: string; invalid?: boolean };

const formatValue = (key: string, v: any): DisplayValue => {
  const needsGuard = key === 'phy' || key === 'param';

  // Invalid handling for phy/param
  if (needsGuard) {
    if (v == null) return { text: 'null', invalid: true };
    if (typeof v !== 'number') return { text: String(v), invalid: true };
    if (!Number.isFinite(v)) {
      if (Number.isNaN(v)) return { text: 'NaN', invalid: true };
      return { text: v > 0 ? '∞' : '-∞', invalid: true };
    }
  }

  if (typeof v !== 'number') return { text: String(v) };
  return { text: key === 'raw' ? v.toFixed(0) : v.toFixed(5) };
};
// Previously declared helper structures (range, PARAMS, ALL_PARAMS) were unused and removed for cleanliness.

interface DataItemProps {
  label: string;
  value: DisplayValue;
}

interface DataGroupProps {
  title: string;
  data: Record<string, { label?: string; value: any }>;
  categoryKey: string;
}

// DataItem Component
const DataItem = ({ label, value }: DataItemProps) => (
  <div style={{
    border: '1px solid rgba(255, 255, 255, 0.4)',
    borderRadius: '4px',
    padding: '4px',
    minWidth: '130px'
  }}>
    <div style={{ fontSize: '0.75rem', opacity: 0.75 }}>{label}</div>
    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', textAlign: 'right', color: value.invalid ? '#ff0000' : undefined }}>
      {value.text}
    </div>
  </div>
);

// DataGroup Component
const DataGroup = ({ title, data, categoryKey }: DataGroupProps) => {
  const storageKey = `dg-open-${categoryKey}`;
  const [open, setOpen] = useState<boolean>(() => {
    const v = storage.get(storageKey);
    return v === null ? true : v === '1';
  });
  const entries = Object.entries(data)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([id, obj]) => ({
      id: id.padStart(2, "0"),
      label: obj.label || id,
      value: formatValue(categoryKey, obj.value)
    }));

  return (
    <div style={{
      border: '1px solid rgba(255, 255, 255, 0.4)',
      borderRadius: '0.5rem',
      marginBottom: '0.5rem'
    }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontWeight: 'bold',
          padding: '0.25rem 0.75rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.4)'
        }}
      >
        <span>{title}</span>
        <button
          type="button"
          aria-label={open ? '折りたたむ' : '展開'}
          onClick={() => {
            setOpen(o => {
              const next = !o;
              storage.set(storageKey, next ? '1' : '0');
              return next;
            });
          }}
          style={{
            background: 'transparent',
            color: 'inherit',
            border: '1px solid rgba(255, 255, 255, 0.4)',
            borderRadius: '4px',
            fontSize: '0.9rem',
            padding: '0 0.5rem',
            lineHeight: '1.5rem',
            cursor: 'pointer'
          }}
        >
          {open ? '△' : '▽'}
        </button>
      </div>
      {open && (
        <div style={{ padding: '0.5rem' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '4px'
          }}>
            {entries.map(({ id, label, value }) => (
              <DataItem key={id} label={label} value={value} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ChartPreviewArea: multiple card-based charts using Chart.js
const ChartPreviewArea = () => {
  // fields available for X/Y selection
  const fields = [
    'time',
    ...Array.from({ length: 16 }, (_, i) => `raw_${String(i).padStart(2, '0')}`),
    ...Array.from({ length: 16 }, (_, i) => `phy_${String(i).padStart(2, '0')}`),
    ...Array.from({ length: 32 }, (_, i) => `param_${String(i).padStart(2, '0')}`),
  ];

  type Card = { id: string; x: string; y: string };
  const [cards, setCards] = useState<Card[]>([{ id: 'c0', x: 'time', y: 'phy_00' }]);
  const chartsRef = useRef<Record<string, Chart | null>>({});

  // helper to add a card
  const addCard = () => {
    setCards(prev => [...prev, { id: `c${Date.now()}`, x: 'time', y: 'phy_00' }]);
  };
  const removeCard = (id: string) => {
    setCards(prev => prev.filter(c => c.id !== id));
    // destroy chart if exists
    const ch = chartsRef.current[id];
    if (ch) {
      ch.destroy();
      delete chartsRef.current[id];
    }
  };

  // create or update a Chart.js instance for a card canvas
  const ensureChart = (id: string, canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    if (chartsRef.current[id]) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    chartsRef.current[id] = new Chart(ctx, {
      type: 'scatter',
      // cast datasets to any to avoid strict Chart.js dataset typing issues in TS
      data: { labels: [], datasets: ([{ label: id, data: [], showLine: true, pointRadius: 0, borderWidth: 2, tension: 0.2, spanGaps: true, borderColor: '#1976d2' }]) as any },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: true } },
        elements: { point: { radius: 0 } },
      }
    });
  };

  // Batch fetch and update charts
  useEffect(() => {
    let isMounted = true;

    const fetchAndUpdate = async () => {
      if (cards.length === 0) return;
      // gather unique fields needed across cards
      const needed = new Set<string>();
      cards.forEach(c => { needed.add(c.x); needed.add(c.y); });
      const params = Array.from(needed).join('&');
      const url = params ? `/v1/preview?${params}` : `/v1/preview`;

      try {
        const res = await fetchWithTimeout(url);
        if (!isMounted || !res.ok) return;
        const json = await res.json();

        // Support two response shapes:
        // 1) legacy: { label?: string[] | {field:label}, list: { [field]: number[] } }
        // 2) new/sample: { fieldName: { label: string, list: number[] }, ... }

        const lists: Record<string, any[]> = {};
        const labelMap: Record<string, string> = {};

        if (json && typeof json === 'object') {
          if (json.list) {
            // legacy shape
            Object.assign(lists, json.list);
            if (json.label && typeof json.label === 'object' && !Array.isArray(json.label)) {
              Object.entries(json.label).forEach(([k, v]) => { labelMap[k] = String(v); });
            }
          } else {
            // new/sample shape: top-level keys are fields
            Object.entries(json).forEach(([k, v]) => {
              if (v && typeof v === 'object') {
                if (Array.isArray((v as any).list)) lists[k] = (v as any).list;
                if ((v as any).label !== undefined) labelMap[k] = String((v as any).label);
              }
            });
          }
        }

        // Update each card's chart
        cards.forEach(card => {
          const ch = chartsRef.current[card.id];
          if (!ch) return;

          const xArr = lists[card.x];
          const yArr = lists[card.y];

          const dataPoints: { x: number; y: number | null }[] = [];
          if (Array.isArray(xArr) && Array.isArray(yArr)) {
            const len = Math.min(xArr.length, yArr.length);
            for (let i = 0; i < len; i++) {
              const xVal = Number(xArr[i]);
              const yValRaw = yArr[i];
              const yVal = (yValRaw === null || yValRaw === undefined || (typeof yValRaw === 'number' && !Number.isFinite(yValRaw))) ? null : Number(yValRaw);
              dataPoints.push({ x: xVal, y: yVal });
            }
          }
          if (!ch.data.datasets || ch.data.datasets.length === 0) {
            ch.data.datasets = ([{ label: labelMap[card.y] || card.y, data: dataPoints, showLine: true, pointRadius: 0, borderWidth: 2, tension: 0.2, spanGaps: true, borderColor: '#1976d2' }]) as any;
          } else {
            (ch.data.datasets[0] as any).label = labelMap[card.y] || card.y;
            (ch.data.datasets[0] as any).data = dataPoints;
            (ch.data.datasets[0] as any).pointRadius = 0;
            (ch.data.datasets[0] as any).borderWidth = 2;
            (ch.data.datasets[0] as any).tension = 0.2;
            (ch.data.datasets[0] as any).spanGaps = true;
            (ch.data.datasets[0] as any).borderColor = '#1976d2';
          }

          ch.update();
        });
      } catch (err) {
        // silent
        console.error('preview fetch error', err);
      }
    };

    // run immediately, then interval
    fetchAndUpdate();
    const id = setInterval(fetchAndUpdate, CHART_INTERVAL);
    return () => {
      isMounted = false;
      clearInterval(id);
    };
  }, [cards]);

  return (
    <div className="border border-white/40 rounded-lg mb-2">
      <div className="font-bold px-3 py-1 border-b border-white/40 relative">
        Charts (v4.3.0 or newer)
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
          <div key={card.id} className="border border-white/10 rounded p-2">
            <div className="flex items-center gap-2 mb-2">
              <label className="flex items-center gap-2">X:
                <select
                  value={card.x}
                  onChange={e => setCards(cs => cs.map(c => c.id === card.id ? { ...c, x: e.target.value } : c))}
                  className="text-black bg-white rounded px-2 py-1"
                >
                  {fields.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2">Y:
                <select
                  value={card.y}
                  onChange={e => setCards(cs => cs.map(c => c.id === card.id ? { ...c, y: e.target.value } : c))}
                  className="text-black bg-white rounded px-2 py-1"
                >
                  {fields.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>
              <button onClick={() => removeCard(card.id)} className="ml-auto">✕</button>
            </div>
            <div className="bg-white p-1 rounded aspect-video">
              <canvas ref={el => ensureChart(card.id, el as HTMLCanvasElement | null)} className="w-full h-full bg-white" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ChartImages Component
const ChartImages = () => {
  const [errorA, setErrorA] = useState(false);
  const [errorB, setErrorB] = useState(false);
  const [imageA, setImageA] = useState<string | null>(null);
  const [imageB, setImageB] = useState<string | null>(null);
  // Keep track of object URLs to revoke and avoid memory leaks
  const prevUrlA = useRef<string | null>(null);
  const prevUrlB = useRef<string | null>(null);

  // Collapsible state (persisted like other cards)
  const storageKey = 'chart-images-open';
  const [open, setOpen] = useState<boolean>(() => {
    const v = storage.get(storageKey);
    return v === null ? true : v === '1';
  });

  useEffect(() => {
    if (!open) return; // do not request resources when collapsed
    let isMounted = true;

    const refresh = async () => {
      const urlA = `/v1/img/chart_a`;
      const urlB = `/v1/img/chart_b`;

      const [resA, resB] = await Promise.allSettled([
        fetchWithTimeout(urlA),
        fetchWithTimeout(urlB)
      ]);

      if (!isMounted) return;

      // Update A only on success; create object URL to avoid duplicate network request by <img>
      if (resA.status === 'fulfilled' && resA.value.ok) {
        try {
          const blob = await resA.value.blob();
          const nextUrl = URL.createObjectURL(blob);
          if (prevUrlA.current) URL.revokeObjectURL(prevUrlA.current);
          prevUrlA.current = nextUrl;
          setImageA(nextUrl);
          setErrorA(false);
        } catch {
          setErrorA(true);
        }
      } else {
        setErrorA(true);
      }

      // Update B only on success
      if (resB.status === 'fulfilled' && resB.value.ok) {
        try {
          const blob = await resB.value.blob();
          const nextUrl = URL.createObjectURL(blob);
          if (prevUrlB.current) URL.revokeObjectURL(prevUrlB.current);
          prevUrlB.current = nextUrl;
          setImageB(nextUrl);
          setErrorB(false);
        } catch {
          setErrorB(true);
        }
      } else {
        setErrorB(true);
      }
    };

    refresh();
    const id = setInterval(refresh, CHART_INTERVAL);
    return () => {
      isMounted = false;
      clearInterval(id);
    };
  }, [open]);

  // Cleanup object URLs only when component unmounts
  useEffect(() => {
    return () => {
      if (prevUrlA.current) URL.revokeObjectURL(prevUrlA.current);
      if (prevUrlB.current) URL.revokeObjectURL(prevUrlB.current);
    };
  }, []);

  return (
    <div style={{
      border: '1px solid rgba(255, 255, 255, 0.4)',
      borderRadius: '0.5rem',
      marginBottom: '0.5rem'
    }}>
      <div style={{
        fontWeight: 'bold',
        padding: '0.25rem 0.75rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.4)'
      }}>
        <span>Legacy Charts (v4.2.1 or older)</span>
        <button
          type="button"
          aria-label={open ? '折りたたむ' : '展開'}
          onClick={() => {
            setOpen(o => {
              const next = !o;
              storage.set(storageKey, next ? '1' : '0');
              return next;
            });
          }}
          style={{
            float: 'right',
            background: 'transparent',
            color: 'inherit',
            border: '1px solid rgba(255, 255, 255, 0.4)',
            borderRadius: '4px',
            fontSize: '0.9rem',
            padding: '0 0.5rem',
            lineHeight: '1.5rem',
            cursor: 'pointer'
          }}
        >
          {open ? '△' : '▽'}
        </button>
      </div>
      {open && (
      <div style={{ padding: '0.5rem' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '0.75rem'
        }}>
          <div style={{ opacity: errorA ? 0.5 : 1 }}>
            {imageA ? (
              <img
                src={imageA}
                alt={errorA ? 'Chart A (load failed)' : 'Chart A'}
                style={{
                  width: '100%',
                  height: 'auto',
                  borderRadius: '0.25rem',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  background: 'rgba(255, 255, 255, 0.05)'
                }}
                onError={() => setErrorA(true)}
                onLoad={() => setErrorA(false)}
              />
            ) : (
              <div style={{
                width: '100%',
                height: '200px',
                borderRadius: '0.25rem',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(255, 255, 255, 0.05)'
              }} />
            )}
          </div>
          <div style={{ opacity: errorB ? 0.5 : 1 }}>
            {imageB ? (
              <img
                src={imageB}
                alt={errorB ? 'Chart B (load failed)' : 'Chart B'}
                style={{
                  width: '100%',
                  height: 'auto',
                  borderRadius: '0.25rem',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  background: 'rgba(255, 255, 255, 0.05)'
                }}
                onError={() => setErrorB(true)}
                onLoad={() => setErrorB(false)}
              />
            ) : (
              <div style={{
                width: '100%',
                height: '200px',
                borderRadius: '0.25rem',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(255, 255, 255, 0.05)'
              }} />
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
};

// Main App Component
export default function App() {
  const [data, setData] = useState<any>(null);
  const [bgColor, setBgColor] = useState('#002020');

  const categories = [
    { key: "raw", title: "Raw Value (int16_t −32768 to +32767)" },
    { key: "phy", title: "Physical Value" },
    { key: "param", title: "Parameter" },
    { key: "output", title: "Voltage Output" }
  ];

  useEffect(() => {
    let isMounted = true;

    const poll = async () => {
      try {
        const res = await fetchWithTimeout(ENDPOINT);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        
        if (isMounted) {
          setData(json);
          const color = json?.system?.color || '#002020';
          setBgColor(color);
        }
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        if (isMounted) {
          setTimeout(poll, POLL_INTERVAL);
        }
      }
    };

    poll();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      color: '#ffffff',
      padding: '0.5rem',
      backgroundColor: bgColor
    }}>
      <div style={{ maxWidth: '1536px', margin: '0 auto' }}>
        <h1 style={{
          fontSize: '1.5rem',
          fontWeight: 'bold',
          textAlign: 'center',
          marginBottom: '0.5rem'
        }}>
          DigiShowWebview
        </h1>

        {data && (
          <>
            {categories.map(cat => 
              data[cat.key] && (
                <DataGroup
                  key={cat.key}
                  title={cat.title}
                  data={data[cat.key]}
                  categoryKey={cat.key}
                />
              )
            )}
          </>
        )}

        <ChartImages />
        <ChartPreviewArea />
      </div>
    </div>
  );
}
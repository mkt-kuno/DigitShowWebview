import { useState, useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

const ENDPOINT = "/v1/";
const TIMEOUT_MS = 4000;
const POLL_INTERVAL = 200;

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

const formatValue = (key: string, v: any) => {
  if (typeof v !== "number") return v;
  return key === "raw" ? v.toFixed(0) : v.toFixed(5);
};

const range = (n: number) => Array.from({ length: n }, (_, i) => i.toString().padStart(2, '0'));

const PARAMS = {
  time: ['time'],
  raw: range(16).map(i => `raw_${i}`),
  phy: range(16).map(i => `phy_${i}`),
  param: range(32).map(i => `param_${i}`),
  output: range(16).map(i => `output_${i}`),
};

const ALL_PARAMS = [PARAMS.time[0], ...PARAMS.phy, ...PARAMS.raw, ...PARAMS.param, ...PARAMS.output];

interface DataItemProps {
  label: string;
  value: string;
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
    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', textAlign: 'right' }}>{value}</div>
  </div>
);

// DataGroup Component
const DataGroup = ({ title, data, categoryKey }: DataGroupProps) => {
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
      <div style={{
        fontWeight: 'bold',
        padding: '0.25rem 0.75rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.4)'
      }}>
        {title}
      </div>
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
    </div>
  );
};

// ChartImages Component
const ChartImages = () => {
  const [timestamp, setTimestamp] = useState(Date.now());
  const [errorA, setErrorA] = useState(false);
  const [errorB, setErrorB] = useState(false);

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
        Charts (fallback images)
      </div>
      <div style={{ padding: '0.5rem' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '0.75rem'
        }}>
          <div style={{ opacity: errorA ? 0.5 : 1 }}>
            <img
              src={`/v1/img/chart_a?ts=${timestamp}`}
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
          </div>
          <div style={{ opacity: errorB ? 0.5 : 1 }}>
            <img
              src={`/v1/img/chart_b?ts=${timestamp}`}
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
          </div>
        </div>
      </div>
    </div>
  );
};

// ChartPreview Component
const ChartPreview = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const [xAxis, setXAxis] = useState('time');
  const [yAxes, setYAxes] = useState(['phy_00', 'phy_01']);
  const [loading, setLoading] = useState(false);

  const yParams = [...PARAMS.phy, ...PARAMS.raw, ...PARAMS.param, ...PARAMS.output];

  const handleYChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const options = Array.from(e.target.selectedOptions);
    setYAxes(options.map(opt => opt.value));
  };

  const clearChart = () => {
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }
  };

  const fetchAndPlot = async () => {
    if (!xAxis || yAxes.length === 0) {
      alert('XとYを選択してください');
      return;
    }

    setLoading(true);
    const params = [xAxis, ...yAxes];
    const query = Array.from(new Set(params)).join('&');
    const url = `/v1/preview?${query}`;

    try {
      const res = await fetchWithTimeout(url, TIMEOUT_MS);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      const xList = json[xAxis]?.list || [];
      if (!Array.isArray(xList)) throw new Error('選択したXのlistが見つかりません');

      clearChart();

      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;

      const datasets = yAxes.map(tk => {
        const yList = json[tk]?.list || [];
        const label = json[tk]?.label || tk;
        const n = Math.min(xList.length, yList.length);
        const points = Array.from({ length: n }, (_, i) => ({ x: xList[i], y: yList[i] }));
        
        return {
          label,
          data: points,
          showLine: true,
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          tension: 0.2,
          parsing: false
        };
      });

      chartRef.current = new Chart(ctx, {
        type: 'scatter',
        data: { datasets },
        options: {
          animation: false,
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { 
              display: true,
              labels: { color: '#ffffff' }
            },
          },
          scales: {
            x: { 
              type: 'linear', 
              title: { display: true, text: xAxis, color: '#ffffff' },
              ticks: { color: '#ffffff' },
              grid: { color: 'rgba(255,255,255,0.1)' }
            },
            y: { 
              title: { display: true, text: 'value', color: '#ffffff' },
              ticks: { color: '#ffffff' },
              grid: { color: 'rgba(255,255,255,0.1)' }
            }
          },
        }
      });
    } catch (e: any) {
      console.error(e);
      alert('プレビュー取得に失敗しました: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => clearChart();
  }, []);

  const selectStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.25rem 0.5rem',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    borderRadius: '0.25rem',
    color: '#ffffff',
    fontSize: '0.875rem'
  };

  const buttonStyle: React.CSSProperties = {
    padding: '0.5rem 1rem',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.4)',
    borderRadius: '0.25rem',
    fontSize: '0.875rem',
    color: '#ffffff',
    cursor: 'pointer',
    transition: 'background 0.2s'
  };

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
        Preview JSON → Chart.js (X/Y選択式)
      </div>
      <div style={{ padding: '0.5rem' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '0.5rem',
          marginBottom: '0.5rem',
          alignItems: 'end'
        }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem' }}>X軸</label>
            <select 
              value={xAxis}
              onChange={(e) => setXAxis(e.target.value)}
              style={selectStyle}
            >
              {ALL_PARAMS.map(param => (
                <option key={param} value={param}>{param}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Y軸(複数可)</label>
            <select 
              multiple
              value={yAxes}
              onChange={handleYChange}
              style={{ ...selectStyle, height: '6rem' }}
            >
              {yParams.map(param => (
                <option key={param} value={param}>{param}</option>
              ))}
            </select>
            <div style={{ fontSize: '0.7rem', opacity: 0.6, marginTop: '0.25rem' }}>Ctrl / ⌘ で複数選択</div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={fetchAndPlot}
              disabled={loading}
              style={{ ...buttonStyle, opacity: loading ? 0.5 : 1, flex: 1 }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
            >
              {loading ? '取得中...' : '取得 & 描画'}
            </button>
            <button
              onClick={clearChart}
              style={{ ...buttonStyle, flex: 1 }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
            >
              クリア
            </button>
          </div>
        </div>
        <div style={{ height: '260px', background: '#ffffff', borderRadius: '0.25rem' }}>
          <canvas ref={canvasRef} />
        </div>
      </div>
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
        <ChartPreview />
      </div>
    </div>
  );
}
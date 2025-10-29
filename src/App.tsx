import { useState, useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

const ENDPOINT = "/v1/";
const TIMEOUT_MS = 4000;
const POLL_INTERVAL = 200;
const CHART_INTERVAL = 5000;

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
// Previously declared helper structures (range, PARAMS, ALL_PARAMS) were unused and removed for cleanliness.

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
  const [errorA, setErrorA] = useState(false);
  const [errorB, setErrorB] = useState(false);
  const [imageA, setImageA] = useState<string | null>(null);
  const [imageB, setImageB] = useState<string | null>(null);
  // Keep track of object URLs to revoke and avoid memory leaks
  const prevUrlA = useRef<string | null>(null);
  const prevUrlB = useRef<string | null>(null);

  useEffect(() => {
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
          // Revoke previous URL to free memory
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
      // Cleanup any object URLs on unmount
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
        Charts (fallback images)
      </div>
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
      </div>
    </div>
  );
}
import { useState, useEffect } from 'react';
import { DataGroup } from './DataDisplay';
import { ChartImages } from './ChartImages';
import { ChartPreviewArea } from './ChartPreview';

const ENDPOINT = "/v1/";
const TIMEOUT_MS = 5000;
const POLL_INTERVAL = 200;

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

const categories = [
  { key: "raw", title: "Raw Value (int16_t −32768 to +32767)" },
  { key: "phy", title: "Physical Value" },
  { key: "param", title: "Parameter" },
  { key: "output", title: "Voltage Output" }
];

export default function App() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [bgColor, setBgColor] = useState('#002020');

  useEffect(() => {
    let isMounted = true;

    const poll = async () => {
      try {
        const res = await fetchWithTimeout(ENDPOINT);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        
        if (isMounted) {
          setData(json);
          const color = (json?.system as { color?: string })?.color || '#002020';
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
    <div className="min-h-screen text-white p-2" style={{ backgroundColor: bgColor }}>
      <div className="max-w-[1536px] mx-auto">
        <h1 className="text-2xl font-bold text-center mb-2">
          DigitShowWebview
        </h1>

        {data && (
          <>
            {categories.map(cat => 
              data[cat.key] && (
                <DataGroup
                  key={cat.key}
                  title={cat.title}
                  data={data[cat.key] as Record<string, { label?: string; value: unknown }>}
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
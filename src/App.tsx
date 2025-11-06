import { useState, useEffect } from 'react';
import { DataGroup } from './DataDisplay';
import { ChartImages } from './ChartImages';
import { ChartPreviewArea } from './ChartPreview';
import { fetchWithTimeout, POLL_INTERVAL } from './utils';

const categories = [
  { key: "raw", title: "Raw Value (int16_t −32768 to +32767)" },
  { key: "phy", title: "Physical Value" },
  { key: "param", title: "Parameter" },
  { key: "output", title: "Voltage Output" }
] as const;

export default function App() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [bgColor, setBgColor] = useState('#002020');

  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      try {
        const res = await fetchWithTimeout("/v1/");
        if (!res.ok) throw Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!mounted) return;
        setData(json);
        setBgColor(json?.system?.color ?? '#002020');
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        if (mounted) setTimeout(poll, POLL_INTERVAL);
      }
    };
    poll();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="min-h-screen text-white p-2" style={{ backgroundColor: bgColor }}>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-center mb-2">DigitShowWebview</h1>
        {data && categories.map(({ key, title }) => 
          data[key] ? <DataGroup key={key} title={title} data={data[key] as Record<string, { label?: string; value: unknown }>} categoryKey={key} /> : null
        )}
        <ChartImages />
        <ChartPreviewArea />
      </div>
    </div>
  );
}
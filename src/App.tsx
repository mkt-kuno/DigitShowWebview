import { useEffect, useMemo, useRef, useState } from 'react';
import { DataGroup } from './DataDisplay';
import { ChartPreviewArea } from './ChartPreview';
import { fetchWithTimeout, POLL_INTERVAL } from './utils';
import { version } from '../package.json';

const categories = [
  { key: "raw", title: "Raw Value (int16_t −32768 to +32767)" },
  { key: "phy", title: "Physical Value" },
  { key: "param", title: "Parameter" },
  { key: "output", title: "Voltage Output" }
] as const;

type RootData = Record<string, unknown>;
type DataItem = { label?: string; value: unknown };
type GroupData = Record<string, DataItem>;

const isObject = (value: unknown): value is RootData => typeof value === 'object' && value !== null;

const CATEGORY_ALIASES: Record<(typeof categories)[number]['key'], string[]> = {
  raw: ['raw', 'Raw'],
  phy: ['phy', 'Phy', 'physical', 'Physical'],
  param: ['param', 'Param', 'parameter', 'Parameter'],
  output: ['output', 'Output', 'voltage', 'Voltage']
};

const toDataItem = (value: unknown): DataItem => {
  if (isObject(value) && 'value' in value) {
    return {
      label: typeof value.label === 'string' ? value.label : undefined,
      value: value.value
    };
  }
  return { value };
};

const normalizeGroupObject = (value: unknown): GroupData => {
  if (!isObject(value)) return {};
  const out: GroupData = {};
  Object.entries(value).forEach(([k, v]) => {
    out[k] = toDataItem(v);
  });
  return out;
};

const getLabelMap = (root: RootData): RootData => {
  const candidate = root.label ?? root.labels;
  return isObject(candidate) ? candidate : {};
};

const extractFlatGroup = (root: RootData, key: (typeof categories)[number]['key']): GroupData => {
  const out: GroupData = {};
  const labels = getLabelMap(root);
  const re = new RegExp(`^${key}[_-]?(\\d+)$`, 'i');

  Object.entries(root).forEach(([k, v]) => {
    const match = k.match(re);
    if (!match) return;

    const id = String(Number(match[1])).padStart(2, '0');
    const label = typeof labels[k] === 'string' ? String(labels[k]) : undefined;
    out[id] = { label, value: v };
  });

  return out;
};

const pickGroupFromAliases = (root: RootData, key: (typeof categories)[number]['key']): GroupData => {
  const aliases = CATEGORY_ALIASES[key];
  for (let i = 0; i < aliases.length; i += 1) {
    const alias = aliases[i];
    const group = normalizeGroupObject(root[alias]);
    if (Object.keys(group).length > 0) return group;
  }
  return extractFlatGroup(root, key);
};

const hasCategoryKeys = (value: unknown) => {
  if (!isObject(value)) return false;
  return categories.some(({ key }) => {
    const aliases = CATEGORY_ALIASES[key];
    return aliases.some(alias => alias in value);
  });
};

const normalizeRootData = (value: unknown): RootData | null => {
  if (!isObject(value)) return null;
  if (hasCategoryKeys(value)) return value;

  const candidates = [
    value.data,
    value.payload,
    value.content,
    value.result,
    value.body
  ];

  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    if (hasCategoryKeys(candidate)) return candidate as RootData;
  }

  return value;
};

const getGroups = (data: RootData | null): Partial<Record<(typeof categories)[number]['key'], GroupData>> => {
  if (!data) return {};

  const out: Partial<Record<(typeof categories)[number]['key'], GroupData>> = {};
  categories.forEach(({ key }) => {
    const group = pickGroupFromAliases(data, key);
    if (Object.keys(group).length > 0) out[key] = group;
  });
  return out;
};

export default function App() {
  const [data, setData] = useState<RootData | null>(null);
  const inFlight = useRef(false);
  const intervalId = useRef<number | null>(null);

  const bgColor = useMemo(() => {
    const candidate = data?.system as { color?: unknown } | undefined;
    return typeof candidate?.color === 'string' ? candidate.color : '#002020';
  }, [data]);

  const groups = useMemo(() => getGroups(data), [data]);

  useEffect(() => {
    let active = true;
    const pollOnce = async () => {
      if (!active || inFlight.current) return;
      inFlight.current = true;
      try {
        const res = await fetchWithTimeout("/v1/");
        if (!res.ok) throw Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!active) return;
        setData(normalizeRootData(json));
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        inFlight.current = false;
      }
    };

    pollOnce();
    intervalId.current = window.setInterval(pollOnce, POLL_INTERVAL);

    return () => {
      active = false;
      if (intervalId.current != null) window.clearInterval(intervalId.current);
    };
  }, []);

  return (
    <div className="min-h-screen text-white p-2 relative" style={{ backgroundColor: bgColor }}>
      <div className="absolute top-2 right-2 text-base opacity-50 hover:opacity-100">
        <a href="https://github.com/mkt-kuno/DigitShowWebview/releases">v{version}</a>
      </div>
      <div className="w-full">
        <h1 className="text-2xl font-bold text-center mb-2">DigitShowWebview</h1>
        {data && categories.map(({ key, title }) =>
          (groups[key] && Object.keys(groups[key]).length > 0)
            ? <DataGroup key={key} title={title} data={groups[key] as Record<string, { label?: string; value: unknown }>} categoryKey={key} />
            : null
        )}
        <ChartPreviewArea />
      </div>
    </div>
  );
}
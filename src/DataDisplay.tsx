import { useState } from 'react';
import { storage } from './utils';

const formatValue = (key: string, v: unknown) => {
  const needsGuard = ['phy', 'param'].includes(key);
  if (needsGuard) {
    if (v == null) return { text: 'null', invalid: true };
    if (typeof v !== 'number') return { text: String(v), invalid: true };
    if (!Number.isFinite(v)) return { text: Number.isNaN(v) ? 'NaN' : v > 0 ? '∞' : '-∞', invalid: true };
  }
  return typeof v === 'number' ? { text: key === 'raw' ? v.toFixed(0) : v.toFixed(5) } : { text: String(v) };
};

const DataItem = ({ label, value }: { label: string; value: ReturnType<typeof formatValue> }) => (
  <div className="border border-white/40 rounded p-1 min-w-[130px]">
    <div className="text-xs opacity-75">{label}</div>
    <div className={`text-xl font-bold text-right ${value.invalid ? 'text-red-500' : ''}`}>{value.text}</div>
  </div>
);

export const DataGroup = ({ title, data, categoryKey }: { title: string; data: Record<string, { label?: string; value: unknown }>; categoryKey: string }) => {
  const key = `dg-open-${categoryKey}`;
  const [open, setOpen] = useState(() => storage.get(key) !== '0');
  const toggle = () => setOpen(o => (storage.set(key, o ? '0' : '1'), !o));

  const entries = Object.entries(data)
    .sort(([a], [b]) => +a - +b)
    .map(([id, { label, value }]) => ({ id: id.padStart(2, '0'), label: label || id, value: formatValue(categoryKey, value) }));

  return (
    <div className="border border-white/40 rounded-lg mb-2">
      <div className="flex items-center justify-between font-bold px-3 py-1 border-b border-white/40">
        <span>{title}</span>
        <button onClick={toggle} className="bg-transparent text-inherit border border-white/40 rounded text-sm px-2 leading-6 cursor-pointer">
          {open ? '△' : '▽'}
        </button>
      </div>
      {open && (
        <div className="p-2">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-1">
            {entries.map(({ id, label, value }) => <DataItem key={id} label={label} value={value} />)}
          </div>
        </div>
      )}
    </div>
  );
};

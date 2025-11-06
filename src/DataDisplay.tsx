import { useState } from 'react';

const setCookie = (name: string, value: string, days = 365) => {
  try {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
  } catch {
    // ignore
  }
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
    } catch {
      // ignore
    }
    return getCookie(key);
  },
  set(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // ignore
    }
    setCookie(key, value);
  }
};

type DisplayValue = { text: string; invalid?: boolean };

const formatValue = (key: string, v: unknown): DisplayValue => {
  const needsGuard = key === 'phy' || key === 'param';

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

interface DataItemProps {
  label: string;
  value: DisplayValue;
}

const DataItem = ({ label, value }: DataItemProps) => (
  <div className="border border-white/40 rounded p-1 min-w-[130px]">
    <div className="text-xs opacity-75">{label}</div>
    <div className={`text-xl font-bold text-right ${value.invalid ? 'text-red-500' : ''}`}>
      {value.text}
    </div>
  </div>
);

interface DataGroupProps {
  title: string;
  data: Record<string, { label?: string; value: unknown }>;
  categoryKey: string;
}

export const DataGroup = ({ title, data, categoryKey }: DataGroupProps) => {
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
    <div className="border border-white/40 rounded-lg mb-2">
      <div className="flex items-center justify-between font-bold px-3 py-1 border-b border-white/40">
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
          className="bg-transparent text-inherit border border-white/40 rounded text-sm px-2 leading-6 cursor-pointer"
        >
          {open ? '△' : '▽'}
        </button>
      </div>
      {open && (
        <div className="p-2">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-1">
            {entries.map(({ id, label, value }) => (
              <DataItem key={id} label={label} value={value} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

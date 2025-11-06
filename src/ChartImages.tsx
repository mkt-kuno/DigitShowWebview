import { useState, useEffect, useRef } from 'react';
import { fetchWithTimeout, storage, CHART_INTERVAL } from './utils';

const useImage = (url: string, enabled: boolean) => {
  const [state, setState] = useState<{ img: string | null; err: boolean }>({ img: null, err: false });
  const prevUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetchWithTimeout(url);
        if (!mounted || !res.ok) throw Error();
        const blob = await res.blob();
        const nextUrl = URL.createObjectURL(blob);
        if (prevUrl.current) URL.revokeObjectURL(prevUrl.current);
        prevUrl.current = nextUrl;
        setState({ img: nextUrl, err: false });
      } catch {
        setState(s => ({ ...s, err: true }));
      }
    };
    load();
    const id = setInterval(load, CHART_INTERVAL);
    return () => { mounted = false; clearInterval(id); };
  }, [url, enabled]);

  useEffect(() => () => { if (prevUrl.current) URL.revokeObjectURL(prevUrl.current); }, []);
  return state;
};

const Img = ({ name, url, open }: { name: string; url: string; open: boolean }) => {
  const { img, err } = useImage(url, open);
  return (
    <div className={err ? 'opacity-50' : ''}>
      {img ? (
        <img src={img} alt={`Chart ${name}${err ? ' (load failed)' : ''}`} className="w-full h-auto rounded border border-white/10 bg-white/5" />
      ) : (
        <div className="w-full h-[200px] rounded border border-white/10 bg-white/5" />
      )}
    </div>
  );
};

export const ChartImages = () => {
  const [open, setOpen] = useState(() => storage.get('chart-images-open') !== '0');
  const toggle = () => setOpen(o => (storage.set('chart-images-open', o ? '0' : '1'), !o));

  return (
    <div className="border border-white/40 rounded-lg mb-2">
      <div className="font-bold px-3 py-1 border-b border-white/40">
        <span>Legacy Charts (v4.2.1 or older)</span>
        <button onClick={toggle} className="float-right bg-transparent text-inherit border border-white/40 rounded text-sm px-2 leading-6 cursor-pointer">
          {open ? '△' : '▽'}
        </button>
      </div>
      {open && (
        <div className="p-2 grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-3">
          <Img name="A" url="/v1/img/chart_a" open={open} />
          <Img name="B" url="/v1/img/chart_b" open={open} />
        </div>
      )}
    </div>
  );
};

import { useState, useEffect, useRef } from 'react';

const TIMEOUT_MS = 5000;
const CHART_INTERVAL = 2000;

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

export const ChartImages = () => {
  const [errorA, setErrorA] = useState(false);
  const [errorB, setErrorB] = useState(false);
  const [imageA, setImageA] = useState<string | null>(null);
  const [imageB, setImageB] = useState<string | null>(null);
  const prevUrlA = useRef<string | null>(null);
  const prevUrlB = useRef<string | null>(null);

  const storageKey = 'chart-images-open';
  const [open, setOpen] = useState<boolean>(() => {
    const v = storage.get(storageKey);
    return v === null ? true : v === '1';
  });

  useEffect(() => {
    if (!open) return;
    let isMounted = true;

    const refresh = async () => {
      const urlA = `/v1/img/chart_a`;
      const urlB = `/v1/img/chart_b`;

      const [resA, resB] = await Promise.allSettled([
        fetchWithTimeout(urlA),
        fetchWithTimeout(urlB)
      ]);

      if (!isMounted) return;

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

  useEffect(() => {
    return () => {
      if (prevUrlA.current) URL.revokeObjectURL(prevUrlA.current);
      if (prevUrlB.current) URL.revokeObjectURL(prevUrlB.current);
    };
  }, []);

  return (
    <div className="border border-white/40 rounded-lg mb-2">
      <div className="font-bold px-3 py-1 border-b border-white/40">
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
          className="float-right bg-transparent text-inherit border border-white/40 rounded text-sm px-2 leading-6 cursor-pointer"
        >
          {open ? '△' : '▽'}
        </button>
      </div>
      {open && (
        <div className="p-2">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-3">
            <div className={errorA ? 'opacity-50' : ''}>
              {imageA ? (
                <img
                  src={imageA}
                  alt={errorA ? 'Chart A (load failed)' : 'Chart A'}
                  className="w-full h-auto rounded border border-white/10 bg-white/5"
                  onError={() => setErrorA(true)}
                  onLoad={() => setErrorA(false)}
                />
              ) : (
                <div className="w-full h-[200px] rounded border border-white/10 bg-white/5" />
              )}
            </div>
            <div className={errorB ? 'opacity-50' : ''}>
              {imageB ? (
                <img
                  src={imageB}
                  alt={errorB ? 'Chart B (load failed)' : 'Chart B'}
                  className="w-full h-auto rounded border border-white/10 bg-white/5"
                  onError={() => setErrorB(true)}
                  onLoad={() => setErrorB(false)}
                />
              ) : (
                <div className="w-full h-[200px] rounded border border-white/10 bg-white/5" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

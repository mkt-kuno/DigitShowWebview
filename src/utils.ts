export const [TIMEOUT_MS, CHART_INTERVAL, POLL_INTERVAL] = [5000, 2000, 200];

export const fetchWithTimeout = (url: string, timeout = TIMEOUT_MS) => {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeout);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(id));
};

const setCookie = (name: string, value: string, days = 365) => {
  try {
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${new Date(Date.now() + days * 864e5).toUTCString()}; path=/`;
  } catch {
    // ignore
  }
};

const getCookie = (name: string) => {
  try {
    return document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))?.[1] ? decodeURIComponent(RegExp.$1) : null;
  } catch {
    return null;
  }
};

export const storage = {
  get: (key: string) => {
    try {
      return localStorage.getItem(key) ?? getCookie(key);
    } catch {
      return getCookie(key);
    }
  },
  set: (key: string, value: string) => {
    try { 
      localStorage.setItem(key, value); 
    } catch {
      // ignore
    }
    setCookie(key, value);
  }
};

let id = 0;
export const generateId = () => `c${Date.now()}_${id++}`;

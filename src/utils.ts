// Constants
export const TIMEOUT_MS = 5000;
export const CHART_INTERVAL = 2000;
export const POLL_INTERVAL = 200;

// Fetch with timeout utility
export const fetchWithTimeout = async (url: string, timeout = TIMEOUT_MS) => {
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

// Cookie utilities
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

// Storage utility with cookie fallback
export const storage = {
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

// Unique ID generator
let idCounter = 0;
export const generateId = () => `c${Date.now()}_${idCounter++}`;

import type { ConnectionConfig } from './types';

const STORAGE_KEY = 'dsweb:connectionConfig:v1';

export const defaultConfig: ConnectionConfig = {
  ip: '127.0.0.1',
  port: 80,
  useHttps: false,
  pollIntervalMs: 2000,
};

export function loadConfig(): ConnectionConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultConfig;
    const parsed = JSON.parse(raw);
    if (
      parsed
      && typeof parsed.ip === 'string'
      && parsed.ip.length > 0
      && typeof parsed.port === 'number'
      && Number.isInteger(parsed.port)
      && parsed.port > 0
      && parsed.port <= 65535
      && typeof parsed.useHttps === 'boolean'
    ) {
      return {
        ip: parsed.ip,
        port: parsed.port,
        useHttps: parsed.useHttps,
        pollIntervalMs: (typeof parsed.pollIntervalMs === 'number' && Number.isInteger(parsed.pollIntervalMs) && parsed.pollIntervalMs > 0)
          ? parsed.pollIntervalMs
          : defaultConfig.pollIntervalMs,
      };
    }
  } catch {
    // ignore
  }
  return defaultConfig;
}

export function saveConfig(config: ConnectionConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignore
  }
}

export function buildBaseUrl(config: ConnectionConfig): string {
  const protocol = config.useHttps ? 'https' : 'http';
  return `${protocol}://${config.ip}:${config.port}`;
}

export function resolveApiUrl(config: ConnectionConfig, path: string): string {
  const base = buildBaseUrl(config).replace(/\/+$/, '');
  const normalisedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalisedPath}`;
}

export function isValidIp(value: string): boolean {
  if (!value) return false;
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const m = value.match(ipv4);
  if (m) {
    return m.slice(1).every((octet) => {
      const n = Number(octet);
      return n >= 0 && n <= 255;
    });
  }
  return /^[a-zA-Z0-9]([a-zA-Z0-9-_.]{0,253}[a-zA-Z0-9])?$/.test(value);
}

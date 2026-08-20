import type { ConnectionConfig } from './types';
import { readJsonStorage, writeJsonStorage } from './utils/cookies';

const STORAGE_KEY = 'dsweb_connectionConfig_v1';

export const defaultConfig: ConnectionConfig = {
  ip: '127.0.0.1',
  port: 80,
  useHttps: false,
  pollIntervalMs: 2000,
};

export function loadConfig(): ConnectionConfig {
  const saved = readJsonStorage<Partial<ConnectionConfig>>(STORAGE_KEY);
  if (!saved) return defaultConfig;
  if (
    typeof saved.ip === 'string'
    && saved.ip.length > 0
    && typeof saved.port === 'number'
    && Number.isInteger(saved.port)
    && saved.port > 0
    && saved.port <= 65535
    && typeof saved.useHttps === 'boolean'
  ) {
    return {
      ip: saved.ip,
      port: saved.port,
      useHttps: saved.useHttps,
      pollIntervalMs:
        typeof saved.pollIntervalMs === 'number' &&
        Number.isInteger(saved.pollIntervalMs) &&
        saved.pollIntervalMs > 0
          ? saved.pollIntervalMs
          : defaultConfig.pollIntervalMs,
    };
  }
  return defaultConfig;
}

export function saveConfig(config: ConnectionConfig): void {
  writeJsonStorage(STORAGE_KEY, config);
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

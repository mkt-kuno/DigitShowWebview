export type DataPoint = {
  seq: number;
  timestamp: number;
  aiRaw: Float32Array;
  aiPhysical: Float32Array;
  param: Float32Array;
};

export type ConnectionConfig = {
  ip: string;
  port: number;
  useHttps: boolean;
  pollIntervalMs: number;
};

export type ApiData = {
  raw: Record<string, number>;
  phy: Record<string, number>;
  par: Record<string, number>;
  out: Record<string, number>;
  label: Record<string, string>;
};

export type ApiPreview = {
  data: Record<string, (number | null)[]>;
};
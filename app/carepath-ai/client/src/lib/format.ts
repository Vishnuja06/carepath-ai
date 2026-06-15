// Small formatting helpers. SQL DECIMAL/BIGINT can arrive as strings at
// runtime, so always coerce with Number() before doing math or formatting.

export const toNum = (v: number | string | null | undefined): number =>
  v === null || v === undefined || v === '' ? NaN : Number(v);

export const fmtScore = (v: number | string): string => {
  const n = toNum(v);
  return Number.isFinite(n) ? n.toFixed(0) : '—';
};

export const fmtNum = (v: number | string | null | undefined): string => {
  const n = toNum(v);
  return Number.isFinite(n) ? n.toLocaleString('en-IN') : '—';
};

export const fmtKm = (v: number | string): string => {
  const n = toNum(v);
  return Number.isFinite(n) ? `${n.toFixed(1)} km` : '—';
};

export const fmtPct = (v: number | string | null | undefined): string => {
  const n = toNum(v);
  return Number.isFinite(n) ? `${n.toFixed(1)}%` : '—';
};

export const norm = {
  str: (v: any) => (typeof v === 'string' ? v.trim() : v ?? ''),
  email: (v: any) => (v ? String(v).trim().toLowerCase() : null),
  phoneDigits: (v: any) => {
    if (!v) return null;
    const d = String(v).replace(/\D/g, '');
    return d || null;
  },
  money: (v: any) => {
    if (v === null || v === undefined || v === '') return null;
    const s = String(v).replace(/[$,]/g, '');
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  },
  upperState: (v: any) => (v ? String(v).trim().toUpperCase() : null)
};

export function addressKey(a1?: string, city?: string, st?: string, zip?: string) {
  if (!a1 || !city || !st || !zip) return null;
  return `${a1}`.toLowerCase() + '|' + `${city}`.toLowerCase() + '|' + `${st}`.toUpperCase() + '|' + `${zip}`;
}
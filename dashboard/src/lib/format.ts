import type { Language } from './i18n';

export function fmt(n: number, lang: Language): string {
  return n.toLocaleString(lang === 'id' ? 'id-ID' : 'en-US');
}

export function currencySymbol(lang: Language): string {
  return lang === 'id' ? 'Rp' : 'IDR';
}

export function fmtMoney(n: number, lang: Language): string {
  return `${currencySymbol(lang)} ${fmt(n, lang)}`;
}

export function fmtCurrency(n: number, lang: Language): string {
  const sym = currencySymbol(lang);
  const abs = Math.abs(n);
  let compact: string;
  if (abs >= 1_000_000_000) compact = `${(n / 1_000_000_000).toFixed(1)}B`;
  else if (abs >= 1_000_000) compact = `${(n / 1_000_000).toFixed(1)}M`;
  else if (abs >= 1_000) compact = `${(n / 1_000).toFixed(1)}K`;
  else compact = String(n);
  compact = compact.replace(/\.0(?=[KMB]$)/, '');
  return `${sym} ${compact}`;
}

export function fmtDateTime(ts: number | null, lang: Language): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString(lang === 'id' ? 'id-ID' : 'en-US', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

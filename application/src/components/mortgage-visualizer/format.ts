// Formatting helpers — ported from the rework wireframe (math.js + chart.jsx).
// All currency CAD.

export function money(n: number | null | undefined, opts: { compact?: boolean } = {}): string {
  if (n == null || isNaN(n)) { return '—'; }
  const abs = Math.abs(n);
  if (opts.compact && abs >= 1000) {
    if (abs >= 1e6) { return '$' + (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M'; }
    return '$' + (n / 1e3).toFixed(abs >= 1e4 ? 0 : 1).replace(/\.?0+$/, '') + 'k';
  }
  return '$' + Math.round(n).toLocaleString('en-CA');
}

export function moneyExact(n: number | null | undefined): string {
  if (n == null || isNaN(n)) { return '—'; }
  return '$' + n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function percent(n: number | null | undefined): string {
  if (n == null || isNaN(n)) { return '—'; }
  return n.toFixed(2) + '%';
}

// "8 yr 4 mo"
export function duration(days: number): string {
  if (!days || days < 0) { return '—'; }
  const years = Math.floor(days / 365.25);
  const months = Math.round((days - years * 365.25) / 30.4375);
  if (years === 0 && months === 0) { return '< 1 mo'; }
  const parts: string[] = [];
  if (years > 0) { parts.push(years + ' yr'); }
  if (months > 0) { parts.push(months + ' mo'); }
  return parts.join(' ');
}

export function monthName(d: Date): string {
  return d.toLocaleDateString('en-CA', { month: 'short', year: 'numeric' });
}

export function fullDate(d: Date): string {
  return d.toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' });
}

// Compact axis money: "$0", "$12k", "$1.2M"
export function compactMoney(n: number): string {
  if (n === 0) { return '$0'; }
  if (Math.abs(n) >= 1e6) { return '$' + (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M'; }
  if (Math.abs(n) >= 1e3) { return '$' + Math.round(n / 1e3) + 'k'; }
  return '$' + Math.round(n);
}

// Round a raw step up to a "nice" 1/2/5 × 10^n value.
export function niceStep(raw: number): number {
  const exp = Math.floor(Math.log10(raw));
  const base = Math.pow(10, exp);
  const n = raw / base;
  let nice: number;
  if (n < 1.5) { nice = 1; }
  else if (n < 3) { nice = 2; }
  else if (n < 7) { nice = 5; }
  else { nice = 10; }
  return nice * base;
}

// "Number" thousands grouping with no currency symbol.
export function groupNumber(n: number): string {
  return Number(n).toLocaleString('en-CA');
}

// ── Live-formatting helpers for money text inputs ──────────────────────────
// Strip everything but digits and a single decimal point.
export function cleanMoneyInput(raw: string): string {
  const stripped = raw.replace(/[^\d.]/g, '');
  const firstDot = stripped.indexOf('.');
  if (firstDot === -1) { return stripped; }
  return stripped.slice(0, firstDot + 1) + stripped.slice(firstDot + 1).replace(/\./g, '');
}

// Group the integer part with thousands separators; pass the fractional part
// through verbatim so a half-typed "1234." or "1234.0" stays as the user typed it.
export function formatMoneyDraft(cleaned: string): string {
  if (cleaned === '') { return ''; }
  const dot = cleaned.indexOf('.');
  if (dot === -1) { return groupNumber(Number(cleaned || '0')); }
  const intPart = cleaned.slice(0, dot);
  const fracPart = cleaned.slice(dot + 1);
  return groupNumber(Number(intPart || '0')) + '.' + fracPart;
}

// Caret bookkeeping: count digits in str[0..pos), and find the index just past
// the n-th digit in str — used to keep the caret stable when separators shift.
export function digitsBefore(str: string, pos: number): number {
  return (str.slice(0, pos).match(/\d/g) || []).length;
}
export function caretAfterDigits(str: string, n: number): number {
  if (n <= 0) { return 0; }
  let count = 0;
  for (let i = 0; i < str.length; i++) {
    if (str.charCodeAt(i) >= 48 && str.charCodeAt(i) <= 57) {
      if (++count === n) { return i + 1; }
    }
  }
  return str.length;
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** 本地时区的今天，YYYY-MM-DD */
export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isDateStr(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
  );
}

function utc(s: string): number {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(date: string, n: number): string {
  const dt = new Date(utc(date) + n * 86400000);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** b - a，单位天 */
export function diffDays(a: string, b: string): number {
  return Math.round((utc(b) - utc(a)) / 86400000);
}

export function weekdayCN(date: string): string {
  return WEEKDAYS[new Date(utc(date)).getUTCDay()];
}

export function monthDayCN(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  return `${m}月${d}日`;
}

export function shortDate(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  return `${m}/${d}`;
}

export function fullDateCN(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${y}年${m}月${d}日`;
}

export function buildDates(startDate: string, totalDays: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < totalDays; i++) out.push(addDays(startDate, i));
  return out;
}

export function endDate(startDate: string, totalDays: number): string {
  return addDays(startDate, Math.max(0, totalDays - 1));
}

export function relativeLabel(date: string): string {
  const delta = diffDays(todayStr(), date);
  if (delta === 0) return '今天';
  if (delta === 1) return '明天';
  if (delta === -1) return '昨天';
  if (delta > 1 && delta <= 7) return `${delta} 天后`;
  if (delta < -1 && delta >= -7) return `${-delta} 天前`;
  return '';
}

export function formatStamp(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

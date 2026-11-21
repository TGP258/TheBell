import type { RoutineItem, RoutineKind } from '../types';

/** 未设置时间时的哨兵值（分钟） */
export const NO_TIME = -1;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** 分钟数规整到 0..1439 */
export function wrapClock(minutes: number): number {
  const value = Math.round(minutes);
  return ((value % 1440) + 1440) % 1440;
}

/** 510 -> "08:30"；-1 -> "" */
export function clockText(minutes: number): string {
  if (minutes < 0) return '';
  const value = wrapClock(minutes);
  return `${pad(Math.floor(value / 60))}:${pad(value % 60)}`;
}

/** "8:30" / "08：30" -> 510；非法返回 null */
export function parseClock(value: string): number | null {
  const match = /^\s*(\d{1,2})\s*[:：]\s*(\d{1,2})\s*$/.exec(value ?? '');
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

/** 解析 "08:00–08:50"、"8:00-8:50"、"08:00 至 09:00"，返回分钟区间 */
export function parseRange(text: string): { startMin: number; endMin: number } {
  const raw = (text ?? '').trim();
  if (!raw) return { startMin: NO_TIME, endMin: NO_TIME };

  const parts = raw.split(/[–—\-~～→至到]/).map((part) => part.trim());
  const startMin = parseClock(parts[0] ?? '');
  if (startMin === null) return { startMin: NO_TIME, endMin: NO_TIME };

  const endMin = parts.length > 1 ? parseClock(parts[1]) : null;
  if (endMin === null) return { startMin, endMin: NO_TIME };
  return normalizeRange(startMin, endMin);
}

/**
 * 结束时间早于开始时间时视作跨到次日。
 * 起止相同视为无效（返回 0 时长，由调用方决定如何处理）。
 */
export function normalizeRange(
  startMin: number,
  endMin: number
): { startMin: number; endMin: number } {
  if (startMin < 0) return { startMin: NO_TIME, endMin: NO_TIME };
  if (endMin < 0) return { startMin, endMin: NO_TIME };
  if (endMin === startMin) return { startMin, endMin: NO_TIME };
  const end = endMin < startMin ? endMin + 1440 : endMin;
  return { startMin, endMin: end };
}

/** 区间展示文本：08:00–08:50 / 23:00 / "" */
export function rangeText(startMin: number, endMin: number): string {
  if (startMin < 0) return '';
  if (endMin <= startMin) return clockText(startMin);
  const suffix = endMin >= 1440 ? ' 次日' : '';
  return `${clockText(startMin)}–${clockText(endMin)}${suffix}`;
}

/** 区间时长（分钟），无效返回 0 */
export function rangeMinutes(startMin: number, endMin: number): number {
  if (startMin < 0 || endMin <= startMin) return 0;
  return Math.min(1440, endMin - startMin);
}

/** 作息条目展示用时间文本 */
export function itemTimeText(item: RoutineItem): string {
  const text = rangeText(item.startMin, item.endMin);
  return text || item.time || '弹性';
}

/** 学习/休息段的倒计时秒数：优先按起止时间推导 */
export function durationFromRange(
  startMin: number,
  endMin: number,
  kind: RoutineKind
): number {
  if (kind === 'routine') return 0;
  const minutes = rangeMinutes(startMin, endMin);
  if (minutes > 0) return Math.min(86400, minutes * 60);
  return 0;
}

/** 秒 -> 50:00 / 1:05:30 */
export function fmtCountdown(total: number): string {
  const value = Math.max(0, Math.round(total));
  const h = Math.floor(value / 3600);
  const m = Math.floor((value % 3600) / 60);
  const s = value % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** 秒 -> 50 分钟 / 1 小时 10 分 */
export function durationText(sec: number): string {
  const minutes = Math.round(sec / 60);
  if (minutes <= 0) return '未计时';
  if (minutes < 60) return `${minutes} 分钟`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} 小时 ${m} 分` : `${h} 小时`;
}

/** 当前时刻的分钟数 */
export function nowMinutes(ms: number): number {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
}

/** 该时间段是否覆盖当前时刻 */
export function coversNow(item: RoutineItem, minutes: number): boolean {
  if (item.startMin < 0) return false;
  const start = item.startMin;
  const end = item.endMin > start ? item.endMin : start + 1;
  if (end <= 1440) return minutes >= start && minutes < end;
  // 跨日：23:30–00:30
  return minutes >= start || minutes < end - 1440;
}

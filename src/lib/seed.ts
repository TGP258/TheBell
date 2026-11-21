import type { AppData, Day, RoutineItem, RoutineKind } from '../types';
import { buildDates, todayStr } from './date';
import { defaultHome } from './home';
import { newId } from './id';
import { durationFromRange, parseRange, rangeText, normalizeRange } from './segment';

interface TemplateBlock {
  kind: RoutineKind;
  minutes: number;
  title?: string;
}

export interface RoutineInput {
  title: string;
  kind?: RoutineKind;
  startMin?: number;
  endMin?: number;
  /** 兼容旧数据的整段文本，如 "08:00–08:50" */
  time?: string;
  durationSec?: number;
}

/**
 * 默认的一天：只保留早 / 午 / 晚起居节点，
 * 其余学习时间统一切成 50 分钟学习 + 10 分钟休息。
 * 起始 07:30，结束 21:30，之后 23:00 睡觉。
 */
const DAY_PLAN: TemplateBlock[] = [
  { kind: 'routine', minutes: 30, title: '早间作息：起床、洗漱、早餐' },
  { kind: 'study', minutes: 50 },
  { kind: 'break', minutes: 10 },
  { kind: 'study', minutes: 50 },
  { kind: 'break', minutes: 10 },
  { kind: 'study', minutes: 50 },
  { kind: 'break', minutes: 10 },
  { kind: 'study', minutes: 50 },
  { kind: 'routine', minutes: 70, title: '午间作息：午饭 + 午休' },
  { kind: 'study', minutes: 50 },
  { kind: 'break', minutes: 10 },
  { kind: 'study', minutes: 50 },
  { kind: 'break', minutes: 10 },
  { kind: 'study', minutes: 50 },
  { kind: 'break', minutes: 10 },
  { kind: 'study', minutes: 50 },
  { kind: 'routine', minutes: 60, title: '晚间作息：晚饭 + 散步' },
  { kind: 'study', minutes: 50 },
  { kind: 'break', minutes: 10 },
  { kind: 'study', minutes: 50 },
  { kind: 'break', minutes: 10 },
  { kind: 'routine', minutes: 30, title: '晚间复盘：整理笔记、错题、明日计划' },
  { kind: 'routine', minutes: 60, title: '睡前准备：洗漱、放松' },
];

function buildDefaultRoutine(): RoutineInput[] {
  let cursor = 7 * 60 + 30;
  let studyIndex = 0;
  const items: RoutineInput[] = [];

  for (const block of DAY_PLAN) {
    const start = cursor;
    cursor += block.minutes;
    if (block.kind === 'study') studyIndex += 1;
    const title =
      block.kind === 'study'
        ? `学习段 ${studyIndex}`
        : block.kind === 'break'
          ? `休息 ${block.minutes} 分钟`
          : block.title ?? '作息';
    items.push({
      time: rangeText(start, cursor),
      startMin: start,
      endMin: cursor,
      title,
      kind: block.kind,
      durationSec: block.kind === 'routine' ? 0 : block.minutes * 60,
    });
  }

  items.push({
    time: '23:00',
    startMin: 23 * 60,
    endMin: -1,
    title: '睡觉（保证 7 小时以上）',
    kind: 'routine',
    durationSec: 0,
  });
  return items;
}

export const DEFAULT_ROUTINE: RoutineInput[] = buildDefaultRoutine();

export function emptyData(): AppData {
  return {
    plan: { name: '', startDate: todayStr(), totalDays: 0 },
    days: [],
    routine: [],
    checks: {},
    segmentTimers: {},
    customTimers: [],
    countdowns: [],
    home: defaultHome(),
    theme: 'system',
  };
}

/**
 * 统一构造作息条目：
 * - 有起止时间时，学习/休息段的倒计时时长一律由区间推导，避免「改了时间但倒计时不变」
 * - 旧数据只有 time 文本时先解析区间
 * - 都缺失时给该类型一个默认时长
 */
export function makeRoutine(items: RoutineInput[]): RoutineItem[] {
  return items.map((item, index) => {
    const kind = item.kind ?? 'routine';
    let startMin = typeof item.startMin === 'number' ? item.startMin : -1;
    let endMin = typeof item.endMin === 'number' ? item.endMin : -1;

    if (startMin < 0 && item.time) {
      const parsed = parseRange(item.time);
      startMin = parsed.startMin;
      endMin = parsed.endMin;
    }

    const range = normalizeRange(startMin, endMin);
    const derived = durationFromRange(range.startMin, range.endMin, kind);
    const fallback = kind === 'break' ? 600 : 3000;
    let durationSec = 0;
    if (kind !== 'routine') {
      const given = Math.round(item.durationSec ?? 0);
      durationSec = derived || (given > 0 ? Math.min(86400, given) : fallback);
    }

    return {
      id: newId(),
      time: rangeText(range.startMin, range.endMin) || item.time?.trim() || '弹性',
      startMin: range.startMin,
      endMin: range.endMin,
      title: item.title,
      sort: index,
      kind,
      durationSec,
    };
  });
}

export function createSeed(): AppData {
  const start = todayStr();
  const totalDays = 100;
  const days: Day[] = buildDates(start, totalDays).map((date, index) => ({
    idx: index + 1,
    date,
    tasks: [],
  }));

  return {
    plan: { name: '我的学习计划', startDate: start, totalDays },
    days,
    routine: makeRoutine(DEFAULT_ROUTINE),
    checks: {},
    segmentTimers: {},
    customTimers: [],
    countdowns: [],
    home: defaultHome(),
    theme: 'system',
  };
}

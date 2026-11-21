import type { AppData, Day, RoutineItem, RoutineKind } from '../types';
import { buildDates, todayStr } from './date';
import { newId } from './id';

interface TemplateBlock {
  kind: RoutineKind;
  minutes: number;
  title?: string;
}

/**
 * 默认的一天：只保留早 / 午 / 晚起居节点，
 * 其余学习时间统一切成 50 分钟学习 + 10 分钟休息。
 * 起始 07:30，结束 21:30，之后 23:00 前睡觉。
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
  { kind: 'break', minutes: 20 },
  { kind: 'routine', minutes: 30, title: '晚间复盘：整理笔记、错题、明日计划' },
  { kind: 'routine', minutes: 60, title: '睡前准备：洗漱、放松' },
];

function hhmm(totalMinutes: number): string {
  const dayMinutes = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(dayMinutes / 60);
  const m = dayMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function buildDefaultRoutine(): {
  time: string;
  title: string;
  kind: RoutineKind;
  durationSec: number;
}[] {
  let cursor = 7 * 60 + 30;
  let studyIndex = 0;
  const items: {
    time: string;
    title: string;
    kind: RoutineKind;
    durationSec: number;
  }[] = [];

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
      time: `${hhmm(start)}–${hhmm(cursor)}`,
      title,
      kind: block.kind,
      durationSec: block.kind === 'routine' ? 0 : block.minutes * 60,
    });
  }

  items.push({
    time: '23:00 前',
    title: '睡觉（保证 7 小时以上）',
    kind: 'routine',
    durationSec: 0,
  });
  return items;
}

export const DEFAULT_ROUTINE = buildDefaultRoutine();

export function emptyData(): AppData {
  return {
    plan: { name: '', startDate: todayStr(), totalDays: 0 },
    days: [],
    routine: [],
    checks: {},
    segmentTimers: {},
    customTimers: [],
    countdowns: [],
    theme: 'system',
  };
}

export function makeRoutine(
  items: { time: string; title: string; kind?: RoutineKind; durationSec?: number }[]
): RoutineItem[] {
  return items.map((item, index) => ({
    id: newId(),
    time: item.time,
    title: item.title,
    sort: index,
    kind: item.kind ?? 'routine',
    durationSec: Math.max(0, Math.round(item.durationSec ?? 0)),
  }));
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
    theme: 'system',
  };
}

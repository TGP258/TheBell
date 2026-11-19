import type { AppData, Day, RoutineItem } from '../types';
import { buildDates, todayStr } from './date';
import { newId } from './id';

/**
 * 中性的默认作息模板：只描述一天的时间结构，不带任何个人计划或科目偏好。
 * 用户可以随时修改时间、内容、顺序，或全部删除。
 */
export const DEFAULT_ROUTINE: { time: string; title: string }[] = [
  { time: '7:30–8:00', title: '起床、洗漱、早餐' },
  { time: '8:00–8:30', title: '晨间记忆（单词 / 公式 / 背诵）' },
  { time: '8:30–12:00', title: '上午学习（把最难的科目放在上午）' },
  { time: '12:00–13:30', title: '午饭 + 午休（20–30 分钟）' },
  { time: '13:30–17:30', title: '下午学习（刷题 / 真题 / 专业课）' },
  { time: '17:30–18:30', title: '晚饭 + 散步' },
  { time: '19:00–21:00', title: '晚间学习（错题整理 + 复盘）' },
  { time: '21:00–22:30', title: '自由安排 / 运动 / 放松' },
  { time: '23:00 前', title: '睡觉（保证 7 小时以上睡眠）' },
];

export function emptyData(): AppData {
  return {
    plan: { name: '', startDate: todayStr(), totalDays: 0 },
    days: [],
    routine: [],
    checks: {},
    countdowns: [],
    theme: 'system',
  };
}

export function makeRoutine(items: { time: string; title: string }[]): RoutineItem[] {
  return items.map((item, index) => ({
    id: newId(),
    time: item.time,
    title: item.title,
    sort: index,
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
    plan: { name: '我的百日计划', startDate: start, totalDays },
    days,
    routine: makeRoutine(DEFAULT_ROUTINE),
    checks: {},
    countdowns: [],
    theme: 'system',
  };
}

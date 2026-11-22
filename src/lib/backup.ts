import type {
  AppData,
  BackupFile,
  BackupSummary,
  Category,
  Countdown,
  CustomTimer,
  Day,
  RoutineItem,
  RoutineKind,
  Task,
  ThemeMode,
  TimerState,
} from '../types';
import { isCategory, isCountdownColor } from './categories';
import { addDays, endDate, isDateStr, todayStr } from './date';
import { normalizeHome } from './home';
import { newId } from './id';
import { clockText, parseClock, parseRange } from './segment';
import { DEFAULT_ROUTINE, makeRoutine, type RoutineInput } from './seed';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function integer(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function isRoutineKind(value: unknown): value is RoutineKind {
  return value === 'routine' || value === 'study' || value === 'break';
}

function inferRoutine(title: string): { kind: RoutineKind; durationSec: number } {
  // 起居：只打卡，不计时
  if (/作息|睡觉|起床|洗漱|早饭|早餐|午饭|午餐|晚饭|晚餐|通勤|洗澡/.test(title)) {
    return { kind: 'routine', durationSec: 0 };
  }
  // 休息：短休、午休、运动
  if (/休息|午休|小憩|短休|散步|运动|拉伸|茶歇|咖啡/.test(title)) {
    return { kind: 'break', durationSec: 600 };
  }
  // 学习：旧版标题里通常直接写科目或任务
  if (
    /学习|上课|刷题|背诵|复习|专注|自习|单词|数学|英语|政治|408|专业课|真题|套卷|错题|笔记|听课|网课|阅读|作文|复盘|订正|翻译|语法/.test(
      title
    )
  ) {
    return { kind: 'study', durationSec: 3000 };
  }
  // 其余保持起居，避免旧数据被误判成计时段
  return { kind: 'routine', durationSec: 0 };
}

function remainingNow(remainingSec: number, endsAt: number | null): number {
  if (endsAt) return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
  return Math.max(0, remainingSec);
}

export function buildBackup(data: AppData): BackupFile {
  const routine = [...data.routine].sort((a, b) => a.sort - b.sort || a.id - b.id);
  const routineIndex = new Map(routine.map((item, index) => [item.id, index]));
  const countdownIndex = new Map(data.countdowns.map((item, index) => [item.id, index]));
  const timerIndex = new Map(data.customTimers.map((item, index) => [item.id, index]));

  return {
    app: 'pascal.thebell',
    format: 'thebell/v1',
    version: 'Dev0.4.2202',
    exportedAt: new Date().toISOString(),
    plan: { ...data.plan },
    routine: routine.map((item) => ({
      time: item.time,
      start: item.startMin >= 0 ? clockText(item.startMin) : '',
      end: item.endMin > 0 ? clockText(item.endMin) : '',
      title: item.title,
      kind: item.kind,
      durationSec: item.durationSec,
    })),
    days: data.days.map((day) => {
      const tasks = [...day.tasks]
        .sort((a, b) => a.sort - b.sort || a.id - b.id)
        .map((task) => ({
          category: task.category,
          title: task.title,
          done: task.done,
          sort: task.sort,
        }));
      const routineDone: number[] = [];
      routine.forEach((item, index) => {
        if (data.checks[`${day.idx}:${item.id}`]) routineDone.push(index);
      });
      return { idx: day.idx, date: day.date, tasks, routineDone };
    }),
    countdowns: data.countdowns.map((item) => ({
      title: item.title,
      targetDate: item.targetDate,
      color: item.color,
      pinned: item.pinned,
    })),
    customTimers: data.customTimers.map((timer) => ({
      title: timer.title,
      durationSec: timer.durationSec,
      remainingSec: remainingNow(timer.remainingSec, timer.endsAt),
      color: timer.color,
    })),
    segmentTimers: Object.entries(data.segmentTimers)
      .map(([key, state]) => {
        const [dayIdx, routineId] = key.split(':').map(Number);
        const routineIndexValue = routineIndex.get(routineId);
        if (!dayIdx || routineIndexValue === undefined) return null;
        return {
          dayIdx,
          routineIndex: routineIndexValue,
          remainingSec: remainingNow(state.remainingSec, state.endsAt),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null),
    home: {
      cards: data.home.cards.map((card) => ({ ...card })),
      heroCountdownIndex:
        data.home.heroCountdownId != null
          ? countdownIndex.get(data.home.heroCountdownId) ?? null
          : null,
      heroTheme: data.home.heroTheme,
      timerIndexes: data.home.timerIds
        .map((id) => timerIndex.get(id))
        .filter((index): index is number => index !== undefined),
      countdownIndexes: data.home.countdownIds
        .map((id) => countdownIndex.get(id))
        .filter((index): index is number => index !== undefined),
    },
    settings: { theme: data.theme, autoPostpone: data.autoPostpone },
  };
}

export function serializeBackup(data: AppData): string {
  return JSON.stringify(buildBackup(data), null, 2);
}

export function parseBackup(textContent: string): {
  data: AppData;
  summary: BackupSummary;
} {
  let raw: unknown;
  try {
    raw = JSON.parse(textContent);
  } catch {
    throw new Error('文件不是有效的 JSON，可能已损坏');
  }
  return normalizeBackup(raw);
}

export function normalizeBackup(raw: unknown): {
  data: AppData;
  summary: BackupSummary;
} {
  const root = asRecord(raw);
  if (!root) throw new Error('备份内容为空或格式不正确');

  const planRaw = asRecord(root.plan);
  if (!planRaw) throw new Error('备份里没有 plan 信息，无法识别');

  // 兼容：TheBell（thebell/v1 / pascal.thebell）与旧版百日冲刺（studyplan/v1 / pascal.studyplan）
  const format = text(root.format);
  const app = text(root.app);
  const known =
    format === 'thebell/v1' ||
    format === 'studyplan/v1' ||
    app === 'pascal.thebell' ||
    app === 'pascal.studyplan';
  const hasBody = Array.isArray(root.days) || Array.isArray(root.routine);
  if (!known && !hasBody) {
    throw new Error('无法识别这个备份文件：支持 TheBell 与旧版「百日冲刺」导出的 JSON');
  }

  const name = text(planRaw.name) || '导入的计划';
  const startDate = isDateStr(planRaw.startDate) ? planRaw.startDate : todayStr();
  const totalDays = clamp(integer(planRaw.totalDays, 100), 1, 1000);

  const routineRaw = Array.isArray(root.routine) ? root.routine : [];
  const routineSource: RoutineInput[] = [];
  for (const item of routineRaw) {
    const record = asRecord(item);
    if (!record) continue;
    const title = text(record.title);
    if (!title) continue;
    const inferred = inferRoutine(title);
    const kind = isRoutineKind(record.kind) ? record.kind : inferred.kind;
    const durationSec =
      kind === 'routine' ? 0 : integer(record.durationSec, inferred.durationSec);

    // 新版存 start/end；旧版只有 time 文本时解析出区间
    let startMin = parseClock(text(record.start)) ?? -1;
    let endMin = parseClock(text(record.end)) ?? -1;
    if (startMin < 0) {
      const parsed = parseRange(text(record.time));
      startMin = parsed.startMin;
      endMin = parsed.endMin;
    }

    routineSource.push({
      time: text(record.time),
      startMin,
      endMin,
      title,
      kind,
      durationSec,
    });
  }

  const routine: RoutineItem[] = makeRoutine(
    routineSource.length ? routineSource : DEFAULT_ROUTINE
  );

  const daySource = new Map<number, Record<string, unknown>>();
  if (Array.isArray(root.days)) {
    for (const item of root.days) {
      const record = asRecord(item);
      if (!record) continue;
      const idx = integer(record.idx, 0);
      if (idx >= 1 && idx <= totalDays) daySource.set(idx, record);
    }
  }

  const days: Day[] = [];
  const checks: Record<string, boolean> = {};
  let taskCount = 0;
  let doneCount = 0;

  for (let idx = 1; idx <= totalDays; idx++) {
    const record = daySource.get(idx);
    const date = addDays(startDate, idx - 1);
    const tasks: Task[] = [];
    const tasksRaw = record && Array.isArray(record.tasks) ? record.tasks : [];

    tasksRaw.slice(0, 300).forEach((item, order) => {
      const taskRecord = asRecord(item);
      if (!taskRecord) return;
      const title = text(taskRecord.title);
      if (!title) return;
      const category: Category = isCategory(taskRecord.category)
        ? taskRecord.category
        : 'other';
      tasks.push({
        id: newId(),
        dayIdx: idx,
        category,
        title,
        done: taskRecord.done === true,
        sort: integer(taskRecord.sort, order),
        createdAt: Date.now(),
        doneAt: null,
      });
      taskCount += 1;
      if (taskRecord.done === true) doneCount += 1;
    });

    tasks.sort((a, b) => a.sort - b.sort || a.id - b.id);

    const routineDone =
      record && Array.isArray(record.routineDone) ? record.routineDone : [];
    for (const value of routineDone) {
      const index = integer(value, -1);
      const item = routine[index];
      if (item) checks[`${idx}:${item.id}`] = true;
    }

    days.push({ idx, date, tasks });
  }

  const countdownSource = Array.isArray(root.countdowns) ? root.countdowns : [];
  const countdowns: Countdown[] = [];
  for (const item of countdownSource.slice(0, 50)) {
    const record = asRecord(item);
    if (!record) continue;
    const title = text(record.title);
    const targetDate = isDateStr(record.targetDate) ? record.targetDate : '';
    if (!title || !targetDate) continue;
    countdowns.push({
      id: newId(),
      title,
      targetDate,
      color: isCountdownColor(record.color) ? record.color : 'violet',
      pinned: record.pinned === true,
      createdAt: Date.now(),
    });
  }
  let pinned = false;
  for (const item of countdowns) {
    if (item.pinned && !pinned) pinned = true;
    else item.pinned = false;
  }

  const customTimerSource = Array.isArray(root.customTimers) ? root.customTimers : [];
  const customTimers: CustomTimer[] = [];
  for (const item of customTimerSource.slice(0, 50)) {
    const record = asRecord(item);
    if (!record) continue;
    const title = text(record.title);
    const durationSec = clamp(integer(record.durationSec, 0), 1, 86400);
    if (!title || !durationSec) continue;
    customTimers.push({
      id: newId(),
      title,
      durationSec,
      remainingSec: clamp(integer(record.remainingSec, durationSec), 0, durationSec),
      endsAt: null,
      color: isCountdownColor(record.color) ? record.color : 'violet',
      createdAt: Date.now(),
    });
  }

  const segmentTimers: Record<string, TimerState> = {};
  const segmentSource = Array.isArray(root.segmentTimers) ? root.segmentTimers : [];
  for (const item of segmentSource) {
    const record = asRecord(item);
    if (!record) continue;
    const dayIdx = integer(record.dayIdx, 0);
    const routineIndex = integer(record.routineIndex, -1);
    const routineItem = routine[routineIndex];
    if (!routineItem || routineItem.kind === 'routine') continue;
    if (dayIdx < 1 || dayIdx > totalDays) continue;
    segmentTimers[`${dayIdx}:${routineItem.id}`] = {
      remainingSec: clamp(
        integer(record.remainingSec, routineItem.durationSec),
        0,
        routineItem.durationSec
      ),
      endsAt: null,
    };
  }

  const settings = asRecord(root.settings);
  const themeRaw = settings?.theme;
  const theme: ThemeMode =
    themeRaw === 'light' || themeRaw === 'dark' || themeRaw === 'system'
      ? themeRaw
      : 'system';
  const autoPostpone = settings?.autoPostpone !== false;

  const homeRaw = asRecord(root.home);
  const heroIndex = homeRaw ? integer(homeRaw.heroCountdownIndex, -1) : -1;
  const timerIndexes =
    homeRaw && Array.isArray(homeRaw.timerIndexes) ? homeRaw.timerIndexes : [];
  const countdownIndexes =
    homeRaw && Array.isArray(homeRaw.countdownIndexes) ? homeRaw.countdownIndexes : [];
  const home = normalizeHome({
    cards: homeRaw?.cards,
    heroTheme: homeRaw?.heroTheme,
    heroCountdownId: heroIndex >= 0 ? countdowns[heroIndex]?.id ?? null : null,
    timerIds: timerIndexes
      .map((value) => customTimers[integer(value, -1)]?.id)
      .filter((id): id is number => typeof id === 'number'),
    countdownIds: countdownIndexes
      .map((value) => countdowns[integer(value, -1)]?.id)
      .filter((id): id is number => typeof id === 'number'),
  });

  const data: AppData = {
    plan: { name, startDate, totalDays },
    days,
    routine,
    checks,
    segmentTimers,
    customTimers,
    countdowns,
    home,
    theme,
    autoPostpone,
  };

  return {
    data,
    summary: {
      days: totalDays,
      tasks: taskCount,
      doneTasks: doneCount,
      routine: routine.length,
      countdowns: countdowns.length,
      startDate,
      endDate: endDate(startDate, totalDays),
    },
  };
}

import type {
  AppData,
  BackupFile,
  BackupSummary,
  Category,
  Countdown,
  Day,
  RoutineItem,
  Task,
  ThemeMode,
} from '../types';
import { isCategory, isCountdownColor } from './categories';
import { addDays, endDate, isDateStr, todayStr } from './date';
import { newId } from './id';
import { DEFAULT_ROUTINE, makeRoutine } from './seed';

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

export function buildBackup(data: AppData): BackupFile {
  const routine = [...data.routine].sort((a, b) => a.sort - b.sort || a.id - b.id);

  return {
    app: 'pascal.studyplan',
    format: 'studyplan/v1',
    version: 'Dev0.1',
    exportedAt: new Date().toISOString(),
    plan: { ...data.plan },
    routine: routine.map((item) => ({ time: item.time, title: item.title })),
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
    settings: { theme: data.theme },
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
  if (root.format !== 'studyplan/v1' && root.app !== 'pascal.studyplan') {
    throw new Error('这不是「百日冲刺」的计划备份文件');
  }

  const planRaw = asRecord(root.plan);
  if (!planRaw) throw new Error('备份缺少 plan 字段');

  const name = text(planRaw.name) || '导入的计划';
  const startDate = isDateStr(planRaw.startDate) ? planRaw.startDate : todayStr();
  const totalDays = clamp(integer(planRaw.totalDays, 100), 1, 1000);

  const routineRaw = Array.isArray(root.routine) ? root.routine : [];
  const routineSource = routineRaw
    .map((item) => {
      const record = asRecord(item);
      if (!record) return null;
      const title = text(record.title);
      if (!title) return null;
      return { time: text(record.time) || '—', title };
    })
    .filter((item): item is { time: string; title: string } => item !== null);

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

  const settings = asRecord(root.settings);
  const themeRaw = settings?.theme;
  const theme: ThemeMode =
    themeRaw === 'light' || themeRaw === 'dark' || themeRaw === 'system'
      ? themeRaw
      : 'system';

  const data: AppData = {
    plan: { name, startDate, totalDays },
    days,
    routine,
    checks,
    countdowns,
    theme,
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

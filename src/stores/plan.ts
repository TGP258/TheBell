import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type {
  AppData,
  Category,
  Countdown,
  CountdownColor,
  Day,
  DayProgress,
  PlanMeta,
  RoutineItem,
  Task,
  ThemeMode,
} from '../types';
import { createDriver, type StorageDriver } from '../lib/storage';
import { WebDriver } from '../lib/storage/web';
import { createSeed, emptyData } from '../lib/seed';
import { buildDates, diffDays, endDate, todayStr } from '../lib/date';
import { newId } from '../lib/id';

let driver: StorageDriver | null = null;
let clock: number | undefined;

export const usePlanStore = defineStore('plan', () => {
  const data = ref<AppData>(emptyData());
  const ready = ref(false);
  const dbKind = ref<'sqlite' | 'browser'>('browser');
  const today = ref(todayStr());
  const loadError = ref('');
  const systemDark = ref(
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false
  );

  const plan = computed(() => data.value.plan);
  const days = computed(() => data.value.days);
  const routine = computed(() =>
    [...data.value.routine].sort((a, b) => a.sort - b.sort || a.id - b.id)
  );
  const routineCount = computed(() => routine.value.length);
  const theme = computed(() => data.value.theme);
  const effectiveTheme = computed<'light' | 'dark'>(() => {
    if (theme.value === 'system') return systemDark.value ? 'dark' : 'light';
    return theme.value;
  });

  const todayIdx = computed(() => diffDays(plan.value.startDate, today.value) + 1);
  const currentDayIdx = computed(() =>
    Math.min(plan.value.totalDays || 1, Math.max(1, todayIdx.value))
  );
  const currentDay = computed(
    () => days.value.find((day) => day.idx === currentDayIdx.value) ?? null
  );
  const isInRange = computed(
    () => todayIdx.value >= 1 && todayIdx.value <= plan.value.totalDays
  );
  const planEnd = computed(() =>
    plan.value.totalDays > 0 ? endDate(plan.value.startDate, plan.value.totalDays) : ''
  );

  const totalTasks = computed(() =>
    days.value.reduce((sum, day) => sum + day.tasks.length, 0)
  );
  const doneTasks = computed(() =>
    days.value.reduce(
      (sum, day) => sum + day.tasks.filter((task) => task.done).length,
      0
    )
  );
  const overallPct = computed(() =>
    totalTasks.value ? Math.round((doneTasks.value / totalTasks.value) * 100) : 0
  );
  const completedDays = computed(
    () => days.value.filter((day) => day.tasks.length > 0 && day.tasks.every((t) => t.done)).length
  );

  const pinnedCountdown = computed(
    () => data.value.countdowns.find((item) => item.pinned) ?? data.value.countdowns[0] ?? null
  );

  const streak = computed(() => {
    const total = plan.value.totalDays;
    if (!total) return 0;
    let start = Math.min(todayIdx.value, total);
    if (start >= 1) {
      const progress = dayProgress(start);
      if (!(progress.total > 0 && progress.done === progress.total)) start -= 1;
    }
    let count = 0;
    for (let idx = start; idx >= 1; idx -= 1) {
      const progress = dayProgress(idx);
      if (progress.total > 0 && progress.done === progress.total) count += 1;
      else break;
    }
    return count;
  });

  function getDay(idx: number): Day | null {
    return days.value.find((day) => day.idx === idx) ?? null;
  }

  function dayProgress(idx: number): DayProgress {
    const day = getDay(idx);
    const total = day?.tasks.length ?? 0;
    const done = day?.tasks.filter((task) => task.done).length ?? 0;
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
  }

  function routineDone(dayIdx: number): number {
    let count = 0;
    for (const item of routine.value) {
      if (data.value.checks[`${dayIdx}:${item.id}`]) count += 1;
    }
    return count;
  }

  function isRoutineDone(dayIdx: number, routineId: number): boolean {
    return Boolean(data.value.checks[`${dayIdx}:${routineId}`]);
  }

  function daysUntil(date: string): number {
    return diffDays(today.value, date);
  }

  async function init(): Promise<void> {
    if (ready.value) return;
    try {
      driver = createDriver();
      data.value = await driver.init();
      dbKind.value = driver.kind;
    } catch (error) {
      console.error('SQLite 初始化失败，回退浏览器存储', error);
      loadError.value = '原生数据库不可用，已回退到浏览器存储';
      driver = new WebDriver();
      data.value = await driver.init();
      dbKind.value = 'browser';
    }
    ready.value = true;
    startClock();
  }

  function startClock(): void {
    if (clock) window.clearInterval(clock);
    clock = window.setInterval(() => {
      const next = todayStr();
      if (next !== today.value) today.value = next;
    }, 30000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) today.value = todayStr();
    });
    if (window.matchMedia) {
      window
        .matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', (event) => {
          systemDark.value = event.matches;
        });
    }
  }

  function requireDriver(): StorageDriver {
    if (!driver) throw new Error('存储尚未初始化');
    return driver;
  }

  function findTask(id: number): Task | null {
    for (const day of data.value.days) {
      const task = day.tasks.find((item) => item.id === id);
      if (task) return task;
    }
    return null;
  }

  async function addTask(
    dayIdx: number,
    category: Category,
    title: string
  ): Promise<Task | null> {
    const day = getDay(dayIdx);
    const text = title.trim();
    if (!day || !text) return null;
    const sort = day.tasks.length
      ? Math.max(...day.tasks.map((task) => task.sort)) + 1
      : 0;
    const task: Task = {
      id: newId(),
      dayIdx,
      category,
      title: text,
      done: false,
      sort,
      createdAt: Date.now(),
      doneAt: null,
    };
    day.tasks.push(task);
    await requireDriver().upsertTask(task);
    return task;
  }

  async function toggleTask(id: number): Promise<void> {
    const task = findTask(id);
    if (!task) return;
    task.done = !task.done;
    task.doneAt = task.done ? Date.now() : null;
    await requireDriver().upsertTask(task);
  }

  async function updateTask(
    id: number,
    patch: Partial<Pick<Task, 'title' | 'category'>>
  ): Promise<void> {
    const task = findTask(id);
    if (!task) return;
    if (typeof patch.title === 'string') {
      const text = patch.title.trim();
      if (text) task.title = text;
    }
    if (patch.category) task.category = patch.category;
    await requireDriver().upsertTask(task);
  }

  async function deleteTask(id: number): Promise<void> {
    for (const day of data.value.days) {
      const index = day.tasks.findIndex((task) => task.id === id);
      if (index >= 0) {
        day.tasks.splice(index, 1);
        break;
      }
    }
    await requireDriver().deleteTask(id);
  }

  async function addRoutine(time: string, title: string): Promise<RoutineItem | null> {
    const text = title.trim();
    if (!text) return null;
    const item: RoutineItem = {
      id: newId(),
      time: time.trim() || '—',
      title: text,
      sort: data.value.routine.length
        ? Math.max(...data.value.routine.map((r) => r.sort)) + 1
        : 0,
    };
    data.value.routine.push(item);
    await requireDriver().upsertRoutine(item);
    return item;
  }

  async function updateRoutine(
    id: number,
    patch: Partial<Pick<RoutineItem, 'time' | 'title'>>
  ): Promise<void> {
    const item = data.value.routine.find((r) => r.id === id);
    if (!item) return;
    if (typeof patch.time === 'string') item.time = patch.time.trim() || '—';
    if (typeof patch.title === 'string' && patch.title.trim()) item.title = patch.title.trim();
    await requireDriver().upsertRoutine(item);
  }

  async function deleteRoutine(id: number): Promise<void> {
    const index = data.value.routine.findIndex((item) => item.id === id);
    if (index >= 0) data.value.routine.splice(index, 1);
    const suffix = `:${id}`;
    for (const key of Object.keys(data.value.checks)) {
      if (key.endsWith(suffix)) delete data.value.checks[key];
    }
    await requireDriver().deleteRoutine(id);
  }

  async function moveRoutine(id: number, delta: number): Promise<void> {
    const ordered = routine.value;
    const index = ordered.findIndex((item) => item.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    const current = ordered[index];
    const neighbor = ordered[target];
    const swap = current.sort;
    current.sort = neighbor.sort;
    neighbor.sort = swap;
    await Promise.all([
      requireDriver().upsertRoutine(current),
      requireDriver().upsertRoutine(neighbor),
    ]);
  }

  async function toggleCheck(dayIdx: number, routineId: number): Promise<void> {
    const key = `${dayIdx}:${routineId}`;
    const next = !data.value.checks[key];
    if (next) data.value.checks[key] = true;
    else delete data.value.checks[key];
    await requireDriver().setCheck(dayIdx, routineId, next);
  }

  async function updatePlan(patch: Partial<PlanMeta>): Promise<void> {
    const next: PlanMeta = {
      name: (patch.name ?? plan.value.name).trim() || '未命名计划',
      startDate: patch.startDate ?? plan.value.startDate,
      totalDays: Math.min(
        1000,
        Math.max(1, Math.round(patch.totalDays ?? plan.value.totalDays))
      ),
    };
    const dates = buildDates(next.startDate, next.totalDays);
    const previous = data.value.days;
    data.value.days = dates.map((date, index) => ({
      idx: index + 1,
      date,
      tasks: previous[index]?.tasks ?? [],
    }));
    data.value.plan = next;
    for (const key of Object.keys(data.value.checks)) {
      const dayIdx = Number(key.split(':')[0]);
      if (dayIdx > next.totalDays) delete data.value.checks[key];
    }
    await requireDriver().setPlan(next, dates);
  }

  async function addCountdown(input: {
    title: string;
    targetDate: string;
    color: CountdownColor;
    pinned: boolean;
  }): Promise<Countdown | null> {
    const title = input.title.trim();
    if (!title || !input.targetDate) return null;
    if (input.pinned) {
      for (const item of data.value.countdowns) {
        if (item.pinned) {
          item.pinned = false;
          await requireDriver().upsertCountdown(item);
        }
      }
    }
    const item: Countdown = {
      id: newId(),
      title,
      targetDate: input.targetDate,
      color: input.color,
      pinned: input.pinned || data.value.countdowns.length === 0,
      createdAt: Date.now(),
    };
    data.value.countdowns.push(item);
    await requireDriver().upsertCountdown(item);
    return item;
  }

  async function updateCountdown(
    id: number,
    patch: Partial<Pick<Countdown, 'title' | 'targetDate' | 'color' | 'pinned'>>
  ): Promise<void> {
    const item = data.value.countdowns.find((c) => c.id === id);
    if (!item) return;
    if (typeof patch.title === 'string' && patch.title.trim()) item.title = patch.title.trim();
    if (patch.targetDate) item.targetDate = patch.targetDate;
    if (patch.color) item.color = patch.color;
    if (typeof patch.pinned === 'boolean') item.pinned = patch.pinned;
    if (item.pinned) {
      for (const other of data.value.countdowns) {
        if (other.id !== item.id && other.pinned) {
          other.pinned = false;
          await requireDriver().upsertCountdown(other);
        }
      }
    }
    await requireDriver().upsertCountdown(item);
  }

  async function deleteCountdown(id: number): Promise<void> {
    const index = data.value.countdowns.findIndex((item) => item.id === id);
    if (index >= 0) data.value.countdowns.splice(index, 1);
    if (data.value.countdowns.length && !data.value.countdowns.some((item) => item.pinned)) {
      data.value.countdowns[0].pinned = true;
      await requireDriver().upsertCountdown(data.value.countdowns[0]);
    }
    await requireDriver().deleteCountdown(id);
  }

  async function pinCountdown(id: number): Promise<void> {
    for (const item of data.value.countdowns) {
      const pinned = item.id === id;
      if (item.pinned !== pinned) {
        item.pinned = pinned;
        await requireDriver().upsertCountdown(item);
      }
    }
  }

  async function setTheme(mode: ThemeMode): Promise<void> {
    data.value.theme = mode;
    await requireDriver().setTheme(mode);
  }

  async function toggleTheme(): Promise<void> {
    await setTheme(effectiveTheme.value === 'dark' ? 'light' : 'dark');
  }

  async function importData(next: AppData): Promise<void> {
    data.value = next;
    await requireDriver().replaceAll(next);
  }

  async function resetAll(): Promise<void> {
    await importData(createSeed());
  }

  return {
    ready,
    dbKind,
    today,
    loadError,
    data,
    plan,
    days,
    routine,
    routineCount,
    theme,
    effectiveTheme,
    todayIdx,
    currentDayIdx,
    currentDay,
    isInRange,
    planEnd,
    totalTasks,
    doneTasks,
    overallPct,
    completedDays,
    pinnedCountdown,
    streak,
    getDay,
    dayProgress,
    routineDone,
    isRoutineDone,
    daysUntil,
    init,
    addTask,
    toggleTask,
    updateTask,
    deleteTask,
    addRoutine,
    updateRoutine,
    deleteRoutine,
    moveRoutine,
    toggleCheck,
    updatePlan,
    addCountdown,
    updateCountdown,
    deleteCountdown,
    pinCountdown,
    setTheme,
    toggleTheme,
    importData,
    resetAll,
  };
});

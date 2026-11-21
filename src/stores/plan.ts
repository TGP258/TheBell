import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type {
  AppData,
  Category,
  Countdown,
  CountdownColor,
  CustomTimer,
  Day,
  DayProgress,
  HomeLayout,
  PlanMeta,
  RoutineItem,
  RoutineKind,
  Task,
  ThemeMode,
  TimerState,
} from '../types';
import { createDriver, type StorageDriver } from '../lib/storage';
import { WebDriver } from '../lib/storage/web';
import { createSeed, emptyData } from '../lib/seed';
import { buildDates, diffDays, endDate, todayStr } from '../lib/date';
import { newId } from '../lib/id';
import { durationFromRange, coversNow, normalizeRange, nowMinutes, rangeText } from '../lib/segment';
import { toast } from '../lib/toast';

let driver: StorageDriver | null = null;
let dateClock: number | undefined;
let timerClock: number | undefined;

export const usePlanStore = defineStore('plan', () => {
  const data = ref<AppData>(emptyData());
  const ready = ref(false);
  const dbKind = ref<'sqlite' | 'browser'>('browser');
  const today = ref(todayStr());
  const nowMs = ref(Date.now());
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

  /** 时间线顺序：按开始时间排，未设置时间的排在最后 */
  const timeline = computed(() =>
    [...routine.value].sort((a, b) => {
      const aTimed = a.startMin >= 0 ? 0 : 1;
      const bTimed = b.startMin >= 0 ? 0 : 1;
      if (aTimed !== bTimed) return aTimed - bTimed;
      if (a.startMin !== b.startMin) return a.startMin - b.startMin;
      return a.sort - b.sort || a.id - b.id;
    })
  );

  /** 可倒计时的分段（学习 / 休息），顺序与时间线一致 */
  const timerSegments = computed(() =>
    timeline.value.filter((item) => item.kind !== 'routine' && item.durationSec > 0)
  );
  const activeSegmentId = ref<number | null>(null);
  const activeSegment = computed<RoutineItem | null>(() => {
    const list = timerSegments.value;
    if (!list.length) return null;
    return list.find((item) => item.id === activeSegmentId.value) ?? list[0];
  });
  const activeSegmentIndex = computed(() => {
    const item = activeSegment.value;
    return item ? timerSegments.value.findIndex((seg) => seg.id === item.id) : -1;
  });

  function selectSegment(id: number): void {
    activeSegmentId.value = id;
  }

  /** 左右切换要进行的时间段 */
  function stepSegment(delta: number): void {
    const list = timerSegments.value;
    if (!list.length) return;
    const base = activeSegmentIndex.value < 0 ? 0 : activeSegmentIndex.value;
    const next = (base + delta + list.length) % list.length;
    activeSegmentId.value = list[next].id;
  }

  /** 首次进入时，默认选中当前时间覆盖的那一段 */
  function focusCurrentSegment(): void {
    if (timerSegments.value.some((item) => item.id === activeSegmentId.value)) return;
    const minutes = nowMinutes(Date.now());
    const hit = timerSegments.value.find((item) => coversNow(item, minutes));
    activeSegmentId.value = hit?.id ?? timerSegments.value[0]?.id ?? null;
  }

  const customTimers = computed(() =>
    [...data.value.customTimers].sort((a, b) => a.createdAt - b.createdAt || a.id - b.id)
  );
  const runningCustomCount = computed(
    () => customTimers.value.filter((timer) => customRunning(timer)).length
  );
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

  /** 首页布局 */
  const home = computed(() => data.value.home);
  const visibleHomeCards = computed(() => home.value.cards.filter((card) => card.visible));
  const homeFull = computed(() => visibleHomeCards.value.filter((card) => card.zone === 'full'));
  const homeLeft = computed(() => visibleHomeCards.value.filter((card) => card.zone === 'left'));
  const homeRight = computed(() => visibleHomeCards.value.filter((card) => card.zone === 'right'));
  const heroCountdown = computed(() => {
    const id = home.value.heroCountdownId;
    const picked = id ? data.value.countdowns.find((item) => item.id === id) : null;
    return picked ?? pinnedCountdown.value;
  });
  const homeTimers = computed(() =>
    home.value.timerIds
      .map((id) => customTimers.value.find((timer) => timer.id === id))
      .filter((timer): timer is CustomTimer => Boolean(timer))
  );
  const homeCountdowns = computed(() =>
    home.value.countdownIds
      .map((id) => data.value.countdowns.find((item) => item.id === id))
      .filter((item): item is Countdown => Boolean(item))
  );

  async function saveHome(next: HomeLayout): Promise<void> {
    data.value.home = {
      cards: next.cards.map((card) => ({ ...card })),
      heroCountdownId: next.heroCountdownId,
      heroTheme: next.heroTheme,
      timerIds: [...next.timerIds],
      countdownIds: [...next.countdownIds],
    };
    await requireDriver().setHome(data.value.home);
  }

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

  function findRoutine(id: number): RoutineItem | null {
    return data.value.routine.find((item) => item.id === id) ?? null;
  }

  function segmentState(dayIdx: number, routineId: number): TimerState | null {
    const item = findRoutine(routineId);
    if (!item || item.kind === 'routine' || item.durationSec <= 0) return null;
    return (
      data.value.segmentTimers[`${dayIdx}:${routineId}`] ?? {
        remainingSec: item.durationSec,
        endsAt: null,
      }
    );
  }

  function segmentRemaining(dayIdx: number, routineId: number): number {
    const state = segmentState(dayIdx, routineId);
    if (!state) return 0;
    if (state.endsAt) {
      return Math.max(0, Math.ceil((state.endsAt - nowMs.value) / 1000));
    }
    return Math.max(0, state.remainingSec);
  }

  function segmentRunning(dayIdx: number, routineId: number): boolean {
    const state = segmentState(dayIdx, routineId);
    return Boolean(state?.endsAt && state.endsAt > nowMs.value);
  }

  function segmentProgress(dayIdx: number, routineId: number): number {
    const item = findRoutine(routineId);
    if (!item || item.durationSec <= 0) return 0;
    const remaining = segmentRemaining(dayIdx, routineId);
    return Math.min(
      100,
      Math.max(0, Math.round(((item.durationSec - remaining) / item.durationSec) * 100))
    );
  }

  function customRemaining(timer: CustomTimer): number {
    if (timer.endsAt) {
      return Math.max(0, Math.ceil((timer.endsAt - nowMs.value) / 1000));
    }
    return Math.max(0, timer.remainingSec);
  }

  function customRunning(timer: CustomTimer): boolean {
    return Boolean(timer.endsAt && timer.endsAt > nowMs.value);
  }

  function customProgress(timer: CustomTimer): number {
    if (!timer.durationSec) return 0;
    const remaining = customRemaining(timer);
    return Math.min(
      100,
      Math.max(0, Math.round(((timer.durationSec - remaining) / timer.durationSec) * 100))
    );
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
    expireTimers();
    focusCurrentSegment();
  }

  function startClock(): void {
    if (dateClock) window.clearInterval(dateClock);
    if (timerClock) window.clearInterval(timerClock);

    dateClock = window.setInterval(() => {
      const next = todayStr();
      if (next !== today.value) today.value = next;
    }, 30000);

    timerClock = window.setInterval(() => {
      nowMs.value = Date.now();
      expireTimers();
    }, 1000);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) return;
      today.value = todayStr();
      nowMs.value = Date.now();
      expireTimers();
    });

    if (window.matchMedia) {
      window
        .matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', (event) => {
          systemDark.value = event.matches;
        });
    }
  }

  function expireTimers(): void {
    if (!driver) return;
    const now = Date.now();
    let segmentExpired = false;

    for (const [key, state] of Object.entries(data.value.segmentTimers)) {
      if (!state.endsAt || state.endsAt > now) continue;
      state.remainingSec = 0;
      state.endsAt = null;
      const [dayIdx, routineId] = key.split(':').map(Number);
      if (dayIdx && routineId) {
        void driver.upsertSegmentTimer(dayIdx, routineId, { ...state });
        if (dayIdx === currentDayIdx.value) segmentExpired = true;
      }
    }

    if (segmentExpired) toast('一个学习时段结束了，起来活动一下', 'info');

    for (const timer of data.value.customTimers) {
      if (!timer.endsAt || timer.endsAt > now) continue;
      timer.remainingSec = 0;
      timer.endsAt = null;
      void driver.upsertCustomTimer({ ...timer });
      toast(`「${timer.title}」计时结束`, 'info');
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

  async function addRoutine(input: {
    startMin: number;
    endMin: number;
    title: string;
    kind: RoutineKind;
  }): Promise<RoutineItem | null> {
    const text = input.title.trim();
    if (!text) return null;
    const kind = input.kind;
    const range = normalizeRange(input.startMin, input.endMin);
    const derived = durationFromRange(range.startMin, range.endMin, kind);
    const fallback = kind === 'break' ? 600 : 3000;
    const item: RoutineItem = {
      id: newId(),
      time: rangeText(range.startMin, range.endMin) || '弹性',
      startMin: range.startMin,
      endMin: range.endMin,
      title: text,
      kind,
      durationSec: kind === 'routine' ? 0 : derived || fallback,
      sort: data.value.routine.length
        ? Math.max(...data.value.routine.map((r) => r.sort)) + 1
        : 0,
    };
    data.value.routine.push(item);
    await requireDriver().upsertRoutine(item);
    return item;
  }

  async function clearRoutineTimers(routineId: number): Promise<void> {
    const suffix = `:${routineId}`;
    for (const key of Object.keys(data.value.segmentTimers)) {
      if (key.endsWith(suffix)) delete data.value.segmentTimers[key];
    }
    await requireDriver().deleteSegmentTimersForRoutine(routineId);
  }

  async function updateRoutine(
    id: number,
    patch: Partial<Pick<RoutineItem, 'startMin' | 'endMin' | 'title' | 'kind'>>
  ): Promise<void> {
    const item = findRoutine(id);
    if (!item) return;
    const previousKind = item.kind;
    const previousDuration = item.durationSec;

    if (typeof patch.title === 'string' && patch.title.trim()) {
      item.title = patch.title.trim();
    }
    if (patch.kind) item.kind = patch.kind;

    // 起止时间一变，展示文本与倒计时时长都跟着重算
    if (typeof patch.startMin === 'number' || typeof patch.endMin === 'number') {
      const range = normalizeRange(
        typeof patch.startMin === 'number' ? patch.startMin : item.startMin,
        typeof patch.endMin === 'number' ? patch.endMin : item.endMin
      );
      item.startMin = range.startMin;
      item.endMin = range.endMin;
      item.time = rangeText(range.startMin, range.endMin) || '弹性';
    }

    if (item.kind === 'routine') {
      item.durationSec = 0;
    } else {
      const derived = durationFromRange(item.startMin, item.endMin, item.kind);
      if (derived > 0) item.durationSec = derived;
      else if (item.durationSec <= 0) item.durationSec = item.kind === 'break' ? 600 : 3000;
    }

    await requireDriver().upsertRoutine(item);

    if (item.kind !== previousKind || item.durationSec !== previousDuration) {
      await clearRoutineTimers(id);
    }
  }

  async function deleteRoutine(id: number): Promise<void> {
    const index = data.value.routine.findIndex((item) => item.id === id);
    if (index >= 0) data.value.routine.splice(index, 1);
    const suffix = `:${id}`;
    for (const key of Object.keys(data.value.checks)) {
      if (key.endsWith(suffix)) delete data.value.checks[key];
    }
    for (const key of Object.keys(data.value.segmentTimers)) {
      if (key.endsWith(suffix)) delete data.value.segmentTimers[key];
    }
    await requireDriver().deleteRoutine(id);
  }

  async function toggleCheck(dayIdx: number, routineId: number): Promise<void> {
    const key = `${dayIdx}:${routineId}`;
    const next = !data.value.checks[key];
    if (next) data.value.checks[key] = true;
    else delete data.value.checks[key];
    await requireDriver().setCheck(dayIdx, routineId, next);
  }

  async function toggleSegment(dayIdx: number, routineId: number): Promise<void> {
    const item = findRoutine(routineId);
    if (!item || item.kind === 'routine' || item.durationSec <= 0) return;
    const key = `${dayIdx}:${routineId}`;
    const existing = data.value.segmentTimers[key];
    const now = Date.now();
    let next: TimerState;

    if (existing?.endsAt) {
      next = {
        remainingSec: Math.max(0, Math.ceil((existing.endsAt - now) / 1000)),
        endsAt: null,
      };
    } else {
      const remaining =
        existing && existing.remainingSec > 0 ? existing.remainingSec : item.durationSec;
      next = { remainingSec: remaining, endsAt: now + remaining * 1000 };
      nowMs.value = now;
    }
    data.value.segmentTimers[key] = next;
    await requireDriver().upsertSegmentTimer(dayIdx, routineId, next);
  }

  async function resetSegment(dayIdx: number, routineId: number): Promise<void> {
    const item = findRoutine(routineId);
    if (!item || item.kind === 'routine' || item.durationSec <= 0) return;
    const next: TimerState = { remainingSec: item.durationSec, endsAt: null };
    data.value.segmentTimers[`${dayIdx}:${routineId}`] = next;
    await requireDriver().upsertSegmentTimer(dayIdx, routineId, next);
  }

  async function addCustomTimer(input: {
    title: string;
    durationSec: number;
    color: CountdownColor;
  }): Promise<CustomTimer | null> {
    const title = input.title.trim();
    const durationSec = Math.min(86400, Math.max(1, Math.round(input.durationSec)));
    if (!title || !durationSec) return null;
    const timer: CustomTimer = {
      id: newId(),
      title,
      durationSec,
      remainingSec: durationSec,
      endsAt: null,
      color: input.color,
      createdAt: Date.now(),
    };
    data.value.customTimers.push(timer);
    await requireDriver().upsertCustomTimer(timer);
    return timer;
  }

  async function updateCustomTimer(
    id: number,
    patch: Partial<Pick<CustomTimer, 'title' | 'durationSec' | 'color'>>
  ): Promise<void> {
    const timer = data.value.customTimers.find((item) => item.id === id);
    if (!timer) return;
    if (typeof patch.title === 'string' && patch.title.trim()) {
      timer.title = patch.title.trim();
    }
    if (patch.color) timer.color = patch.color;
    if (typeof patch.durationSec === 'number') {
      const nextDuration = Math.min(86400, Math.max(1, Math.round(patch.durationSec)));
      if (nextDuration !== timer.durationSec) {
        timer.durationSec = nextDuration;
        timer.remainingSec = nextDuration;
        timer.endsAt = null;
      }
    }
    await requireDriver().upsertCustomTimer(timer);
  }

  async function deleteCustomTimer(id: number): Promise<void> {
    const index = data.value.customTimers.findIndex((item) => item.id === id);
    if (index >= 0) data.value.customTimers.splice(index, 1);
    await requireDriver().deleteCustomTimer(id);
  }

  async function toggleCustomTimer(id: number): Promise<void> {
    const timer = data.value.customTimers.find((item) => item.id === id);
    if (!timer) return;
    const now = Date.now();
    if (timer.endsAt) {
      timer.remainingSec = Math.max(0, Math.ceil((timer.endsAt - now) / 1000));
      timer.endsAt = null;
    } else {
      const remaining = timer.remainingSec > 0 ? timer.remainingSec : timer.durationSec;
      timer.remainingSec = remaining;
      timer.endsAt = now + remaining * 1000;
      nowMs.value = now;
    }
    await requireDriver().upsertCustomTimer(timer);
  }

  async function resetCustomTimer(id: number): Promise<void> {
    const timer = data.value.customTimers.find((item) => item.id === id);
    if (!timer) return;
    timer.remainingSec = timer.durationSec;
    timer.endsAt = null;
    await requireDriver().upsertCustomTimer(timer);
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
    for (const key of Object.keys(data.value.segmentTimers)) {
      const dayIdx = Number(key.split(':')[0]);
      if (dayIdx > next.totalDays) delete data.value.segmentTimers[key];
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
    expireTimers();
  }

  async function resetAll(): Promise<void> {
    await importData(createSeed());
  }

  return {
    ready,
    dbKind,
    today,
    nowMs,
    loadError,
    data,
    plan,
    days,
    routine,
    routineCount,
    timeline,
    timerSegments,
    activeSegment,
    activeSegmentIndex,
    selectSegment,
    stepSegment,
    focusCurrentSegment,
    customTimers,
    runningCustomCount,
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
    home,
    visibleHomeCards,
    homeFull,
    homeLeft,
    homeRight,
    heroCountdown,
    homeTimers,
    homeCountdowns,
    saveHome,
    streak,
    getDay,
    dayProgress,
    routineDone,
    isRoutineDone,
    daysUntil,
    segmentState,
    segmentRemaining,
    segmentRunning,
    segmentProgress,
    customRemaining,
    customRunning,
    customProgress,
    init,
    addTask,
    toggleTask,
    updateTask,
    deleteTask,
    addRoutine,
    updateRoutine,
    deleteRoutine,
    toggleCheck,
    toggleSegment,
    resetSegment,
    addCustomTimer,
    updateCustomTimer,
    deleteCustomTimer,
    toggleCustomTimer,
    resetCustomTimer,
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

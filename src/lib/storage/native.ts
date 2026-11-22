import { registerPlugin } from '@capacitor/core';
import type {
  AppData,
  Category,
  Countdown,
  CountdownColor,
  CustomTimer,
  HomeLayout,
  PlanMeta,
  RoutineItem,
  RoutineKind,
  Task,
  ThemeMode,
  TimerState,
} from '../../types';
import { isCategory, isCountdownColor } from '../categories';
import { buildDates, isDateStr, todayStr } from '../date';
import { normalizeHome } from '../home';
import {
  durationFromRange,
  normalizeRange,
  parseRange,
  rangeText,
} from '../segment';
import { createSeed } from '../seed';
import type { StorageDriver } from './driver';

type SqlArg = string | number | null;

interface Statement {
  sql: string;
  args?: SqlArg[];
}

interface PascalDbApi {
  query(options: { sql: string; args?: SqlArg[] }): Promise<{
    rows: Record<string, unknown>[];
  }>;
  run(options: { sql: string; args?: SqlArg[] }): Promise<void>;
  transaction(options: { statements: Statement[] }): Promise<void>;
}

const PascalDb = registerPlugin<PascalDbApi>('PascalDb');

const SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS meta (
     key TEXT PRIMARY KEY,
     value TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS plan (
     id INTEGER PRIMARY KEY CHECK (id = 1),
     name TEXT NOT NULL,
     start_date TEXT NOT NULL,
     total_days INTEGER NOT NULL,
     updated_at INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS day (
     idx INTEGER PRIMARY KEY,
     date TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS task (
     id INTEGER PRIMARY KEY,
     day_idx INTEGER NOT NULL,
     category TEXT NOT NULL,
     title TEXT NOT NULL,
     done INTEGER NOT NULL DEFAULT 0,
     sort INTEGER NOT NULL DEFAULT 0,
     created_at INTEGER,
     done_at INTEGER
   )`,
  `CREATE INDEX IF NOT EXISTS idx_task_day ON task(day_idx)`,
  `CREATE INDEX IF NOT EXISTS idx_task_done ON task(day_idx, done)`,
  `CREATE TABLE IF NOT EXISTS routine (
     id INTEGER PRIMARY KEY,
     time_text TEXT NOT NULL,
     start_min INTEGER NOT NULL DEFAULT -1,
     end_min INTEGER NOT NULL DEFAULT -1,
     title TEXT NOT NULL,
     sort INTEGER NOT NULL,
     kind TEXT NOT NULL DEFAULT 'routine',
     duration_sec INTEGER NOT NULL DEFAULT 0
   )`,
  `CREATE TABLE IF NOT EXISTS routine_check (
     day_idx INTEGER NOT NULL,
     routine_id INTEGER NOT NULL,
     done INTEGER NOT NULL DEFAULT 0,
     PRIMARY KEY (day_idx, routine_id)
   )`,
  `CREATE TABLE IF NOT EXISTS segment_timer (
     day_idx INTEGER NOT NULL,
     routine_id INTEGER NOT NULL,
     remaining_sec INTEGER NOT NULL DEFAULT 0,
     ends_at INTEGER,
     PRIMARY KEY (day_idx, routine_id)
   )`,
  `CREATE TABLE IF NOT EXISTS custom_timer (
     id INTEGER PRIMARY KEY,
     title TEXT NOT NULL,
     duration_sec INTEGER NOT NULL,
     remaining_sec INTEGER NOT NULL,
     ends_at INTEGER,
     color TEXT NOT NULL DEFAULT 'violet',
     created_at INTEGER
   )`,
  `CREATE TABLE IF NOT EXISTS countdown (
     id INTEGER PRIMARY KEY,
     title TEXT NOT NULL,
     target_date TEXT NOT NULL,
     color TEXT NOT NULL DEFAULT 'violet',
     pinned INTEGER NOT NULL DEFAULT 0,
     created_at INTEGER
   )`,
];

interface PlanRow {
  name: string;
  start_date: string;
  total_days: number;
}

interface DayRow {
  idx: number;
  date: string;
}

interface TaskRow {
  id: number;
  day_idx: number;
  category: string;
  title: string;
  done: number;
  sort: number;
  created_at: number | null;
  done_at: number | null;
}

interface RoutineRow {
  id: number;
  time_text: string;
  start_min: number;
  end_min: number;
  title: string;
  sort: number;
  kind: string;
  duration_sec: number;
}

interface CheckRow {
  day_idx: number;
  routine_id: number;
}

interface SegmentTimerRow {
  day_idx: number;
  routine_id: number;
  remaining_sec: number;
  ends_at: number | null;
}

interface CustomTimerRow {
  id: number;
  title: string;
  duration_sec: number;
  remaining_sec: number;
  ends_at: number | null;
  color: string;
  created_at: number | null;
}

interface CountdownRow {
  id: number;
  title: string;
  target_date: string;
  color: string;
  pinned: number;
  created_at: number | null;
}

interface MetaRow {
  value: string;
}

interface ColumnRow {
  name: string;
}

function isRoutineKind(value: unknown): value is RoutineKind {
  return value === 'routine' || value === 'study' || value === 'break';
}

export class NativeDriver implements StorageDriver {
  readonly kind = 'sqlite' as const;

  private async query<T>(sql: string, args: SqlArg[] = []): Promise<T[]> {
    const result = await PascalDb.query({ sql, args });
    return result.rows as T[];
  }

  private run(sql: string, args: SqlArg[] = []): Promise<void> {
    return PascalDb.run({ sql, args });
  }

  private async ensureRoutineColumns(): Promise<void> {
    const columns = await this.query<ColumnRow>('PRAGMA table_info(routine)');
    const names = new Set(columns.map((column) => column.name));
    let migrated = false;

    if (!names.has('kind')) {
      await this.run(
        "ALTER TABLE routine ADD COLUMN kind TEXT NOT NULL DEFAULT 'routine'"
      );
      migrated = true;
    }
    if (!names.has('duration_sec')) {
      await this.run(
        'ALTER TABLE routine ADD COLUMN duration_sec INTEGER NOT NULL DEFAULT 0'
      );
      migrated = true;
    }
    if (!names.has('start_min')) {
      await this.run('ALTER TABLE routine ADD COLUMN start_min INTEGER NOT NULL DEFAULT -1');
    }
    if (!names.has('end_min')) {
      await this.run('ALTER TABLE routine ADD COLUMN end_min INTEGER NOT NULL DEFAULT -1');
    }
    if (migrated) {
      // 旧版本只有 time/title，按内容推断学习/休息段
      await this.run(
        `UPDATE routine SET kind = 'study', duration_sec = 3000
         WHERE kind = 'routine' AND (title LIKE '%学习%' OR title LIKE '%上课%' OR title LIKE '%刷题%')`
      );
      await this.run(
        `UPDATE routine SET kind = 'break', duration_sec = 600
         WHERE kind = 'routine' AND (title LIKE '%休息%' OR title LIKE '%放松%')`
      );
    }
  }

  async init(): Promise<AppData> {
    for (const sql of SCHEMA) await this.run(sql);
    await this.ensureRoutineColumns();

    const plans = await this.query<PlanRow>(
      'SELECT name, start_date, total_days FROM plan WHERE id = 1'
    );

    if (!plans.length) {
      const seed = createSeed();
      await this.replaceAll(seed);
      return seed;
    }

    const planRow = plans[0];
    const plan: PlanMeta = {
      name: planRow.name,
      startDate: isDateStr(planRow.start_date) ? planRow.start_date : todayStr(),
      totalDays: Math.min(1000, Math.max(1, Math.round(planRow.total_days))),
    };

    const dates = buildDates(plan.startDate, plan.totalDays);
    const dayRows = await this.query<DayRow>('SELECT idx, date FROM day ORDER BY idx');
    const datesMatch =
      dayRows.length === plan.totalDays &&
      dayRows.every((row, index) => row.date === dates[index]);

    if (!datesMatch) await this.setPlan(plan, dates);

    const taskRows = await this.query<TaskRow>(
      'SELECT id, day_idx, category, title, done, sort, created_at, done_at FROM task ORDER BY day_idx, sort, id'
    );
    const routineRows = await this.query<RoutineRow>(
      'SELECT id, time_text, start_min, end_min, title, sort, kind, duration_sec FROM routine ORDER BY sort, id'
    );
    const checkRows = await this.query<CheckRow>(
      'SELECT day_idx, routine_id FROM routine_check WHERE done = 1'
    );
    const segmentRows = await this.query<SegmentTimerRow>(
      'SELECT day_idx, routine_id, remaining_sec, ends_at FROM segment_timer'
    );
    const customRows = await this.query<CustomTimerRow>(
      'SELECT id, title, duration_sec, remaining_sec, ends_at, color, created_at FROM custom_timer ORDER BY created_at, id'
    );
    const countdownRows = await this.query<CountdownRow>(
      'SELECT id, title, target_date, color, pinned, created_at FROM countdown ORDER BY pinned DESC, id'
    );
    const themeRows = await this.query<MetaRow>(
      "SELECT value FROM meta WHERE key = 'theme'"
    );
    const homeRows = await this.query<MetaRow>(
      "SELECT value FROM meta WHERE key = 'home_layout'"
    );
    const autoPostponeRows = await this.query<MetaRow>(
      "SELECT value FROM meta WHERE key = 'auto_postpone'"
    );

    const tasksByDay = new Map<number, Task[]>();
    for (const row of taskRows) {
      const category: Category = isCategory(row.category) ? row.category : 'other';
      const task: Task = {
        id: row.id,
        dayIdx: row.day_idx,
        category,
        title: row.title,
        done: row.done === 1,
        sort: row.sort,
        createdAt: row.created_at ?? Date.now(),
        doneAt: row.done_at ?? null,
      };
      const list = tasksByDay.get(row.day_idx);
      if (list) list.push(task);
      else tasksByDay.set(row.day_idx, [task]);
    }

    const days = dates.map((date, index) => ({
      idx: index + 1,
      date,
      tasks: tasksByDay.get(index + 1) ?? [],
    }));

    const routine: RoutineItem[] = [];
    for (const row of routineRows) {
      const kind: RoutineKind = isRoutineKind(row.kind) ? row.kind : 'routine';
      // 旧库只有 time_text，首次升级时解析成起止时间并回写
      const legacy = typeof row.start_min !== 'number' || row.start_min < 0;
      let startMin = typeof row.start_min === 'number' ? row.start_min : -1;
      let endMin = typeof row.end_min === 'number' ? row.end_min : -1;
      if (legacy && row.time_text) {
        const parsed = parseRange(row.time_text);
        startMin = parsed.startMin;
        endMin = parsed.endMin;
        // 旧版时长时间是独立字段，且可能与文本不一致：保留原来的计时长度，
        // 把结束时间对齐成「开始 + 时长」，升级后倒计时行为不变
        if (kind !== 'routine' && row.duration_sec >= 60 && startMin >= 0) {
          endMin = startMin + Math.min(1440, Math.round(row.duration_sec / 60));
        }
      }
      const range = normalizeRange(startMin, endMin);
      const derived = durationFromRange(range.startMin, range.endMin, kind);
      const stored = Math.max(60, Math.round(row.duration_sec || 0));
      const durationSec =
        kind === 'routine'
          ? 0
          : derived || (row.duration_sec > 0 ? stored : kind === 'break' ? 600 : 3000);

      const item: RoutineItem = {
        id: row.id,
        time: rangeText(range.startMin, range.endMin) || row.time_text || '弹性',
        startMin: range.startMin,
        endMin: range.endMin,
        title: row.title,
        sort: row.sort,
        kind,
        durationSec,
      };
      routine.push(item);

      if (startMin !== row.start_min || endMin !== row.end_min || item.time !== row.time_text) {
        await this.upsertRoutine(item);
      }
    }

    const checks: Record<string, boolean> = {};
    for (const row of checkRows) checks[`${row.day_idx}:${row.routine_id}`] = true;

    const segmentTimers: Record<string, TimerState> = {};
    for (const row of segmentRows) {
      segmentTimers[`${row.day_idx}:${row.routine_id}`] = {
        remainingSec: Math.max(0, row.remaining_sec),
        endsAt: row.ends_at ?? null,
      };
    }

    const customTimers: CustomTimer[] = customRows.map((row) => ({
      id: row.id,
      title: row.title,
      durationSec: Math.max(1, row.duration_sec),
      remainingSec: Math.max(0, row.remaining_sec),
      endsAt: row.ends_at ?? null,
      color: isCountdownColor(row.color) ? row.color : 'violet',
      createdAt: row.created_at ?? Date.now(),
    }));

    const countdowns: Countdown[] = countdownRows
      .filter((row) => isDateStr(row.target_date))
      .map((row) => ({
        id: row.id,
        title: row.title,
        targetDate: row.target_date,
        color: (isCountdownColor(row.color) ? row.color : 'violet') as CountdownColor,
        pinned: row.pinned === 1,
        createdAt: row.created_at ?? Date.now(),
      }));

    const themeValue = themeRows[0]?.value;
    const theme: ThemeMode =
      themeValue === 'light' || themeValue === 'dark' || themeValue === 'system'
        ? themeValue
        : 'system';

    let home = normalizeHome(undefined);
    if (homeRows[0]?.value) {
      try {
        home = normalizeHome(JSON.parse(homeRows[0].value));
      } catch {
        // 配置损坏时用默认布局
      }
    }

    return {
      plan,
      days,
      routine,
      checks,
      segmentTimers,
      customTimers,
      countdowns,
      home,
      theme,
      autoPostpone: autoPostponeRows[0]?.value !== '0',
    };
  }

  async setPlan(plan: PlanMeta, dates: string[]): Promise<void> {
    const total = plan.totalDays;
    const statements: Statement[] = [
      {
        sql: `INSERT OR REPLACE INTO plan(id, name, start_date, total_days, updated_at)
              VALUES(1, ?, ?, ?, ?)`,
        args: [plan.name, plan.startDate, total, Date.now()],
      },
      { sql: 'DELETE FROM task WHERE day_idx > ?', args: [total] },
      { sql: 'DELETE FROM routine_check WHERE day_idx > ?', args: [total] },
      { sql: 'DELETE FROM segment_timer WHERE day_idx > ?', args: [total] },
      { sql: 'DELETE FROM day WHERE idx > ?', args: [total] },
      ...dates.map((date, index) => ({
        sql: 'INSERT OR REPLACE INTO day(idx, date) VALUES(?, ?)',
        args: [index + 1, date],
      })),
    ];
    await PascalDb.transaction({ statements });
  }

  async upsertTask(task: Task): Promise<void> {
    await this.run(
      `INSERT OR REPLACE INTO task(id, day_idx, category, title, done, sort, created_at, done_at)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task.id,
        task.dayIdx,
        task.category,
        task.title,
        task.done ? 1 : 0,
        task.sort,
        task.createdAt,
        task.doneAt,
      ]
    );
  }

  async deleteTask(id: number): Promise<void> {
    await this.run('DELETE FROM task WHERE id = ?', [id]);
  }

  async upsertRoutine(item: RoutineItem): Promise<void> {
    await this.run(
      `INSERT OR REPLACE INTO routine(id, time_text, start_min, end_min, title, sort, kind, duration_sec)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.time,
        item.startMin,
        item.endMin,
        item.title,
        item.sort,
        item.kind,
        item.durationSec,
      ]
    );
  }

  async deleteRoutine(id: number): Promise<void> {
    await PascalDb.transaction({
      statements: [
        { sql: 'DELETE FROM routine WHERE id = ?', args: [id] },
        { sql: 'DELETE FROM routine_check WHERE routine_id = ?', args: [id] },
        { sql: 'DELETE FROM segment_timer WHERE routine_id = ?', args: [id] },
      ],
    });
  }

  async setCheck(dayIdx: number, routineId: number, done: boolean): Promise<void> {
    await this.run(
      'INSERT OR REPLACE INTO routine_check(day_idx, routine_id, done) VALUES(?, ?, ?)',
      [dayIdx, routineId, done ? 1 : 0]
    );
  }

  async upsertSegmentTimer(
    dayIdx: number,
    routineId: number,
    state: TimerState
  ): Promise<void> {
    await this.run(
      `INSERT OR REPLACE INTO segment_timer(day_idx, routine_id, remaining_sec, ends_at)
       VALUES(?, ?, ?, ?)`,
      [dayIdx, routineId, Math.max(0, Math.round(state.remainingSec)), state.endsAt]
    );
  }

  async deleteSegmentTimersForRoutine(routineId: number): Promise<void> {
    await this.run('DELETE FROM segment_timer WHERE routine_id = ?', [routineId]);
  }

  async upsertCustomTimer(timer: CustomTimer): Promise<void> {
    await this.run(
      `INSERT OR REPLACE INTO custom_timer(id, title, duration_sec, remaining_sec, ends_at, color, created_at)
       VALUES(?, ?, ?, ?, ?, ?, ?)`,
      [
        timer.id,
        timer.title,
        timer.durationSec,
        Math.max(0, Math.round(timer.remainingSec)),
        timer.endsAt,
        timer.color,
        timer.createdAt,
      ]
    );
  }

  async deleteCustomTimer(id: number): Promise<void> {
    await this.run('DELETE FROM custom_timer WHERE id = ?', [id]);
  }

  async upsertCountdown(item: Countdown): Promise<void> {
    await this.run(
      `INSERT OR REPLACE INTO countdown(id, title, target_date, color, pinned, created_at)
       VALUES(?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.title,
        item.targetDate,
        item.color,
        item.pinned ? 1 : 0,
        item.createdAt,
      ]
    );
  }

  async deleteCountdown(id: number): Promise<void> {
    await this.run('DELETE FROM countdown WHERE id = ?', [id]);
  }

  async setTheme(theme: ThemeMode): Promise<void> {
    await this.run('INSERT OR REPLACE INTO meta(key, value) VALUES(?, ?)', [
      'theme',
      theme,
    ]);
  }

  async setAutoPostpone(on: boolean): Promise<void> {
    await this.run('INSERT OR REPLACE INTO meta(key, value) VALUES(?, ?)', [
      'auto_postpone',
      on ? '1' : '0',
    ]);
  }

  async setHome(layout: HomeLayout): Promise<void> {
    await this.run('INSERT OR REPLACE INTO meta(key, value) VALUES(?, ?)', [
      'home_layout',
      JSON.stringify(layout),
    ]);
  }

  async replaceAll(data: AppData): Promise<void> {
    const statements: Statement[] = [
      { sql: 'DELETE FROM task' },
      { sql: 'DELETE FROM routine_check' },
      { sql: 'DELETE FROM segment_timer' },
      { sql: 'DELETE FROM custom_timer' },
      { sql: 'DELETE FROM day' },
      { sql: 'DELETE FROM routine' },
      { sql: 'DELETE FROM countdown' },
      { sql: 'DELETE FROM plan' },
      { sql: 'DELETE FROM meta' },
      {
        sql: `INSERT INTO plan(id, name, start_date, total_days, updated_at)
              VALUES(1, ?, ?, ?, ?)`,
        args: [data.plan.name, data.plan.startDate, data.plan.totalDays, Date.now()],
      },
      {
        sql: 'INSERT INTO meta(key, value) VALUES(?, ?)',
        args: ['theme', data.theme],
      },
      {
        sql: 'INSERT INTO meta(key, value) VALUES(?, ?)',
        args: ['auto_postpone', data.autoPostpone === false ? '0' : '1'],
      },
      {
        sql: 'INSERT INTO meta(key, value) VALUES(?, ?)',
        args: ['home_layout', JSON.stringify(data.home)],
      },
    ];

    for (const day of data.days) {
      statements.push({
        sql: 'INSERT OR REPLACE INTO day(idx, date) VALUES(?, ?)',
        args: [day.idx, day.date],
      });
      for (const task of day.tasks) {
        statements.push({
          sql: `INSERT OR REPLACE INTO task(id, day_idx, category, title, done, sort, created_at, done_at)
                VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            task.id,
            task.dayIdx,
            task.category,
            task.title,
            task.done ? 1 : 0,
            task.sort,
            task.createdAt,
            task.doneAt,
          ],
        });
      }
    }

    for (const item of data.routine) {
      statements.push({
        sql: 'INSERT OR REPLACE INTO routine(id, time_text, start_min, end_min, title, sort, kind, duration_sec) VALUES(?, ?, ?, ?, ?, ?, ?, ?)',
        args: [
          item.id,
          item.time,
          item.startMin,
          item.endMin,
          item.title,
          item.sort,
          item.kind,
          item.durationSec,
        ],
      });
    }

    for (const key of Object.keys(data.checks)) {
      if (!data.checks[key]) continue;
      const [dayIdx, routineId] = key.split(':').map(Number);
      if (!dayIdx || !routineId) continue;
      statements.push({
        sql: 'INSERT OR REPLACE INTO routine_check(day_idx, routine_id, done) VALUES(?, ?, 1)',
        args: [dayIdx, routineId],
      });
    }

    for (const key of Object.keys(data.segmentTimers)) {
      const state = data.segmentTimers[key];
      const [dayIdx, routineId] = key.split(':').map(Number);
      if (!dayIdx || !routineId || !state) continue;
      statements.push({
        sql: 'INSERT OR REPLACE INTO segment_timer(day_idx, routine_id, remaining_sec, ends_at) VALUES(?, ?, ?, ?)',
        args: [dayIdx, routineId, Math.max(0, Math.round(state.remainingSec)), state.endsAt],
      });
    }

    for (const timer of data.customTimers) {
      statements.push({
        sql: `INSERT OR REPLACE INTO custom_timer(id, title, duration_sec, remaining_sec, ends_at, color, created_at)
              VALUES(?, ?, ?, ?, ?, ?, ?)`,
        args: [
          timer.id,
          timer.title,
          timer.durationSec,
          Math.max(0, Math.round(timer.remainingSec)),
          timer.endsAt,
          timer.color,
          timer.createdAt,
        ],
      });
    }

    for (const item of data.countdowns) {
      statements.push({
        sql: `INSERT OR REPLACE INTO countdown(id, title, target_date, color, pinned, created_at)
              VALUES(?, ?, ?, ?, ?, ?)`,
        args: [
          item.id,
          item.title,
          item.targetDate,
          item.color,
          item.pinned ? 1 : 0,
          item.createdAt,
        ],
      });
    }

    await PascalDb.transaction({ statements });
  }
}

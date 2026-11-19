import { registerPlugin } from '@capacitor/core';
import type {
  AppData,
  Category,
  Countdown,
  CountdownColor,
  PlanMeta,
  RoutineItem,
  Task,
  ThemeMode,
} from '../../types';
import { isCategory, isCountdownColor } from '../categories';
import { buildDates, isDateStr, todayStr } from '../date';
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
     title TEXT NOT NULL,
     sort INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS routine_check (
     day_idx INTEGER NOT NULL,
     routine_id INTEGER NOT NULL,
     done INTEGER NOT NULL DEFAULT 0,
     PRIMARY KEY (day_idx, routine_id)
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
  title: string;
  sort: number;
}

interface CheckRow {
  day_idx: number;
  routine_id: number;
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

export class NativeDriver implements StorageDriver {
  readonly kind = 'sqlite' as const;

  private async query<T>(sql: string, args: SqlArg[] = []): Promise<T[]> {
    const result = await PascalDb.query({ sql, args });
    return result.rows as T[];
  }

  private run(sql: string, args: SqlArg[] = []): Promise<void> {
    return PascalDb.run({ sql, args });
  }

  async init(): Promise<AppData> {
    for (const sql of SCHEMA) await this.run(sql);

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
      'SELECT id, time_text, title, sort FROM routine ORDER BY sort, id'
    );
    const checkRows = await this.query<CheckRow>(
      'SELECT day_idx, routine_id FROM routine_check WHERE done = 1'
    );
    const countdownRows = await this.query<CountdownRow>(
      'SELECT id, title, target_date, color, pinned, created_at FROM countdown ORDER BY pinned DESC, id'
    );
    const themeRows = await this.query<MetaRow>(
      "SELECT value FROM meta WHERE key = 'theme'"
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

    const routine: RoutineItem[] = routineRows.map((row) => ({
      id: row.id,
      time: row.time_text,
      title: row.title,
      sort: row.sort,
    }));

    const checks: Record<string, boolean> = {};
    for (const row of checkRows) checks[`${row.day_idx}:${row.routine_id}`] = true;

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

    return { plan, days, routine, checks, countdowns, theme };
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
      `INSERT OR REPLACE INTO routine(id, time_text, title, sort) VALUES(?, ?, ?, ?)`,
      [item.id, item.time, item.title, item.sort]
    );
  }

  async deleteRoutine(id: number): Promise<void> {
    await PascalDb.transaction({
      statements: [
        { sql: 'DELETE FROM routine WHERE id = ?', args: [id] },
        { sql: 'DELETE FROM routine_check WHERE routine_id = ?', args: [id] },
      ],
    });
  }

  async setCheck(dayIdx: number, routineId: number, done: boolean): Promise<void> {
    await this.run(
      `INSERT OR REPLACE INTO routine_check(day_idx, routine_id, done) VALUES(?, ?, ?)`,
      [dayIdx, routineId, done ? 1 : 0]
    );
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

  async replaceAll(data: AppData): Promise<void> {
    const statements: Statement[] = [
      { sql: 'DELETE FROM task' },
      { sql: 'DELETE FROM routine_check' },
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
        sql: 'INSERT OR REPLACE INTO routine(id, time_text, title, sort) VALUES(?, ?, ?, ?)',
        args: [item.id, item.time, item.title, item.sort],
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

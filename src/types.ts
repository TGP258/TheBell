export type Category = 'math' | 'cs408' | 'english' | 'politics' | 'other';

export type ThemeMode = 'light' | 'dark' | 'system';

export type CountdownColor = 'violet' | 'amber' | 'cyan' | 'pink' | 'green';

/** routine = 起居作息，不计时；study = 学习段；break = 休息段 */
export type RoutineKind = 'routine' | 'study' | 'break';

export interface Task {
  id: number;
  dayIdx: number;
  category: Category;
  title: string;
  done: boolean;
  sort: number;
  createdAt: number;
  doneAt: number | null;
}

export interface Day {
  idx: number;
  date: string;
  tasks: Task[];
}

export interface RoutineItem {
  id: number;
  /** 展示用时间文本，由 startMin/endMin 生成 */
  time: string;
  /** 开始时间（0..1439），-1 表示未设置 */
  startMin: number;
  /** 结束时间（可 > 1440 表示跨日），-1 表示未设置 */
  endMin: number;
  title: string;
  sort: number;
  kind: RoutineKind;
  /** 学习/休息段为倒计时秒数，由起止时间推导；起居作息恒为 0 */
  durationSec: number;
}

/** 剩余秒数 + 结束时间戳（运行中时有值，暂停时为 null） */
export interface TimerState {
  remainingSec: number;
  endsAt: number | null;
}

export interface CustomTimer {
  id: number;
  title: string;
  durationSec: number;
  remainingSec: number;
  endsAt: number | null;
  color: CountdownColor;
  createdAt: number;
}

export interface Countdown {
  id: number;
  title: string;
  targetDate: string;
  color: CountdownColor;
  pinned: boolean;
  createdAt: number;
}

export interface PlanMeta {
  name: string;
  startDate: string;
  totalDays: number;
}

export interface AppData {
  plan: PlanMeta;
  days: Day[];
  routine: RoutineItem[];
  checks: Record<string, boolean>;
  /** key = `${dayIdx}:${routineId}` */
  segmentTimers: Record<string, TimerState>;
  customTimers: CustomTimer[];
  countdowns: Countdown[];
  theme: ThemeMode;
}

export interface DayProgress {
  total: number;
  done: number;
  pct: number;
}

export interface BackupTask {
  category: Category;
  title: string;
  done?: boolean;
  sort?: number;
}

export interface BackupDay {
  idx: number;
  date?: string;
  tasks: BackupTask[];
  routineDone?: number[];
}

export interface BackupRoutine {
  /** 兼容旧版：完整时间文本，如 "08:00–08:50" */
  time?: string;
  /** 新版：开始 / 结束时间，如 "08:00" / "08:50" */
  start?: string;
  end?: string;
  title: string;
  kind?: RoutineKind;
  durationSec?: number;
}

export interface BackupCustomTimer {
  title: string;
  durationSec: number;
  remainingSec?: number;
  color?: CountdownColor;
}

export interface BackupSegmentTimer {
  dayIdx: number;
  routineIndex: number;
  remainingSec: number;
}

export interface BackupFile {
  app: string;
  format: string;
  version: string;
  exportedAt: string;
  plan: PlanMeta;
  routine: BackupRoutine[];
  days: BackupDay[];
  countdowns: {
    title: string;
    targetDate: string;
    color?: CountdownColor;
    pinned?: boolean;
  }[];
  customTimers?: BackupCustomTimer[];
  segmentTimers?: BackupSegmentTimer[];
  settings?: { theme?: ThemeMode };
}

export interface BackupSummary {
  days: number;
  tasks: number;
  doneTasks: number;
  routine: number;
  countdowns: number;
  startDate: string;
  endDate: string;
}

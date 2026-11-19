export type Category = 'math' | 'cs408' | 'english' | 'politics' | 'other';

export type ThemeMode = 'light' | 'dark' | 'system';

export type CountdownColor = 'violet' | 'amber' | 'cyan' | 'pink' | 'green';

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
  time: string;
  title: string;
  sort: number;
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

export interface BackupFile {
  app: string;
  format: string;
  version: string;
  exportedAt: string;
  plan: PlanMeta;
  routine: { time: string; title: string }[];
  days: BackupDay[];
  countdowns: {
    title: string;
    targetDate: string;
    color?: CountdownColor;
    pinned?: boolean;
  }[];
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

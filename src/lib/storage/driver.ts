import type {
  AppData,
  Countdown,
  PlanMeta,
  RoutineItem,
  Task,
  ThemeMode,
} from '../../types';

export interface StorageDriver {
  readonly kind: 'sqlite' | 'browser';
  init(): Promise<AppData>;
  setPlan(plan: PlanMeta, dates: string[]): Promise<void>;
  upsertTask(task: Task): Promise<void>;
  deleteTask(id: number): Promise<void>;
  upsertRoutine(item: RoutineItem): Promise<void>;
  deleteRoutine(id: number): Promise<void>;
  setCheck(dayIdx: number, routineId: number, done: boolean): Promise<void>;
  upsertCountdown(item: Countdown): Promise<void>;
  deleteCountdown(id: number): Promise<void>;
  setTheme(theme: ThemeMode): Promise<void>;
  replaceAll(data: AppData): Promise<void>;
}

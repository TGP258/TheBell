import type { AppData, ThemeMode } from '../../types';
import { normalizeHome } from '../home';
import { createSeed } from '../seed';
import { durationFromRange, parseRange } from '../segment';
import type { StorageDriver } from './driver';

const STORAGE_KEY = 'pascal.thebell.web.v1';

function hydrate(raw: unknown): AppData | null {
  const data = raw as AppData;
  if (!data || typeof data !== 'object') return null;
  if (!data.plan || !Array.isArray(data.days) || !Array.isArray(data.routine)) {
    return null;
  }
  data.checks = data.checks ?? {};
  data.segmentTimers = data.segmentTimers ?? {};
  data.customTimers = data.customTimers ?? [];
  data.countdowns = data.countdowns ?? [];
  data.home = normalizeHome(data.home);
  data.theme = data.theme ?? 'system';
  data.alertOnEnd = data.alertOnEnd !== false;
  data.liveNotification = data.liveNotification !== false;
  for (const item of data.routine) {
    item.kind = item.kind ?? 'routine';
    if (typeof item.startMin !== 'number' || typeof item.endMin !== 'number') {
      const parsed = parseRange(item.time ?? '');
      item.startMin = parsed.startMin;
      item.endMin = parsed.endMin;
      // 旧数据时长独立：保留计时长度，把结束时间对齐成「开始 + 时长」
      if (item.kind !== 'routine' && (item.durationSec ?? 0) >= 60 && item.startMin >= 0) {
        item.endMin = item.startMin + Math.min(1440, Math.round((item.durationSec ?? 0) / 60));
      }
    }
    const derived = durationFromRange(item.startMin, item.endMin, item.kind);
    item.durationSec =
      item.kind === 'routine' ? 0 : derived || Math.max(0, item.durationSec ?? 0);
  }
  for (const timer of data.customTimers) {
    timer.remainingSec = timer.remainingSec ?? timer.durationSec;
    timer.endsAt = timer.endsAt ?? null;
    timer.color = timer.color ?? 'violet';
  }
  return data;
}

/**
 * 浏览器预览环境的持久化实现。
 * 直接保存完整 AppData（含运行中的 endsAt），刷新后计时可以继续；
 * 原生端使用真正的 SQLite（见 native.ts）。
 */
export class WebDriver implements StorageDriver {
  readonly kind = 'browser' as const;
  private data: AppData = createSeed();

  async init(): Promise<AppData> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const stored = hydrate(JSON.parse(raw));
        if (stored) {
          this.data = stored;
          return this.data;
        }
      }
    } catch {
      // 数据损坏时退回种子数据
    }
    this.data = createSeed();
    this.persist();
    return this.data;
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (error) {
      console.warn('浏览器存储写入失败', error);
    }
  }

  // 以下写操作由 store 先更新内存再调用，这里只需要落盘

  async setPlan(): Promise<void> {
    this.persist();
  }

  async upsertTask(): Promise<void> {
    this.persist();
  }

  async deleteTask(): Promise<void> {
    this.persist();
  }

  async upsertRoutine(): Promise<void> {
    this.persist();
  }

  async deleteRoutine(): Promise<void> {
    this.persist();
  }

  async setCheck(): Promise<void> {
    this.persist();
  }

  async upsertSegmentTimer(): Promise<void> {
    this.persist();
  }

  async deleteSegmentTimersForRoutine(): Promise<void> {
    this.persist();
  }

  async upsertCustomTimer(): Promise<void> {
    this.persist();
  }

  async deleteCustomTimer(): Promise<void> {
    this.persist();
  }

  async upsertCountdown(): Promise<void> {
    this.persist();
  }

  async deleteCountdown(): Promise<void> {
    this.persist();
  }

  async setTheme(_theme: ThemeMode): Promise<void> {
    this.persist();
  }

  async setHome(): Promise<void> {
    this.persist();
  }

  async setAlertOnEnd(): Promise<void> {
    this.persist();
  }

  async setLiveNotification(): Promise<void> {
    this.persist();
  }

  async replaceAll(data: AppData): Promise<void> {
    this.data = data;
    this.persist();
  }
}

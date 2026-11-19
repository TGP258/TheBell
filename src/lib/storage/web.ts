import type { AppData, ThemeMode } from '../../types';
import { buildBackup, normalizeBackup } from '../backup';
import { createSeed } from '../seed';
import type { StorageDriver } from './driver';

const STORAGE_KEY = 'pascal.studyplan.web.v1';

/**
 * 浏览器预览环境的持久化实现。
 * 底层仍按「备份 JSON」结构存储，复用导入校验逻辑；
 * 原生端使用真正的 SQLite（见 native.ts）。
 */
export class WebDriver implements StorageDriver {
  readonly kind = 'browser' as const;
  private data: AppData = createSeed();

  async init(): Promise<AppData> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const normalized = normalizeBackup(JSON.parse(raw));
        this.data = normalized.data;
        return this.data;
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(buildBackup(this.data)));
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

  async upsertCountdown(): Promise<void> {
    this.persist();
  }

  async deleteCountdown(): Promise<void> {
    this.persist();
  }

  async setTheme(_theme: ThemeMode): Promise<void> {
    this.persist();
  }

  async replaceAll(data: AppData): Promise<void> {
    this.data = data;
    this.persist();
  }
}

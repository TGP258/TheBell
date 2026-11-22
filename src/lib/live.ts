import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

/** 发布给 Android 侧的一条实时倒计时状态 */
export interface LiveSegmentPayload {
  title: string;
  subtitle: string;
  /** 状态栏胶囊上的短文本，例如 42:18 */
  shortText: string;
  state: 'running' | 'paused';
  remainingSec: number;
  totalSec: number;
  /** 运行时的绝对结束时间戳（ epoch ms ），暂停时为 null */
  endsAt: number | null;
  dayIdx: number;
  routineId: number;
  nextTitle: string | null;
}

export interface LiveEndPayload {
  title: string;
  nextTitle: string | null;
}

export type LiveActionName = 'pause' | 'resume' | 'next' | 'end' | 'open';

export interface LiveActionEvent {
  action: LiveActionName;
  dayIdx?: number;
  routineId?: number;
}

export interface LivePermissionState {
  /** 通知权限与通知开关都已就绪 */
  granted: boolean;
  /** 系统级通知开关是否打开 */
  enabled: boolean;
  /** 是否可以设置精确闹钟（决定后台结束提醒的准时程度） */
  canScheduleExact: boolean;
}

export interface SegmentLivePlugin {
  checkPermission(): Promise<LivePermissionState>;
  requestPermission(): Promise<LivePermissionState>;
  openSettings(): Promise<void>;
  publish(options: LiveSegmentPayload): Promise<void>;
  clear(): Promise<void>;
  notifyEnd(options: LiveEndPayload): Promise<void>;
  /** 取回应用未启动期间用户在通知上点过的动作 */
  drainPending(): Promise<{ actions: LiveActionEvent[] }>;
  addListener(
    eventName: 'action',
    listenerFunc: (event: LiveActionEvent) => void
  ): Promise<PluginListenerHandle>;
}

/** 浏览器 / iOS 上的空实现：所有调用都安全地退化为空操作 */
class SegmentLiveWeb implements SegmentLivePlugin {
  async checkPermission(): Promise<LivePermissionState> {
    return { granted: false, enabled: false, canScheduleExact: false };
  }
  async requestPermission(): Promise<LivePermissionState> {
    return this.checkPermission();
  }
  async openSettings(): Promise<void> {
    /* no-op */
  }
  async publish(): Promise<void> {
    /* no-op */
  }
  async clear(): Promise<void> {
    /* no-op */
  }
  async notifyEnd(): Promise<void> {
    /* no-op */
  }
  async drainPending(): Promise<{ actions: LiveActionEvent[] }> {
    return { actions: [] };
  }
  async addListener(): Promise<PluginListenerHandle> {
    return { remove: async () => undefined };
  }
}

export const SegmentLive = registerPlugin<SegmentLivePlugin>('SegmentLive', {
  web: () => new SegmentLiveWeb(),
});

/** 实时通知目前只在 Android 实现 */
export const liveSupported = Capacitor.getPlatform() === 'android';

/** 统一的容错调用：原生插件异常不应影响计时主流程 */
export async function liveCall<T>(
  fn: () => Promise<T>,
  fallback: T
): Promise<T> {
  if (!liveSupported) return fallback;
  try {
    return await fn();
  } catch (error) {
    console.warn('[SegmentLive]', error);
    return fallback;
  }
}

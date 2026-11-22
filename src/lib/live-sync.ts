import { ref, watch } from 'vue';
import type { PluginListenerHandle } from '@capacitor/core';
import { usePlanStore } from '../stores/plan';
import { rangeText } from './segment';
import {
  liveCall,
  liveSupported,
  SegmentLive,
  type LiveActionEvent,
  type LivePermissionState,
  type LiveSegmentPayload,
} from './live';

type PlanStore = ReturnType<typeof usePlanStore>;

const EMPTY_PERMISSION: LivePermissionState = {
  granted: false,
  enabled: false,
  canScheduleExact: false,
};

/** 设置页订阅的通知权限状态 */
export const liveStatus = ref<LivePermissionState & { checked: boolean }>({
  ...EMPTY_PERMISSION,
  checked: false,
});

export async function refreshLiveStatus(): Promise<void> {
  if (!liveSupported) {
    liveStatus.value = { ...EMPTY_PERMISSION, checked: true };
    return;
  }
  const state = await liveCall(
    () => SegmentLive.checkPermission(),
    EMPTY_PERMISSION
  );
  liveStatus.value = { ...state, checked: true };
}

export async function requestLivePermission(): Promise<void> {
  if (!liveSupported) return;
  const state = await liveCall(
    () => SegmentLive.requestPermission(),
    EMPTY_PERMISSION
  );
  liveStatus.value = { ...state, checked: true };
}

export async function openLiveSettings(): Promise<void> {
  await liveCall(() => SegmentLive.openSettings(), undefined);
}

function shortClock(sec: number): string {
  const total = Math.max(0, Math.round(sec));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * 把 Pinia 里的分段计时状态映射到系统通知。
 * 计时状态本身只存「结束时间戳」，所以通知用 Chronometer 由系统驱动，
 * 应用切后台、被冻结甚至被杀死时状态栏的倒计时仍然准确。
 */
export function setupLiveSync(store: PlanStore): () => void {
  if (!liveSupported) return () => undefined;

  let lastKey = '';
  let canPost = true;
  let askedOnce = false;
  let listener: PluginListenerHandle | null = null;
  const disposers: (() => void)[] = [];

  function runningRoutineId(dayIdx: number): number | null {
    const now = Date.now();
    let found: { id: number; endsAt: number } | null = null;
    for (const [key, state] of Object.entries(store.data.segmentTimers)) {
      const [day, id] = key.split(':').map(Number);
      if (day !== dayIdx || !state.endsAt || state.endsAt <= now) continue;
      if (!found || state.endsAt < found.endsAt) found = { id, endsAt: state.endsAt };
    }
    return found?.id ?? null;
  }

  function snapshot(): LiveSegmentPayload | null {
    const now = Date.now();
    const dayIdx = store.currentDayIdx;
    const segments = store.timerSegments;
    const states = store.data.segmentTimers;

    let chosen: {
      id: number;
      title: string;
      startMin: number;
      endMin: number;
      durationSec: number;
      endsAt: number | null;
      remainingSec: number;
      index: number;
    } | null = null;

    for (let index = 0; index < segments.length; index += 1) {
      const item = segments[index];
      const state = states[`${dayIdx}:${item.id}`];
      if (!state?.endsAt || state.endsAt <= now) continue;
      const remainingSec = Math.max(0, Math.ceil((state.endsAt - now) / 1000));
      if (!chosen || state.endsAt < (chosen.endsAt ?? Infinity)) {
        chosen = {
          id: item.id,
          title: item.title,
          startMin: item.startMin,
          endMin: item.endMin,
          durationSec: item.durationSec,
          endsAt: state.endsAt,
          remainingSec,
          index,
        };
      }
    }

    if (!chosen) {
      const active = store.activeSegment;
      const state = active ? states[`${dayIdx}:${active.id}`] : null;
      if (active && state && !state.endsAt && state.remainingSec > 0) {
        chosen = {
          id: active.id,
          title: active.title,
          startMin: active.startMin,
          endMin: active.endMin,
          durationSec: active.durationSec,
          endsAt: null,
          remainingSec: state.remainingSec,
          index: segments.findIndex((item) => item.id === active.id),
        };
      }
    }

    if (!chosen) return null;

    const next = store.nextTimerSegmentAfter(chosen.id);
    const state = chosen.endsAt ? 'running' : 'paused';
    return {
      title: chosen.title,
      subtitle: `${rangeText(chosen.startMin, chosen.endMin)} · 第 ${chosen.index + 1}/${segments.length} 段`,
      shortText: shortClock(chosen.remainingSec),
      state,
      remainingSec: chosen.remainingSec,
      totalSec: chosen.durationSec,
      endsAt: chosen.endsAt,
      dayIdx,
      routineId: chosen.id,
      nextTitle: next?.title ?? null,
    };
  }

  function sync(): void {
    if (!store.liveNotification) {
      if (lastKey !== 'off') {
        lastKey = 'off';
        void liveCall(() => SegmentLive.clear(), undefined);
      }
      return;
    }
    const payload = snapshot();
    if (!canPost) {
      // 首次真正开始计时时再申请权限，避免装完就弹系统对话框
      if (payload && !askedOnce) {
        askedOnce = true;
        void requestLivePermission().then(() => {
          canPost = liveStatus.value.granted;
          if (canPost) {
            lastKey = '';
            sync();
          }
        });
      }
      return;
    }

    if (!payload) {
      if (lastKey !== 'none') {
        lastKey = 'none';
        void liveCall(() => SegmentLive.clear(), undefined);
      }
      return;
    }

    // 运行时每 30 秒重发一次，用于刷新进度与状态栏胶囊文字；暂停态不重发。
    const bucket = payload.state === 'running' ? Math.floor(payload.remainingSec / 30) : 0;
    const key = [
      payload.state,
      payload.dayIdx,
      payload.routineId,
      payload.endsAt ?? 0,
      payload.remainingSec,
      bucket,
      payload.title,
      payload.nextTitle ?? '',
    ].join('|');
    if (key === lastKey) return;
    lastKey = key;
    void liveCall(() => SegmentLive.publish(payload), undefined);
  }

  async function applyAction(event: LiveActionEvent): Promise<void> {
    const dayIdx = event.dayIdx ?? store.currentDayIdx;
    const routineId = event.routineId ?? runningRoutineId(dayIdx);
    if (!routineId) return;

    if (event.action === 'pause' && store.segmentRunning(dayIdx, routineId)) {
      await store.toggleSegment(dayIdx, routineId);
    } else if (event.action === 'resume' && !store.segmentRunning(dayIdx, routineId)) {
      await store.toggleSegment(dayIdx, routineId);
    } else if (event.action === 'next') {
      const next = store.nextTimerSegmentAfter(routineId);
      if (next) await store.startSegment(dayIdx, next.id);
    }
    lastKey = '';
    sync();
  }

  async function drain(): Promise<void> {
    const result = await liveCall(
      () => SegmentLive.drainPending(),
      { actions: [] as LiveActionEvent[] }
    );
    for (const event of result.actions ?? []) {
      await applyAction(event);
    }
  }

  async function onVisible(): Promise<void> {
    if (document.hidden) return;
    await refreshLiveStatus();
    canPost = liveStatus.value.granted;
    await drain();
    lastKey = '';
    sync();
  }

  void (async () => {
    await refreshLiveStatus();
    canPost = liveStatus.value.granted;
    await drain();
    sync();
    const result = await liveCall(
      () => SegmentLive.addListener('action', (event) => void applyAction(event)),
      null as PluginListenerHandle | null
    );
    listener = result;
  })();

  const stopWatch = watch(
    () => ({
      ready: store.ready,
      now: store.nowMs,
      enabled: store.liveNotification,
      timers: JSON.stringify(store.data.segmentTimers),
      routine: store.routine.length,
      day: store.currentDayIdx,
    }),
    (next, prev) => {
      if (next.ready !== prev?.ready || next.enabled !== prev?.enabled) {
        if (next.enabled) void refreshLiveStatus().then(() => {
          canPost = liveStatus.value.granted;
          sync();
        });
      }
      sync();
    },
    { deep: true }
  );

  const stopEndWatch = watch(
    () => store.segmentEndEvent,
    (event) => {
      if (!event || !document.hidden || !store.liveNotification) return;
      const next = store.nextTimerSegmentAfter(event.routineId);
      void liveCall(
        () => SegmentLive.notifyEnd({ title: event.title, nextTitle: next?.title ?? null }),
        undefined
      );
    }
  );

  document.addEventListener('visibilitychange', onVisible);
  disposers.push(() => document.removeEventListener('visibilitychange', onVisible));

  return () => {
    stopWatch();
    stopEndWatch();
    disposers.forEach((dispose) => dispose());
    void listener?.remove();
  };
}

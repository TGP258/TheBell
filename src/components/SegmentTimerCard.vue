<script setup lang="ts">
import { computed } from 'vue';
import { Check, ChevronLeft, ChevronRight, Pause, Play, RotateCcw, Timer } from 'lucide-vue-next';
import { usePlanStore } from '../stores/plan';
import { durationText, fmtCountdown, rangeText } from '../lib/segment';

const store = usePlanStore();

const day = computed(() => store.currentDay);
const segment = computed(() => store.activeSegment);
const total = computed(() => store.timerSegments.length);
const index = computed(() => store.activeSegmentIndex + 1);

const remaining = computed(() =>
  segment.value && day.value ? store.segmentRemaining(day.value.idx, segment.value.id) : 0
);
const running = computed(() =>
  segment.value && day.value ? store.segmentRunning(day.value.idx, segment.value.id) : false
);
const progress = computed(() =>
  segment.value && day.value ? store.segmentProgress(day.value.idx, segment.value.id) : 0
);
const checked = computed(() =>
  segment.value && day.value ? store.isRoutineDone(day.value.idx, segment.value.id) : false
);
const otherRunning = computed(() => {
  if (!day.value) return 0;
  return store.timerSegments.filter(
    (item) => item.id !== segment.value?.id && store.segmentRunning(day.value!.idx, item.id)
  ).length;
});

const timeText = computed(() =>
  segment.value ? rangeText(segment.value.startMin, segment.value.endMin) || '弹性' : ''
);

const toggleLabel = computed(() => {
  if (running.value) return '暂停';
  if (remaining.value === 0) return '重新开始';
  if (remaining.value < (segment.value?.durationSec ?? 0)) return '继续';
  return '开始';
});

const toggle = (): void => {
  if (!segment.value || !day.value) return;
  void store.toggleSegment(day.value.idx, segment.value.id);
};

const reset = (): void => {
  if (!segment.value || !day.value) return;
  void store.resetSegment(day.value.idx, segment.value.id);
};

const check = (): void => {
  if (!segment.value || !day.value) return;
  void store.toggleCheck(day.value.idx, segment.value.id);
};
</script>

<template>
  <section class="focus-card" :class="{ running, empty: !segment }">
    <div class="fc-head">
      <span class="fc-tag"><Timer :size="13" /> 分段倒计时</span>
      <span v-if="segment" class="fc-idx num">{{ index }} / {{ total }}</span>
      <span v-if="otherRunning" class="fc-other">另有 {{ otherRunning }} 段在计时</span>
    </div>

    <template v-if="segment">
      <div class="fc-main">
        <button
          class="fc-nav"
          :disabled="total < 2"
          aria-label="上一段"
          @click="store.stepSegment(-1)"
        >
          <ChevronLeft :size="20" />
        </button>

        <div class="fc-core">
          <div class="fc-clock num">
            <span v-if="running" class="fc-live" aria-hidden="true" />
            {{ fmtCountdown(remaining) }}
          </div>
          <p class="fc-name">{{ segment.title }}</p>
          <p class="fc-meta">
            <span class="num">{{ timeText }}</span>
            <span class="dot">·</span>
            <span>{{ durationText(segment.durationSec) }}</span>
          </p>
        </div>

        <button
          class="fc-nav"
          :disabled="total < 2"
          aria-label="下一段"
          @click="store.stepSegment(1)"
        >
          <ChevronRight :size="20" />
        </button>
      </div>

      <div class="fc-bar"><i :style="{ width: progress + '%' }" /></div>

      <div class="fc-foot">
        <button class="fc-toggle" :class="{ on: running }" @click="toggle">
          <Pause v-if="running" :size="15" />
          <Play v-else :size="15" />
          {{ toggleLabel }}
        </button>
        <button class="fc-reset" title="重置本段" @click="reset">
          <RotateCcw :size="15" />
          重置
        </button>
        <button class="fc-check" :class="{ on: checked }" @click="check">
          <Check :size="14" :stroke-width="3" />
          本段完成
        </button>
        <span class="fc-hint">左右切换时间段</span>
      </div>
    </template>

    <div v-else class="fc-empty">
      <b>还没有可倒计时的时段</b>
      <p>在右侧「今日节奏」里添加学习段或休息段，这里就会出现倒计时。</p>
    </div>
  </section>
</template>

<style scoped>
.focus-card {
  position: relative;
  padding: 16px 20px 14px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background:
    radial-gradient(130% 140% at 100% 0%, var(--primary-soft-2), transparent 62%),
    var(--surface);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}
.focus-card.running {
  border-color: color-mix(in srgb, var(--primary) 38%, var(--border));
  box-shadow: 0 10px 30px -22px rgba(91, 75, 240, 0.75), var(--shadow-sm);
}

.fc-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.fc-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 22px;
  padding: 0 9px;
  border-radius: 999px;
  background: var(--primary-soft);
  color: var(--primary-strong);
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.fc-idx {
  margin-left: auto;
  font-size: 11px;
  color: var(--faint);
  font-weight: 600;
}
.fc-other {
  font-size: 10.5px;
  color: var(--warning);
  background: var(--warning-soft);
  padding: 2px 7px;
  border-radius: 99px;
  font-weight: 600;
}

.fc-main {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}
.fc-nav {
  flex: none;
  width: 34px;
  height: 34px;
  border-radius: 11px;
  display: grid;
  place-items: center;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-2);
  transition: all 0.15s ease;
}
.fc-nav:hover:not(:disabled) {
  color: var(--primary-strong);
  border-color: var(--primary);
  background: var(--primary-soft);
}
.fc-nav:disabled {
  opacity: 0.3;
  pointer-events: none;
}
.fc-core {
  flex: 1;
  min-width: 0;
  text-align: center;
  padding: 2px 4px 0;
}
.fc-clock {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 46px;
  line-height: 1.06;
  font-weight: 800;
  letter-spacing: -0.04em;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}
.focus-card.running .fc-clock {
  color: var(--primary-strong);
}
.fc-live {
  width: 8px;
  height: 8px;
  border-radius: 99px;
  background: var(--primary);
  box-shadow: 0 0 0 4px var(--primary-soft);
  animation: fc-pulse 1.4s ease-in-out infinite;
}
@keyframes fc-pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.45;
    transform: scale(0.82);
  }
}
.fc-name {
  margin-top: 3px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fc-meta {
  margin-top: 2px;
  font-size: 11px;
  color: var(--faint);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
}
.fc-meta .dot {
  opacity: 0.6;
}

.fc-bar {
  height: 4px;
  border-radius: 99px;
  background: var(--surface-3);
  overflow: hidden;
  margin: 10px 2px 0;
}
.fc-bar i {
  display: block;
  height: 100%;
  border-radius: 99px;
  background: linear-gradient(90deg, var(--primary), #a855f7);
  transition: width 0.9s linear;
}

.fc-foot {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
}
.fc-toggle,
.fc-reset,
.fc-check {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 32px;
  padding: 0 12px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 650;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-2);
  transition: all 0.15s ease;
}
.fc-toggle {
  background: var(--primary);
  border-color: transparent;
  color: #fff;
  min-width: 78px;
  justify-content: center;
}
.fc-toggle.on {
  background: var(--primary-strong);
}
.fc-check.on {
  background: var(--success-soft);
  border-color: transparent;
  color: #0a7a47;
}
html[data-theme="dark"] .fc-check.on {
  color: var(--success);
}
.fc-hint {
  margin-left: auto;
  font-size: 10.5px;
  color: var(--faint);
}

.fc-empty {
  padding: 14px 2px 6px;
}
.fc-empty b {
  font-size: 13px;
  color: var(--text-2);
}
.fc-empty p {
  margin-top: 4px;
  font-size: 11.5px;
  color: var(--faint);
  line-height: 1.6;
}

@media (max-width: 620px) {
  .focus-card {
    padding: 14px 14px 12px;
  }
  .fc-clock {
    font-size: 38px;
  }
  .fc-hint {
    display: none;
  }
  .fc-toggle,
  .fc-reset,
  .fc-check {
    flex: 1;
    justify-content: center;
    padding: 0 8px;
  }
}
</style>

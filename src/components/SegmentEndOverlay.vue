<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue';
import { ArrowRight, BellRing } from 'lucide-vue-next';
import { durationText, rangeText } from '../lib/segment';
import { usePlanStore } from '../stores/plan';

const store = usePlanStore();

const event = computed(() => store.segmentEndEvent);
const next = computed(() =>
  event.value ? store.nextTimerSegmentAfter(event.value.routineId) : null
);
const segment = computed(() =>
  event.value ? store.routine.find((item) => item.id === event.value!.routineId) ?? null : null
);
const rangeLabel = computed(() =>
  segment.value ? rangeText(segment.value.startMin, segment.value.endMin) : ''
);
const durationLabel = computed(() =>
  segment.value ? durationText(segment.value.durationSec) : ''
);

function goNext(): void {
  void store.continueToNextSegment();
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') store.dismissSegmentEnd();
}

watch(
  () => Boolean(event.value),
  (open) => {
    if (open) window.addEventListener('keydown', onKeydown);
    else window.removeEventListener('keydown', onKeydown);
  }
);

onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <Teleport to="body">
    <Transition name="seg-end">
      <div
        v-if="event"
        class="seg-end"
        :class="store.effectiveTheme === 'light' ? 'is-light' : 'is-dark'"
        role="dialog"
        aria-modal="true"
      >
        <div class="seg-glow" />
        <div class="seg-body">
          <span class="seg-icon"><BellRing :size="30" /></span>
          <p class="seg-kicker">本段结束</p>
          <h1 class="seg-title">{{ event.title }}</h1>
          <p v-if="rangeLabel" class="seg-time num">
            {{ rangeLabel }}
            <span v-if="durationLabel">· {{ durationLabel }}</span>
          </p>

          <div class="seg-actions">
            <button class="seg-ghost" @click="store.dismissSegmentEnd()">稍后再说</button>
            <button v-if="next" class="seg-primary" @click="goNext">
              <span>
                开始下一段
                <em>{{ next.title }}</em>
              </span>
              <ArrowRight :size="18" />
            </button>
          </div>

          <p v-if="!next" class="seg-hint">今天已经没有可计时的分段了。</p>
          <p v-else class="seg-hint">可在「设置 → 专注提醒」里关闭结束后全屏提示</p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.seg-end {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: grid;
  place-items: center;
  padding: 28px;
  overflow: hidden;
}
.seg-end.is-light {
  background: #ffffff;
  color: #121319;
}
.seg-end.is-dark {
  background: #08090c;
  color: #f4f5f8;
}
.seg-glow {
  position: absolute;
  width: min(70vw, 720px);
  height: min(70vw, 720px);
  border-radius: 50%;
  filter: blur(20px);
  opacity: 0.5;
  pointer-events: none;
  animation: seg-breathe 4s ease-in-out infinite;
}
.is-light .seg-glow {
  background: radial-gradient(circle, rgba(37, 99, 235, 0.16), transparent 62%);
}
.is-dark .seg-glow {
  background: radial-gradient(circle, rgba(37, 99, 235, 0.32), transparent 62%);
}
.seg-body {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 560px;
  animation: seg-rise 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}
.seg-icon {
  width: 70px;
  height: 70px;
  border-radius: 24px;
  display: grid;
  place-items: center;
  margin-bottom: 18px;
}
.is-light .seg-icon {
  background: rgba(37, 99, 235, 0.1);
  color: #2563eb;
}
.is-dark .seg-icon {
  background: rgba(96, 165, 250, 0.16);
  color: #93c5fd;
}
.seg-kicker {
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #2563eb;
}
.is-dark .seg-kicker {
  color: #93c5fd;
}
.seg-title {
  margin-top: 10px;
  font-size: clamp(26px, 4.6vw, 42px);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.25;
}
.seg-time {
  margin-top: 10px;
  font-size: 13px;
  opacity: 0.6;
}
.seg-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
  margin-top: 34px;
}
.seg-ghost,
.seg-primary {
  height: 54px;
  padding: 0 24px;
  border-radius: 16px;
  font-size: 14px;
  font-weight: 700;
  transition: transform 0.15s ease, background 0.15s ease;
}
.seg-ghost {
  border: 1px solid currentColor;
  opacity: 0.55;
  background: transparent;
}
.seg-ghost:hover {
  opacity: 0.9;
}
.seg-primary {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  background: #2563eb;
  color: #fff;
  box-shadow: 0 20px 40px -18px rgba(37, 99, 235, 0.7);
}
.seg-primary span {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  line-height: 1.25;
}
.seg-primary em {
  font-style: normal;
  font-size: 11.5px;
  font-weight: 600;
  opacity: 0.75;
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.seg-primary:hover {
  transform: translateY(-1px);
  background: #1d4ed8;
}
.seg-hint {
  margin-top: 22px;
  font-size: 11px;
  opacity: 0.45;
}

.seg-end-enter-active,
.seg-end-leave-active {
  transition: opacity 0.28s ease;
}
.seg-end-enter-from,
.seg-end-leave-to {
  opacity: 0;
}
.seg-end-enter-active .seg-body,
.seg-end-leave-active .seg-body {
  transition: transform 0.42s cubic-bezier(0.22, 1, 0.36, 1);
}
.seg-end-enter-from .seg-body,
.seg-end-leave-to .seg-body {
  transform: translateY(14px) scale(0.96);
}

@keyframes seg-rise {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes seg-breathe {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.45;
  }
  50% {
    transform: scale(1.08);
    opacity: 0.7;
  }
}

@media (max-width: 520px) {
  .seg-actions {
    flex-direction: column-reverse;
    width: 100%;
  }
  .seg-ghost,
  .seg-primary {
    width: 100%;
    justify-content: center;
  }
  .seg-primary {
    justify-content: space-between;
  }
}
</style>

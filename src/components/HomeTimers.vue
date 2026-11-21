<script setup lang="ts">
import { computed } from 'vue';
import { Pause, Play, RotateCcw, Timer } from 'lucide-vue-next';
import { COUNTDOWN_THEMES } from '../lib/categories';
import { fmtCountdown } from '../lib/segment';
import { usePlanStore } from '../stores/plan';

const store = usePlanStore();
const timers = computed(() => store.homeTimers);

function status(timerId: number): string {
  const timer = timers.value.find((item) => item.id === timerId);
  if (!timer) return '';
  if (store.customRunning(timer)) return '进行中';
  const remaining = store.customRemaining(timer);
  if (remaining === 0) return '已完成';
  if (remaining === timer.durationSec) return '未开始';
  return '已暂停';
}
</script>

<template>
  <section class="card mini-card">
    <div class="section-head">
      <h3>计时器 <span class="cnt num">{{ timers.length }}</span></h3>
      <span class="spacer" />
      <span class="mini-note">首页布局里选择</span>
    </div>

    <div v-if="timers.length" class="rows">
      <div
        v-for="item in timers"
        :key="item.id"
        class="row"
        :class="{ running: store.customRunning(item), done: store.customRemaining(item) === 0 }"
        :style="{ '--tc': COUNTDOWN_THEMES[item.color].from }"
      >
        <span class="dot" />
        <div class="meta">
          <b>{{ item.title }}</b>
          <span>{{ status(item.id) }}</span>
        </div>
        <span class="clock num">{{ fmtCountdown(store.customRemaining(item)) }}</span>
        <button
          class="act play"
          :aria-label="store.customRunning(item) ? '暂停' : '开始'"
          @click="store.toggleCustomTimer(item.id)"
        >
          <Pause v-if="store.customRunning(item)" :size="13" />
          <Play v-else :size="13" />
        </button>
        <button class="act" aria-label="重置" @click="store.resetCustomTimer(item.id)">
          <RotateCcw :size="13" />
        </button>
      </div>
    </div>

    <div v-else class="empty">
      <span class="empty-icon"><Timer :size="22" /></span>
      <b>还没有选择计时器</b>
      <p>在「首页布局」里勾选要显示的计时器，或去「计时」页新建一个。</p>
    </div>
  </section>
</template>

<style scoped>
.mini-card {
  overflow: hidden;
}
.mini-note {
  font-size: 10.5px;
  color: var(--faint);
}
.rows {
  padding: 0 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 12px;
  background: var(--surface-2);
  border: 1px solid transparent;
}
.row.running {
  background: var(--primary-soft-2);
  border-color: color-mix(in srgb, var(--primary) 24%, transparent);
}
.row.done {
  opacity: 0.62;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 99px;
  background: var(--tc);
  flex: none;
}
.meta {
  min-width: 0;
  flex: 1;
}
.meta b {
  display: block;
  font-size: 12.5px;
  font-weight: 650;
  color: var(--text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.meta span {
  font-size: 10px;
  color: var(--faint);
}
.clock {
  font-size: 16px;
  font-weight: 750;
  letter-spacing: -0.02em;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}
.row.running .clock {
  color: var(--primary-strong);
}
.act {
  flex: none;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  color: var(--muted);
  background: var(--surface);
  border: 1px solid var(--border);
}
.act:hover {
  color: var(--primary-strong);
  border-color: var(--primary);
}
.act.play {
  background: var(--primary-soft);
  border-color: transparent;
  color: var(--primary-strong);
}
</style>

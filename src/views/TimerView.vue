<script setup lang="ts">
import { computed, ref } from 'vue';
import { Pause, Pencil, Play, Plus, RotateCcw, Timer } from 'lucide-vue-next';
import type { CustomTimer } from '../types';
import { COUNTDOWN_THEMES } from '../lib/categories';
import { usePlanStore } from '../stores/plan';
import { toast } from '../lib/toast';
import TimerDialog from '../components/TimerDialog.vue';

const store = usePlanStore();
const dialogOpen = ref(false);
const editing = ref<CustomTimer | null>(null);

const runningCount = computed(() => store.runningCustomCount);

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function fmt(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function durationLabel(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m && s) return `${m} 分 ${s} 秒`;
  if (m) return `${m} 分钟`;
  return `${s} 秒`;
}

function statusLabel(timer: CustomTimer): string {
  const remaining = store.customRemaining(timer);
  if (store.customRunning(timer)) return '进行中';
  if (remaining === 0) return '已完成';
  if (remaining === timer.durationSec) return '未开始';
  return '已暂停';
}

function openCreate(): void {
  editing.value = null;
  dialogOpen.value = true;
}

function openEdit(timer: CustomTimer): void {
  editing.value = timer;
  dialogOpen.value = true;
}

async function quickAdd(minutes: number, kind: 'focus' | 'break'): Promise<void> {
  const title = kind === 'focus' ? `专注 ${minutes} 分钟` : `休息 ${minutes} 分钟`;
  await store.addCustomTimer({
    title,
    durationSec: minutes * 60,
    color: kind === 'focus' ? 'violet' : 'green',
  });
  toast(`${title} 已加入`);
}
</script>

<template>
  <div class="view timer-view">
    <header class="page-head">
      <div>
        <p class="eyebrow">独立计时 · 可同时运行</p>
        <h1>计时</h1>
        <p class="head-sub">自定义时长，和今日页的分段倒计时互不影响</p>
      </div>
      <div class="head-actions">
        <span class="chip accent num">运行中 {{ runningCount }}</span>
        <button class="btn primary" @click="openCreate">
          <Plus :size="16" /> 新建计时器
        </button>
      </div>
    </header>

    <section class="timer-intro card">
      <div class="ti-text">
        <b>把任何一段时间，变成可执行的专注块</b>
        <p>可以同时开始多个计时器：背单词、刷题、休息各算各的，暂停互不影响。</p>
      </div>
      <div class="ti-actions">
        <button class="btn soft sm" @click="quickAdd(50, 'focus')">+ 50 分钟专注</button>
        <button class="btn ghost sm" @click="quickAdd(10, 'break')">+ 10 分钟休息</button>
      </div>
    </section>

    <div v-if="store.customTimers.length" class="timer-grid">
      <article
        v-for="item in store.customTimers"
        :key="item.id"
        class="timer-card card"
        :class="{
          running: store.customRunning(item),
          finished: store.customRemaining(item) === 0,
        }"
        :style="{
          '--tc': COUNTDOWN_THEMES[item.color].from,
          '--tc2': COUNTDOWN_THEMES[item.color].to,
        }"
      >
        <div class="tc-head">
          <span class="tc-dot" />
          <h3>{{ item.title }}</h3>
          <button class="tc-edit" title="编辑" @click="openEdit(item)">
            <Pencil :size="15" />
          </button>
        </div>

        <div class="tc-clock num">{{ fmt(store.customRemaining(item)) }}</div>

        <div class="tc-meta">
          <span>{{ statusLabel(item) }}</span>
          <span>{{ durationLabel(item.durationSec) }}</span>
        </div>

        <div class="tc-bar">
          <i
            :style="{
              width: store.customProgress(item) + '%',
              background: `linear-gradient(90deg, ${COUNTDOWN_THEMES[item.color].from}, ${COUNTDOWN_THEMES[item.color].to})`,
            }"
          />
        </div>

        <div class="tc-controls">
          <button class="tc-main" @click="store.toggleCustomTimer(item.id)">
            <Pause v-if="store.customRunning(item)" :size="16" />
            <Play v-else :size="16" />
            {{
              store.customRunning(item)
                ? '暂停'
                : store.customRemaining(item) === 0
                  ? '重新开始'
                  : '开始'
            }}
          </button>
          <button class="tc-reset" title="重置" @click="store.resetCustomTimer(item.id)">
            <RotateCcw :size="16" />
          </button>
        </div>
      </article>

      <button class="timer-add" @click="openCreate">
        <Plus :size="22" />
        <span>新建计时器</span>
      </button>
    </div>

    <div v-else class="empty big-empty">
      <span class="empty-icon"><Timer :size="26" /></span>
      <b>还没有独立计时器</b>
      <p>给背单词、刷题、休息各建一个倒计时，它们可以同时运行、互不打扰。</p>
      <button class="btn primary" style="margin-top: 10px" @click="openCreate">
        <Plus :size="16" /> 新建第一个计时器
      </button>
    </div>

    <TimerDialog :open="dialogOpen" :timer="editing" @close="dialogOpen = false" />
  </div>
</template>

<style scoped>
.timer-view {
  container-type: inline-size;
}

.timer-intro {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 18px 22px;
  margin-bottom: 18px;
}
.ti-text b {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.ti-text p {
  font-size: 12.5px;
  color: var(--muted);
  margin-top: 3px;
}
.ti-actions {
  display: flex;
  gap: 8px;
  flex: none;
}

.timer-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 14px;
}

.timer-card {
  position: relative;
  padding: 16px 16px 14px;
  overflow: hidden;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}
.timer-card::before {
  content: "";
  position: absolute;
  inset: 0 0 auto;
  height: 3px;
  background: linear-gradient(90deg, var(--tc), var(--tc2));
  opacity: 0.8;
}
.timer-card.running {
  border-color: var(--tc);
  box-shadow: 0 0 0 1px var(--tc), var(--shadow-md);
  transform: translateY(-1px);
}
.timer-card.finished {
  opacity: 0.82;
}
.tc-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.tc-dot {
  width: 7px;
  height: 7px;
  border-radius: 99px;
  background: var(--tc);
  flex: none;
}
.timer-card.running .tc-dot {
  animation: pulse 1.4s ease-in-out infinite;
}
@keyframes pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--tc) 45%, transparent);
  }
  50% {
    box-shadow: 0 0 0 5px transparent;
  }
}
.tc-head h3 {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.01em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tc-edit {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  color: var(--muted);
}
.tc-edit:hover {
  background: var(--surface-3);
  color: var(--text);
}
.tc-clock {
  margin: 14px 0 2px;
  font-family: var(--font-mono);
  font-size: 40px;
  font-weight: 700;
  letter-spacing: -0.045em;
  line-height: 1.05;
  font-variant-numeric: tabular-nums;
  color: var(--text);
}
.timer-card.running .tc-clock {
  color: var(--tc);
}
.timer-card.finished .tc-clock {
  color: var(--faint);
}
.tc-meta {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 11px;
  color: var(--muted);
  font-weight: 600;
}
.tc-bar {
  height: 4px;
  border-radius: 99px;
  background: var(--surface-3);
  overflow: hidden;
  margin: 10px 0 12px;
}
.tc-bar i {
  display: block;
  height: 100%;
  border-radius: 99px;
  transition: width 0.5s linear;
}
.tc-controls {
  display: flex;
  gap: 8px;
}
.tc-main {
  flex: 1;
  height: 38px;
  border-radius: 11px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 650;
  color: #fff;
  background: linear-gradient(135deg, var(--tc), var(--tc2));
  transition: filter 0.15s ease, transform 0.12s ease;
}
.tc-main:hover {
  filter: brightness(1.05);
}
.tc-main:active {
  transform: scale(0.98);
}
.tc-reset {
  width: 38px;
  height: 38px;
  border-radius: 11px;
  display: grid;
  place-items: center;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-2);
  flex: none;
}
.tc-reset:hover {
  background: var(--surface-3);
  color: var(--text);
}
.timer-add {
  min-height: 210px;
  border-radius: var(--r-xl);
  border: 1.5px dashed var(--border-strong);
  color: var(--muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 12.5px;
  font-weight: 600;
  transition: all 0.16s ease;
}
.timer-add:hover {
  border-color: var(--primary);
  color: var(--primary-strong);
  background: var(--primary-soft);
}
.big-empty {
  padding: 80px 20px;
  border: 1px dashed var(--border-strong);
  border-radius: var(--r-xl);
}

@container (max-width: 560px) {
  .timer-intro {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    padding: 16px 18px;
  }
  .tc-clock {
    font-size: 34px;
  }
}
</style>

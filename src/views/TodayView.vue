<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import {
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  Clock3,
  Flame,
  Moon,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Sun,
  Target,
  Trash2,
} from 'lucide-vue-next';
import type { Category, RoutineItem } from '../types';
import { CATEGORY_LIST, CATEGORY_META } from '../lib/categories';
import { fullDateCN, relativeLabel, weekdayCN } from '../lib/date';
import { usePlanStore } from '../stores/plan';
import { toast } from '../lib/toast';
import ProgressRing from '../components/ProgressRing.vue';
import TaskRow from '../components/TaskRow.vue';
import TaskDialog from '../components/TaskDialog.vue';
import RoutineDialog from '../components/RoutineDialog.vue';
import PlanDialog from '../components/PlanDialog.vue';
import CountdownDialog from '../components/CountdownDialog.vue';

const store = usePlanStore();

const day = computed(() => store.currentDay);
const progress = computed(() =>
  day.value ? store.dayProgress(day.value.idx) : { total: 0, done: 0, pct: 0 }
);
const routineDone = computed(() => (day.value ? store.routineDone(day.value.idx) : 0));

const groups = computed(() => {
  if (!day.value) return [];
  return CATEGORY_LIST.map((id) => ({
    meta: CATEGORY_META[id],
    tasks: day.value!.tasks
      .filter((task) => task.category === id)
      .sort((a, b) => a.sort - b.sort || a.id - b.id),
  })).filter((group) => group.tasks.length > 0);
});

const countdown = computed(() => store.pinnedCountdown);
const countdownDays = computed(() =>
  countdown.value ? store.daysUntil(countdown.value.targetDate) : null
);
const countdownBig = computed(() => {
  if (countdownDays.value === null) return '—';
  if (countdownDays.value === 0) return '今天';
  return String(Math.abs(countdownDays.value));
});
const countdownUnit = computed(() => {
  if (countdownDays.value === null || countdownDays.value === 0) return '';
  return countdownDays.value > 0 ? '天' : '天前';
});
const countdownLabel = computed(() => {
  if (!countdown.value) return '';
  return (countdownDays.value ?? 0) >= 0
    ? `距离 ${countdown.value.title}`
    : `${countdown.value.title} 已过去`;
});

const planPct = computed(() =>
  store.plan.totalDays
    ? Math.min(100, Math.round((store.currentDayIdx / store.plan.totalDays) * 100))
    : 0
);

const outOfRangeText = computed(() => {
  if (store.isInRange) return '';
  if (store.todayIdx < 1) {
    return `计划还没开始，${-store.todayIdx + 1} 天后启动 · 先预览 D1 的安排`;
  }
  return `计划已结束 · 今天是第 ${store.todayIdx} 天，可回看最后一天`;
});

const composerOpen = ref(false);
const composerText = ref('');
const composerCategory = ref<Category>('math');
const composerInput = ref<HTMLInputElement | null>(null);

const taskDialogOpen = ref(false);
const editingTaskId = ref<number | null>(null);
const taskDialogCategory = ref<Category>('math');

const routineDialogOpen = ref(false);
const editingRoutine = ref<RoutineItem | null>(null);
const manageRoutine = ref(false);

const planDialogOpen = ref(false);
const countdownDialogOpen = ref(false);

function openComposer(): void {
  composerOpen.value = true;
  void nextTick(() => composerInput.value?.focus());
}

async function submitTask(): Promise<void> {
  if (!day.value) return;
  const text = composerText.value.trim();
  if (!text) return;
  await store.addTask(day.value.idx, composerCategory.value, text);
  composerText.value = '';
  taskDialogCategory.value = composerCategory.value;
  void nextTick(() => composerInput.value?.focus());
}

function editTask(taskId: number): void {
  editingTaskId.value = taskId;
  taskDialogOpen.value = true;
}

function openRoutineDialog(item: RoutineItem | null): void {
  editingRoutine.value = item;
  routineDialogOpen.value = true;
}

function kindName(kind: RoutineItem['kind']): string {
  if (kind === 'study') return '学习';
  if (kind === 'break') return '休息';
  return '作息';
}

function fmtSec(total: number): string {
  const value = Math.max(0, Math.round(total));
  const h = Math.floor(value / 3600);
  const m = Math.floor((value % 3600) / 60);
  const s = value % 60;
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

async function removeRoutine(item: RoutineItem): Promise<void> {
  await store.deleteRoutine(item.id);
  toast('作息已删除', 'info');
}

const editingTask = computed(() =>
  editingTaskId.value ? day.value?.tasks.find((t) => t.id === editingTaskId.value) ?? null : null
);
</script>

<template>
  <div class="view today-view">
    <header class="page-head">
      <div>
        <p class="eyebrow">{{ fullDateCN(store.today) }} · {{ weekdayCN(store.today) }}</p>
        <h1>今日</h1>
      </div>
      <div class="head-actions">
        <span v-if="day" class="chip accent num">
          D{{ day.idx }} / {{ store.plan.totalDays }}
        </span>
        <button class="icon-btn" title="调整计划" @click="planDialogOpen = true">
          <SlidersHorizontal :size="18" />
        </button>
        <button
          class="icon-btn"
          :title="store.effectiveTheme === 'dark' ? '切换浅色' : '切换深色'"
          @click="store.toggleTheme()"
        >
          <Sun v-if="store.effectiveTheme === 'dark'" :size="18" />
          <Moon v-else :size="18" />
        </button>
      </div>
    </header>

    <p v-if="outOfRangeText" class="banner">{{ outOfRangeText }}</p>

    <section class="hero">
      <div class="hero-glow g1" />
      <div class="hero-glow g2" />

      <div class="hero-main">
        <template v-if="countdown">
          <p class="hero-kicker">
            <Target :size="14" />
            {{ countdownLabel }}
          </p>
          <div class="hero-days">
            <span class="num" :class="{ word: countdownBig === '今天' }">{{ countdownBig }}</span>
            <span v-if="countdownUnit" class="hero-unit">{{ countdownUnit }}</span>
          </div>
          <p class="hero-target">
            {{ fullDateCN(countdown.targetDate) }} · {{ weekdayCN(countdown.targetDate) }}
            <span class="hero-sep">·</span>
            {{ relativeLabel(countdown.targetDate) || '目标日' }}
          </p>
        </template>
        <template v-else>
          <p class="hero-kicker"><Target :size="14" /> 还没有倒数日</p>
          <div class="hero-days"><span class="num word">今天</span></div>
          <p class="hero-target">添加一个目标日，让每天更有方向</p>
        </template>

        <div class="hero-plan">
          <div class="hero-plan-row">
            <span>{{ store.plan.name }}</span>
            <span class="num">{{ store.currentDayIdx }} / {{ store.plan.totalDays }} 天</span>
          </div>
          <div class="hero-bar"><i :style="{ width: planPct + '%' }" /></div>
        </div>
      </div>

      <div class="hero-side">
        <ProgressRing
          :value="progress.pct"
          :size="94"
          :stroke="8"
          color="#ffffff"
          track="rgba(255,255,255,0.22)"
        >
          <b class="num hero-ring-num">
            {{ progress.total ? `${progress.done}/${progress.total}` : '—' }}
          </b>
          <span class="hero-ring-label">今日完成</span>
        </ProgressRing>
        <button v-if="!countdown" class="hero-add" @click="countdownDialogOpen = true">
          添加倒数日
        </button>
      </div>
    </section>

    <section class="stat-row">
      <div class="stat">
        <span class="stat-icon" style="color: var(--success); background: var(--success-soft)">
          <CheckCircle2 :size="18" />
        </span>
        <div>
          <b class="num">{{ progress.done }}/{{ progress.total }}</b>
          <span>今日任务</span>
        </div>
      </div>
      <div class="stat">
        <span class="stat-icon" style="color: var(--primary); background: var(--primary-soft)">
          <Clock3 :size="18" />
        </span>
        <div>
          <b class="num">{{ routineDone }}/{{ store.routineCount }}</b>
          <span>节奏完成</span>
        </div>
      </div>
      <div class="stat">
        <span class="stat-icon" style="color: var(--warning); background: var(--warning-soft)">
          <Flame :size="18" />
        </span>
        <div>
          <b class="num">{{ store.streak }} 天</b>
          <span>连续完成</span>
        </div>
      </div>
    </section>

    <div class="today-grid">
      <section class="card tasks-card">
        <div class="section-head">
          <h3>学习任务 <span class="cnt num">{{ progress.done }}/{{ progress.total }}</span></h3>
          <span class="spacer" />
          <button class="icon-btn" title="添加任务" @click="openComposer">
            <Plus :size="19" />
          </button>
        </div>

        <div v-if="day" class="tasks-body">
          <div v-for="group in groups" :key="group.meta.id" class="task-group">
            <div class="group-head">
              <span class="group-dot" :style="{ background: group.meta.color }" />
              <span class="group-name">{{ group.meta.name }}</span>
              <span class="group-count num">
                {{ group.tasks.filter((t) => t.done).length }}/{{ group.tasks.length }}
              </span>
            </div>
            <TaskRow
              v-for="task in group.tasks"
              :key="task.id"
              :task="task"
              editable
              @toggle="store.toggleTask(task.id)"
              @edit="editTask(task.id)"
            />
          </div>

          <div v-if="!groups.length && !composerOpen" class="empty">
            <span class="empty-icon"><CheckCircle2 :size="24" /></span>
            <b>今天还没有任务</b>
            <p>添加第一条任务，或者从「计划」里给某一天安排复习内容。</p>
            <button class="btn sm soft" style="margin-top: 8px" @click="openComposer">
              <Plus :size="14" /> 添加任务
            </button>
          </div>

          <div v-if="composerOpen" class="composer">
            <div class="composer-cats">
              <button
                v-for="id in CATEGORY_LIST"
                :key="id"
                class="cat-chip"
                :class="{ active: composerCategory === id }"
                @click="composerCategory = id"
              >
                <span :style="{ background: CATEGORY_META[id].color }" />
                {{ CATEGORY_META[id].name }}
              </button>
            </div>
            <div class="composer-row">
              <input
                ref="composerInput"
                v-model="composerText"
                class="input"
                placeholder="输入要做的任务，回车添加…"
                maxlength="120"
                @keydown.enter.prevent="submitTask"
                @keydown.esc="composerOpen = false"
              />
              <button class="btn primary" :disabled="!composerText.trim()" @click="submitTask">
                添加
              </button>
            </div>
          </div>

          <button v-if="!composerOpen && groups.length" class="add-inline" @click="openComposer">
            <Plus :size="16" /> 添加任务
          </button>
        </div>
      </section>

      <section class="card routine-card">
        <div class="section-head">
          <h3>今日节奏 <span class="cnt num">{{ routineDone }}/{{ store.routineCount }}</span></h3>
          <span class="spacer" />
          <button
            class="mini-link"
            :class="{ active: manageRoutine }"
            @click="manageRoutine = !manageRoutine"
          >
            {{ manageRoutine ? '完成' : '管理' }}
          </button>
        </div>

        <div v-if="day" class="routine-body">
          <div v-if="store.routine.length" class="seg-grid">
            <div
              v-for="(item, index) in store.routine"
              :key="item.id"
              class="seg-card"
              :class="[
                item.kind,
                {
                  full: item.kind === 'routine',
                  done: store.isRoutineDone(day.idx, item.id),
                  running: store.segmentRunning(day.idx, item.id),
                  managing: manageRoutine,
                },
              ]"
            >
              <div class="seg-head">
                <span class="seg-kind">{{ kindName(item.kind) }}</span>
                <span class="seg-time num">{{ item.time }}</span>
                <button
                  v-if="!manageRoutine"
                  class="seg-check"
                  :class="{ on: store.isRoutineDone(day.idx, item.id) }"
                  :aria-label="store.isRoutineDone(day.idx, item.id) ? '取消打卡' : '打卡'"
                  @click="store.toggleCheck(day.idx, item.id)"
                >
                  <Check :size="12" :stroke-width="3.2" />
                </button>
              </div>

              <div class="seg-title">{{ item.title }}</div>

              <template v-if="item.kind !== 'routine'">
                <div class="seg-timer">
                  <span
                    v-if="store.segmentRunning(day.idx, item.id)"
                    class="seg-live"
                    aria-hidden="true"
                  />
                  <span class="seg-clock num">
                    {{ fmtSec(store.segmentRemaining(day.idx, item.id)) }}
                  </span>
                  <div class="seg-actions">
                    <button
                      class="seg-play"
                      :class="{ on: store.segmentRunning(day.idx, item.id) }"
                      :title="store.segmentRunning(day.idx, item.id) ? '暂停' : '开始'"
                      @click="store.toggleSegment(day.idx, item.id)"
                    >
                      <Pause v-if="store.segmentRunning(day.idx, item.id)" :size="13" />
                      <Play v-else :size="13" />
                    </button>
                    <button
                      class="seg-reset"
                      title="重置"
                      @click="store.resetSegment(day.idx, item.id)"
                    >
                      <RotateCcw :size="13" />
                    </button>
                  </div>
                </div>
                <div class="seg-bar">
                  <i :style="{ width: store.segmentProgress(day.idx, item.id) + '%' }" />
                </div>
              </template>

              <div v-if="manageRoutine" class="seg-manage">
                <button :disabled="index === 0" title="上移" @click="store.moveRoutine(item.id, -1)">
                  <ArrowUp :size="13" />
                </button>
                <button
                  :disabled="index === store.routine.length - 1"
                  title="下移"
                  @click="store.moveRoutine(item.id, 1)"
                >
                  <ArrowDown :size="13" />
                </button>
                <button title="编辑" @click="openRoutineDialog(item)">
                  <Pencil :size="13" />
                </button>
                <button class="danger" title="删除" @click="removeRoutine(item)">
                  <Trash2 :size="13" />
                </button>
              </div>
            </div>
          </div>

          <div v-if="!store.routine.length" class="empty">
            <span class="empty-icon"><Clock3 :size="24" /></span>
            <b>还没有时间段</b>
            <p>添加学习段与休息段，按自己的节奏安排一天。</p>
          </div>

          <button class="add-inline" @click="openRoutineDialog(null)">
            <Plus :size="16" /> 添加时间段
          </button>
          <p class="rt-note">
            学习与休息段可独立倒计时、暂停、重置；起居作息只打卡不计时。所有状态按天保存。
          </p>
        </div>
      </section>
    </div>

    <TaskDialog
      :open="taskDialogOpen"
      :day-idx="day?.idx ?? 1"
      :task="editingTask"
      :default-category="taskDialogCategory"
      @close="taskDialogOpen = false"
    />
    <RoutineDialog
      :open="routineDialogOpen"
      :item="editingRoutine"
      @close="routineDialogOpen = false"
    />
    <PlanDialog :open="planDialogOpen" @close="planDialogOpen = false" />
    <CountdownDialog :open="countdownDialogOpen" @close="countdownDialogOpen = false" />
  </div>
</template>

<style scoped>
.today-view {
  container-type: inline-size;
}

.banner {
  margin-bottom: 16px;
  padding: 10px 14px;
  border-radius: 12px;
  background: var(--warning-soft);
  color: #9a5b00;
  font-size: 12.5px;
  font-weight: 500;
}

/* ---------- Hero ---------- */
.hero {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 28px 32px;
  border-radius: var(--r-xl);
  background: linear-gradient(118deg, var(--hero-a), var(--hero-b) 48%, var(--hero-c));
  color: #fff;
  overflow: hidden;
  box-shadow: 0 24px 60px -24px rgba(91, 75, 240, 0.6);
}
.hero-glow {
  position: absolute;
  border-radius: 99px;
  filter: blur(8px);
  pointer-events: none;
}
.hero-glow.g1 {
  width: 300px;
  height: 300px;
  right: -60px;
  top: -140px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.24), transparent 65%);
}
.hero-glow.g2 {
  width: 260px;
  height: 260px;
  left: 32%;
  bottom: -190px;
  background: radial-gradient(circle, rgba(6, 182, 212, 0.3), transparent 65%);
}
.hero-main {
  position: relative;
  z-index: 1;
  min-width: 0;
  flex: 1;
}
.hero-kicker {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.82);
  letter-spacing: 0.02em;
}
.hero-days {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin: 4px 0 2px;
}
.hero-days .num {
  font-size: 68px;
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -0.045em;
}
.hero-days .num.word {
  font-size: 48px;
  letter-spacing: -0.03em;
}
.hero-unit {
  font-size: 18px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
}
.hero-target {
  font-size: 12.5px;
  color: rgba(255, 255, 255, 0.75);
}
.hero-sep {
  margin: 0 5px;
}
.hero-plan {
  margin-top: 20px;
  max-width: 430px;
}
.hero-plan-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 11.5px;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 7px;
}
.hero-bar {
  height: 6px;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.22);
  overflow: hidden;
}
.hero-bar i {
  display: block;
  height: 100%;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.92);
  transition: width 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}
.hero-side {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.hero-ring-num {
  font-size: 19px;
  font-weight: 800;
  letter-spacing: -0.02em;
}
.hero-ring-label {
  font-size: 10.5px;
  color: rgba(255, 255, 255, 0.75);
  margin-top: 1px;
}
.hero-add {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 99px;
  padding: 5px 12px;
}

/* ---------- Stats ---------- */
.stat-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin: 18px 0 20px;
}
.stat {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 18px;
  box-shadow: var(--shadow-sm);
}
.stat-icon {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  flex: none;
}
.stat b {
  display: block;
  font-size: 16.5px;
  font-weight: 750;
  letter-spacing: -0.02em;
  line-height: 1.2;
}
.stat span {
  font-size: 11.5px;
  color: var(--muted);
}

/* ---------- Grid ---------- */
.today-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}
@container (min-width: 880px) {
  .today-grid {
    grid-template-columns: minmax(0, 1.3fr) minmax(0, 0.9fr);
  }
}

.tasks-card,
.routine-card {
  overflow: hidden;
}
.tasks-body {
  padding: 0 14px 16px;
}
.task-group {
  padding: 4px 0 8px;
}
.task-group + .task-group {
  border-top: 1px solid var(--border);
  padding-top: 12px;
}
.group-head {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 12px 3px;
}
.group-dot {
  width: 7px;
  height: 7px;
  border-radius: 99px;
}
.group-name {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--muted);
  letter-spacing: 0.04em;
}
.group-count {
  margin-left: auto;
  font-size: 11px;
  color: var(--faint);
  font-weight: 600;
}

.composer {
  margin: 8px 0 4px;
  padding: 14px;
  border-radius: 16px;
  background: var(--surface-2);
  border: 1px solid var(--border);
}
.composer-cats {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}
.cat-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--muted);
  border: 1px solid transparent;
}
.cat-chip span {
  width: 6px;
  height: 6px;
  border-radius: 99px;
}
.cat-chip.active {
  background: var(--surface);
  border-color: var(--border);
  color: var(--text);
  box-shadow: var(--shadow-xs);
}
.composer-row {
  display: flex;
  gap: 8px;
}
.composer-row .input {
  height: 42px;
  min-height: 42px;
}
.add-inline {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 40px;
  border-radius: 12px;
  border: 1px dashed var(--border-strong);
  color: var(--muted);
  font-size: 13px;
  font-weight: 600;
  margin-top: 8px;
  transition: all 0.15s ease;
}
.add-inline:hover {
  border-color: var(--primary);
  color: var(--primary-strong);
  background: var(--primary-soft);
}

/* ---------- Routine segments ---------- */
.routine-body {
  padding: 0 16px 16px;
}
.seg-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.seg-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 11px 8px;
  border-radius: 14px;
  border: 1px solid var(--border);
  border-left-width: 3px;
  background: var(--surface-2);
  overflow: hidden;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
}
.seg-card.study {
  border-left-color: var(--primary);
}
.seg-card.break {
  border-left-color: var(--success);
}
.seg-card.routine {
  border-left-color: var(--border-strong);
  background: var(--surface);
}
.seg-card.full {
  grid-column: 1 / -1;
}
.seg-card.running {
  border-color: var(--primary);
  background: var(--primary-soft-2);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--primary) 22%, transparent);
}
.seg-card.done .seg-title {
  color: var(--faint);
  text-decoration: line-through;
}
.seg-head {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 18px;
}
.seg-kind {
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.04em;
  padding: 1px 6px;
  border-radius: 99px;
  background: var(--surface-3);
  color: var(--muted);
  flex: none;
}
.seg-card.study .seg-kind {
  color: var(--primary-strong);
  background: var(--primary-soft);
}
.seg-card.break .seg-kind {
  color: #0a7a47;
  background: var(--success-soft);
}
html[data-theme="dark"] .seg-card.break .seg-kind {
  color: var(--success);
}
.seg-time {
  font-size: 9.5px;
  font-family: var(--font-mono);
  color: var(--muted);
  margin-left: auto;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.seg-check {
  flex: none;
  width: 21px;
  height: 21px;
  border-radius: 7px;
  border: 1.5px solid var(--border-strong);
  display: grid;
  place-items: center;
  color: #fff;
  background: transparent;
  transition: all 0.16s ease;
}
.seg-check :deep(svg) {
  opacity: 0;
  transform: scale(0.6);
  transition: all 0.15s ease;
}
.seg-check.on {
  background: var(--success);
  border-color: var(--success);
}
.seg-check.on :deep(svg) {
  opacity: 1;
  transform: scale(1);
}
.seg-title {
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--text-2);
  word-break: break-word;
}
.seg-timer {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}
.seg-live {
  width: 5px;
  height: 5px;
  border-radius: 99px;
  background: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-soft);
  flex: none;
  animation: seg-pulse 1.4s ease-in-out infinite;
}
@keyframes seg-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}
.seg-clock {
  font-family: var(--font-mono);
  font-size: 19px;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.2;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}
.seg-card.running .seg-clock {
  color: var(--primary-strong);
}
.seg-actions {
  display: flex;
  gap: 4px;
  margin-left: auto;
}
.seg-play,
.seg-reset {
  width: 25px;
  height: 25px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-2);
}
.seg-play {
  background: var(--primary-soft);
  border-color: transparent;
  color: var(--primary-strong);
}
.seg-play.on {
  background: var(--primary);
  color: #fff;
}
.seg-play:hover,
.seg-reset:hover {
  filter: brightness(0.97);
}
.seg-bar {
  height: 3px;
  border-radius: 99px;
  background: var(--surface-3);
  overflow: hidden;
  margin-top: 3px;
}
.seg-bar i {
  display: block;
  height: 100%;
  border-radius: 99px;
  background: linear-gradient(90deg, var(--primary), #a855f7);
  transition: width 0.8s linear;
}
.seg-card.break .seg-bar i {
  background: linear-gradient(90deg, var(--success), #34d399);
}
.seg-manage {
  display: flex;
  gap: 4px;
  margin-top: 5px;
  padding-top: 6px;
  border-top: 1px dashed var(--border);
}
.seg-manage button {
  width: 25px;
  height: 25px;
  border-radius: 7px;
  display: grid;
  place-items: center;
  color: var(--muted);
  background: var(--surface-3);
}
.seg-manage button:hover {
  color: var(--text);
}
.seg-manage button.danger:hover {
  color: var(--danger);
  background: var(--danger-soft);
}
.seg-manage button:disabled {
  opacity: 0.35;
  pointer-events: none;
}
.rt-note {
  margin-top: 10px;
  padding: 0 4px;
  font-size: 11px;
  color: var(--faint);
  line-height: 1.6;
}
.mini-link {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--muted);
  padding: 4px 8px;
  border-radius: 8px;
}
.mini-link:hover,
.mini-link.active {
  color: var(--primary-strong);
  background: var(--primary-soft);
}

/* ---------- Responsive ---------- */
@container (max-width: 620px) {
  .hero {
    padding: 22px 20px;
    gap: 14px;
  }
  .hero-days .num {
    font-size: 54px;
  }
  .hero-days .num.word {
    font-size: 38px;
  }
  .hero-side :deep(.ring) {
    width: 78px !important;
    height: 78px !important;
  }
  .hero-plan {
    margin-top: 14px;
  }
  .stat {
    padding: 11px 12px;
    gap: 9px;
    border-radius: 16px;
  }
  .stat-icon {
    width: 32px;
    height: 32px;
    border-radius: 10px;
  }
  .stat b {
    font-size: 14.5px;
  }
  .stat span {
    font-size: 10.5px;
  }
  .seg-clock {
    font-size: 17px;
  }
  .seg-kind {
    font-size: 9px;
  }
}
@container (max-width: 460px) {
  .seg-grid {
    grid-template-columns: 1fr;
  }
}
@container (max-width: 430px) {
  .hero-side {
    display: none;
  }
  .stat-row {
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .stat {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }
  .stat-icon {
    width: 30px;
    height: 30px;
  }
  .stat b {
    font-size: 14px;
  }
}
</style>

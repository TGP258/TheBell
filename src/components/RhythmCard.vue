<script setup lang="ts">
import { computed, ref } from 'vue';
import { Check, ChevronDown, ChevronRight, Clock3, Pencil, Plus, Trash2 } from 'lucide-vue-next';
import type { RoutineItem } from '../types';
import { clockText, coversNow, durationText, fmtCountdown, nowMinutes } from '../lib/segment';
import { usePlanStore } from '../stores/plan';
import { toast } from '../lib/toast';
import RoutineDialog from './RoutineDialog.vue';

const store = usePlanStore();

const day = computed(() => store.currentDay);
const routineDone = computed(() => (day.value ? store.routineDone(day.value.idx) : 0));
const nowMin = computed(() => nowMinutes(store.nowMs));

const routineDialogOpen = ref(false);
const editingRoutine = ref<RoutineItem | null>(null);
const manageRoutine = ref(false);

/** 已勾选完成的项目是否折叠收起 */
const doneFolded = ref(false);

const doneCount = computed(() => routineDone.value);
const visibleTimeline = computed(() => {
  if (!doneFolded.value || !day.value) return store.timeline;
  return store.timeline.filter((item) => !store.isRoutineDone(day.value!.idx, item.id));
});

function openRoutineDialog(item: RoutineItem | null): void {
  editingRoutine.value = item;
  routineDialogOpen.value = true;
}

function kindName(kind: RoutineItem['kind']): string {
  if (kind === 'study') return '学习';
  if (kind === 'break') return '休息';
  return '作息';
}

function startLabel(item: RoutineItem): string {
  return item.startMin >= 0 ? clockText(item.startMin) : '—';
}

function endLabel(item: RoutineItem): string {
  return item.endMin > 0 ? clockText(item.endMin) : '';
}

function segDuration(item: RoutineItem): string {
  return item.kind === 'routine' ? '' : durationText(item.durationSec);
}

function isNowSegment(item: RoutineItem): boolean {
  return coversNow(item, nowMin.value);
}

function selectSegment(item: RoutineItem): void {
  if (item.kind === 'routine' || item.durationSec <= 0) return;
  store.selectSegment(item.id);
}

async function removeRoutine(item: RoutineItem): Promise<void> {
  await store.deleteRoutine(item.id);
  toast('作息已删除', 'info');
}
</script>

<template>
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
      <button
        v-if="doneCount && !manageRoutine"
        class="done-fold"
        :class="{ open: !doneFolded }"
        @click="doneFolded = !doneFolded"
      >
        <component :is="doneFolded ? ChevronRight : ChevronDown" :size="13" />
        {{ doneFolded ? '展开' : '收起' }}已完成 {{ doneCount }} 项
      </button>

      <div v-if="store.timeline.length" class="timeline">
        <article
          v-for="item in visibleTimeline"
          :key="item.id"
          class="tl-item"
          :class="[
            item.kind,
            {
              active: store.activeSegment?.id === item.id,
              done: store.isRoutineDone(day.idx, item.id),
              running: store.segmentRunning(day.idx, item.id),
              now: !manageRoutine && isNowSegment(item),
              managing: manageRoutine,
            },
          ]"
        >
          <div class="tl-time num">
            <b>{{ startLabel(item) }}</b>
            <span v-if="endLabel(item)">{{ endLabel(item) }}</span>
          </div>

          <div class="tl-rail"><span class="tl-dot" /></div>

          <div
            class="tl-card"
            :class="{ inert: item.kind === 'routine' && !manageRoutine }"
            @click="manageRoutine ? openRoutineDialog(item) : selectSegment(item)"
          >
            <div class="tl-top">
              <span class="tl-kind">{{ kindName(item.kind) }}</span>
              <span v-if="item.kind !== 'routine'" class="tl-dur num">
                {{ segDuration(item) }}
              </span>
              <span v-if="!manageRoutine && isNowSegment(item)" class="tl-now">现在</span>
              <span
                v-if="store.segmentRunning(day.idx, item.id)"
                class="tl-live num"
                title="该段正在计时"
              >
                {{ fmtCountdown(store.segmentRemaining(day.idx, item.id)) }}
              </span>
              <button
                v-if="!manageRoutine"
                class="tl-check"
                :class="{ on: store.isRoutineDone(day.idx, item.id) }"
                :aria-label="store.isRoutineDone(day.idx, item.id) ? '取消打卡' : '打卡'"
                @click.stop="store.toggleCheck(day.idx, item.id)"
              >
                <Check :size="12" :stroke-width="3.2" />
              </button>
            </div>

            <p class="tl-title">{{ item.title }}</p>

            <div v-if="manageRoutine" class="tl-actions">
              <button title="编辑" @click.stop="openRoutineDialog(item)">
                <Pencil :size="13" />
              </button>
              <button class="danger" title="删除" @click.stop="removeRoutine(item)">
                <Trash2 :size="13" />
              </button>
            </div>
          </div>
        </article>
      </div>

      <div v-if="!store.timeline.length" class="empty">
        <span class="empty-icon"><Clock3 :size="24" /></span>
        <b>还没有时间段</b>
        <p>添加学习段与休息段，按自己的节奏安排一天。</p>
      </div>

      <button class="add-inline" @click="openRoutineDialog(null)">
        <Plus :size="16" /> 添加时间段
      </button>
      <p class="rt-note">
        时间线按开始时间排列。点某一段可在倒计时卡里切换；学习与休息段可计时，起居作息只打卡。
      </p>
    </div>

    <RoutineDialog
      :open="routineDialogOpen"
      :item="editingRoutine"
      @close="routineDialogOpen = false"
    />
  </section>
</template>

<style scoped>
.routine-card {
  overflow: hidden;
}
.routine-body {
  padding: 0 16px 16px;
}
.timeline {
  padding: 2px 0;
}
.tl-item {
  --accent: var(--border-strong);
  --accent-soft: var(--surface-3);
  display: grid;
  grid-template-columns: 56px 22px minmax(0, 1fr);
  gap: 6px;
  padding-bottom: 8px;
}
.tl-item.study {
  --accent: var(--primary);
  --accent-soft: var(--primary-soft);
}
.tl-item.break {
  --accent: var(--success);
  --accent-soft: var(--success-soft);
}
.tl-time {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
  padding-top: 7px;
  line-height: 1.3;
  font-size: 10px;
  color: var(--faint);
}
.tl-time b {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--text-2);
  letter-spacing: -0.01em;
}
.tl-rail {
  position: relative;
  display: flex;
  justify-content: center;
}
.tl-rail::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: -8px;
  left: 50%;
  width: 1.5px;
  margin-left: -0.75px;
  background: var(--border);
}
.tl-item:last-child .tl-rail::before {
  display: none;
}
.tl-dot {
  position: relative;
  z-index: 1;
  width: 9px;
  height: 9px;
  margin-top: 11px;
  border-radius: 99px;
  background: var(--accent);
  box-shadow: 0 0 0 3px var(--surface);
  transition: background 0.18s ease, box-shadow 0.18s ease;
}
.tl-item.routine .tl-dot {
  width: 7px;
  height: 7px;
  margin-top: 12px;
  background: var(--border-strong);
}
.tl-item.routine.study .tl-dot,
.tl-item.routine.break .tl-dot {
  background: var(--accent);
}
.tl-card {
  min-width: 0;
  padding: 7px 10px 8px;
  border-radius: 12px;
  border: 1px solid transparent;
  background: var(--surface-2);
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.tl-card:hover {
  background: var(--surface-3);
}
.tl-item.routine .tl-card {
  background: transparent;
  padding-top: 5px;
  padding-bottom: 6px;
}
.tl-item.routine .tl-card:hover {
  background: var(--surface-2);
}
.tl-card.inert {
  cursor: default;
}
.tl-card.inert:hover {
  background: transparent;
}
.tl-item.active .tl-card {
  background: var(--accent-soft);
  border-color: color-mix(in srgb, var(--accent) 34%, transparent);
}
.tl-item.active .tl-dot {
  box-shadow: 0 0 0 4px var(--accent-soft);
}
.tl-item.running .tl-dot {
  animation: tl-pulse 1.5s ease-in-out infinite;
}
@keyframes tl-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 4px var(--accent-soft);
  }
  50% {
    box-shadow: 0 0 0 7px transparent;
  }
}
.tl-item.done .tl-title {
  color: var(--faint);
  text-decoration: line-through;
}
.tl-top {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 19px;
}
.tl-kind {
  flex: none;
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.04em;
  padding: 1px 6px;
  border-radius: 99px;
  background: var(--surface-3);
  color: var(--muted);
}
.tl-item.study .tl-kind {
  color: var(--primary-strong);
  background: var(--primary-soft);
}
.tl-item.break .tl-kind {
  color: #0a7a47;
  background: var(--success-soft);
}
html[data-theme="dark"] .tl-item.break .tl-kind {
  color: var(--success);
}
.tl-dur {
  font-size: 10px;
  color: var(--faint);
  white-space: nowrap;
}
.tl-now {
  flex: none;
  font-size: 9px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 99px;
  background: var(--accent-soft);
  color: var(--accent);
}
.tl-live {
  margin-left: auto;
  font-size: 11px;
  font-weight: 700;
  color: var(--primary-strong);
  font-variant-numeric: tabular-nums;
}
.tl-check {
  flex: none;
  margin-left: auto;
  width: 20px;
  height: 20px;
  border-radius: 7px;
  border: 1.5px solid var(--border-strong);
  display: grid;
  place-items: center;
  color: #fff;
  background: transparent;
  transition: all 0.16s ease;
}
.tl-live + .tl-check {
  margin-left: 4px;
}
.tl-check :deep(svg) {
  opacity: 0;
  transform: scale(0.6);
  transition: all 0.15s ease;
}
.tl-check.on {
  background: var(--success);
  border-color: var(--success);
}
.tl-check.on :deep(svg) {
  opacity: 1;
  transform: scale(1);
}
.tl-title {
  margin-top: 2px;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--text-2);
  word-break: break-word;
}
.tl-actions {
  display: flex;
  gap: 4px;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px dashed var(--border);
}
.tl-actions button {
  width: 25px;
  height: 25px;
  border-radius: 7px;
  display: grid;
  place-items: center;
  color: var(--muted);
  background: var(--surface-3);
}
.tl-actions button:hover {
  color: var(--text);
}
.tl-actions button.danger:hover {
  color: var(--danger);
  background: var(--danger-soft);
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
.done-fold {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  width: 100%;
  margin: 2px 0 8px;
  padding: 8px 0;
  border-radius: 10px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--muted);
  background: var(--surface-2);
  border: 1px dashed var(--border);
  transition: all 0.15s ease;
}
.done-fold:hover {
  color: var(--text-2);
  border-color: var(--border-strong);
}
.mini-link:hover,
.mini-link.active {
  color: var(--primary-strong);
  background: var(--primary-soft);
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
@container (max-width: 620px) {
  .tl-time {
    font-size: 9.5px;
  }
  .tl-time b {
    font-size: 11px;
  }
  .tl-title {
    font-size: 12px;
  }
}
@container (max-width: 460px) {
  .tl-item {
    grid-template-columns: 46px 18px minmax(0, 1fr);
    gap: 5px;
  }
  .tl-card {
    padding: 6px 8px 7px;
  }
}
</style>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Plus } from 'lucide-vue-next';
import type { Category, Task } from '../types';
import { CATEGORY_LIST, CATEGORY_META } from '../lib/categories';
import { relativeLabel, shortDate, weekdayCN } from '../lib/date';
import { usePlanStore } from '../stores/plan';
import TaskRow from './TaskRow.vue';
import TaskDialog from './TaskDialog.vue';
import PostponeDialog from './PostponeDialog.vue';

const store = usePlanStore();

/** 0 = 今天，负数看之前，正数看之后 */
const viewOffset = ref(0);
const totalDays = computed(() => store.plan.totalDays || 1);
const viewIdx = computed(() =>
  Math.min(totalDays.value, Math.max(1, store.currentDayIdx + viewOffset.value))
);
const viewDay = computed(() => store.getDay(viewIdx.value));
const isToday = computed(() => viewIdx.value === store.currentDayIdx);

const progress = computed(() => store.dayProgress(viewIdx.value));

const dayDateLabel = computed(() => (viewDay.value ? shortDate(viewDay.value.date) : ''));
const dayLabel = computed(() => {
  const date = viewDay.value?.date ?? '';
  if (!date) return '';
  if (isToday.value) return '今天';
  return relativeLabel(date) || weekdayCN(date);
});

/** 今天 + 自动顺延时显示继承区：之前所有未完成任务 */
const inherited = computed(() =>
  isToday.value && store.autoPostpone ? store.inheritedTasks : []
);
const inheritedOpen = ref(true);

/** 手动顺延模式下的轻提示条数（仅今天） */
const manualHint = computed(() =>
  isToday.value && !store.autoPostpone ? store.inheritedTasks.length : 0
);

function badgeFor(task: Task): string {
  return shortDate(store.getDay(task.dayIdx)?.date ?? '');
}

const groups = computed(() => {
  if (!viewDay.value) return [];
  return CATEGORY_LIST.map((id) => ({
    meta: CATEGORY_META[id],
    tasks: viewDay.value!.tasks
      .filter((task) => task.category === id)
      .sort((a, b) => a.sort - b.sort || a.id - b.id),
  })).filter((group) => group.tasks.length > 0);
});

const composerOpen = ref(false);
const composerText = ref('');
const composerCategory = ref<Category>('math');
const composerInput = ref<HTMLInputElement | null>(null);

const taskDialogOpen = ref(false);
const editingTaskId = ref<number | null>(null);
const taskDialogCategory = ref<Category>('math');

const postponeOpen = ref(false);
const postponingTask = ref<Task | null>(null);

const editingTask = computed(() =>
  editingTaskId.value ? viewDay.value?.tasks.find((t) => t.id === editingTaskId.value) ?? null : null
);

function stepView(delta: number): void {
  const next = Math.min(
    totalDays.value,
    Math.max(1, store.currentDayIdx + viewOffset.value + delta)
  );
  viewOffset.value = next - store.currentDayIdx;
}

function backToToday(): void {
  viewOffset.value = 0;
}

function openComposer(): void {
  composerOpen.value = true;
  void nextTick(() => composerInput.value?.focus());
}

async function submitTask(): Promise<void> {
  if (!viewDay.value) return;
  const text = composerText.value.trim();
  if (!text) return;
  await store.addTask(viewDay.value.idx, composerCategory.value, text);
  composerText.value = '';
  taskDialogCategory.value = composerCategory.value;
  void nextTick(() => composerInput.value?.focus());
}

function editTask(taskId: number): void {
  editingTaskId.value = taskId;
  taskDialogOpen.value = true;
}

function openPostpone(task: Task): void {
  postponingTask.value = task;
  postponeOpen.value = true;
}
</script>

<template>
  <section class="card tasks-card">
    <div class="section-head">
      <h3>学习任务 <span class="cnt num">{{ progress.done }}/{{ progress.total }}</span></h3>
      <span class="spacer" />
      <div v-if="viewDay" class="day-nav">
        <button
          class="icon-btn nav"
          :disabled="viewIdx <= 1"
          title="前一天"
          @click="stepView(-1)"
        >
          <ChevronLeft :size="17" />
        </button>
        <button
          class="day-label"
          :class="{ away: !isToday }"
          :title="isToday ? '' : '点击回到今天'"
          @click="backToToday"
        >
          <span class="num">{{ dayDateLabel }}</span>
          <span class="sep">·</span>
          <span>{{ dayLabel }}</span>
        </button>
        <button
          class="icon-btn nav"
          :disabled="viewIdx >= totalDays"
          title="后一天"
          @click="stepView(1)"
        >
          <ChevronRight :size="17" />
        </button>
      </div>
      <button class="icon-btn" title="添加任务" @click="openComposer">
        <Plus :size="19" />
      </button>
    </div>

    <div v-if="viewDay" class="tasks-body">
      <div v-if="inherited.length" class="task-group inherited">
        <button class="group-head fold" @click="inheritedOpen = !inheritedOpen">
          <span class="group-dot inherit" />
          <span class="group-name">继承任务</span>
          <span class="group-count num">{{ inherited.length }}</span>
          <ChevronDown :size="14" class="fold-icon" :class="{ open: inheritedOpen }" />
        </button>
        <template v-if="inheritedOpen">
          <TaskRow
            v-for="task in inherited"
            :key="task.id"
            :task="task"
            :badge="badgeFor(task)"
            show-category
            postponable
            @toggle="store.toggleTask(task.id)"
            @postpone="openPostpone(task)"
          />
          <p class="inherit-hint">之前未完成的任务会自动出现在这里，完成后自动消失</p>
        </template>
      </div>

      <p v-else-if="manualHint" class="manual-hint">
        还有 {{ manualHint }} 条未完成任务留在之前几天，切换到那一天后可顺延到今天
      </p>

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
          postponable
          @toggle="store.toggleTask(task.id)"
          @edit="editTask(task.id)"
          @postpone="openPostpone(task)"
        />
      </div>

      <div v-if="!groups.length && !inherited.length && !composerOpen" class="empty">
        <span class="empty-icon"><CheckCircle2 :size="24" /></span>
        <b>{{ isToday ? '今天还没有任务' : '这一天还没有任务' }}</b>
        <p>
          {{
            isToday
              ? '添加第一条任务，或者从「计划」里给某一天安排复习内容。'
              : '也可以直接添加，把复习内容安排到这一天。'
          }}
        </p>
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
            :placeholder="isToday ? '输入要做的任务，回车添加…' : `添加到 ${dayDateLabel}（${dayLabel}）…`"
            maxlength="120"
            @keydown.enter.prevent="submitTask"
            @keydown.esc="composerOpen = false"
          />
          <button class="btn primary" :disabled="!composerText.trim()" @click="submitTask">
            添加
          </button>
        </div>
      </div>

      <button v-if="!composerOpen && (groups.length || inherited.length)" class="add-inline" @click="openComposer">
        <Plus :size="16" /> 添加任务
      </button>
    </div>

    <TaskDialog
      :open="taskDialogOpen"
      :day-idx="viewDay?.idx ?? 1"
      :task="editingTask"
      :default-category="taskDialogCategory"
      @close="taskDialogOpen = false"
    />
    <PostponeDialog
      :open="postponeOpen"
      :task="postponingTask"
      @close="postponeOpen = false"
    />
  </section>
</template>

<style scoped>
.tasks-card {
  overflow: hidden;
}
.tasks-body {
  padding: 0 14px 16px;
}
.day-nav {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-right: 6px;
}
.icon-btn.nav {
  width: 28px;
  height: 28px;
  border-radius: 8px;
}
.day-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid transparent;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text-2);
  white-space: nowrap;
  transition: all 0.15s ease;
}
.day-label .sep {
  color: var(--faint);
  font-weight: 600;
}
.day-label.away {
  background: var(--primary-soft);
  color: var(--primary-strong);
}
.day-label.away:hover {
  border-color: var(--primary);
}
.task-group {
  padding: 4px 0 8px;
}
.task-group + .task-group {
  border-top: 1px solid var(--border);
  padding-top: 12px;
}
.task-group.inherited + .task-group {
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
.group-dot.inherit {
  background: var(--primary);
}
.inherited .group-name {
  color: var(--primary-strong);
}
.group-count {
  margin-left: auto;
  font-size: 11px;
  color: var(--faint);
  font-weight: 600;
}
.inherit-hint {
  padding: 2px 12px 4px;
  font-size: 11px;
  color: var(--faint);
  line-height: 1.5;
}
.group-head.fold {
  width: 100%;
  text-align: left;
  cursor: pointer;
  border-radius: 8px;
}
.group-head.fold:hover {
  background: var(--surface-2);
}
.fold-icon {
  flex: none;
  color: var(--faint);
  transition: transform 0.15s ease;
}
.fold-icon.open {
  transform: rotate(0deg);
}
.fold-icon:not(.open) {
  transform: rotate(-90deg);
}
.manual-hint {
  padding: 8px 12px;
  border-radius: 10px;
  background: var(--surface-2);
  border: 1px dashed var(--border);
  font-size: 11.5px;
  color: var(--muted);
  line-height: 1.55;
  margin-top: 6px;
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
@media (max-width: 640px) {
  .day-label .num,
  .day-label .sep {
    display: none;
  }
}
</style>

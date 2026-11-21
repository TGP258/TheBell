<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { CheckCircle2, Plus } from 'lucide-vue-next';
import type { Category } from '../types';
import { CATEGORY_LIST, CATEGORY_META } from '../lib/categories';
import { usePlanStore } from '../stores/plan';
import TaskRow from './TaskRow.vue';
import TaskDialog from './TaskDialog.vue';

const store = usePlanStore();

const day = computed(() => store.currentDay);
const progress = computed(() =>
  day.value ? store.dayProgress(day.value.idx) : { total: 0, done: 0, pct: 0 }
);

const groups = computed(() => {
  if (!day.value) return [];
  return CATEGORY_LIST.map((id) => ({
    meta: CATEGORY_META[id],
    tasks: day.value!.tasks
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

const editingTask = computed(() =>
  editingTaskId.value ? day.value?.tasks.find((t) => t.id === editingTaskId.value) ?? null : null
);

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
</script>

<template>
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

    <TaskDialog
      :open="taskDialogOpen"
      :day-idx="day?.idx ?? 1"
      :task="editingTask"
      :default-category="taskDialogCategory"
      @close="taskDialogOpen = false"
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
</style>

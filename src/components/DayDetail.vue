<script setup lang="ts">
import { computed, ref } from 'vue';
import { Check, Plus } from 'lucide-vue-next';
import type { Task } from '../types';
import { fullDateCN, relativeLabel, weekdayCN } from '../lib/date';
import { usePlanStore } from '../stores/plan';
import AppModal from './AppModal.vue';
import TaskRow from './TaskRow.vue';
import TaskDialog from './TaskDialog.vue';

const props = defineProps<{
  open: boolean;
  dayIdx: number | null;
}>();

const emit = defineEmits<{ close: [] }>();
const store = usePlanStore();

const day = computed(() => (props.dayIdx ? store.getDay(props.dayIdx) : null));
const progress = computed(() =>
  props.dayIdx ? store.dayProgress(props.dayIdx) : { total: 0, done: 0, pct: 0 }
);
const checks = computed(() => (props.dayIdx ? store.routineDone(props.dayIdx) : 0));

const taskDialogOpen = ref(false);
const editingTask = ref<Task | null>(null);

function close(): void {
  emit('close');
}

function addTask(): void {
  editingTask.value = null;
  taskDialogOpen.value = true;
}

function editTask(task: Task): void {
  editingTask.value = task;
  taskDialogOpen.value = true;
}
</script>

<template>
  <AppModal :open="open" width="lg" @close="close">
    <template #header>
      <div v-if="day" class="dd-head">
        <div class="dd-badge num">D{{ day.idx }}</div>
        <div class="dd-title">
          <h3>{{ fullDateCN(day.date) }}</h3>
          <p>
            {{ weekdayCN(day.date) }}
            <span v-if="relativeLabel(day.date)" class="dot">·</span>
            <span v-if="relativeLabel(day.date)">{{ relativeLabel(day.date) }}</span>
            <span class="dot">·</span>
            <span>任务 {{ progress.done }}/{{ progress.total }}</span>
          </p>
        </div>
      </div>
    </template>

    <div v-if="day" class="dd-body">
      <div class="dd-bar">
        <i :style="{ width: progress.pct + '%' }" />
      </div>

      <section class="dd-section">
        <div class="dd-section-head">
          <h4>学习任务</h4>
          <span class="pill">{{ progress.pct }}%</span>
          <span class="grow" />
          <button class="btn sm soft" @click="addTask">
            <Plus :size="14" /> 添加
          </button>
        </div>

        <div v-if="day.tasks.length" class="dd-tasks">
          <TaskRow
            v-for="task in day.tasks"
            :key="task.id"
            :task="task"
            editable
            show-category
            dense
            @toggle="store.toggleTask(task.id)"
            @edit="editTask(task)"
          />
        </div>
        <div v-else class="dd-empty">
          <p>这一天还没有任务。</p>
          <button class="btn sm" @click="addTask"><Plus :size="14" /> 添加第一条</button>
        </div>
      </section>

      <section class="dd-section">
        <div class="dd-section-head">
          <h4>作息打卡</h4>
          <span class="pill">{{ checks }}/{{ store.routineCount }}</span>
        </div>
        <div class="dd-routine">
          <button
            v-for="item in store.routine"
            :key="item.id"
            class="dd-routine-row"
            :class="{ done: store.isRoutineDone(day.idx, item.id) }"
            @click="store.toggleCheck(day.idx, item.id)"
          >
            <span class="mini-check">
              <Check v-if="store.isRoutineDone(day.idx, item.id)" :size="11" :stroke-width="3.2" />
            </span>
            <span class="dd-time num">{{ item.time }}</span>
            <span class="dd-routine-title">{{ item.title }}</span>
          </button>
        </div>
      </section>
    </div>

    <TaskDialog
      :open="taskDialogOpen"
      :day-idx="day?.idx ?? 1"
      :task="editingTask"
      @close="taskDialogOpen = false"
    />
  </AppModal>
</template>

<style scoped>
.dd-head {
  display: flex;
  align-items: center;
  gap: 14px;
  flex: 1;
}
.dd-badge {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, var(--primary), var(--primary-strong));
  color: #fff;
  font-size: 14px;
  font-weight: 800;
  letter-spacing: -0.02em;
  box-shadow: 0 8px 18px -8px rgba(98, 87, 245, 0.7);
}
.dd-title h3 {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.dd-title p {
  font-size: 12.5px;
  color: var(--muted);
  margin-top: 2px;
}
.dot {
  margin: 0 4px;
}
.dd-body {
  padding-top: 4px;
}
.dd-bar {
  height: 8px;
  border-radius: 99px;
  background: var(--surface-3);
  overflow: hidden;
  margin-bottom: 22px;
}
.dd-bar i {
  display: block;
  height: 100%;
  border-radius: 99px;
  background: linear-gradient(90deg, var(--primary), #a855f7);
  transition: width 0.45s cubic-bezier(0.22, 1, 0.36, 1);
}
.dd-section + .dd-section {
  margin-top: 26px;
}
.dd-section-head {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 10px;
}
.dd-section-head h4 {
  font-size: 14px;
  font-weight: 700;
}
.pill {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--muted);
  background: var(--surface-3);
  border-radius: 99px;
  padding: 2px 9px;
  font-variant-numeric: tabular-nums;
}
.grow {
  flex: 1;
}
.dd-tasks {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0 -6px;
}
.dd-empty {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px;
  border-radius: 14px;
  border: 1px dashed var(--border-strong);
  color: var(--muted);
  font-size: 13px;
}
.dd-routine {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: 16px;
  overflow: hidden;
}
.dd-routine-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  text-align: left;
  border-bottom: 1px solid var(--border);
  transition: background 0.15s ease;
}
.dd-routine-row:last-child {
  border-bottom: none;
}
.dd-routine-row:hover {
  background: var(--surface-2);
}
.mini-check {
  flex: none;
  width: 18px;
  height: 18px;
  border-radius: 6px;
  border: 1.5px solid var(--border-strong);
  display: grid;
  place-items: center;
  color: #fff;
  transition: all 0.16s ease;
}
.dd-routine-row.done .mini-check {
  background: var(--success);
  border-color: var(--success);
}
.dd-time {
  flex: none;
  width: 88px;
  font-size: 11.5px;
  font-weight: 700;
  color: var(--purple, var(--primary));
  color: var(--primary);
  font-family: var(--font-mono);
}
.dd-routine-title {
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-2);
  transition: color 0.15s ease;
}
.dd-routine-row.done .dd-routine-title {
  color: var(--faint);
  text-decoration: line-through;
}
@media (max-width: 560px) {
  .dd-time {
    width: 70px;
    font-size: 10.5px;
  }
  .dd-badge {
    width: 42px;
    height: 42px;
    font-size: 13px;
  }
  .dd-title h3 {
    font-size: 15px;
  }
}
</style>

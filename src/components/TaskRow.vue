<script setup lang="ts">
import { computed } from 'vue';
import { Check, Pencil } from 'lucide-vue-next';
import type { Task } from '../types';
import { CATEGORY_META } from '../lib/categories';

const props = withDefaults(
  defineProps<{
    task: Task;
    editable?: boolean;
    showCategory?: boolean;
    dense?: boolean;
  }>(),
  {
    editable: false,
    showCategory: false,
    dense: false,
  }
);

defineEmits<{ toggle: []; edit: [] }>();

const meta = computed(() => CATEGORY_META[props.task.category]);
</script>

<template>
  <div class="task" :class="{ done: task.done, dense }">
    <button
      class="task-check"
      :class="{ checked: task.done }"
      :aria-label="task.done ? '取消完成' : '标记完成'"
      @click="$emit('toggle')"
    >
      <Check :size="13" :stroke-width="3.4" />
    </button>
    <button class="task-body" @click="$emit('toggle')">
      <span v-if="showCategory" class="task-cat" :style="{ color: meta.color }">
        <span class="cat-dot" :style="{ background: meta.color }" />
        {{ meta.name }}
      </span>
      <span class="task-title">{{ task.title }}</span>
    </button>
    <button
      v-if="editable"
      class="task-edit"
      aria-label="编辑任务"
      @click.stop="$emit('edit')"
    >
      <Pencil :size="15" />
    </button>
  </div>
</template>

<style scoped>
.task {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  padding: 10px 12px;
  border-radius: 12px;
  transition: background 0.15s ease;
}
.task:hover {
  background: var(--surface-2);
}
.task.dense {
  padding: 8px 10px;
}

.task-check {
  flex: none;
  width: 21px;
  height: 21px;
  margin-top: 2px;
  border-radius: 7px;
  border: 1.6px solid var(--border-strong);
  display: grid;
  place-items: center;
  color: #fff;
  background: transparent;
  transition: background 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
}
.task-check svg {
  opacity: 0;
  transform: scale(0.5);
  transition: opacity 0.16s ease, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.task-check:hover {
  border-color: var(--primary);
}
.task-check.checked {
  background: var(--primary);
  border-color: var(--primary);
  transform: scale(1.02);
}
.task-check.checked svg {
  opacity: 1;
  transform: scale(1);
}
.task-check:active {
  transform: scale(0.9);
}

.task-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  text-align: left;
  padding-top: 1px;
}
.task-cat {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  margin-bottom: 1px;
}
.cat-dot {
  width: 6px;
  height: 6px;
  border-radius: 99px;
}
.task-title {
  font-size: 14.5px;
  line-height: 1.55;
  color: var(--text);
  word-break: break-word;
  transition: color 0.2s ease;
}
.task.done .task-title {
  color: var(--faint);
  text-decoration: line-through;
  text-decoration-color: var(--faint);
}
.task-edit {
  flex: none;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  color: var(--muted);
  opacity: 0;
  transition: opacity 0.15s ease, background 0.15s ease, color 0.15s ease;
}
.task:hover .task-edit {
  opacity: 1;
}
.task-edit:hover {
  background: var(--surface-3);
  color: var(--text);
}
@media (hover: none) {
  .task-edit {
    opacity: 0.55;
  }
}
</style>

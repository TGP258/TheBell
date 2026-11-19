<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { Trash2 } from 'lucide-vue-next';
import type { Category, Task } from '../types';
import { CATEGORY_LIST, CATEGORY_META } from '../lib/categories';
import { usePlanStore } from '../stores/plan';
import { toast } from '../lib/toast';
import AppModal from './AppModal.vue';

const props = defineProps<{
  open: boolean;
  task?: Task | null;
  dayIdx: number;
  defaultCategory?: Category;
}>();

const emit = defineEmits<{ close: [] }>();
const store = usePlanStore();

const title = ref('');
const category = ref<Category>('math');
const textarea = ref<HTMLTextAreaElement | null>(null);

watch(
  () => props.open,
  async (open) => {
    if (!open) return;
    title.value = props.task?.title ?? '';
    category.value = props.task?.category ?? props.defaultCategory ?? 'math';
    await nextTick();
    textarea.value?.focus();
    textarea.value?.setSelectionRange(title.value.length, title.value.length);
  }
);

function close(): void {
  emit('close');
}

async function save(): Promise<void> {
  const text = title.value.trim();
  if (!text) return;
  if (props.task) {
    await store.updateTask(props.task.id, { title: text, category: category.value });
    toast('任务已更新');
  } else {
    await store.addTask(props.dayIdx, category.value, text);
    toast('任务已添加');
  }
  close();
}

async function remove(): Promise<void> {
  if (!props.task) return;
  await store.deleteTask(props.task.id);
  toast('任务已删除', 'info');
  close();
}

function onKeydown(event: KeyboardEvent): void {
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
    event.preventDefault();
    void save();
  }
}
</script>

<template>
  <AppModal :open="open" width="sm" @close="close">
    <template #header>
      <h3>{{ task ? '编辑任务' : '添加任务' }}</h3>
    </template>

    <div class="form">
      <div class="field">
        <label>任务内容</label>
        <textarea
          ref="textarea"
          v-model="title"
          class="textarea"
          rows="4"
          placeholder="例如：数学真题 2019 年整套计时 + 订正"
          @keydown="onKeydown"
        />
      </div>
      <div class="field">
        <label>所属科目</label>
        <div class="cat-picker">
          <button
            v-for="id in CATEGORY_LIST"
            :key="id"
            class="cat-opt"
            :class="{ active: category === id }"
            @click="category = id"
          >
            <span class="cat-dot" :style="{ background: CATEGORY_META[id].color }" />
            {{ CATEGORY_META[id].name }}
          </button>
        </div>
      </div>
      <p class="hint">Ctrl / ⌘ + Enter 快速保存</p>
    </div>

    <template #footer>
      <button v-if="task" class="btn danger" @click="remove">
        <Trash2 :size="15" /> 删除
      </button>
      <span class="grow" />
      <button class="btn ghost" @click="close">取消</button>
      <button class="btn primary" :disabled="!title.trim()" @click="save">保存</button>
    </template>
  </AppModal>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.cat-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.cat-opt {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 38px;
  padding: 0 14px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-2);
  font-size: 13.5px;
  font-weight: 600;
  transition: all 0.15s ease;
}
.cat-opt:hover {
  border-color: var(--border-strong);
}
.cat-opt.active {
  background: var(--primary-soft);
  border-color: transparent;
  color: var(--primary-strong);
}
.cat-dot {
  width: 8px;
  height: 8px;
  border-radius: 99px;
}
.hint {
  font-size: 12px;
  color: var(--faint);
}
</style>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { Trash2 } from 'lucide-vue-next';
import type { RoutineItem } from '../types';
import { usePlanStore } from '../stores/plan';
import { toast } from '../lib/toast';
import AppModal from './AppModal.vue';

const props = defineProps<{
  open: boolean;
  item?: RoutineItem | null;
}>();

const emit = defineEmits<{ close: [] }>();
const store = usePlanStore();

const time = ref('');
const title = ref('');
const timeInput = ref<HTMLInputElement | null>(null);

watch(
  () => props.open,
  async (open) => {
    if (!open) return;
    time.value = props.item?.time ?? '';
    title.value = props.item?.title ?? '';
    await nextTick();
    timeInput.value?.focus();
  }
);

function close(): void {
  emit('close');
}

async function save(): Promise<void> {
  if (!title.value.trim()) return;
  if (props.item) {
    await store.updateRoutine(props.item.id, { time: time.value, title: title.value });
    toast('作息已更新');
  } else {
    await store.addRoutine(time.value, title.value);
    toast('作息已添加');
  }
  close();
}

async function remove(): Promise<void> {
  if (!props.item) return;
  await store.deleteRoutine(props.item.id);
  toast('作息已删除', 'info');
  close();
}
</script>

<template>
  <AppModal :open="open" width="sm" @close="close">
    <template #header>
      <h3>{{ item ? '编辑作息' : '添加作息' }}</h3>
    </template>

    <div class="form">
      <div class="field">
        <label>时间段</label>
        <input
          ref="timeInput"
          v-model="time"
          class="input"
          placeholder="例如：8:30–12:30"
          maxlength="24"
        />
        <p class="hint">纯文本，不参与排序；拖拽或上下移动只改变条目顺序。</p>
      </div>
      <div class="field">
        <label>内容</label>
        <textarea
          v-model="title"
          class="textarea"
          rows="3"
          placeholder="例如：数学 4h，真题整套计时 + 订正"
        />
      </div>
    </div>

    <template #footer>
      <button v-if="item" class="btn danger" @click="remove">
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
.hint {
  font-size: 12px;
  color: var(--faint);
  line-height: 1.6;
}
</style>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { Trash2 } from 'lucide-vue-next';
import type { RoutineItem, RoutineKind } from '../types';
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
const kind = ref<RoutineKind>('study');
const durationMin = ref(50);
const timeInput = ref<HTMLInputElement | null>(null);

const KIND_OPTIONS: { id: RoutineKind; name: string; desc: string }[] = [
  { id: 'routine', name: '起居作息', desc: '不计时，只打卡' },
  { id: 'study', name: '学习段', desc: '倒计时 + 打卡' },
  { id: 'break', name: '休息段', desc: '倒计时 + 打卡' },
];

watch(
  () => props.open,
  async (open) => {
    if (!open) return;
    time.value = props.item?.time ?? '';
    title.value = props.item?.title ?? '';
    kind.value = props.item?.kind ?? 'study';
    durationMin.value =
      props.item && props.item.kind !== 'routine'
        ? Math.max(1, Math.round(props.item.durationSec / 60))
        : kind.value === 'break'
          ? 10
          : 50;
    await nextTick();
    timeInput.value?.focus();
  }
);

function chooseKind(next: RoutineKind): void {
  if (next === kind.value) return;
  kind.value = next;
  if (next === 'routine') durationMin.value = 0;
  else if (next === 'break') durationMin.value = 10;
  else durationMin.value = 50;
}

function close(): void {
  emit('close');
}

async function save(): Promise<void> {
  if (!title.value.trim()) return;
  const durationSec =
    kind.value === 'routine' ? 0 : Math.max(60, Math.round(durationMin.value * 60));
  if (props.item) {
    await store.updateRoutine(props.item.id, {
      time: time.value,
      title: title.value,
      kind: kind.value,
      durationSec,
    });
    toast('时间段已更新');
  } else {
    await store.addRoutine({
      time: time.value,
      title: title.value,
      kind: kind.value,
      durationSec,
    });
    toast('时间段已添加');
  }
  close();
}

async function remove(): Promise<void> {
  if (!props.item) return;
  await store.deleteRoutine(props.item.id);
  toast('时间段已删除', 'info');
  close();
}
</script>

<template>
  <AppModal :open="open" width="sm" @close="close">
    <template #header>
      <h3>{{ item ? '编辑时间段' : '添加时间段' }}</h3>
    </template>

    <div class="form">
      <div class="field">
        <label>类型</label>
        <div class="kind-picker">
          <button
            v-for="option in KIND_OPTIONS"
            :key="option.id"
            class="kind-option"
            :class="{ active: kind === option.id }"
            @click="chooseKind(option.id)"
          >
            <b>{{ option.name }}</b>
            <span>{{ option.desc }}</span>
          </button>
        </div>
      </div>

      <div class="field">
        <label>时间段</label>
        <input
          ref="timeInput"
          v-model="time"
          class="input"
          placeholder="例如：08:00–08:50"
          maxlength="24"
        />
      </div>

      <div class="field">
        <label>内容</label>
        <textarea
          v-model="title"
          class="textarea"
          rows="3"
          placeholder="例如：学习段 1（数学真题）"
        />
      </div>

      <div v-if="kind !== 'routine'" class="field">
        <label>计时时长（分钟）</label>
        <div class="duration-row">
          <input
            v-model.number="durationMin"
            class="input num"
            type="number"
            min="1"
            max="1440"
          />
          <div class="duration-presets">
            <button
              v-for="preset in [5, 10, 25, 50]"
              :key="preset"
              class="preset"
              :class="{ active: durationMin === preset }"
              @click="durationMin = preset"
            >
              {{ preset }}'
            </button>
          </div>
        </div>
        <p class="hint">学习段与休息段会在今日页显示为可暂停的倒计时小卡片。</p>
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
.kind-picker {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.kind-option {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  text-align: left;
  transition: all 0.15s ease;
}
.kind-option b {
  font-size: 13px;
  font-weight: 650;
}
.kind-option span {
  font-size: 10.5px;
  color: var(--muted);
}
.kind-option.active {
  background: var(--primary-soft);
  border-color: transparent;
}
.kind-option.active b {
  color: var(--primary-strong);
}
.duration-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.duration-row .input {
  width: 96px;
  text-align: center;
}
.duration-presets {
  display: flex;
  gap: 6px;
}
.preset {
  height: 32px;
  padding: 0 10px;
  border-radius: 9px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
}
.preset.active {
  background: var(--primary-soft);
  border-color: transparent;
  color: var(--primary-strong);
}
.hint {
  font-size: 12px;
  color: var(--faint);
  line-height: 1.6;
}
@media (max-width: 480px) {
  .kind-picker {
    grid-template-columns: 1fr;
  }
  .kind-option {
    flex-direction: row;
    align-items: baseline;
    gap: 8px;
  }
}
</style>

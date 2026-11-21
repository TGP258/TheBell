<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { Trash2 } from 'lucide-vue-next';
import type { CountdownColor, CustomTimer } from '../types';
import { COUNTDOWN_COLORS, COUNTDOWN_THEMES } from '../lib/categories';
import { usePlanStore } from '../stores/plan';
import { toast } from '../lib/toast';
import AppModal from './AppModal.vue';

const props = defineProps<{
  open: boolean;
  timer?: CustomTimer | null;
}>();

const emit = defineEmits<{ close: [] }>();
const store = usePlanStore();

const title = ref('');
const minutes = ref(50);
const seconds = ref(0);
const color = ref<CountdownColor>('violet');
const titleInput = ref<HTMLInputElement | null>(null);

const totalSec = computed(() =>
  Math.max(0, Math.round(minutes.value || 0) * 60 + Math.round(seconds.value || 0))
);

const preview = computed(() => {
  const total = totalSec.value;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
});

watch(
  () => props.open,
  async (open) => {
    if (!open) return;
    title.value = props.timer?.title ?? '';
    const total = props.timer?.durationSec ?? 50 * 60;
    minutes.value = Math.floor(total / 60);
    seconds.value = total % 60;
    color.value = props.timer?.color ?? 'violet';
    await nextTick();
    titleInput.value?.focus();
  }
);

function preset(min: number): void {
  minutes.value = min;
  seconds.value = 0;
}

function close(): void {
  emit('close');
}

async function save(): Promise<void> {
  if (!title.value.trim() || totalSec.value < 1) return;
  if (props.timer) {
    await store.updateCustomTimer(props.timer.id, {
      title: title.value,
      durationSec: totalSec.value,
      color: color.value,
    });
    toast('计时器已更新');
  } else {
    await store.addCustomTimer({
      title: title.value,
      durationSec: totalSec.value,
      color: color.value,
    });
    toast('计时器已添加');
  }
  close();
}

async function remove(): Promise<void> {
  if (!props.timer) return;
  await store.deleteCustomTimer(props.timer.id);
  toast('计时器已删除', 'info');
  close();
}
</script>

<template>
  <AppModal :open="open" width="sm" @close="close">
    <template #header>
      <h3>{{ timer ? '编辑计时器' : '新建计时器' }}</h3>
    </template>

    <div class="form">
      <div class="preview" :style="{ background: COUNTDOWN_THEMES[color].soft }">
        <span class="preview-label">时长</span>
        <b class="num">{{ preview }}</b>
      </div>

      <div class="field">
        <label>名称</label>
        <input
          ref="titleInput"
          v-model="title"
          class="input"
          maxlength="24"
          placeholder="例如：背单词 / 刷题 / 休息"
        />
      </div>

      <div class="field">
        <label>计时时长</label>
        <div class="time-row">
          <div class="time-input">
            <input v-model.number="minutes" class="input num" type="number" min="0" max="1440" />
            <span>分</span>
          </div>
          <div class="time-input">
            <input v-model.number="seconds" class="input num" type="number" min="0" max="59" />
            <span>秒</span>
          </div>
        </div>
        <div class="presets">
          <button
            v-for="value in [10, 25, 50, 90]"
            :key="value"
            class="preset"
            :class="{ active: totalSec === value * 60 }"
            @click="preset(value)"
          >
            {{ value }} 分钟
          </button>
        </div>
      </div>

      <div class="field">
        <label>颜色</label>
        <div class="colors">
          <button
            v-for="item in COUNTDOWN_COLORS"
            :key="item"
            class="swatch"
            :class="{ active: color === item }"
            :style="{
              background: `linear-gradient(135deg, ${COUNTDOWN_THEMES[item].from}, ${COUNTDOWN_THEMES[item].to})`,
            }"
            @click="color = item"
          />
        </div>
      </div>

      <p class="hint">独立计时器可以多个同时运行，与今日页的分段倒计时互不影响。</p>
    </div>

    <template #footer>
      <button v-if="timer" class="btn danger" @click="remove">
        <Trash2 :size="15" /> 删除
      </button>
      <span class="grow" />
      <button class="btn ghost" @click="close">取消</button>
      <button class="btn primary" :disabled="!title.trim() || totalSec < 1" @click="save">
        保存
      </button>
    </template>
  </AppModal>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.preview {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
  border-radius: 14px;
}
.preview-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
}
.preview b {
  font-size: 34px;
  font-weight: 800;
  letter-spacing: -0.03em;
  font-family: var(--font-mono);
}
.time-row {
  display: flex;
  gap: 10px;
}
.time-input {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--surface-2);
}
.time-input .input {
  border: none;
  background: transparent;
  padding-left: 0;
  box-shadow: none;
  min-height: 38px;
  text-align: center;
}
.time-input span {
  font-size: 12px;
  color: var(--muted);
}
.presets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.preset {
  height: 30px;
  padding: 0 10px;
  border-radius: 8px;
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
.colors {
  display: flex;
  gap: 10px;
}
.swatch {
  width: 34px;
  height: 34px;
  border-radius: 99px;
  border: 3px solid var(--surface);
  box-shadow: 0 0 0 1px var(--border);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.swatch.active {
  transform: scale(1.12);
  box-shadow: 0 0 0 2px var(--primary);
}
.hint {
  font-size: 12px;
  color: var(--faint);
  line-height: 1.6;
}
</style>

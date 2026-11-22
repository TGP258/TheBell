<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Task } from '../types';
import { usePlanStore } from '../stores/plan';
import { toast } from '../lib/toast';
import { monthDayCN, relativeLabel, shortDate, weekdayCN } from '../lib/date';
import AppModal from './AppModal.vue';
import DatePicker from './DatePicker.vue';

const props = defineProps<{
  open: boolean;
  task: Task | null;
}>();

const emit = defineEmits<{ close: [] }>();
const store = usePlanStore();

const selectedDate = ref('');

/** 允许顺延到的最早一天：任务原天的下一天，且不早于今天 */
const minIdx = computed(() =>
  props.task ? Math.max(props.task.dayIdx + 1, store.todayIdx) : 1
);
const maxIdx = computed(() => store.plan.totalDays || 0);
const minDate = computed(() => store.getDay(minIdx.value)?.date ?? '');
const maxDate = computed(() => store.getDay(maxIdx.value)?.date ?? '');

const selectedIndex = computed(() => {
  const day = store.days.find((item) => item.date === selectedDate.value);
  return day ? day.idx : -1;
});

const valid = computed(() =>
  Boolean(
    props.task &&
      selectedDate.value &&
      selectedIndex.value >= minIdx.value &&
      selectedIndex.value <= maxIdx.value
  )
);

const quickChips = computed(() => {
  const out: { label: string; date: string }[] = [];
  for (const [delta, label] of [
    [0, '今天'],
    [1, '明天'],
    [2, '后天'],
  ] as const) {
    const idx = store.todayIdx + delta;
    if (idx < minIdx.value || idx > maxIdx.value) continue;
    const day = store.getDay(idx);
    if (!day) continue;
    out.push({ label, date: day.date });
  }
  return out;
});

const previewMain = computed(() =>
  selectedDate.value ? `${monthDayCN(selectedDate.value)} ${weekdayCN(selectedDate.value)}` : ''
);
const previewRel = computed(() =>
  selectedDate.value ? relativeLabel(selectedDate.value) : ''
);

const originLabel = computed(() => {
  const day = props.task ? store.getDay(props.task.dayIdx) : null;
  return day ? monthDayCN(day.date) : '';
});

const yearRange = computed(() => {
  const start = store.plan.startDate;
  const end = store.planEnd;
  const y0 = start ? Number(start.slice(0, 4)) : new Date().getFullYear();
  const y1 = end ? Number(end.slice(0, 4)) : y0;
  return [Math.min(y0, y1), Math.max(y0, y1)] as const;
});

const hintText = computed(() => {
  if (!props.task) return '';
  if (valid.value) {
    return `可顺延范围：${shortDate(minDate.value)} – ${shortDate(maxDate.value)}`;
  }
  if (selectedDate.value < minDate.value) {
    return `不能早于 ${monthDayCN(minDate.value)}`;
  }
  if (selectedDate.value > maxDate.value || selectedIndex.value < 0) {
    return `超出计划范围（${monthDayCN(maxDate.value) || '—'} 截止）`;
  }
  return '请选择计划内的日期';
});

watch(
  () => props.open,
  (open) => {
    if (!open || !props.task) return;
    // 默认指向最早的合法目标：今天的任务→明天；继承来的任务→今天
    const idx = Math.min(minIdx.value, maxIdx.value);
    selectedDate.value = store.getDay(idx)?.date ?? '';
  }
);

async function confirm(): Promise<void> {
  if (!valid.value || !props.task) return;
  const target = store.getDay(selectedIndex.value);
  await store.moveTask(props.task.id, selectedIndex.value);
  toast(`已顺延到 ${monthDayCN(target?.date ?? '')}`, 'success');
  emit('close');
}
</script>

<template>
  <AppModal :open="open" width="sm" @close="emit('close')">
    <template #header>
      <h3>顺延任务</h3>
    </template>

    <div class="postpone">
      <p class="task-line">{{ task?.title }}</p>
      <p v-if="originLabel" class="task-origin num">原定 {{ originLabel }}</p>

      <div class="preview">
        <span class="num">{{ previewMain }}</span>
        <span v-if="previewRel" class="rel num">{{ previewRel }}</span>
      </div>

      <div v-if="quickChips.length" class="chips">
        <button
          v-for="chip in quickChips"
          :key="chip.label"
          class="chip"
          :class="{ on: chip.date === selectedDate }"
          @click="selectedDate = chip.date"
        >
          {{ chip.label }}
        </button>
      </div>

      <DatePicker
        :model-value="selectedDate"
        :year-from="yearRange[0]"
        :year-to="yearRange[1]"
        @change="selectedDate = $event"
      />

      <p class="hint" :class="{ bad: !valid }">{{ hintText }}</p>
    </div>

    <template #footer>
      <span class="grow" />
      <button class="btn ghost" @click="emit('close')">取消</button>
      <button class="btn primary" :disabled="!valid" @click="confirm">
        顺延到 {{ monthDayCN(selectedDate) || '…' }}
      </button>
    </template>
  </AppModal>
</template>

<style scoped>
.postpone {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 0 6px;
}
.task-line {
  width: 100%;
  text-align: center;
  font-size: 14.5px;
  font-weight: 700;
  color: var(--text);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.task-origin {
  margin-top: 3px;
  font-size: 11.5px;
  color: var(--faint);
}
.preview {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-top: 6px;
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}
.preview .rel {
  font-size: 14px;
  font-weight: 700;
  color: var(--primary-strong);
}
.chips {
  display: flex;
  gap: 8px;
  margin: 10px 0 4px;
}
.chip {
  height: 30px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-2);
  transition: all 0.15s ease;
}
.chip:hover {
  border-color: var(--primary);
  color: var(--primary-strong);
}
.chip.on {
  background: var(--primary-soft);
  border-color: transparent;
  color: var(--primary-strong);
}
.hint {
  margin-top: 10px;
  font-size: 11.5px;
  color: var(--faint);
  text-align: center;
}
.hint.bad {
  color: #dc2626;
}
@media (max-width: 480px) {
  .preview {
    font-size: 26px;
  }
}
</style>

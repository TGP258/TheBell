<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Minus, Plus } from 'lucide-vue-next';
import { usePlanStore } from '../stores/plan';
import { endDate, fullDateCN } from '../lib/date';
import { toast } from '../lib/toast';
import AppModal from './AppModal.vue';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();
const store = usePlanStore();

const name = ref('');
const startDate = ref('');
const totalDays = ref(100);

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    name.value = store.plan.name;
    startDate.value = store.plan.startDate;
    totalDays.value = store.plan.totalDays;
  }
);

const end = computed(() =>
  startDate.value ? endDate(startDate.value, Math.max(1, totalDays.value)) : ''
);

const removedTasks = computed(() => {
  if (totalDays.value >= store.plan.totalDays) return 0;
  return store.days
    .filter((day) => day.idx > totalDays.value)
    .reduce((sum, day) => sum + day.tasks.length, 0);
});

const removedDays = computed(() =>
  Math.max(0, store.plan.totalDays - Math.max(1, totalDays.value))
);

function step(delta: number): void {
  totalDays.value = Math.min(1000, Math.max(1, totalDays.value + delta));
}

function close(): void {
  emit('close');
}

async function save(): Promise<void> {
  if (!name.value.trim() || !startDate.value) return;
  await store.updatePlan({
    name: name.value,
    startDate: startDate.value,
    totalDays: totalDays.value,
  });
  toast('计划设置已保存');
  close();
}
</script>

<template>
  <AppModal :open="open" width="md" @close="close">
    <template #header>
      <h3>调整计划</h3>
    </template>

    <div class="form">
      <div class="field">
        <label>计划名称</label>
        <input v-model="name" class="input" maxlength="30" placeholder="例如：我的学习计划" />
      </div>

      <div class="row">
        <div class="field">
          <label>开始日期</label>
          <input v-model="startDate" class="input" type="date" />
        </div>
        <div class="field">
          <label>总天数</label>
          <div class="stepper">
            <button class="step-btn" :disabled="totalDays <= 1" @click="step(-1)">
              <Minus :size="16" />
            </button>
            <input v-model.number="totalDays" class="step-input num" type="number" min="1" max="1000" />
            <button class="step-btn" :disabled="totalDays >= 1000" @click="step(1)">
              <Plus :size="16" />
            </button>
          </div>
        </div>
      </div>

      <div class="presets">
        <button
          v-for="preset in [35, 60, 100, 180]"
          :key="preset"
          class="preset"
          :class="{ active: totalDays === preset }"
          @click="totalDays = preset"
        >
          {{ preset }} 天
        </button>
      </div>

      <div class="preview">
        <div>
          <span class="label">日期范围</span>
          <b>{{ fullDateCN(startDate) }} → {{ fullDateCN(end) }}</b>
        </div>
        <div>
          <span class="label">当前进度</span>
          <b>第 {{ Math.min(store.currentDayIdx, totalDays) }} / {{ totalDays }} 天</b>
        </div>
      </div>

      <p v-if="removedDays > 0" class="warn">
        ⚠️ 减少 {{ removedDays }} 天
        <template v-if="removedTasks > 0">，将删除其中 {{ removedTasks }} 条任务及对应作息打卡</template>
        <template v-else>，这些天目前没有任务</template>
        。
      </p>
      <p v-else class="hint">
        调整天数会保留已有任务与打卡记录；开始日期变化会整体平移每天对应的日期。
      </p>
    </div>

    <template #footer>
      <span class="grow" />
      <button class="btn ghost" @click="close">取消</button>
      <button class="btn primary" :disabled="!name.trim() || !startDate" @click="save">
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
.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.stepper {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border-radius: 13px;
  border: 1px solid var(--border);
  background: var(--surface-2);
}
.step-btn {
  width: 36px;
  height: 36px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  color: var(--text-2);
  background: var(--surface);
  border: 1px solid var(--border);
}
.step-btn:disabled {
  opacity: 0.35;
}
.step-input {
  flex: 1;
  min-width: 0;
  height: 36px;
  border: none;
  background: transparent;
  text-align: center;
  font-size: 16px;
  font-weight: 700;
  outline: none;
  -moz-appearance: textfield;
}
.step-input::-webkit-outer-spin-button,
.step-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.presets {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.preset {
  height: 32px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}
.preset.active {
  background: var(--primary-soft);
  border-color: transparent;
  color: var(--primary-strong);
}
.preview {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  padding: 14px 16px;
  border-radius: 14px;
  background: var(--surface-2);
  border: 1px solid var(--border);
}
.preview > div {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.preview b {
  font-size: 13.5px;
  font-weight: 600;
}
.warn {
  padding: 11px 14px;
  border-radius: 12px;
  background: var(--warning-soft);
  color: #a15c00;
  font-size: 12.5px;
  line-height: 1.6;
}
.hint {
  font-size: 12px;
  color: var(--faint);
  line-height: 1.6;
}
@media (max-width: 520px) {
  .row,
  .preview {
    grid-template-columns: 1fr;
  }
}
</style>

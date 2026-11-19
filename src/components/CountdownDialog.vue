<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Trash2 } from 'lucide-vue-next';
import type { Countdown, CountdownColor } from '../types';
import { COUNTDOWN_COLORS, COUNTDOWN_THEMES } from '../lib/categories';
import { addDays, diffDays, fullDateCN, todayStr, weekdayCN } from '../lib/date';
import { usePlanStore } from '../stores/plan';
import { toast } from '../lib/toast';
import AppModal from './AppModal.vue';

const props = defineProps<{
  open: boolean;
  item?: Countdown | null;
}>();

const emit = defineEmits<{ close: [] }>();
const store = usePlanStore();

const title = ref('');
const targetDate = ref('');
const color = ref<CountdownColor>('violet');
const pinned = ref(false);

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    title.value = props.item?.title ?? '';
    targetDate.value = props.item?.targetDate ?? addDays(todayStr(), 30);
    color.value = props.item?.color ?? 'violet';
    pinned.value = props.item?.pinned ?? store.data.countdowns.length === 0;
  }
);

const days = computed(() =>
  targetDate.value ? diffDays(todayStr(), targetDate.value) : 0
);

const preview = computed(() => {
  if (!targetDate.value) return '';
  if (days.value === 0) return '就是今天';
  if (days.value > 0) return `还有 ${days.value} 天`;
  return `已过去 ${-days.value} 天`;
});

function close(): void {
  emit('close');
}

async function save(): Promise<void> {
  if (!title.value.trim() || !targetDate.value) return;
  if (props.item) {
    await store.updateCountdown(props.item.id, {
      title: title.value,
      targetDate: targetDate.value,
      color: color.value,
      pinned: pinned.value,
    });
    toast('倒数日已更新');
  } else {
    await store.addCountdown({
      title: title.value,
      targetDate: targetDate.value,
      color: color.value,
      pinned: pinned.value,
    });
    toast('倒数日已添加');
  }
  close();
}

async function remove(): Promise<void> {
  if (!props.item) return;
  await store.deleteCountdown(props.item.id);
  toast('倒数日已删除', 'info');
  close();
}
</script>

<template>
  <AppModal :open="open" width="sm" @close="close">
    <template #header>
      <h3>{{ item ? '编辑倒数日' : '添加倒数日' }}</h3>
    </template>

    <div class="form">
      <div class="field">
        <label>名称</label>
        <input v-model="title" class="input" maxlength="24" placeholder="例如：期末考试" />
      </div>

      <div class="field">
        <label>目标日期</label>
        <input v-model="targetDate" class="input" type="date" />
        <div v-if="targetDate" class="date-preview">
          <span>{{ fullDateCN(targetDate) }} · {{ weekdayCN(targetDate) }}</span>
          <b :class="{ past: days < 0 }">{{ preview }}</b>
        </div>
      </div>

      <div class="field">
        <label>主题颜色</label>
        <div class="colors">
          <button
            v-for="c in COUNTDOWN_COLORS"
            :key="c"
            class="swatch"
            :class="{ active: color === c }"
            :style="{
              background: `linear-gradient(135deg, ${COUNTDOWN_THEMES[c].from}, ${COUNTDOWN_THEMES[c].to})`,
            }"
            :aria-label="c"
            @click="color = c"
          />
        </div>
      </div>

      <label class="switch-row">
        <div>
          <b>设为首页主倒数</b>
          <p>今日页顶部会优先展示这个倒数日</p>
        </div>
        <button class="switch" :class="{ on: pinned }" @click.prevent="pinned = !pinned">
          <span />
        </button>
      </label>
    </div>

    <template #footer>
      <button v-if="item" class="btn danger" @click="remove">
        <Trash2 :size="15" /> 删除
      </button>
      <span class="grow" />
      <button class="btn ghost" @click="close">取消</button>
      <button class="btn primary" :disabled="!title.trim() || !targetDate" @click="save">
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
.date-preview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12.5px;
  color: var(--muted);
}
.date-preview b {
  color: var(--primary-strong);
  font-size: 13px;
}
.date-preview b.past {
  color: var(--muted);
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
.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 16px;
  border-radius: 14px;
  background: var(--surface-2);
  border: 1px solid var(--border);
}
.switch-row b {
  display: block;
  font-size: 13.5px;
  font-weight: 600;
}
.switch-row p {
  font-size: 12px;
  color: var(--muted);
  margin-top: 2px;
}
.switch {
  flex: none;
  width: 44px;
  height: 26px;
  border-radius: 99px;
  background: var(--surface-3);
  border: 1px solid var(--border-strong);
  padding: 2px;
  transition: background 0.18s ease, border-color 0.18s ease;
}
.switch span {
  display: block;
  width: 20px;
  height: 20px;
  border-radius: 99px;
  background: var(--surface);
  box-shadow: var(--shadow-xs);
  transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}
.switch.on {
  background: var(--primary);
  border-color: transparent;
}
.switch.on span {
  transform: translateX(18px);
}
</style>

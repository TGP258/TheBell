<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { ArrowRight, Clock3, Trash2 } from 'lucide-vue-next';
import type { RoutineItem, RoutineKind } from '../types';
import { usePlanStore } from '../stores/plan';
import { toast } from '../lib/toast';
import {
  clockText,
  durationText,
  fmtCountdown,
  normalizeRange,
  parseClock,
  rangeMinutes,
} from '../lib/segment';
import AppModal from './AppModal.vue';

const props = defineProps<{
  open: boolean;
  item?: RoutineItem | null;
}>();

const emit = defineEmits<{ close: [] }>();
const store = usePlanStore();

const start = ref('08:00');
const end = ref('08:50');
const title = ref('');
const kind = ref<RoutineKind>('study');
const startInput = ref<HTMLInputElement | null>(null);

const KIND_OPTIONS: { id: RoutineKind; name: string; desc: string }[] = [
  { id: 'routine', name: '起居作息', desc: '只打卡，不计时' },
  { id: 'study', name: '学习段', desc: '可倒计时' },
  { id: 'break', name: '休息段', desc: '可倒计时' },
];

const PRESETS = [10, 25, 30, 50];

const range = computed(() => {
  const startMin = parseClock(start.value);
  const endMin = parseClock(end.value);
  if (startMin === null) return { startMin: -1, endMin: -1, minutes: 0, crossDay: false };
  if (endMin === null) return { startMin, endMin: -1, minutes: 0, crossDay: false };
  const normalized = normalizeRange(startMin, endMin);
  return {
    startMin: normalized.startMin,
    endMin: normalized.endMin,
    minutes: rangeMinutes(normalized.startMin, normalized.endMin),
    crossDay: normalized.endMin >= 1440,
  };
});

const durationLabel = computed(() =>
  range.value.minutes > 0 ? durationText(range.value.minutes * 60) : '时长未定'
);

const canSave = computed(() => {
  if (!title.value.trim()) return false;
  if (parseClock(start.value) === null) return false;
  if (kind.value !== 'routine') {
    if (parseClock(end.value) === null) return false;
    if (range.value.minutes < 1) return false;
  }
  return true;
});

watch(
  () => props.open,
  async (open) => {
    if (!open) return;
    const item = props.item;
    kind.value = item?.kind ?? 'study';
    title.value = item?.title ?? '';

    if (item) {
      start.value = item.startMin >= 0 ? clockText(item.startMin) : '';
      end.value = item.endMin > 0 ? clockText(item.endMin) : '';
    } else {
      const startMin = defaultStart();
      start.value = clockText(startMin);
      end.value = clockText(startMin + 50);
    }

    await nextTick();
    startInput.value?.focus();
  }
);

/** 新建时从下一个整刻开始 */
function defaultStart(): number {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  return Math.min(23 * 60 + 30, Math.ceil(minutes / 10) * 10);
}

function chooseKind(next: RoutineKind): void {
  if (next === kind.value) return;
  kind.value = next;
  // 从起居切到计时类型、且原区间无效时，补一个默认时长
  if (next !== 'routine' && range.value.minutes <= 0) {
    const startMin = parseClock(start.value) ?? defaultStart();
    start.value = clockText(startMin);
    end.value = clockText(startMin + (next === 'break' ? 10 : 50));
  }
}

function applyPreset(minutes: number): void {
  const startMin = parseClock(start.value) ?? defaultStart();
  start.value = clockText(startMin);
  end.value = clockText(startMin + minutes);
}

function clearTime(): void {
  start.value = '';
  end.value = '';
}

/** 手输时把 830 / 8:3 规整成 08:30，无冒号也能识别 */
function tidy(value: string): string {
  const raw = value.trim();
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (!raw.includes(':') && !raw.includes('：')) {
    if (digits.length <= 2) return raw;
    const h = digits.slice(0, digits.length - 2);
    const m = digits.slice(-2);
    const hh = Number(h);
    const mm = Number(m);
    if (hh <= 23 && mm <= 59) {
      return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    }
    return raw;
  }
  const parsed = parseClock(raw.replace('：', ':'));
  return parsed === null ? raw : clockText(parsed);
}

function onTimeBlur(which: 'start' | 'end'): void {
  if (which === 'start') start.value = tidy(start.value);
  else end.value = tidy(end.value);
}

function close(): void {
  emit('close');
}

async function save(): Promise<void> {
  if (!canSave.value) return;
  const startMin = parseClock(start.value) ?? -1;
  const endMin = parseClock(end.value) ?? -1;

  if (props.item) {
    await store.updateRoutine(props.item.id, {
      startMin,
      endMin,
      title: title.value,
      kind: kind.value,
    });
    toast('时间段已更新，倒计时已按新时长重置');
  } else {
    await store.addRoutine({
      startMin,
      endMin,
      title: title.value,
      kind: kind.value,
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
        <label>起止时间</label>
        <div class="time-row">
          <input
            ref="startInput"
            v-model="start"
            class="input time-input num"
            type="time"
            step="60"
            aria-label="开始时间"
            @blur="onTimeBlur('start')"
          />
          <ArrowRight :size="16" class="time-arrow" />
          <input
            v-model="end"
            class="input time-input num"
            type="time"
            step="60"
            aria-label="结束时间"
            @blur="onTimeBlur('end')"
          />
          <button
            v-if="kind === 'routine'"
            class="time-clear"
            title="清空时间"
            @click="clearTime"
          >
            清空
          </button>
        </div>
        <div class="time-hint">
          <template v-if="range.minutes > 0">
            <span class="dur-pill">
              <Clock3 :size="12" />
              {{ durationLabel }}
              <em v-if="range.crossDay">次日</em>
            </span>
            <span v-if="kind !== 'routine'" class="dur-pill soft num">
              倒计时 {{ fmtCountdown(range.minutes * 60) }}
            </span>
          </template>
          <span v-else-if="kind === 'routine'" class="hint-line">
            起居作息可以只填开始时间，结束留空表示不固定。
          </span>
          <span v-else class="hint-line">结束时间需晚于开始时间。</span>
        </div>
        <div v-if="kind !== 'routine'" class="preset-row">
          <span class="preset-label">快设时长</span>
          <button
            v-for="preset in PRESETS"
            :key="preset"
            class="preset"
            :class="{ active: range.minutes === preset }"
            @click="applyPreset(preset)"
          >
            {{ preset }}′
          </button>
        </div>
        <p class="hint">
          点时间框会打开系统时间选择器；倒计时时长由起止时间自动计算。
        </p>
      </div>

      <div class="field">
        <label>内容</label>
        <textarea
          v-model="title"
          class="textarea"
          rows="3"
          placeholder="例如：学习段 1（专业课真题）"
        />
      </div>
    </div>

    <template #footer>
      <button v-if="item" class="btn danger" @click="remove">
        <Trash2 :size="15" /> 删除
      </button>
      <span class="grow" />
      <button class="btn ghost" @click="close">取消</button>
      <button class="btn primary" :disabled="!canSave" @click="save">保存</button>
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
.time-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.time-input {
  flex: 1;
  min-width: 0;
  text-align: center;
  font-family: var(--font-mono);
  font-size: 17px;
  font-weight: 650;
  letter-spacing: 0.02em;
  height: 48px;
}
.time-arrow {
  color: var(--faint);
  flex: none;
}
.time-clear {
  flex: none;
  font-size: 12px;
  color: var(--muted);
  padding: 6px 8px;
  border-radius: 8px;
}
.time-clear:hover {
  color: var(--danger);
  background: var(--danger-soft);
}
.time-hint {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  min-height: 22px;
}
.dur-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  background: var(--success-soft);
  color: #0a7a47;
  font-size: 11.5px;
  font-weight: 650;
}
.dur-pill.soft {
  background: var(--primary-soft);
  color: var(--primary-strong);
}
.dur-pill em {
  font-style: normal;
  opacity: 0.75;
}
html[data-theme="dark"] .dur-pill {
  color: var(--success);
}
.hint-line {
  font-size: 11.5px;
  color: var(--faint);
}
.preset-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
}
.preset-label {
  font-size: 11px;
  color: var(--faint);
  margin-right: 2px;
}
.preset {
  height: 28px;
  min-width: 42px;
  padding: 0 8px;
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
  margin-top: 10px;
  font-size: 11.5px;
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
  .time-input {
    font-size: 16px;
  }
}
</style>

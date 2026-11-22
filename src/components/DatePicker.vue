<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';

/**
 * 自绘日期选择器：年 / 月 / 日三列滚轮，风格与 TimePicker 一致。
 * 不带弹窗，嵌入到宿主（如顺延弹窗）里使用；
 * 每次滚动或点选都会通过 change 事件抛出完整的 YYYY-MM-DD。
 */
const props = defineProps<{
  modelValue: string;
  /** 允许显示的年份范围（含） */
  yearFrom: number;
  yearTo: number;
}>();

const emit = defineEmits<{ change: [value: string] }>();

const ITEM_H = 44;

const YEARS = computed(() => {
  const from = Math.min(props.yearFrom, props.yearTo);
  const to = Math.max(props.yearFrom, props.yearTo);
  const out: number[] = [];
  for (let y = from; y <= to; y += 1) out.push(y);
  return out.length ? out : [new Date().getFullYear()];
});
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

const year = ref(new Date().getFullYear());
const month = ref(new Date().getMonth() + 1);
const day = ref(new Date().getDate());

const yearWheel = ref<HTMLElement | null>(null);
const monthWheel = ref<HTMLElement | null>(null);
const dayWheel = ref<HTMLElement | null>(null);

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

const DAYS = computed(() =>
  Array.from({ length: daysInMonth(year.value, month.value) }, (_, i) => i + 1)
);

function dateText(): string {
  return `${year.value}-${pad(month.value)}-${pad(day.value)}`;
}

function scrollTo(el: HTMLElement | null, index: number, smooth = false): void {
  if (!el) return;
  el.scrollTo({ top: index * ITEM_H, behavior: smooth ? 'smooth' : 'auto' });
}

/** 程序化改动（外部赋值 / 点选）后，把三列滚轮对齐到当前值 */
function syncScrolls(smooth = false): void {
  const yearIndex = YEARS.value.indexOf(year.value);
  scrollTo(yearWheel.value, yearIndex < 0 ? 0 : yearIndex, smooth);
  scrollTo(monthWheel.value, month.value - 1, smooth);
  scrollTo(dayWheel.value, day.value - 1, smooth);
}

onMounted(() => {
  void nextTick(() => syncScrolls());
});

watch(
  () => props.modelValue,
  (value) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
    if (!match) return;
    const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (y === year.value && m === month.value && d === day.value) return;
    year.value = y;
    month.value = m;
    day.value = Math.min(d, daysInMonth(y, m));
    void nextTick(() => syncScrolls());
  }
);

function onScroll(which: 'year' | 'month' | 'day', event: Event): void {
  const el = event.target as HTMLElement;
  const index = Math.round(el.scrollTop / ITEM_H);
  if (which === 'year') {
    const next = YEARS.value[Math.min(Math.max(index, 0), YEARS.value.length - 1)];
    if (next !== undefined && next !== year.value) year.value = next;
  } else if (which === 'month') {
    const next = Math.min(Math.max(index + 1, 1), 12);
    if (next !== month.value) month.value = next;
  } else {
    const next = Math.min(Math.max(index + 1, 1), daysInMonth(year.value, month.value));
    if (next !== day.value) day.value = next;
  }
}

function pick(which: 'year' | 'month' | 'day', value: number): void {
  if (which === 'year') year.value = value;
  else if (which === 'month') month.value = value;
  else day.value = value;
  const el =
    which === 'year' ? yearWheel.value : which === 'month' ? monthWheel.value : dayWheel.value;
  const index =
    which === 'year'
      ? YEARS.value.indexOf(value)
      : which === 'month'
        ? value - 1
        : value - 1;
  scrollTo(el, index, true);
}

/** 年月变化后，日期超出当月天数时收敛并滚过去 */
watch(
  () => [year.value, month.value] as const,
  () => {
    const max = daysInMonth(year.value, month.value);
    if (day.value > max) {
      day.value = max;
      scrollTo(dayWheel.value, max - 1, true);
    }
  }
);

watch(
  () => [year.value, month.value, day.value] as const,
  () => {
    emit('change', dateText());
  }
);
</script>

<template>
  <div class="date-picker">
    <div class="wheels">
      <div class="wheel-band" aria-hidden="true" />
      <div ref="yearWheel" class="wheel wide" @scroll.passive="onScroll('year', $event)">
        <div class="wheel-pad" />
        <button
          v-for="y in YEARS"
          :key="y"
          class="wheel-item num"
          :class="{ on: year === y }"
          @click="pick('year', y)"
        >
          {{ y }}年
        </button>
        <div class="wheel-pad" />
      </div>
      <div ref="monthWheel" class="wheel" @scroll.passive="onScroll('month', $event)">
        <div class="wheel-pad" />
        <button
          v-for="m in MONTHS"
          :key="m"
          class="wheel-item num"
          :class="{ on: month === m }"
          @click="pick('month', m)"
        >
          {{ pad(m) }}月
        </button>
        <div class="wheel-pad" />
      </div>
      <div ref="dayWheel" class="wheel" @scroll.passive="onScroll('day', $event)">
        <div class="wheel-pad" />
        <button
          v-for="d in DAYS"
          :key="d"
          class="wheel-item num"
          :class="{ on: day === d }"
          @click="pick('day', d)"
        >
          {{ pad(d) }}日
        </button>
        <div class="wheel-pad" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.wheels {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
}
.wheel-band {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 226px;
  height: 44px;
  border-radius: 12px;
  background: var(--primary-soft);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary) 16%, transparent);
  pointer-events: none;
}
.wheel {
  position: relative;
  z-index: 1;
  width: 72px;
  height: 220px;
  overflow-y: auto;
  scroll-snap-type: y mandatory;
  scrollbar-width: none;
  -ms-overflow-style: none;
  mask-image: linear-gradient(
    to bottom,
    transparent 0,
    rgba(0, 0, 0, 0.35) 18%,
    #000 36%,
    #000 64%,
    rgba(0, 0, 0, 0.35) 82%,
    transparent 100%
  );
}
.wheel.wide {
  width: 82px;
}
.wheel::-webkit-scrollbar {
  display: none;
}
.wheel-pad {
  height: 88px;
}
.wheel-item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 44px;
  scroll-snap-align: center;
  font-size: 21px;
  font-weight: 600;
  color: var(--faint);
  transition: color 0.15s ease, transform 0.15s ease;
}
.wheel-item.on {
  color: var(--primary-strong);
  font-weight: 800;
  transform: scale(1.06);
}
@media (max-width: 480px) {
  .wheel {
    width: 66px;
    height: 198px;
  }
  .wheel.wide {
    width: 78px;
  }
  .wheel-pad {
    height: 77px;
  }
  .wheel-item {
    font-size: 19px;
  }
}
</style>

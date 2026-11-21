<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import AppModal from './AppModal.vue';
import { clockText, parseClock } from '../lib/segment';

const props = defineProps<{
  open: boolean;
  title?: string;
  modelValue: string;
  hint?: string;
}>();

const emit = defineEmits<{ close: []; confirm: [value: string] }>();

const ITEM_H = 44;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

const hour = ref(8);
const minute = ref(0);
const hourWheel = ref<HTMLElement | null>(null);
const minuteWheel = ref<HTMLElement | null>(null);

const preview = computed(() => clockText(hour.value * 60 + minute.value));

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function scrollTo(el: HTMLElement | null, index: number, smooth = false): void {
  if (!el) return;
  el.scrollTo({ top: index * ITEM_H, behavior: smooth ? 'smooth' : 'auto' });
}

watch(
  () => props.open,
  async (open) => {
    if (!open) return;
    const parsed = parseClock(props.modelValue);
    const now = new Date();
    hour.value = parsed === null ? now.getHours() : Math.floor(parsed / 60);
    minute.value = parsed === null ? now.getMinutes() : parsed % 60;
    await nextTick();
    scrollTo(hourWheel.value, hour.value);
    scrollTo(minuteWheel.value, minute.value);
  }
);

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function onScroll(which: 'hour' | 'minute', event: Event): void {
  const el = event.target as HTMLElement;
  const index = Math.round(el.scrollTop / ITEM_H);
  if (which === 'hour') hour.value = clamp(index, 0, 23);
  else minute.value = clamp(index, 0, 59);
}

function pick(which: 'hour' | 'minute', value: number): void {
  if (which === 'hour') hour.value = value;
  else minute.value = value;
  scrollTo(which === 'hour' ? hourWheel.value : minuteWheel.value, value, true);
}

/** 跳到当前时间 */
function useNow(): void {
  const now = new Date();
  pick('hour', now.getHours());
  pick('minute', now.getMinutes());
}

function confirm(): void {
  emit('confirm', preview.value);
  emit('close');
}
</script>

<template>
  <AppModal :open="open" width="sm" @close="emit('close')">
    <template #header>
      <h3>{{ title || '选择时间' }}</h3>
    </template>

    <div class="picker">
      <div class="preview num">{{ preview }}</div>

      <div class="wheels">
        <div class="wheel-band" aria-hidden="true" />
        <div ref="hourWheel" class="wheel" @scroll.passive="onScroll('hour', $event)">
          <div class="wheel-pad" />
          <button
            v-for="h in HOURS"
            :key="h"
            class="wheel-item num"
            :class="{ on: hour === h }"
            @click="pick('hour', h)"
          >
            {{ pad(h) }}
          </button>
          <div class="wheel-pad" />
        </div>
        <span class="colon num">:</span>
        <div ref="minuteWheel" class="wheel" @scroll.passive="onScroll('minute', $event)">
          <div class="wheel-pad" />
          <button
            v-for="m in MINUTES"
            :key="m"
            class="wheel-item num"
            :class="{ on: minute === m, tick: m % 5 === 0 }"
            @click="pick('minute', m)"
          >
            {{ pad(m) }}
          </button>
          <div class="wheel-pad" />
        </div>
      </div>

      <p v-if="hint" class="hint">{{ hint }}</p>

      <button class="now-btn" @click="useNow">使用当前时间</button>
    </div>

    <template #footer>
      <span class="grow" />
      <button class="btn ghost" @click="emit('close')">取消</button>
      <button class="btn primary" @click="confirm">确定</button>
    </template>
  </AppModal>
</template>

<style scoped>
.picker {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2px 0 4px;
}
.preview {
  font-size: 40px;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.1;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}
.wheels {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-top: 6px;
}
.wheel-band {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 232px;
  height: 44px;
  border-radius: 12px;
  background: var(--primary-soft);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary) 16%, transparent);
  pointer-events: none;
}
.wheel {
  position: relative;
  z-index: 1;
  width: 78px;
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
  font-size: 22px;
  font-weight: 600;
  color: var(--faint);
  transition: color 0.15s ease, transform 0.15s ease;
}
.wheel-item.tick {
  color: var(--muted);
}
.wheel-item.on {
  color: var(--primary-strong);
  font-weight: 800;
  transform: scale(1.08);
}
.colon {
  position: relative;
  z-index: 1;
  font-size: 24px;
  font-weight: 700;
  color: var(--muted);
  margin: 0 2px;
}
.hint {
  margin-top: 10px;
  font-size: 11.5px;
  color: var(--faint);
  text-align: center;
  line-height: 1.6;
}
.now-btn {
  margin-top: 6px;
  height: 30px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
}
.now-btn:hover {
  color: var(--primary-strong);
  border-color: var(--primary);
  background: var(--primary-soft);
}
@media (max-width: 480px) {
  .preview {
    font-size: 34px;
  }
  .wheel {
    width: 72px;
    height: 198px;
  }
  .wheel-band {
    width: 210px;
  }
  .wheel-pad {
    height: 77px;
  }
  .wheel-item {
    height: 44px;
  }
}
</style>

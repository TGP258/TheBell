<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    value: number;
    size?: number;
    stroke?: number;
    color?: string;
    track?: string;
  }>(),
  {
    size: 88,
    stroke: 7,
    color: 'var(--primary)',
    track: 'var(--surface-3)',
  }
);

const radius = 44;
const circumference = 2 * Math.PI * radius;
const offset = computed(
  () => circumference * (1 - Math.min(100, Math.max(0, props.value)) / 100)
);
</script>

<template>
  <div class="ring" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg viewBox="0 0 100 100" :width="size" :height="size">
      <circle
        cx="50"
        cy="50"
        :r="radius"
        fill="none"
        :stroke="track"
        :stroke-width="stroke"
      />
      <circle
        class="ring-value"
        cx="50"
        cy="50"
        :r="radius"
        fill="none"
        :stroke="color"
        :stroke-width="stroke"
        stroke-linecap="round"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="offset"
        transform="rotate(-90 50 50)"
      />
    </svg>
    <div class="ring-center">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.ring {
  position: relative;
  flex: none;
  display: grid;
  place-items: center;
}
.ring svg {
  position: absolute;
  inset: 0;
  transform: rotate(0deg);
}
.ring-value {
  transition: stroke-dashoffset 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}
.ring-center {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  line-height: 1.15;
}
</style>

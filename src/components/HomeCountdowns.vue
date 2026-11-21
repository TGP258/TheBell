<script setup lang="ts">
import { computed } from 'vue';
import { Hourglass } from 'lucide-vue-next';
import { COUNTDOWN_THEMES } from '../lib/categories';
import { monthDayCN, weekdayCN } from '../lib/date';
import { usePlanStore } from '../stores/plan';

const store = usePlanStore();
const list = computed(() => store.homeCountdowns);

function days(date: string): number {
  return store.daysUntil(date);
}

function big(date: string): string {
  const value = days(date);
  if (value === 0) return '今天';
  return String(Math.abs(value));
}

function unit(date: string): string {
  const value = days(date);
  if (value === 0) return '';
  return value > 0 ? '天' : '天前';
}
</script>

<template>
  <section class="card mini-card">
    <div class="section-head">
      <h3>倒数日 <span class="cnt num">{{ list.length }}</span></h3>
      <span class="spacer" />
      <span class="mini-note">首页布局里选择</span>
    </div>

    <div v-if="list.length" class="rows">
      <div
        v-for="item in list"
        :key="item.id"
        class="row"
        :style="{
          '--ca': COUNTDOWN_THEMES[item.color].from,
          '--cb': COUNTDOWN_THEMES[item.color].to,
        }"
      >
        <span class="bar" />
        <div class="meta">
          <b>{{ item.title }}</b>
          <span>{{ monthDayCN(item.targetDate) }} · {{ weekdayCN(item.targetDate) }}</span>
        </div>
        <div class="days">
          <b class="num" :class="{ word: big(item.targetDate) === '今天' }">
            {{ big(item.targetDate) }}
          </b>
          <span v-if="unit(item.targetDate)">{{ unit(item.targetDate) }}</span>
        </div>
      </div>
    </div>

    <div v-else class="empty">
      <span class="empty-icon"><Hourglass :size="22" /></span>
      <b>还没有选择倒数日</b>
      <p>在「首页布局」里勾选要显示的倒数日，或去「倒数日」页添加一个。</p>
    </div>
  </section>
</template>

<style scoped>
.mini-card {
  overflow: hidden;
}
.mini-note {
  font-size: 10.5px;
  color: var(--faint);
}
.rows {
  padding: 0 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 12px;
  background: var(--surface-2);
}
.bar {
  width: 3px;
  align-self: stretch;
  border-radius: 99px;
  background: linear-gradient(180deg, var(--ca), var(--cb));
  flex: none;
}
.meta {
  flex: 1;
  min-width: 0;
}
.meta b {
  display: block;
  font-size: 12.5px;
  font-weight: 650;
  color: var(--text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.meta span {
  font-size: 10px;
  color: var(--faint);
}
.days {
  display: flex;
  align-items: baseline;
  gap: 2px;
  flex: none;
}
.days b {
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--ca);
  font-variant-numeric: tabular-nums;
}
.days b.word {
  font-size: 14px;
}
.days span {
  font-size: 10px;
  color: var(--faint);
}
</style>

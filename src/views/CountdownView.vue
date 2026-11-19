<script setup lang="ts">
import { computed, ref } from 'vue';
import { Hourglass, Pencil, Pin, Plus, Trash2 } from 'lucide-vue-next';
import type { Countdown } from '../types';
import { COUNTDOWN_THEMES } from '../lib/categories';
import { fullDateCN, relativeLabel, weekdayCN } from '../lib/date';
import { usePlanStore } from '../stores/plan';
import { toast } from '../lib/toast';
import CountdownDialog from '../components/CountdownDialog.vue';

const store = usePlanStore();

const dialogOpen = ref(false);
const editing = ref<Countdown | null>(null);

const pinned = computed(() => store.pinnedCountdown);
const others = computed(() =>
  store.data.countdowns.filter((item) => item.id !== pinned.value?.id)
);

const pinnedTheme = computed(() =>
  pinned.value ? COUNTDOWN_THEMES[pinned.value.color] : COUNTDOWN_THEMES.violet
);

function daysOf(item: Countdown): number {
  return store.daysUntil(item.targetDate);
}

function bigOf(item: Countdown): string {
  const days = daysOf(item);
  if (days === 0) return '今天';
  return String(Math.abs(days));
}

function unitOf(item: Countdown): string {
  const days = daysOf(item);
  if (days === 0) return '';
  return days > 0 ? '天' : '天前';
}

function kickerOf(item: Countdown): string {
  return daysOf(item) >= 0 ? `距离 ${item.title}` : `${item.title} 已过去`;
}

function openCreate(): void {
  editing.value = null;
  dialogOpen.value = true;
}

function openEdit(item: Countdown): void {
  editing.value = item;
  dialogOpen.value = true;
}

async function remove(item: Countdown): Promise<void> {
  await store.deleteCountdown(item.id);
  toast('倒数日已删除', 'info');
}

async function pin(item: Countdown): Promise<void> {
  await store.pinCountdown(item.id);
  toast('已设为主倒数');
}
</script>

<template>
  <div class="view countdown-view">
    <header class="page-head">
      <div>
        <p class="eyebrow">把重要的日子放在心上</p>
        <h1>倒数日</h1>
      </div>
      <div class="head-actions">
        <button class="btn primary" @click="openCreate">
          <Plus :size="16" /> 添加倒数日
        </button>
      </div>
    </header>

    <template v-if="pinned">
      <section
        class="cd-hero"
        :style="{
          background: `linear-gradient(124deg, ${pinnedTheme.from}, ${pinnedTheme.to})`,
        }"
      >
        <div class="cd-glow" />
        <div class="cd-hero-top">
          <span class="cd-pill"><Pin :size="12" /> 主倒数</span>
          <div class="cd-tools">
            <button title="编辑" @click="openEdit(pinned)"><Pencil :size="16" /></button>
            <button title="删除" @click="remove(pinned)"><Trash2 :size="16" /></button>
          </div>
        </div>
        <p class="cd-kicker">{{ kickerOf(pinned) }}</p>
        <div class="cd-days">
          <span class="num" :class="{ word: bigOf(pinned) === '今天' }">{{ bigOf(pinned) }}</span>
          <span v-if="unitOf(pinned)" class="cd-unit">{{ unitOf(pinned) }}</span>
        </div>
        <p class="cd-target">
          {{ fullDateCN(pinned.targetDate) }} · {{ weekdayCN(pinned.targetDate) }}
          <span class="sep">·</span>
          {{ relativeLabel(pinned.targetDate) || '目标日' }}
        </p>
      </section>

      <div v-if="others.length" class="cd-grid">
        <article v-for="item in others" :key="item.id" class="cd-card card">
          <div
            class="cd-accent"
            :style="{
              background: `linear-gradient(180deg, ${COUNTDOWN_THEMES[item.color].from}, ${COUNTDOWN_THEMES[item.color].to})`,
            }"
          />
          <div class="cd-card-body">
            <div class="cd-card-head">
              <h3>{{ item.title }}</h3>
              <button class="pin-btn" title="设为主倒数" @click="pin(item)">
                <Pin :size="15" />
              </button>
            </div>
            <div class="cd-card-days">
              <b class="num" :class="{ word: bigOf(item) === '今天' }">{{ bigOf(item) }}</b>
              <span>{{ unitOf(item) || '就是今天' }}</span>
            </div>
            <p class="cd-card-date">
              {{ fullDateCN(item.targetDate) }} · {{ weekdayCN(item.targetDate) }}
            </p>
            <div class="cd-card-foot">
              <span :style="{ color: COUNTDOWN_THEMES[item.color].from }">
                {{ daysOf(item) >= 0 ? '还有' : '已过去' }} {{ Math.abs(daysOf(item)) }} 天
              </span>
              <div>
                <button class="mini-act" @click="openEdit(item)"><Pencil :size="14" /></button>
                <button class="mini-act danger" @click="remove(item)"><Trash2 :size="14" /></button>
              </div>
            </div>
          </div>
        </article>

        <button class="cd-add-card" @click="openCreate">
          <Plus :size="20" />
          <span>添加新的目标日</span>
        </button>
      </div>

      <div v-else class="cd-empty-add">
        <div class="empty">
          <span class="empty-icon"><Hourglass :size="24" /></span>
          <b>还可以添加更多目标</b>
          <p>考试、报名、复试、答辩……把每个节点都记下来。</p>
          <button class="btn sm soft" style="margin-top: 8px" @click="openCreate">
            <Plus :size="14" /> 添加倒数日
          </button>
        </div>
      </div>
    </template>

    <div v-else class="empty big-empty">
      <span class="empty-icon"><Hourglass :size="26" /></span>
      <b>还没有倒数日</b>
      <p>设置一个目标日期，今日页会一直显示还剩多少天。</p>
      <button class="btn primary" style="margin-top: 10px" @click="openCreate">
        <Plus :size="16" /> 添加第一个倒数日
      </button>
    </div>

    <CountdownDialog
      :open="dialogOpen"
      :item="editing"
      @close="dialogOpen = false"
    />
  </div>
</template>

<style scoped>
.countdown-view {
  container-type: inline-size;
}

.cd-hero {
  position: relative;
  padding: 26px 30px 28px;
  border-radius: var(--r-xl);
  color: #fff;
  overflow: hidden;
  box-shadow: 0 26px 64px -26px rgba(91, 75, 240, 0.6);
}
.cd-glow {
  position: absolute;
  width: 360px;
  height: 360px;
  right: -90px;
  top: -170px;
  border-radius: 99px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.25), transparent 65%);
}
.cd-hero-top {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.cd-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 99px;
  padding: 4px 10px;
}
.cd-tools {
  display: flex;
  gap: 6px;
}
.cd-tools button {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  color: rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.12);
  transition: background 0.15s ease;
}
.cd-tools button:hover {
  background: rgba(255, 255, 255, 0.22);
}
.cd-kicker {
  position: relative;
  margin-top: 18px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 600;
}
.cd-days {
  position: relative;
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.cd-days .num {
  font-size: 92px;
  font-weight: 800;
  line-height: 1.02;
  letter-spacing: -0.05em;
}
.cd-days .num.word {
  font-size: 62px;
}
.cd-unit {
  font-size: 20px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
}
.cd-target {
  position: relative;
  font-size: 12.5px;
  color: rgba(255, 255, 255, 0.75);
}
.sep {
  margin: 0 5px;
}

.cd-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 14px;
  margin-top: 18px;
}
.cd-card {
  position: relative;
  display: flex;
  overflow: hidden;
  padding: 0;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}
.cd-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}
.cd-accent {
  width: 5px;
  flex: none;
}
.cd-card-body {
  flex: 1;
  min-width: 0;
  padding: 16px 16px 12px;
}
.cd-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.cd-card-head h3 {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.01em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pin-btn {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  color: var(--faint);
}
.pin-btn:hover {
  color: var(--primary);
  background: var(--primary-soft);
}
.cd-card-days {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin: 8px 0 2px;
}
.cd-card-days b {
  font-size: 38px;
  font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 1.1;
}
.cd-card-days b.word {
  font-size: 27px;
}
.cd-card-days span {
  font-size: 12.5px;
  color: var(--muted);
  font-weight: 600;
}
.cd-card-date {
  font-size: 11.5px;
  color: var(--muted);
}
.cd-card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 10px;
  padding-top: 9px;
  border-top: 1px solid var(--border);
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
}
.cd-card-foot > div {
  display: flex;
  gap: 2px;
}
.mini-act {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  display: grid;
  place-items: center;
  color: var(--muted);
}
.mini-act:hover {
  background: var(--surface-3);
  color: var(--text);
}
.mini-act.danger:hover {
  background: var(--danger-soft);
  color: var(--danger);
}
.cd-add-card {
  min-height: 148px;
  border-radius: 20px;
  border: 1.5px dashed var(--border-strong);
  color: var(--muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7px;
  font-size: 12.5px;
  font-weight: 600;
  transition: all 0.16s ease;
}
.cd-add-card:hover {
  border-color: var(--primary);
  color: var(--primary-strong);
  background: var(--primary-soft);
}
.cd-empty-add {
  margin-top: 16px;
  border: 1px dashed var(--border-strong);
  border-radius: var(--r-xl);
}
.big-empty {
  padding: 90px 20px;
}

@container (max-width: 560px) {
  .cd-hero {
    padding: 20px 20px 22px;
  }
  .cd-days .num {
    font-size: 68px;
  }
  .cd-days .num.word {
    font-size: 46px;
  }
}
</style>

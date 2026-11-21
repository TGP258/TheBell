<script setup lang="ts">
import { computed, ref, type Component } from 'vue';
import { LayoutGrid, Moon, SlidersHorizontal, Sun } from 'lucide-vue-next';
import type { HomeCardId } from '../types';
import { fullDateCN, weekdayCN } from '../lib/date';
import { usePlanStore } from '../stores/plan';
import HomeHero from '../components/HomeHero.vue';
import HomeStats from '../components/HomeStats.vue';
import HomeTimers from '../components/HomeTimers.vue';
import HomeCountdowns from '../components/HomeCountdowns.vue';
import SegmentTimerCard from '../components/SegmentTimerCard.vue';
import TaskCard from '../components/TaskCard.vue';
import RhythmCard from '../components/RhythmCard.vue';
import PlanDialog from '../components/PlanDialog.vue';
import HomeLayoutDialog from '../components/HomeLayoutDialog.vue';

const store = usePlanStore();

const planDialogOpen = ref(false);
const layoutDialogOpen = ref(false);

const CARD_COMPONENTS: Record<HomeCardId, Component> = {
  hero: HomeHero,
  stats: HomeStats,
  segment: SegmentTimerCard,
  tasks: TaskCard,
  rhythm: RhythmCard,
  timers: HomeTimers,
  countdowns: HomeCountdowns,
};

const day = computed(() => store.currentDay);

const outOfRangeText = computed(() => {
  if (store.isInRange) return '';
  if (store.todayIdx < 1) {
    return `计划还没开始，${-store.todayIdx + 1} 天后启动 · 先预览 D1 的安排`;
  }
  return `计划已结束 · 今天是第 ${store.todayIdx} 天，可回看最后一天`;
});
</script>

<template>
  <div class="view today-view">
    <header class="page-head">
      <div>
        <p class="eyebrow">{{ fullDateCN(store.today) }} · {{ weekdayCN(store.today) }}</p>
        <h1>今日</h1>
      </div>
      <div class="head-actions">
        <span v-if="day" class="chip accent num">
          D{{ day.idx }} / {{ store.plan.totalDays }}
        </span>
        <button class="icon-btn" title="首页布局" @click="layoutDialogOpen = true">
          <LayoutGrid :size="18" />
        </button>
        <button class="icon-btn" title="调整计划" @click="planDialogOpen = true">
          <SlidersHorizontal :size="18" />
        </button>
        <button
          class="icon-btn"
          :title="store.effectiveTheme === 'dark' ? '切换浅色' : '切换深色'"
          @click="store.toggleTheme()"
        >
          <Sun v-if="store.effectiveTheme === 'dark'" :size="18" />
          <Moon v-else :size="18" />
        </button>
      </div>
    </header>

    <p v-if="outOfRangeText" class="banner">{{ outOfRangeText }}</p>

    <div class="home-stack">
      <div class="home-full">
        <component
          :is="CARD_COMPONENTS[card.id]"
          v-for="card in store.homeFull"
          :key="card.id"
        />
      </div>

      <div v-if="store.homeLeft.length || store.homeRight.length" class="home-cols">
        <div class="home-col">
          <component
            :is="CARD_COMPONENTS[card.id]"
            v-for="card in store.homeLeft"
            :key="card.id"
          />
        </div>
        <div class="home-col">
          <component
            :is="CARD_COMPONENTS[card.id]"
            v-for="card in store.homeRight"
            :key="card.id"
          />
        </div>
      </div>

      <div v-if="!store.visibleHomeCards.length" class="empty all-hidden">
        <span class="empty-icon"><LayoutGrid :size="24" /></span>
        <b>首页卡片都隐藏了</b>
        <p>打开「首页布局」，选几张要显示的卡片。</p>
        <button class="btn sm soft" style="margin-top: 8px" @click="layoutDialogOpen = true">
          打开首页布局
        </button>
      </div>
    </div>

    <PlanDialog :open="planDialogOpen" @close="planDialogOpen = false" />
    <HomeLayoutDialog :open="layoutDialogOpen" @close="layoutDialogOpen = false" />
  </div>
</template>

<style scoped>
.today-view {
  container-type: inline-size;
}

.banner {
  margin-bottom: 16px;
  padding: 10px 14px;
  border-radius: 12px;
  background: var(--warning-soft);
  color: #9a5b00;
  font-size: 12.5px;
  font-weight: 500;
}

.home-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.home-full {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.home-full:empty {
  display: none;
}
.home-cols {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}
.home-col {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}
.home-col:empty {
  display: none;
}
.all-hidden {
  padding: 40px 20px;
}

@container (min-width: 880px) {
  .home-cols {
    grid-template-columns: minmax(0, 1.3fr) minmax(0, 0.9fr);
    gap: 20px;
  }
  .home-full {
    gap: 18px;
  }
}

/* 手机窄屏：隐藏顶部天数 chip，避免标题被挤成两行 */
@container (max-width: 460px) {
  .head-actions .chip {
    display: none;
  }
  .head-actions {
    gap: 2px;
  }
}
</style>

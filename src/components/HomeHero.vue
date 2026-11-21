<script setup lang="ts">
import { computed, ref } from 'vue';
import { Target } from 'lucide-vue-next';
import { fullDateCN, relativeLabel, weekdayCN } from '../lib/date';
import { heroThemeMeta } from '../lib/home';
import { usePlanStore } from '../stores/plan';
import ProgressRing from './ProgressRing.vue';
import CountdownDialog from './CountdownDialog.vue';

const store = usePlanStore();
const countdownDialogOpen = ref(false);

const countdown = computed(() => store.heroCountdown);
const day = computed(() => store.currentDay);
const progress = computed(() =>
  day.value ? store.dayProgress(day.value.idx) : { total: 0, done: 0, pct: 0 }
);

const countdownDays = computed(() =>
  countdown.value ? store.daysUntil(countdown.value.targetDate) : null
);
const countdownBig = computed(() => {
  if (countdownDays.value === null) return '—';
  if (countdownDays.value === 0) return '今天';
  return String(Math.abs(countdownDays.value));
});
const countdownUnit = computed(() => {
  if (countdownDays.value === null || countdownDays.value === 0) return '';
  return countdownDays.value > 0 ? '天' : '天前';
});
const countdownLabel = computed(() => {
  if (!countdown.value) return '';
  return (countdownDays.value ?? 0) >= 0
    ? `距离 ${countdown.value.title}`
    : `${countdown.value.title} 已过去`;
});

const planPct = computed(() =>
  store.plan.totalDays
    ? Math.min(100, Math.round((store.currentDayIdx / store.plan.totalDays) * 100))
    : 0
);

const heroStyle = computed(() => {
  const meta = heroThemeMeta(store.home.heroTheme);
  const colors = store.effectiveTheme === 'dark' ? meta.dark : meta.light;
  return {
    background: `linear-gradient(118deg, ${colors[0]}, ${colors[1]} 48%, ${colors[2]})`,
    boxShadow: `0 24px 60px -24px ${meta.glow}`,
  };
});
</script>

<template>
  <section class="hero" :style="heroStyle">
    <div class="hero-glow g1" />
    <div class="hero-glow g2" />

    <div class="hero-main">
      <template v-if="countdown">
        <p class="hero-kicker">
          <Target :size="14" />
          {{ countdownLabel }}
        </p>
        <div class="hero-days">
          <span class="num" :class="{ word: countdownBig === '今天' }">{{ countdownBig }}</span>
          <span v-if="countdownUnit" class="hero-unit">{{ countdownUnit }}</span>
        </div>
        <p class="hero-target">
          {{ fullDateCN(countdown.targetDate) }} · {{ weekdayCN(countdown.targetDate) }}
          <span class="hero-sep">·</span>
          {{ relativeLabel(countdown.targetDate) || '目标日' }}
        </p>
      </template>
      <template v-else>
        <p class="hero-kicker"><Target :size="14" /> 还没有倒数日</p>
        <div class="hero-days"><span class="num word">今天</span></div>
        <p class="hero-target">添加一个目标日，让每天更有方向</p>
      </template>

      <div class="hero-plan">
        <div class="hero-plan-row">
          <span>{{ store.plan.name }}</span>
          <span class="num">{{ store.currentDayIdx }} / {{ store.plan.totalDays }} 天</span>
        </div>
        <div class="hero-bar"><i :style="{ width: planPct + '%' }" /></div>
      </div>
    </div>

    <div class="hero-side">
      <ProgressRing
        :value="progress.pct"
        :size="94"
        :stroke="8"
        color="#ffffff"
        track="rgba(255,255,255,0.22)"
      >
        <b class="num hero-ring-num">
          {{ progress.total ? `${progress.done}/${progress.total}` : '—' }}
        </b>
        <span class="hero-ring-label">今日完成</span>
      </ProgressRing>
      <button v-if="!countdown" class="hero-add" @click="countdownDialogOpen = true">
        添加倒数日
      </button>
    </div>
  </section>

  <CountdownDialog :open="countdownDialogOpen" @close="countdownDialogOpen = false" />
</template>

<style scoped>
.hero {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 28px 32px;
  border-radius: var(--r-xl);
  color: #fff;
  overflow: hidden;
}
.hero-glow {
  position: absolute;
  border-radius: 99px;
  filter: blur(8px);
  pointer-events: none;
}
.hero-glow.g1 {
  width: 300px;
  height: 300px;
  right: -60px;
  top: -140px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.24), transparent 65%);
}
.hero-glow.g2 {
  width: 260px;
  height: 260px;
  left: 32%;
  bottom: -190px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.18), transparent 65%);
}
.hero-main {
  position: relative;
  z-index: 1;
  min-width: 0;
  flex: 1;
}
.hero-kicker {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.82);
  letter-spacing: 0.02em;
}
.hero-days {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin: 4px 0 2px;
}
.hero-days .num {
  font-size: 68px;
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -0.045em;
}
.hero-days .num.word {
  font-size: 48px;
  letter-spacing: -0.03em;
}
.hero-unit {
  font-size: 18px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
}
.hero-target {
  font-size: 12.5px;
  color: rgba(255, 255, 255, 0.75);
}
.hero-sep {
  margin: 0 5px;
}
.hero-plan {
  margin-top: 20px;
  max-width: 430px;
}
.hero-plan-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 11.5px;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 7px;
}
.hero-bar {
  height: 6px;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.22);
  overflow: hidden;
}
.hero-bar i {
  display: block;
  height: 100%;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.92);
  transition: width 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}
.hero-side {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.hero-ring-num {
  font-size: 19px;
  font-weight: 800;
  letter-spacing: -0.02em;
}
.hero-ring-label {
  font-size: 10.5px;
  color: rgba(255, 255, 255, 0.75);
  margin-top: 1px;
}
.hero-add {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 99px;
  padding: 5px 12px;
}
@container (max-width: 620px) {
  .hero {
    padding: 22px 20px;
    gap: 14px;
  }
  .hero-days .num {
    font-size: 54px;
  }
  .hero-days .num.word {
    font-size: 38px;
  }
  .hero-side :deep(.ring) {
    width: 78px !important;
    height: 78px !important;
  }
  .hero-plan {
    margin-top: 14px;
  }
}
@container (max-width: 430px) {
  .hero-side {
    display: none;
  }
}
</style>

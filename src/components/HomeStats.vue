<script setup lang="ts">
import { computed } from 'vue';
import { CheckCircle2, Clock3, Flame } from 'lucide-vue-next';
import { usePlanStore } from '../stores/plan';

const store = usePlanStore();

const day = computed(() => store.currentDay);
const progress = computed(() =>
  day.value ? store.dayProgress(day.value.idx) : { total: 0, done: 0, pct: 0 }
);
const routineDone = computed(() => (day.value ? store.routineDone(day.value.idx) : 0));
</script>

<template>
  <section class="stat-row">
    <div class="stat">
      <span class="stat-icon" style="color: var(--success); background: var(--success-soft)">
        <CheckCircle2 :size="18" />
      </span>
      <div>
        <b class="num">{{ progress.done }}/{{ progress.total }}</b>
        <span>今日任务</span>
      </div>
    </div>
    <div class="stat">
      <span class="stat-icon" style="color: var(--primary); background: var(--primary-soft)">
        <Clock3 :size="18" />
      </span>
      <div>
        <b class="num">{{ routineDone }}/{{ store.routineCount }}</b>
        <span>节奏完成</span>
      </div>
    </div>
    <div class="stat">
      <span class="stat-icon" style="color: var(--warning); background: var(--warning-soft)">
        <Flame :size="18" />
      </span>
      <div>
        <b class="num">{{ store.streak }} 天</b>
        <span>连续完成</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.stat-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}
.stat {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 18px;
  box-shadow: var(--shadow-sm);
}
.stat-icon {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  flex: none;
}
.stat b {
  display: block;
  font-size: 16.5px;
  font-weight: 750;
  letter-spacing: -0.02em;
  line-height: 1.2;
}
.stat span {
  font-size: 11.5px;
  color: var(--muted);
}
@container (max-width: 620px) {
  .stat {
    padding: 11px 12px;
    gap: 9px;
    border-radius: 16px;
  }
  .stat-icon {
    width: 32px;
    height: 32px;
    border-radius: 10px;
  }
  .stat b {
    font-size: 14.5px;
  }
  .stat span {
    font-size: 10.5px;
  }
}
@container (max-width: 430px) {
  .stat-row {
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .stat {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }
  .stat-icon {
    width: 30px;
    height: 30px;
  }
  .stat b {
    font-size: 14px;
  }
}
</style>

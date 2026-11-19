<script setup lang="ts">
import { computed, ref } from 'vue';
import { CalendarDays, CheckCircle2, ListChecks, Search, SlidersHorizontal, Sparkles } from 'lucide-vue-next';
import type { Day } from '../types';
import { CATEGORY_META } from '../lib/categories';
import { fullDateCN, relativeLabel, shortDate, weekdayCN } from '../lib/date';
import { usePlanStore } from '../stores/plan';
import ProgressRing from '../components/ProgressRing.vue';
import DayDetail from '../components/DayDetail.vue';
import PlanDialog from '../components/PlanDialog.vue';

const store = usePlanStore();

type Filter = 'all' | 'todo' | 'done';
const query = ref('');
const filter = ref<Filter>('all');
const planDialogOpen = ref(false);
const selectedDay = ref<number | null>(null);
const detailOpen = ref(false);

const remainingDays = computed(() =>
  Math.max(0, store.plan.totalDays - Math.min(store.currentDayIdx, store.plan.totalDays))
);

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  return store.days.filter((day) => {
    const progress = store.dayProgress(day.idx);
    const complete = progress.total > 0 && progress.done === progress.total;
    if (filter.value === 'done' && !complete) return false;
    if (filter.value === 'todo' && complete) return false;
    if (!q) return true;
    if (`d${day.idx}`.includes(q) || day.date.includes(q)) return true;
    if (weekdayCN(day.date).includes(q)) return true;
    return day.tasks.some((task) => task.title.toLowerCase().includes(q));
  });
});

function openDay(day: Day): void {
  selectedDay.value = day.idx;
  detailOpen.value = true;
}
</script>

<template>
  <div class="view plan-view">
    <header class="page-head">
      <div>
        <p class="eyebrow">{{ store.plan.name }}</p>
        <h1>计划</h1>
        <p class="head-sub">
          {{ fullDateCN(store.plan.startDate) }} → {{ fullDateCN(store.planEnd) }} ·
          {{ store.plan.totalDays }} 天
        </p>
      </div>
      <div class="head-actions">
        <button class="btn" @click="planDialogOpen = true">
          <SlidersHorizontal :size="16" /> 调整计划
        </button>
      </div>
    </header>

    <section class="overview card">
      <ProgressRing :value="store.overallPct" :size="104" :stroke="8">
        <b class="ov-pct num">{{ store.overallPct }}%</b>
        <span class="ov-pct-label">任务进度</span>
      </ProgressRing>

      <div class="ov-body">
        <div class="ov-name">
          {{ store.plan.name }}
          <span v-if="store.isInRange" class="chip accent num">第 {{ store.currentDayIdx }} 天</span>
        </div>
        <p class="ov-range">
          {{ fullDateCN(store.plan.startDate) }} — {{ fullDateCN(store.planEnd) }}
        </p>
        <div class="ov-stats">
          <div>
            <b class="num">{{ store.completedDays }}</b>
            <span>完成天数</span>
          </div>
          <div>
            <b class="num">{{ store.doneTasks }}</b>
            <span>已完成任务</span>
          </div>
          <div>
            <b class="num">{{ store.totalTasks - store.doneTasks }}</b>
            <span>待完成任务</span>
          </div>
          <div>
            <b class="num">{{ remainingDays }}</b>
            <span>剩余天数</span>
          </div>
        </div>
      </div>

      <div class="ov-side">
        <div class="ov-mini">
          <CalendarDays :size="16" />
          <div><b>{{ store.plan.totalDays }} 天</b><span>计划总长</span></div>
        </div>
        <div class="ov-mini">
          <ListChecks :size="16" />
          <div><b>{{ store.routineCount }} 项</b><span>每日作息</span></div>
        </div>
        <div class="ov-mini">
          <CheckCircle2 :size="16" />
          <div><b>{{ store.streak }} 天</b><span>连续完成</span></div>
        </div>
      </div>
    </section>

    <div class="plan-toolbar">
      <div class="search">
        <Search :size="16" />
        <input v-model="query" placeholder="搜索任务、日期或 D 编号…" />
        <button v-if="query" class="clear" @click="query = ''">×</button>
      </div>
      <div class="seg">
        <button :class="{ active: filter === 'all' }" @click="filter = 'all'">全部</button>
        <button :class="{ active: filter === 'todo' }" @click="filter = 'todo'">未完成</button>
        <button :class="{ active: filter === 'done' }" @click="filter = 'done'">已完成</button>
      </div>
      <span class="result-count num">{{ filtered.length }} 天</span>
    </div>

    <div v-if="filtered.length" class="day-grid">
      <article
        v-for="day in filtered"
        :key="day.idx"
        class="day-card"
        :class="{ today: day.idx === store.todayIdx }"
        @click="openDay(day)"
      >
        <div class="dc-top">
          <span class="dc-badge num">D{{ day.idx }}</span>
          <div class="dc-date">
            <b>{{ shortDate(day.date) }}</b>
            <span>{{ weekdayCN(day.date) }}</span>
          </div>
          <span v-if="relativeLabel(day.date)" class="dc-tag" :class="{ now: day.idx === store.todayIdx }">
            {{ relativeLabel(day.date) }}
          </span>
        </div>

        <div class="dc-progress">
          <div class="dc-bar">
            <i :style="{ width: store.dayProgress(day.idx).pct + '%' }" />
          </div>
          <span class="num">
            {{ store.dayProgress(day.idx).done }}/{{ store.dayProgress(day.idx).total }}
          </span>
        </div>

        <ul v-if="day.tasks.length" class="dc-list">
          <li
            v-for="task in day.tasks.slice(0, 2)"
            :key="task.id"
            :class="{ done: task.done }"
          >
            <span class="dc-dot" :style="{ background: CATEGORY_META[task.category].color }" />
            <span class="dc-task-title">{{ task.title }}</span>
          </li>
          <li v-if="day.tasks.length > 2" class="dc-more">
            + {{ day.tasks.length - 2 }} 条任务
          </li>
        </ul>
        <p v-else class="dc-empty">暂无任务，点击添加</p>

        <div class="dc-foot">
          <span><Sparkles :size="12" /> 作息 {{ store.routineDone(day.idx) }}/{{ store.routineCount }}</span>
          <span v-if="day.idx === store.todayIdx" class="dc-today">今天</span>
        </div>
      </article>
    </div>

    <div v-else class="empty big-empty">
      <span class="empty-icon"><Search :size="24" /></span>
      <b>没有匹配的计划</b>
      <p>试试换个关键词，或把筛选切回「全部」。</p>
      <button class="btn sm" @click="query = ''; filter = 'all'">清除筛选</button>
    </div>

    <DayDetail :open="detailOpen" :day-idx="selectedDay" @close="detailOpen = false" />
    <PlanDialog :open="planDialogOpen" @close="planDialogOpen = false" />
  </div>
</template>

<style scoped>
.plan-view {
  container-type: inline-size;
}

.overview {
  display: flex;
  align-items: center;
  gap: 26px;
  padding: 24px 26px;
  margin-bottom: 22px;
}
.ov-pct {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.03em;
}
.ov-pct-label {
  font-size: 10.5px;
  color: var(--muted);
}
.ov-body {
  flex: 1;
  min-width: 0;
}
.ov-name {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 18px;
  font-weight: 750;
  letter-spacing: -0.02em;
}
.ov-range {
  font-size: 12.5px;
  color: var(--muted);
  margin-top: 3px;
}
.ov-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 26px;
  margin-top: 16px;
}
.ov-stats > div {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.ov-stats b {
  font-size: 18px;
  font-weight: 750;
  letter-spacing: -0.02em;
}
.ov-stats span {
  font-size: 11.5px;
  color: var(--muted);
}
.ov-side {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 148px;
  padding-left: 22px;
  border-left: 1px solid var(--border);
}
.ov-mini {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--muted);
}
.ov-mini b {
  display: block;
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
}
.ov-mini span {
  font-size: 10.5px;
  color: var(--muted);
}

.plan-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.search {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  flex: 1;
  min-width: 210px;
  max-width: 360px;
  padding: 0 12px;
  border-radius: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--muted);
}
.search:focus-within {
  border-color: var(--primary);
  box-shadow: 0 0 0 4px var(--primary-soft);
}
.search input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 13.5px;
  color: var(--text);
}
.search input::placeholder {
  color: var(--faint);
}
.clear {
  width: 20px;
  height: 20px;
  border-radius: 99px;
  background: var(--surface-3);
  color: var(--muted);
  font-size: 14px;
  line-height: 1;
}
.result-count {
  font-size: 12px;
  color: var(--muted);
  margin-left: auto;
}

.day-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}
.day-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 16px 16px 13px;
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition: transform 0.18s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.18s ease,
    border-color 0.18s ease;
}
.day-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: var(--border-strong);
}
.day-card.today {
  border-color: rgba(98, 87, 245, 0.42);
  box-shadow: 0 0 0 1px rgba(98, 87, 245, 0.18), var(--shadow-sm);
}
.dc-top {
  display: flex;
  align-items: center;
  gap: 10px;
}
.dc-badge {
  width: 38px;
  height: 38px;
  border-radius: 11px;
  display: grid;
  place-items: center;
  background: var(--surface-3);
  color: var(--text-2);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: -0.02em;
  flex: none;
}
.day-card.today .dc-badge {
  background: linear-gradient(135deg, var(--primary), var(--primary-strong));
  color: #fff;
  box-shadow: 0 6px 14px -6px rgba(98, 87, 245, 0.65);
}
.dc-date {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}
.dc-date b {
  font-size: 15px;
  font-weight: 750;
  letter-spacing: -0.01em;
}
.dc-date span {
  font-size: 11.5px;
  color: var(--muted);
}
.dc-tag {
  margin-left: auto;
  font-size: 10.5px;
  font-weight: 600;
  color: var(--muted);
  background: var(--surface-3);
  border-radius: 99px;
  padding: 3px 8px;
}
.dc-tag.now {
  background: var(--primary-soft);
  color: var(--primary-strong);
}
.dc-progress {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 12px 0 10px;
}
.dc-bar {
  flex: 1;
  height: 5px;
  border-radius: 99px;
  background: var(--surface-3);
  overflow: hidden;
}
.dc-bar i {
  display: block;
  height: 100%;
  border-radius: 99px;
  background: linear-gradient(90deg, var(--primary), #a855f7);
  transition: width 0.4s ease;
}
.dc-progress span {
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
}
.dc-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-height: 52px;
}
.dc-list li {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--text-2);
}
.dc-list li.done .dc-task-title {
  color: var(--faint);
  text-decoration: line-through;
}
.dc-dot {
  width: 5px;
  height: 5px;
  border-radius: 99px;
  margin-top: 6px;
  flex: none;
}
.dc-task-title {
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.dc-more {
  color: var(--faint) !important;
  font-size: 11.5px !important;
}
.dc-empty {
  min-height: 52px;
  font-size: 12px;
  color: var(--faint);
  padding-top: 8px;
}
.dc-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
  padding-top: 9px;
  border-top: 1px solid var(--border);
  font-size: 10.5px;
  color: var(--muted);
}
.dc-foot span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.dc-today {
  color: var(--primary-strong);
  font-weight: 700;
}
.big-empty {
  padding: 70px 20px;
}

@container (max-width: 700px) {
  .overview {
    flex-wrap: wrap;
    gap: 18px;
    padding: 20px;
  }
  .ov-side {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 18px;
    width: 100%;
    padding-left: 0;
    padding-top: 16px;
    border-left: none;
    border-top: 1px solid var(--border);
  }
  .ov-stats {
    gap: 20px;
  }
  .plan-toolbar .result-count {
    display: none;
  }
  .search {
    max-width: none;
    flex-basis: 100%;
  }
}
</style>

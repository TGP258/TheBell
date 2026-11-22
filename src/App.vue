<script setup lang="ts">
import { computed, onMounted, ref, watch, type Component } from 'vue';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import {
  CalendarCheck2,
  Hourglass,
  ListChecks,
  Settings2,
  Timer,
} from 'lucide-vue-next';
import { usePlanStore } from './stores/plan';
import { fullDateCN, relativeLabel } from './lib/date';
import { toast } from './lib/toast';
import TodayView from './views/TodayView.vue';
import PlanView from './views/PlanView.vue';
import TimerView from './views/TimerView.vue';
import CountdownView from './views/CountdownView.vue';
import SettingsView from './views/SettingsView.vue';
import ToastHost from './components/ToastHost.vue';
import SegmentEndOverlay from './components/SegmentEndOverlay.vue';

type Tab = 'today' | 'plan' | 'timer' | 'countdown' | 'settings';

const store = usePlanStore();
const tab = ref<Tab>('today');

const tabs: { id: Tab; label: string; icon: Component }[] = [
  { id: 'today', label: '今日', icon: CalendarCheck2 },
  { id: 'plan', label: '计划', icon: ListChecks },
  { id: 'timer', label: '计时', icon: Timer },
  { id: 'countdown', label: '倒数日', icon: Hourglass },
  { id: 'settings', label: '设置', icon: Settings2 },
];

const pinned = computed(() => store.pinnedCountdown);
const pinnedDays = computed(() =>
  pinned.value ? store.daysUntil(pinned.value.targetDate) : 0
);
const pinnedBig = computed(() => {
  if (!pinned.value) return '';
  if (pinnedDays.value === 0) return '今天';
  return String(Math.abs(pinnedDays.value));
});
const pinnedUnit = computed(() => {
  if (!pinned.value || pinnedDays.value === 0) return '';
  return pinnedDays.value > 0 ? '天' : '天前';
});
const storageText = computed(() =>
  store.dbKind === 'sqlite' ? 'SQLite 已连接' : '浏览器存储'
);

function applyTheme(mode: 'light' | 'dark'): void {
  document.documentElement.dataset.theme = mode;
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute('content', mode === 'dark' ? '#0a0a0d' : '#f4f4f7');
  if (Capacitor.isNativePlatform()) {
    StatusBar.setStyle({ style: mode === 'dark' ? Style.Light : Style.Dark }).catch(
      () => undefined
    );
    StatusBar.setBackgroundColor({
      color: mode === 'dark' ? '#0a0a0d' : '#f4f4f7',
    }).catch(() => undefined);
  }
}

watch(() => store.effectiveTheme, applyTheme, { immediate: true });

function go(next: Tab): void {
  tab.value = next;
  window.scrollTo({ top: 0, behavior: 'auto' });
}

onMounted(async () => {
  await store.init();
  if (store.loadError) toast(store.loadError, 'info');

  if (Capacitor.isNativePlatform()) {
    CapApp.addListener('backButton', () => {
      if (document.body.classList.contains('modal-open')) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        return;
      }
      if (tab.value !== 'today') {
        go('today');
        return;
      }
      CapApp.minimizeApp().catch(() => undefined);
    });
  }
});
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <img class="brand-mark" src="/brand-icon.svg" alt="TheBell" width="40" height="40" />
        <div class="brand-text">
          <b>TheBell</b>
          <span>学习时钟 · Dev0.4.1</span>
        </div>
      </div>

      <nav class="side-nav">
        <button
          v-for="item in tabs"
          :key="item.id"
          :class="{ active: tab === item.id }"
          @click="go(item.id)"
        >
          <component :is="item.icon" :size="19" />
          <span>{{ item.label }}</span>
        </button>
      </nav>

      <div class="side-spacer" />

      <div v-if="pinned" class="side-cd">
        <p>距离 {{ pinned.title }}</p>
        <div class="side-cd-days">
          <b class="num" :class="{ word: pinnedBig === '今天' }">{{ pinnedBig }}</b>
          <span v-if="pinnedUnit">{{ pinnedUnit }}</span>
        </div>
        <small>{{ fullDateCN(pinned.targetDate) }} · {{ relativeLabel(pinned.targetDate) || '目标日' }}</small>
      </div>

      <div class="side-foot">
        <span class="dot" :class="{ live: store.dbKind === 'sqlite' }" />
        <span>{{ storageText }}</span>
      </div>
    </aside>

    <main class="main">
      <div v-if="!store.ready" class="boot">
        <img class="boot-mark" src="/brand-icon.svg" alt="" width="68" height="68" />
        <b>TheBell</b>
        <span class="boot-spinner" />
        <p>正在准备你的计划…</p>
      </div>

      <template v-else>
        <TodayView v-if="tab === 'today'" />
        <PlanView v-else-if="tab === 'plan'" />
        <TimerView v-else-if="tab === 'timer'" />
        <CountdownView v-else-if="tab === 'countdown'" />
        <SettingsView v-else />
      </template>
    </main>

    <nav class="tabbar">
      <button
        v-for="item in tabs"
        :key="item.id"
        :class="{ active: tab === item.id }"
        @click="go(item.id)"
      >
        <span class="tab-icon"><component :is="item.icon" :size="20" /></span>
        <span>{{ item.label }}</span>
      </button>
    </nav>

    <ToastHost />
    <SegmentEndOverlay />
  </div>
</template>

<style scoped>
.app-shell {
  display: grid;
  grid-template-columns: var(--sidebar-w) minmax(0, 1fr);
  min-height: 100dvh;
}

.sidebar {
  position: sticky;
  top: 0;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  padding: 24px 16px calc(18px + env(safe-area-inset-bottom));
  border-right: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 82%, transparent);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  z-index: 20;
}

.brand {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 0 8px;
  margin-bottom: 26px;
}
.brand-mark {
  width: 40px;
  height: 40px;
  display: block;
  flex: none;
  border-radius: 22.5%;
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.07), 0 10px 20px -12px rgba(15, 23, 42, 0.35);
}
.brand-text b {
  display: block;
  font-size: 15px;
  font-weight: 750;
  letter-spacing: -0.01em;
}
.brand-text span {
  display: block;
  font-size: 10.5px;
  color: var(--muted);
  margin-top: 1px;
}

.side-nav {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.side-nav button {
  display: flex;
  align-items: center;
  gap: 11px;
  height: 44px;
  padding: 0 12px;
  border-radius: 12px;
  color: var(--text-2);
  font-size: 13.5px;
  font-weight: 600;
  transition: background 0.15s ease, color 0.15s ease;
}
.side-nav button:hover {
  background: var(--surface-3);
  color: var(--text);
}
.side-nav button.active {
  background: var(--primary-soft);
  color: var(--primary-strong);
}
.side-nav button :deep(svg) {
  color: currentColor;
}

.side-spacer {
  flex: 1;
}

.side-cd {
  margin: 0 4px 12px;
  padding: 13px 14px;
  border-radius: 16px;
  background: linear-gradient(140deg, var(--primary-soft), var(--primary-soft-2));
  border: 1px solid color-mix(in srgb, var(--primary) 14%, transparent);
}
.side-cd p {
  font-size: 10.5px;
  font-weight: 650;
  color: var(--primary-strong);
  letter-spacing: 0.02em;
}
.side-cd-days {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin: 2px 0;
}
.side-cd-days b {
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 1.15;
}
.side-cd-days b.word {
  font-size: 21px;
}
.side-cd-days span {
  font-size: 11.5px;
  color: var(--primary-strong);
  font-weight: 600;
}
.side-cd small {
  font-size: 9.5px;
  color: var(--muted);
}

.side-foot {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 10px;
  font-size: 10.5px;
  color: var(--muted);
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 99px;
  background: var(--warning);
  box-shadow: 0 0 0 3px var(--warning-soft);
}
.dot.live {
  background: var(--success);
  box-shadow: 0 0 0 3px var(--success-soft);
}

.main {
  min-width: 0;
  padding-top: env(safe-area-inset-top);
}

.boot {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.boot-mark {
  width: 68px;
  height: 68px;
  display: block;
  border-radius: 22.5%;
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.06), 0 24px 40px -22px rgba(37, 99, 235, 0.55);
  animation: boot-pop 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}
.boot b {
  font-size: 16px;
  font-weight: 750;
  margin-top: 4px;
}
.boot p {
  font-size: 11.5px;
  color: var(--muted);
}
.boot-spinner {
  width: 18px;
  height: 18px;
  border-radius: 99px;
  border: 2px solid var(--border);
  border-top-color: var(--primary);
  animation: spin 0.8s linear infinite;
  margin-top: 6px;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes boot-pop {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.tabbar {
  display: none;
}

@media (max-width: 1279px) and (min-width: 1024px) {
  .app-shell {
    grid-template-columns: 88px minmax(0, 1fr);
  }
  .sidebar {
    padding: 22px 10px calc(18px + env(safe-area-inset-bottom));
    align-items: center;
  }
  .brand {
    padding: 0;
    margin-bottom: 22px;
  }
  .brand-text,
  .side-nav button span,
  .side-cd,
  .side-foot span:last-child {
    display: none;
  }
  .side-nav {
    width: 100%;
    align-items: center;
  }
  .side-nav button {
    width: 48px;
    height: 46px;
    justify-content: center;
    padding: 0;
  }
  .side-foot {
    padding: 0;
  }
}

@media (max-width: 1023px) {
  .app-shell {
    grid-template-columns: minmax(0, 1fr);
  }
  .sidebar {
    display: none;
  }
  .main {
    padding-bottom: calc(74px + env(safe-area-inset-bottom));
  }
  .tabbar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 80;
    display: flex;
    align-items: stretch;
    gap: 2px;
    padding: 6px 8px calc(6px + env(safe-area-inset-bottom));
    background: color-mix(in srgb, var(--surface) 86%, transparent);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-top: 1px solid var(--border);
  }
  .tabbar button {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    height: 52px;
    border-radius: 12px;
    color: var(--muted);
    font-size: 10px;
    font-weight: 600;
    transition: color 0.15s ease;
  }
  .tabbar button.active {
    color: var(--primary-strong);
  }
  .tab-icon {
    width: 34px;
    height: 26px;
    border-radius: 9px;
    display: grid;
    place-items: center;
    transition: background 0.15s ease;
  }
  .tabbar button.active .tab-icon {
    background: var(--primary-soft);
  }
}
</style>

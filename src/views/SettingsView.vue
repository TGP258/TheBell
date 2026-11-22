<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  Check,
  ChevronRight,
  Database,
  Download,
  Maximize2,
  Monitor,
  Moon,
  RotateCcw,
  Sun,
  Upload,
} from 'lucide-vue-next';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { AppData, BackupSummary, ThemeMode } from '../types';
import { parseBackup, serializeBackup } from '../lib/backup';
import { fullDateCN } from '../lib/date';
import { usePlanStore } from '../stores/plan';
import { toast } from '../lib/toast';
import AppModal from '../components/AppModal.vue';

const store = usePlanStore();

const planName = ref('');
const planStart = ref('');
const planDays = ref(100);

watch(
  () => store.plan,
  (plan) => {
    planName.value = plan.name;
    planStart.value = plan.startDate;
    planDays.value = plan.totalDays;
  },
  { deep: true, immediate: true }
);

const themeOptions: { id: ThemeMode; name: string; desc: string }[] = [
  { id: 'light', name: '浅色', desc: '清爽明亮' },
  { id: 'dark', name: '深色', desc: '夜间护眼' },
  { id: 'system', name: '跟随系统', desc: '自动切换' },
];

const planDirty = computed(
  () =>
    planName.value.trim() !== store.plan.name ||
    planStart.value !== store.plan.startDate ||
    planDays.value !== store.plan.totalDays
);

async function savePlan(): Promise<void> {
  if (!planName.value.trim() || !planStart.value) return;
  await store.updatePlan({
    name: planName.value,
    startDate: planStart.value,
    totalDays: planDays.value,
  });
  toast('计划设置已保存');
}

const storageLabel = computed(() =>
  store.dbKind === 'sqlite' ? 'SQLite 本地数据库' : '浏览器本地存储'
);
const storageDesc = computed(() =>
  store.dbKind === 'sqlite'
    ? '所有改动实时落盘到 thebell.db，卸载前不会丢失'
    : '当前是网页预览模式。安装到平板后使用内置 SQLite 持久化'
);

async function exportPlan(): Promise<void> {
  try {
    const json = serializeBackup(store.data);
    const filename = `thebell-${store.today}.json`;
    if (Capacitor.isNativePlatform()) {
      const result = await Filesystem.writeFile({
        path: filename,
        data: json,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });
      await Share.share({
        title: '导出计划',
        text: 'TheBell计划备份',
        url: result.uri,
        dialogTitle: '保存或分享备份文件',
      });
      toast('备份已生成，可保存或分享');
    } else {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      toast('备份文件已下载');
    }
  } catch (error) {
    console.error(error);
    toast('导出失败，请重试', 'error');
  }
}

const fileInput = ref<HTMLInputElement | null>(null);

function chooseImport(): void {
  fileInput.value?.click();
}

interface PendingImport {
  data: AppData;
  summary: BackupSummary;
}

const pending = ref<PendingImport | null>(null);
const confirmOpen = ref(false);
const confirmBusy = ref(false);
const confirmTitle = ref('');
const confirmMessage = ref('');
const confirmLabel = ref('确认');
const confirmAction = ref<(() => Promise<void>) | null>(null);
const confirmDanger = ref(false);

function askConfirm(options: {
  title: string;
  message: string;
  confirmText: string;
  danger?: boolean;
  action: () => Promise<void>;
}): void {
  confirmTitle.value = options.title;
  confirmMessage.value = options.message;
  confirmLabel.value = options.confirmText;
  confirmDanger.value = options.danger ?? false;
  confirmAction.value = options.action;
  confirmOpen.value = true;
}

async function runConfirm(): Promise<void> {
  if (!confirmAction.value) return;
  confirmBusy.value = true;
  try {
    await confirmAction.value();
    confirmOpen.value = false;
  } catch (error) {
    console.error(error);
    toast('操作失败，请重试', 'error');
  } finally {
    confirmBusy.value = false;
  }
}

async function handleFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = parseBackup(text);
    pending.value = parsed;
    askConfirm({
      title: '导入计划',
      message: `确认用「${parsed.data.plan.name}」替换当前计划？当前的任务、作息、计时与倒数日都会被覆盖。`,
      confirmText: '替换并导入',
      danger: true,
      action: async () => {
        if (!pending.value) return;
        await store.importData(pending.value.data);
        toast('计划已导入');
        pending.value = null;
      },
    });
  } catch (error) {
    toast((error as Error).message || '导入失败', 'error');
  }
}

function resetAll(): void {
  pending.value = null;
  askConfirm({
    title: '重置所有数据',
    message: '将清空当前计划、任务、作息打卡、计时器和倒数日，并生成一个从今天开始的 100 天默认计划。此操作不可撤销。',
    confirmText: '确认重置',
    danger: true,
    action: async () => {
      await store.resetAll();
      toast('已重置为新的 100 天计划');
    },
  });
}
</script>

<template>
  <div class="view settings-view">
    <header class="page-head">
      <div>
        <p class="eyebrow">按自己的节奏来</p>
        <h1>设置</h1>
      </div>
    </header>

    <div class="settings-grid">
      <section class="card set-card">
        <div class="set-head">
          <h3>计划</h3>
          <p>名称、开始日期与总天数</p>
        </div>
        <div class="set-body plan-form">
          <div class="field">
            <label>计划名称</label>
            <input v-model="planName" class="input" maxlength="30" placeholder="例如：我的学习计划" />
          </div>
          <div class="two">
            <div class="field">
              <label>开始日期</label>
              <input v-model="planStart" class="input" type="date" />
            </div>
            <div class="field">
              <label>总天数</label>
              <input v-model.number="planDays" class="input num" type="number" min="1" max="1000" />
            </div>
          </div>
          <div class="plan-form-foot">
            <span class="hint">
              {{ fullDateCN(planStart) }} 起 · 默认 100 天，最多 1000 天
            </span>
            <button class="btn primary sm" :disabled="!planDirty" @click="savePlan">
              保存修改
            </button>
          </div>
        </div>
      </section>

      <section class="card set-card">
        <div class="set-head">
          <h3>外观</h3>
          <p>主题会立即生效并记住</p>
        </div>
        <div class="set-body">
          <div class="theme-grid">
            <button
              v-for="option in themeOptions"
              :key="option.id"
              class="theme-option"
              :class="{ active: store.theme === option.id }"
              @click="store.setTheme(option.id)"
            >
              <span class="theme-icon">
                <Sun v-if="option.id === 'light'" :size="18" />
                <Moon v-else-if="option.id === 'dark'" :size="18" />
                <Monitor v-else :size="18" />
              </span>
              <span class="theme-name">{{ option.name }}</span>
              <span class="theme-desc">{{ option.desc }}</span>
              <span v-if="store.theme === option.id" class="theme-check"><Check :size="12" /></span>
            </button>
          </div>
        </div>
      </section>

      <section class="card set-card span-2">
        <div class="set-head">
          <h3>数据</h3>
          <p>JSON 备份包含计划、每天任务、作息时间段、分段计时、独立计时器、打卡状态和倒数日</p>
        </div>
        <div class="set-body rows">
          <button class="row-action" @click="exportPlan">
            <span class="ra-icon"><Download :size="18" /></span>
            <span class="ra-text">
              <b>导出计划 JSON</b>
              <p>生成含计时状态的完整备份，原生端可通过系统分享保存</p>
            </span>
            <ChevronRight :size="18" class="ra-arrow" />
          </button>

          <button class="row-action" @click="chooseImport">
            <span class="ra-icon"><Upload :size="18" /></span>
            <span class="ra-text">
              <b>导入计划 JSON</b>
              <p>从备份文件恢复，会替换当前全部数据</p>
            </span>
            <ChevronRight :size="18" class="ra-arrow" />
          </button>

          <button class="row-action danger" @click="resetAll">
            <span class="ra-icon"><RotateCcw :size="18" /></span>
            <span class="ra-text">
              <b>重置所有数据</b>
              <p>清空并重新生成 100 天空白计划</p>
            </span>
            <ChevronRight :size="18" class="ra-arrow" />
          </button>
        </div>
        <input
          ref="fileInput"
          type="file"
          accept=".json,application/json"
          class="hidden-file"
          @change="handleFile"
        />
      </section>

      <section class="card set-card span-2">
        <div class="set-head">
          <h3>专注提醒</h3>
          <p>分段结束时的提示方式</p>
        </div>
        <div class="set-body rows">
          <div class="toggle-row">
            <span class="ra-icon"><Maximize2 :size="18" /></span>
            <span class="ra-text">
              <b>结束后全屏提示</b>
              <p>本段结束时整屏提示，可直接开始下一段；关闭后只在应用内轻提示</p>
            </span>
            <button
              class="switch"
              :class="{ on: store.alertOnEnd }"
              role="switch"
              :aria-checked="store.alertOnEnd"
              aria-label="结束后全屏提示"
              @click="store.setAlertOnEnd(!store.alertOnEnd)"
            >
              <span />
            </button>
          </div>
        </div>
      </section>

      <section class="card set-card">
        <div class="set-head">
          <h3>存储</h3>
          <p>数据保存在哪里</p>
        </div>
        <div class="set-body storage">
          <div class="storage-badge">
            <span class="storage-icon"><Database :size="20" /></span>
            <div>
              <b>{{ storageLabel }}</b>
              <p>{{ storageDesc }}</p>
            </div>
          </div>
          <div class="storage-stats">
            <div><b class="num">{{ store.plan.totalDays }}</b><span>天</span></div>
            <div><b class="num">{{ store.totalTasks }}</b><span>条任务</span></div>
            <div><b class="num">{{ store.routineCount }}</b><span>项作息</span></div>
            <div><b class="num">{{ store.doneTasks }}</b><span>已完成</span></div>
          </div>
        </div>
      </section>

      <section class="card set-card">
        <div class="set-head">
          <h3>关于</h3>
          <p>开发版本信息</p>
        </div>
        <div class="set-body about">
          <div class="about-brand">
            <img class="about-logo" src="/brand-icon.svg" alt="TheBell" width="42" height="42" />
            <div>
              <b>TheBell</b>
              <p>TheBell · 50/10 专注计时、学习计划与倒数日</p>
            </div>
            <span class="version-tag">Dev0.4.1</span>
          </div>
          <ul class="about-meta">
            <li><span>包名</span><b>pascal.thebell</b></li>
            <li><span>技术栈</span><b>Vue 3 · Capacitor 7 · SQLite</b></li>
            <li><span>平台</span><b>Android / iPadOS（可移植）</b></li>
          </ul>
          <p class="about-note">
            数据优先存本地，不联网、不上传。建议定期导出 JSON 备份。
          </p>
        </div>
      </section>
    </div>

    <AppModal :open="confirmOpen" width="sm" @close="confirmOpen = false; pending = null">
      <template #header>
        <h3>{{ confirmTitle }}</h3>
      </template>
      <p class="confirm-text">{{ confirmMessage }}</p>
      <div v-if="pending" class="confirm-facts">
        <div><span>天数</span><b class="num">{{ pending.summary.days }}</b></div>
        <div><span>任务</span><b class="num">{{ pending.summary.tasks }}</b></div>
        <div><span>已完成</span><b class="num">{{ pending.summary.doneTasks }}</b></div>
        <div><span>作息</span><b class="num">{{ pending.summary.routine }}</b></div>
        <div><span>倒数日</span><b class="num">{{ pending.summary.countdowns }}</b></div>
        <div class="wide"><span>日期</span><b>{{ pending.summary.startDate }} → {{ pending.summary.endDate }}</b></div>
      </div>
      <template #footer>
        <span class="grow" />
        <button class="btn ghost" @click="confirmOpen = false">取消</button>
        <button
          class="btn"
          :class="confirmDanger ? 'danger' : 'primary'"
          :disabled="confirmBusy"
          @click="runConfirm"
        >
          {{ confirmBusy ? '处理中…' : confirmLabel }}
        </button>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.settings-view {
  container-type: inline-size;
}
.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  align-items: start;
}
.span-2 {
  grid-column: span 2;
}
.set-card {
  overflow: hidden;
}
.set-head {
  padding: 18px 20px 12px;
}
.set-head h3 {
  font-size: 15.5px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.set-head p {
  font-size: 12px;
  color: var(--muted);
  margin-top: 2px;
}
.set-body {
  padding: 0 20px 20px;
}
.plan-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.plan-form-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.hint {
  font-size: 11.5px;
  color: var(--faint);
}
.theme-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.theme-option {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  text-align: left;
  transition: all 0.15s ease;
}
.theme-option:hover {
  border-color: var(--border-strong);
}
.theme-option.active {
  border-color: var(--primary);
  background: var(--primary-soft);
}
.theme-icon {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  background: var(--surface);
  color: var(--text-2);
  border: 1px solid var(--border);
}
.theme-name {
  font-size: 13px;
  font-weight: 650;
}
.theme-desc {
  font-size: 11px;
  color: var(--muted);
}
.theme-check {
  margin-left: auto;
  width: 20px;
  height: 20px;
  border-radius: 99px;
  background: var(--primary);
  color: #fff;
  display: grid;
  place-items: center;
}
.rows {
  display: flex;
  flex-direction: column;
  padding-top: 0;
}
.row-action {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 2px;
  text-align: left;
  border-bottom: 1px solid var(--border);
}
.row-action:last-of-type {
  border-bottom: none;
}
.row-action:hover .ra-text b {
  color: var(--primary-strong);
}
.ra-icon {
  width: 38px;
  height: 38px;
  border-radius: 11px;
  display: grid;
  place-items: center;
  background: var(--surface-3);
  color: var(--text-2);
  flex: none;
}
.row-action.danger .ra-icon {
  background: var(--danger-soft);
  color: var(--danger);
}
.ra-text {
  flex: 1;
  min-width: 0;
}
.ra-text b {
  display: block;
  font-size: 13.5px;
  font-weight: 650;
  transition: color 0.15s ease;
}
.row-action.danger .ra-text b {
  color: var(--danger);
}
.ra-text p {
  font-size: 11.5px;
  color: var(--muted);
  margin-top: 1px;
  line-height: 1.5;
}
.ra-arrow {
  color: var(--faint);
  flex: none;
}
.toggle-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 2px;
  border-bottom: 1px solid var(--border);
}
.toggle-row:last-of-type {
  border-bottom: none;
}
.switch {
  position: relative;
  flex: none;
  width: 42px;
  height: 24px;
  border-radius: 99px;
  background: var(--surface-3);
  border: 1px solid var(--border-strong);
  transition: background 0.18s ease, border-color 0.18s ease;
}
.switch span {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.24);
  transition: transform 0.18s cubic-bezier(0.22, 1, 0.36, 1);
}
.switch.on {
  background: var(--primary);
  border-color: var(--primary);
}
.switch.on span {
  transform: translateX(18px);
}
.hidden-file {
  display: none;
}
.storage {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.storage-badge {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 13px 14px;
  border-radius: 13px;
  background: var(--surface-2);
  border: 1px solid var(--border);
}
.storage-icon {
  width: 38px;
  height: 38px;
  border-radius: 11px;
  display: grid;
  place-items: center;
  background: var(--primary-soft);
  color: var(--primary-strong);
  flex: none;
}
.storage-badge b {
  font-size: 13px;
  font-weight: 650;
}
.storage-badge p {
  font-size: 11.5px;
  color: var(--muted);
  line-height: 1.55;
  margin-top: 2px;
}
.storage-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  text-align: center;
}
.storage-stats div {
  padding: 8px 4px;
  border-radius: 10px;
  background: var(--surface-2);
}
.storage-stats b {
  display: block;
  font-size: 15px;
  font-weight: 750;
}
.storage-stats span {
  font-size: 10px;
  color: var(--muted);
}
.about {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.about-brand {
  display: flex;
  align-items: center;
  gap: 11px;
}
.about-logo {
  width: 42px;
  height: 42px;
  display: block;
  flex: none;
  border-radius: 22.5%;
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.07), 0 8px 16px -10px rgba(15, 23, 42, 0.3);
}
.about-brand b {
  display: block;
  font-size: 14px;
  font-weight: 700;
}
.about-brand p {
  font-size: 11px;
  color: var(--muted);
}
.version-tag {
  margin-left: auto;
  font-size: 10.5px;
  font-weight: 700;
  color: var(--primary-strong);
  background: var(--primary-soft);
  border-radius: 99px;
  padding: 3px 9px;
}
.about-meta {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--surface-2);
}
.about-meta li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 11.5px;
}
.about-meta span {
  color: var(--muted);
}
.about-meta b {
  font-weight: 600;
  text-align: right;
}
.about-note {
  font-size: 11px;
  color: var(--faint);
  line-height: 1.6;
}
.confirm-text {
  font-size: 13.5px;
  line-height: 1.7;
  color: var(--text-2);
}
.confirm-facts {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 14px;
}
.confirm-facts div {
  padding: 8px 10px;
  border-radius: 10px;
  background: var(--surface-2);
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.confirm-facts .wide {
  grid-column: span 3;
}
.confirm-facts span {
  font-size: 10.5px;
  color: var(--muted);
}
.confirm-facts b {
  font-size: 13px;
  font-weight: 650;
}
.grow {
  flex: 1;
}
@container (max-width: 760px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
  .span-2 {
    grid-column: span 1;
  }
  .storage-stats {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>

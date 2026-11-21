<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Hourglass,
  LayoutGrid,
  Palette,
  RotateCcw,
  Timer,
} from 'lucide-vue-next';
import type { HeroTheme, HomeCardId, HomeLayout, HomeZone } from '../types';
import {
  HERO_THEMES,
  HOME_CARD_META,
  HOME_ZONES,
  defaultHome,
} from '../lib/home';
import { usePlanStore } from '../stores/plan';
import { toast } from '../lib/toast';
import AppModal from './AppModal.vue';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();
const store = usePlanStore();

const draft = ref<HomeLayout>(defaultHome());

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    draft.value = {
      cards: store.home.cards.map((card) => ({ ...card })),
      heroCountdownId: store.home.heroCountdownId,
      heroTheme: store.home.heroTheme,
      timerIds: [...store.home.timerIds],
      countdownIds: [...store.home.countdownIds],
    };
  }
);

const grouped = computed(() =>
  HOME_ZONES.map((zone) => ({
    ...zone,
    cards: draft.value.cards.filter((card) => card.zone === zone.id),
  })).filter((group) => group.cards.length > 0)
);

const heroVisible = computed(() => {
  const card = draft.value.cards.find((item) => item.id === 'hero');
  return Boolean(card?.visible);
});
const timersVisible = computed(() => {
  const card = draft.value.cards.find((item) => item.id === 'timers');
  return Boolean(card?.visible);
});
const countdownsVisible = computed(() => {
  const card = draft.value.cards.find((item) => item.id === 'countdowns');
  return Boolean(card?.visible);
});

function findCard(id: HomeCardId) {
  return draft.value.cards.find((card) => card.id === id);
}

function toggleVisible(id: HomeCardId): void {
  const card = findCard(id);
  if (card) card.visible = !card.visible;
}

function setZone(id: HomeCardId, zone: HomeZone): void {
  const card = findCard(id);
  if (card) card.zone = zone;
}

/** 在同一个栏内上下移动 */
function move(id: HomeCardId, delta: number): void {
  const cards = draft.value.cards;
  const current = cards.find((card) => card.id === id);
  if (!current) return;
  const peers = cards.filter((card) => card.zone === current.zone);
  const index = peers.findIndex((card) => card.id === id);
  const neighbor = peers[index + delta];
  if (!neighbor) return;
  const a = cards.findIndex((card) => card.id === id);
  const b = cards.findIndex((card) => card.id === neighbor.id);
  cards[a] = neighbor;
  cards[b] = current;
}

function isFirst(id: HomeCardId): boolean {
  const card = findCard(id);
  if (!card) return true;
  return draft.value.cards.filter((item) => item.zone === card.zone)[0]?.id === id;
}

function isLast(id: HomeCardId): boolean {
  const card = findCard(id);
  if (!card) return true;
  const peers = draft.value.cards.filter((item) => item.zone === card.zone);
  return peers[peers.length - 1]?.id === id;
}

function pickTheme(theme: HeroTheme): void {
  draft.value.heroTheme = theme;
}

function toggleId(kind: 'timerIds' | 'countdownIds', id: number): void {
  const list = draft.value[kind];
  const index = list.indexOf(id);
  if (index >= 0) list.splice(index, 1);
  else list.push(id);
}

function restoreDefault(): void {
  const next = defaultHome();
  // 保留已选的计时器 / 倒数日
  next.timerIds = [...draft.value.timerIds];
  next.countdownIds = [...draft.value.countdownIds];
  next.heroCountdownId = draft.value.heroCountdownId;
  next.heroTheme = draft.value.heroTheme;
  draft.value = next;
}

async function save(): Promise<void> {
  await store.saveHome(draft.value);
  toast('首页布局已保存');
  emit('close');
}
</script>

<template>
  <AppModal :open="open" width="md" @close="emit('close')">
    <template #header>
      <h3>首页布局</h3>
    </template>

    <div class="layout-form">
      <section class="block">
        <div class="block-head">
          <LayoutGrid :size="15" />
          <b>卡片位置与大小</b>
          <span class="block-hint">上移 / 下移只在本栏内生效</span>
        </div>

        <div v-for="group in grouped" :key="group.id" class="group">
          <div class="group-title">
            <span>{{ group.name }}</span>
            <em>{{ group.desc }}</em>
          </div>

          <div
            v-for="card in group.cards"
            :key="card.id"
            class="card-row"
            :class="{ off: !card.visible }"
          >
            <div class="card-info">
              <b>{{ HOME_CARD_META[card.id].name }}</b>
              <span>{{ HOME_CARD_META[card.id].desc }}</span>
            </div>

            <div class="zone-picker">
              <button
                v-for="zone in HOME_ZONES"
                :key="zone.id"
                class="zone-btn"
                :class="{ active: card.zone === zone.id }"
                @click="setZone(card.id, zone.id)"
              >
                {{ zone.name }}
              </button>
            </div>

            <div class="card-actions">
              <button
                class="act"
                :disabled="isFirst(card.id)"
                title="上移"
                @click="move(card.id, -1)"
              >
                <ChevronUp :size="14" />
              </button>
              <button
                class="act"
                :disabled="isLast(card.id)"
                title="下移"
                @click="move(card.id, 1)"
              >
                <ChevronDown :size="14" />
              </button>
              <button
                class="act eye"
                :class="{ on: card.visible }"
                :title="card.visible ? '隐藏' : '显示'"
                @click="toggleVisible(card.id)"
              >
                <Eye v-if="card.visible" :size="14" />
                <EyeOff v-else :size="14" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section class="block">
        <div class="block-head">
          <Palette :size="15" />
          <b>倒数日主卡</b>
        </div>

        <div class="field">
          <label>展示哪个倒数日</label>
          <select
            class="input"
            :value="draft.heroCountdownId ?? ''"
            @change="
              draft.heroCountdownId =
                ($event.target as HTMLSelectElement).value === ''
                  ? null
                  : Number(($event.target as HTMLSelectElement).value)
            "
          >
            <option value="">自动（跟随置顶）</option>
            <option v-for="item in store.data.countdowns" :key="item.id" :value="item.id">
              {{ item.title }}
            </option>
          </select>
          <p v-if="!heroVisible" class="hint-line">主卡当前是隐藏状态，选择不会显示在首页。</p>
        </div>

        <div class="field">
          <label>背景</label>
          <div class="theme-grid">
            <button
              v-for="theme in HERO_THEMES"
              :key="theme.id"
              class="theme-chip"
              :class="{ active: draft.heroTheme === theme.id }"
              @click="pickTheme(theme.id)"
            >
              <span
                class="theme-swatch"
                :style="{
                  background: `linear-gradient(118deg, ${theme.light[0]}, ${theme.light[1]} 52%, ${theme.light[2]})`,
                }"
              />
              <span class="theme-name">{{ theme.name }}</span>
            </button>
          </div>
        </div>
      </section>

      <section v-if="timersVisible" class="block">
        <div class="block-head">
          <Timer :size="15" />
          <b>首页显示哪些计时器</b>
          <span class="block-hint">{{ draft.timerIds.length }} 个</span>
        </div>
        <div v-if="store.customTimers.length" class="chips">
          <button
            v-for="item in store.customTimers"
            :key="item.id"
            class="pick-chip"
            :class="{ on: draft.timerIds.includes(item.id) }"
            @click="toggleId('timerIds', item.id)"
          >
            {{ item.title }}
          </button>
        </div>
        <p v-else class="hint-line">还没有独立计时器，可以先到「计时」页新建。</p>
      </section>

      <section v-if="countdownsVisible" class="block">
        <div class="block-head">
          <Hourglass :size="15" />
          <b>首页显示哪些倒数日</b>
          <span class="block-hint">{{ draft.countdownIds.length }} 个</span>
        </div>
        <div v-if="store.data.countdowns.length" class="chips">
          <button
            v-for="item in store.data.countdowns"
            :key="item.id"
            class="pick-chip"
            :class="{ on: draft.countdownIds.includes(item.id) }"
            @click="toggleId('countdownIds', item.id)"
          >
            {{ item.title }}
          </button>
        </div>
        <p v-else class="hint-line">还没有倒数日，可以先到「倒数日」页添加。</p>
      </section>
    </div>

    <template #footer>
      <button class="btn ghost" @click="restoreDefault">
        <RotateCcw :size="14" /> 恢复默认
      </button>
      <span class="grow" />
      <button class="btn ghost" @click="emit('close')">取消</button>
      <button class="btn primary" @click="save">保存</button>
    </template>
  </AppModal>
</template>

<style scoped>
.layout-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding-bottom: 4px;
}
.block {
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface-2);
  padding: 12px 14px 14px;
}
.block-head {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 10px;
  color: var(--text-2);
}
.block-head b {
  font-size: 13px;
  font-weight: 700;
}
.block-head svg {
  color: var(--primary);
}
.block-hint {
  margin-left: auto;
  font-size: 10.5px;
  color: var(--faint);
}
.group + .group {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--border);
}
.group-title {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 6px;
}
.group-title span {
  font-size: 11px;
  font-weight: 700;
  color: var(--muted);
  letter-spacing: 0.04em;
}
.group-title em {
  font-style: normal;
  font-size: 10px;
  color: var(--faint);
}
.card-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border-radius: 11px;
  background: var(--surface);
  border: 1px solid transparent;
}
.card-row + .card-row {
  margin-top: 5px;
}
.card-row.off {
  opacity: 0.55;
}
.card-info {
  min-width: 0;
  flex: 1;
}
.card-info b {
  display: block;
  font-size: 12.5px;
  font-weight: 650;
  color: var(--text-2);
}
.card-info span {
  font-size: 10px;
  color: var(--faint);
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.zone-picker {
  display: flex;
  padding: 2px;
  border-radius: 9px;
  background: var(--surface-3);
  flex: none;
}
.zone-btn {
  height: 24px;
  padding: 0 8px;
  border-radius: 7px;
  font-size: 10.5px;
  font-weight: 600;
  color: var(--muted);
}
.zone-btn.active {
  background: var(--surface);
  color: var(--primary-strong);
  box-shadow: var(--shadow-xs);
}
.card-actions {
  display: flex;
  gap: 3px;
  flex: none;
}
.act {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  color: var(--muted);
  background: var(--surface-2);
  border: 1px solid var(--border);
}
.act:hover:not(:disabled) {
  color: var(--text);
}
.act:disabled {
  opacity: 0.3;
  pointer-events: none;
}
.act.eye {
  color: var(--faint);
}
.act.eye.on {
  color: var(--success);
  background: var(--success-soft);
  border-color: transparent;
}
.field + .field {
  margin-top: 12px;
}
.field > label {
  display: block;
  font-size: 11.5px;
  font-weight: 650;
  color: var(--muted);
  margin-bottom: 6px;
}
.hint-line {
  margin-top: 6px;
  font-size: 10.5px;
  color: var(--faint);
  line-height: 1.6;
}
.theme-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.theme-chip {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 8px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-2);
}
.theme-chip.active {
  border-color: var(--primary);
  color: var(--primary-strong);
  box-shadow: 0 0 0 2px var(--primary-soft);
}
.theme-swatch {
  width: 22px;
  height: 22px;
  border-radius: 7px;
  flex: none;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.pick-chip {
  height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: 11.5px;
  font-weight: 600;
  color: var(--muted);
}
.pick-chip.on {
  background: var(--primary-soft);
  border-color: transparent;
  color: var(--primary-strong);
}
@media (max-width: 520px) {
  .card-row {
    flex-wrap: wrap;
  }
  .card-info {
    flex-basis: 100%;
  }
  .zone-picker {
    margin-right: auto;
  }
  .theme-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>

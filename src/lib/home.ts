import type {
  HeroTheme,
  HomeCardId,
  HomeCardPref,
  HomeLayout,
  HomeZone,
} from '../types';

export interface HomeCardMeta {
  id: HomeCardId;
  name: string;
  desc: string;
}

export const HOME_CARD_IDS: HomeCardId[] = [
  'hero',
  'stats',
  'segment',
  'tasks',
  'rhythm',
  'timers',
  'countdowns',
];

export const HOME_CARD_META: Record<HomeCardId, HomeCardMeta> = {
  hero: { id: 'hero', name: '倒数日主卡', desc: '大号天数、计划进度与自定义背景' },
  stats: { id: 'stats', name: '今日统计', desc: '任务、节奏与连续天数' },
  segment: { id: 'segment', name: '分段倒计时', desc: '当前时段的秒级时钟' },
  tasks: { id: 'tasks', name: '学习任务', desc: '今天的任务清单' },
  rhythm: { id: 'rhythm', name: '今日节奏', desc: '一天的时间线' },
  timers: { id: 'timers', name: '独立计时器', desc: '把常用的计时器放到首页' },
  countdowns: { id: 'countdowns', name: '倒数日清单', desc: '把关注的目标日放到首页' },
};

export const HOME_ZONES: { id: HomeZone; name: string; desc: string }[] = [
  { id: 'full', name: '整行', desc: '横跨两栏' },
  { id: 'left', name: '左栏', desc: '与右栏并排' },
  { id: 'right', name: '右栏', desc: '与左栏并排' },
];

export const DEFAULT_HOME: HomeLayout = {
  cards: [
    { id: 'hero', visible: true, zone: 'full' },
    { id: 'stats', visible: true, zone: 'full' },
    { id: 'segment', visible: true, zone: 'left' },
    { id: 'tasks', visible: true, zone: 'left' },
    { id: 'rhythm', visible: true, zone: 'right' },
    { id: 'timers', visible: false, zone: 'left' },
    { id: 'countdowns', visible: false, zone: 'left' },
  ],
  heroCountdownId: null,
  heroTheme: 'violet',
  timerIds: [],
  countdownIds: [],
};

export interface HeroThemeMeta {
  id: HeroTheme;
  name: string;
  light: [string, string, string];
  dark: [string, string, string];
  glow: string;
}

export const HERO_THEMES: HeroThemeMeta[] = [
  {
    id: 'violet',
    name: '紫罗兰',
    light: ['#5b4bf0', '#7c5cff', '#a855f7'],
    dark: ['#3f34b8', '#5b46d6', '#7e3fbf'],
    glow: 'rgba(91, 75, 240, 0.5)',
  },
  {
    id: 'sunset',
    name: '日落',
    light: ['#f97316', '#f43f5e', '#a855f7'],
    dark: ['#b45309', '#be123c', '#7e22ce'],
    glow: 'rgba(244, 63, 94, 0.44)',
  },
  {
    id: 'ocean',
    name: '深海',
    light: ['#0ea5e9', '#2563eb', '#4f46e5'],
    dark: ['#0369a1', '#1d4ed8', '#3730a3'],
    glow: 'rgba(37, 99, 235, 0.44)',
  },
  {
    id: 'forest',
    name: '森林',
    light: ['#10b981', '#0d9488', '#0f766e'],
    dark: ['#047857', '#0f766e', '#115e59'],
    glow: 'rgba(13, 148, 136, 0.42)',
  },
  {
    id: 'midnight',
    name: '午夜',
    light: ['#334155', '#3730a3', '#4c1d95'],
    dark: ['#1e293b', '#312e81', '#3b0764'],
    glow: 'rgba(49, 46, 129, 0.55)',
  },
  {
    id: 'sakura',
    name: '樱花',
    light: ['#fb7185', '#f472b6', '#c084fc'],
    dark: ['#be123c', '#be185d', '#7e22ce'],
    glow: 'rgba(244, 114, 182, 0.44)',
  },
];

export function heroThemeMeta(id: HeroTheme): HeroThemeMeta {
  return HERO_THEMES.find((item) => item.id === id) ?? HERO_THEMES[0];
}

export function isHomeCardId(value: unknown): value is HomeCardId {
  return typeof value === 'string' && (HOME_CARD_IDS as string[]).includes(value);
}

export function isHomeZone(value: unknown): value is HomeZone {
  return value === 'full' || value === 'left' || value === 'right';
}

export function isHeroTheme(value: unknown): value is HeroTheme {
  return HERO_THEMES.some((item) => item.id === value);
}

export function defaultHome(): HomeLayout {
  return {
    cards: DEFAULT_HOME.cards.map((card) => ({ ...card })),
    heroCountdownId: null,
    heroTheme: 'violet',
    timerIds: [],
    countdownIds: [],
  };
}

function numberList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const out: number[] = [];
  for (const item of value) {
    const n = typeof item === 'number' ? item : Number(item);
    if (Number.isFinite(n) && n > 0 && !out.includes(Math.round(n))) out.push(Math.round(n));
  }
  return out.slice(0, 50);
}

/** 校验并补全首页布局，缺失的卡片按默认值补回 */
export function normalizeHome(raw: unknown): HomeLayout {
  const record =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : ({} as Record<string, unknown>);
  const source = Array.isArray(record.cards) ? record.cards : [];
  const seen = new Set<HomeCardId>();
  const cards: HomeCardPref[] = [];

  for (const item of source) {
    const entry = item && typeof item === 'object' ? (item as Record<string, unknown>) : null;
    if (!entry || !isHomeCardId(entry.id) || seen.has(entry.id)) continue;
    seen.add(entry.id);
    cards.push({
      id: entry.id,
      visible: entry.visible !== false,
      zone: isHomeZone(entry.zone) ? entry.zone : 'left',
    });
  }

  for (const id of HOME_CARD_IDS) {
    if (seen.has(id)) continue;
    const fallback = DEFAULT_HOME.cards.find((card) => card.id === id);
    if (fallback) cards.push({ ...fallback });
  }

  const heroRaw = record.heroCountdownId;
  const heroCountdownId =
    typeof heroRaw === 'number' && heroRaw > 0 ? Math.round(heroRaw) : null;

  return {
    cards,
    heroCountdownId,
    heroTheme: isHeroTheme(record.heroTheme) ? record.heroTheme : 'violet',
    timerIds: numberList(record.timerIds),
    countdownIds: numberList(record.countdownIds),
  };
}

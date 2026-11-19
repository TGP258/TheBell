import type { Category, CountdownColor } from '../types';

export interface CategoryMeta {
  id: Category;
  name: string;
  color: string;
  soft: string;
}

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  math: { id: 'math', name: '数学', color: 'var(--math)', soft: 'rgba(245, 158, 11, 0.12)' },
  cs408: { id: 'cs408', name: '专业课', color: 'var(--cs408)', soft: 'rgba(99, 102, 241, 0.12)' },
  english: {
    id: 'english',
    name: '英语',
    color: 'var(--english)',
    soft: 'rgba(6, 182, 212, 0.12)',
  },
  politics: {
    id: 'politics',
    name: '政治',
    color: 'var(--politics)',
    soft: 'rgba(236, 72, 153, 0.12)',
  },
  other: { id: 'other', name: '其他', color: 'var(--other)', soft: 'rgba(139, 139, 147, 0.12)' },
};

export const CATEGORY_LIST: Category[] = ['math', 'cs408', 'english', 'politics', 'other'];

export function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && value in CATEGORY_META;
}

export interface CountdownTheme {
  from: string;
  to: string;
  soft: string;
}

export const COUNTDOWN_THEMES: Record<CountdownColor, CountdownTheme> = {
  violet: { from: '#5b4bf0', to: '#a855f7', soft: 'rgba(98, 87, 245, 0.12)' },
  amber: { from: '#d97706', to: '#f59e0b', soft: 'rgba(245, 158, 11, 0.14)' },
  cyan: { from: '#0891b2', to: '#22d3ee', soft: 'rgba(6, 182, 212, 0.14)' },
  pink: { from: '#db2777', to: '#f472b6', soft: 'rgba(236, 72, 153, 0.14)' },
  green: { from: '#059669', to: '#34d399', soft: 'rgba(16, 185, 129, 0.14)' },
};

export const COUNTDOWN_COLORS: CountdownColor[] = ['violet', 'amber', 'cyan', 'pink', 'green'];

export function isCountdownColor(value: unknown): value is CountdownColor {
  return typeof value === 'string' && value in COUNTDOWN_THEMES;
}

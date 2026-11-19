import { ref } from 'vue';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  text: string;
  type: ToastType;
}

export const toasts = ref<ToastItem[]>([]);

let seq = 0;

export function toast(text: string, type: ToastType = 'success'): void {
  seq += 1;
  const id = seq;
  toasts.value.push({ id, text, type });
  window.setTimeout(() => {
    toasts.value = toasts.value.filter((item) => item.id !== id);
  }, 2600);
}

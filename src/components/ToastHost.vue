<script setup lang="ts">
import { AlertCircle, CheckCircle2, Info } from 'lucide-vue-next';
import { toasts } from '../lib/toast';
</script>

<template>
  <Teleport to="body">
    <div class="toast-host" aria-live="polite">
      <TransitionGroup name="toast">
        <div v-for="item in toasts" :key="item.id" class="toast" :class="item.type">
          <CheckCircle2 v-if="item.type === 'success'" :size="17" />
          <AlertCircle v-else-if="item.type === 'error'" :size="17" />
          <Info v-else :size="17" />
          <span>{{ item.text }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-host {
  position: fixed;
  left: 50%;
  bottom: calc(26px + env(safe-area-inset-bottom));
  transform: translateX(-50%);
  z-index: 200;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
  width: max-content;
  max-width: calc(100vw - 32px);
}
.toast {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 11px 16px;
  border-radius: 14px;
  background: #17171c;
  color: #f7f7fa;
  font-size: 13.5px;
  font-weight: 500;
  box-shadow: 0 14px 38px -12px rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(10px);
}
.toast.success svg {
  color: #4ade80;
}
.toast.error svg {
  color: #f87171;
}
.toast.info svg {
  color: #93c5fd;
}
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.22s ease, transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.96);
}
@media (max-width: 1023px) {
  .toast-host {
    bottom: calc(88px + env(safe-area-inset-bottom));
  }
}
</style>

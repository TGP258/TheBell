<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue';
import { X } from 'lucide-vue-next';
import { closeModal, isTopModal, nextModalId, openModal } from '../lib/ui';

const props = defineProps<{
  open: boolean;
  title?: string;
  width?: 'sm' | 'md' | 'lg';
}>();

const emit = defineEmits<{ close: [] }>();
const id = nextModalId();

watch(
  () => props.open,
  (open) => {
    if (open) openModal(id);
    else closeModal(id);
  },
  { immediate: true }
);

onBeforeUnmount(() => closeModal(id));

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && props.open && isTopModal(id)) {
    event.preventDefault();
    emit('close');
  }
}

window.addEventListener('keydown', onKeydown);
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="modal-root" role="presentation">
        <div class="modal-backdrop" @click="emit('close')" />
        <div
          class="modal-panel"
          :class="`w-${width || 'md'}`"
          role="dialog"
          aria-modal="true"
        >
          <header class="modal-head">
            <slot name="header">
              <h3>{{ title }}</h3>
            </slot>
            <button class="icon-btn modal-x" aria-label="关闭" @click="emit('close')">
              <X :size="19" />
            </button>
          </header>
          <div class="modal-body">
            <slot />
          </div>
          <footer v-if="$slots.footer" class="modal-foot">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-root {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 26px;
}

.modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(12, 12, 18, 0.46);
  backdrop-filter: blur(7px);
  -webkit-backdrop-filter: blur(7px);
}

.modal-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-height: 88dvh;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 24px;
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}
.modal-panel.w-sm {
  max-width: 430px;
}
.modal-panel.w-md {
  max-width: 560px;
}
.modal-panel.w-lg {
  max-width: 760px;
}

.modal-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 22px 14px;
  flex: none;
}
.modal-head :deep(h3) {
  flex: 1;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.015em;
}
.modal-x {
  margin-left: auto;
  margin-right: -6px;
}
.modal-body {
  padding: 4px 22px 22px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.modal-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 20px calc(16px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--border);
  background: var(--surface);
  flex: none;
}
.modal-foot :deep(.grow) {
  flex: 1;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.22s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-active .modal-panel {
  transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.22s ease;
}
.modal-leave-active .modal-panel {
  transition: transform 0.18s ease, opacity 0.18s ease;
}
.modal-enter-from .modal-panel {
  transform: translateY(14px) scale(0.975);
  opacity: 0;
}
.modal-leave-to .modal-panel {
  transform: translateY(8px) scale(0.99);
  opacity: 0;
}

@media (max-width: 640px) {
  .modal-root {
    padding: 0;
    align-items: flex-end;
  }
  .modal-panel {
    max-width: 100%;
    max-height: 92dvh;
    border-radius: 24px 24px 0 0;
    border-bottom: none;
  }
  .modal-head {
    padding: 18px 18px 12px;
  }
  .modal-body {
    padding: 4px 18px 20px;
  }
  .modal-enter-from .modal-panel {
    transform: translateY(100%);
  }
  .modal-leave-to .modal-panel {
    transform: translateY(100%);
  }
}
</style>

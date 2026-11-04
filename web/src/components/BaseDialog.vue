<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';

const props = defineProps<{ open: boolean; wide?: boolean }>();
const emit = defineEmits<{ close: [] }>();

const dialog = ref<HTMLDialogElement>();

function sync(): void {
  const el = dialog.value;
  if (!el) return;
  if (props.open && !el.open) el.showModal();
  if (!props.open && el.open) el.close();
}

watch(() => props.open, sync);
onMounted(sync);
</script>

<template>
  <!-- Échap ferme le dialog natif : on prévient le parent via l'événement close. -->
  <dialog ref="dialog" :class="{ wide }" @close="emit('close')">
    <slot v-if="open" />
  </dialog>
</template>

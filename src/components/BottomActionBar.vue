<script setup>
import { useI18n } from '../composables/useI18n'

defineProps({
  selectedCount: { type: Number, required: true },
})

defineEmits(['clear', 'open-compare'])
const { t } = useI18n()
</script>

<template>
  <div class="floating-bar">
    <button class="floating-action primary" :disabled="selectedCount === 0" @click="$emit('open-compare')">
      <span class="material-symbols-outlined">compare_arrows</span>
      {{ t('actions.compare') }}
      <span class="floating-count">{{ selectedCount }}</span>
    </button>

    <button class="floating-action" :disabled="selectedCount === 0" @click="$emit('clear')">
      <span class="material-symbols-outlined">delete_sweep</span>
      {{ t('actions.clear') }}
    </button>
  </div>
</template>

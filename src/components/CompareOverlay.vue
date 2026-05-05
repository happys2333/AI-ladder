<script setup>
import CompareDrawer from './CompareDrawer.vue'
import { useI18n } from '../composables/useI18n'

defineProps({
  categories: { type: Array, required: true },
  regions: { type: Array, required: true },
  models: { type: Array, required: true },
  activeCategory: { type: String, required: true },
  visible: { type: Boolean, required: true },
})

const emit = defineEmits(['clear', 'close'])
const { t } = useI18n()
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="compare-overlay" @click="emit('close')">
      <div class="compare-float-panel" @click.stop>
        <div class="compare-floating-head">
          <div>
            <p class="hero-kicker">{{ t('compare.kicker') }}</p>
            <h2>{{ t('compare.floatingTitle') }}</h2>
          </div>

          <button class="icon-button" @click="emit('close')">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <CompareDrawer
          :categories="categories"
          :regions="regions"
          :models="models"
          :active-category="activeCategory"
          @clear="emit('clear')"
        />
      </div>
    </div>
  </Teleport>
</template>

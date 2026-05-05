<script setup>
import { useI18n } from '../composables/useI18n'

defineProps({
  model: { type: Object, default: null },
  categories: { type: Array, required: true },
  regions: { type: Array, required: true },
  visible: { type: Boolean, required: true },
})

const emit = defineEmits(['close'])

const { t, translateCategoryLabel, translateRegionLabel } = useI18n()

function barWidth(score) {
  return `${Math.max(8, score)}%`
}

function regionLabel(regions, key) {
  return translateRegionLabel(key, regions.find((region) => region.key === key)?.label ?? key)
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible && model" class="drawer-overlay" @click="emit('close')">
      <aside class="detail-drawer" @click.stop>
        <div class="drawer-head">
          <div>
            <p class="hero-kicker">{{ t('detail.profile') }}</p>
            <h2>{{ model.name }}</h2>
            <p class="drawer-subtitle">{{ model.vendor }} · {{ regionLabel(regions, model.region) }}</p>
          </div>

          <button class="icon-button" @click="emit('close')">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <div class="drawer-section">
          <div class="drawer-summary">{{ model.summary }}</div>
          <div class="tag-row">
            <span v-for="tag in model.tags" :key="tag" class="spec-tag">{{ tag }}</span>
          </div>
        </div>

        <div class="drawer-stats-grid">
          <div class="stat-card compact">
            <span>{{ t('detail.inputPrice') }}</span>
            <strong>{{ model.pricing }}</strong>
          </div>
          <div class="stat-card compact">
            <span>{{ t('detail.responseLatency') }}</span>
            <strong>{{ model.latency }}</strong>
          </div>
          <div class="stat-card compact">
            <span>{{ t('detail.overallScore') }}</span>
            <strong>{{ model.scores.overall?.toFixed(1) ?? '-' }}</strong>
          </div>
        </div>

        <div class="drawer-section">
          <div class="drawer-block-title">{{ t('detail.multiScore') }}</div>
          <div class="benchmark-list">
            <div v-for="category in categories" :key="category.key" class="benchmark-row">
              <span>{{ translateCategoryLabel(category.key, category.label) }}</span>
              <div class="bar-track">
                <div class="bar-fill" :style="{ width: barWidth(model.scores[category.key]) }"></div>
              </div>
              <strong>{{ model.scores[category.key].toFixed(1) }}</strong>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </Teleport>
</template>

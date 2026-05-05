<script setup>
import { useI18n } from '../composables/useI18n'

defineProps({
  categories: { type: Array, required: true },
  regions: { type: Array, required: true },
  models: { type: Array, required: true },
  activeCategory: { type: String, required: true },
})

defineEmits(['clear'])

const { t, translateCategoryLabel, translateRegionLabel } = useI18n()

function barWidth(score) {
  return `${Math.max(8, score)}%`
}

function regionLabel(regions, key) {
  return translateRegionLabel(key, regions.find((region) => region.key === key)?.label ?? key)
}
</script>

<template>
  <section class="compare-panel">
    <div class="compare-header">
      <div>
        <p class="hero-kicker">{{ t('compare.kicker') }}</p>
        <h2>{{ t('compare.title') }}</h2>
      </div>

      <button class="ghost-action" @click="$emit('clear')">{{ t('compare.clear') }}</button>
    </div>

    <div v-if="models.length" class="compare-grid">
      <article v-for="model in models" :key="model.id" class="compare-card">
        <div class="compare-card-head">
          <div>
            <h3>{{ model.name }}</h3>
            <p>{{ model.vendor }} · {{ regionLabel(regions, model.region) }}</p>
          </div>
          <div class="mono-score">{{ model.scores[activeCategory].toFixed(1) }}</div>
        </div>

        <div class="mini-metrics">
          <div>
            <span>{{ t('compare.price') }}</span>
            <strong>{{ model.pricing }}</strong>
          </div>
          <div>
            <span>{{ t('compare.latency') }}</span>
            <strong>{{ model.latency }}</strong>
          </div>
        </div>

        <div class="benchmark-list">
          <div v-for="category in categories" :key="category.key" class="benchmark-row">
            <span>{{ translateCategoryLabel(category.key, category.label) }}</span>
            <div class="bar-track">
              <div class="bar-fill" :style="{ width: barWidth(model.scores[category.key]) }"></div>
            </div>
            <strong>{{ model.scores[category.key].toFixed(1) }}</strong>
          </div>
        </div>
      </article>
    </div>

    <div v-else class="compare-empty">
      {{ t('compare.empty') }}
    </div>
  </section>
</template>

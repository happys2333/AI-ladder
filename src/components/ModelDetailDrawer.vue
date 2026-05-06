<script setup>
import { useI18n } from '../composables/useI18n'

defineProps({
  model: { type: Object, default: null },
  categories: { type: Array, required: true },
  regions: { type: Array, required: true },
  visible: { type: Boolean, required: true },
})

const emit = defineEmits(['close'])

const { locale, t, translateCategoryLabel, translateRegionLabel, localizeText } = useI18n()

function barWidth(score) {
  return `${Math.max(8, score)}%`
}

function regionLabel(regions, key) {
  return translateRegionLabel(key, regions.find((region) => region.key === key)?.label ?? key)
}

function formatPrice(value) {
  return typeof value === 'number' && !Number.isNaN(value) ? `$${value.toFixed(2)} / 1M` : 'N/A'
}

function formatLatency(value) {
  return typeof value === 'number' && !Number.isNaN(value) ? `${value.toFixed(2)}s` : 'N/A'
}

function formatSpeed(value) {
  return typeof value === 'number' && !Number.isNaN(value) ? `${value.toFixed(2)} tok/s` : 'N/A'
}

function formatCategoryValue(categoryKey, value) {
  if (categoryKey === 'price') return `$${value.toFixed(2)} / 1M`
  if (categoryKey === 'speed') return `${value.toFixed(2)} tok/s`
  return value.toFixed(1)
}

function displayModelSummary(summary) {
  if (typeof summary !== 'string') return ''

  if (locale.value === 'zh-CN') {
    return summary.replaceAll('智能指数', '综合指数')
  }

  return summary.replaceAll('Intelligence', 'Overall Index')
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
          <div class="drawer-summary">{{ displayModelSummary(model.summary) }}</div>
          <div class="tag-row">
            <span v-for="tag in model.tags" :key="tag" class="spec-tag">{{ tag }}</span>
          </div>
        </div>

        <div class="drawer-stats-grid">
          <div class="stat-card compact">
            <span>{{ t('detail.blendedPrice') }}</span>
            <strong>{{ model.pricing }}</strong>
          </div>
          <div class="stat-card compact">
            <span>{{ t('detail.responseLatency') }}</span>
            <strong>{{ formatLatency(model.meta?.timeToFirstTokenSeconds) }}</strong>
          </div>
          <div class="stat-card compact">
            <span>{{ t('detail.firstAnswerLatency') }}</span>
            <strong>{{ formatLatency(model.meta?.timeToFirstAnswerTokenSeconds) }}</strong>
          </div>
          <div class="stat-card compact">
            <span>{{ t('detail.outputSpeed') }}</span>
            <strong>{{ formatSpeed(model.meta?.tokensPerSecond) }}</strong>
          </div>
          <div class="stat-card compact">
            <span>{{ t('detail.inputPrice') }}</span>
            <strong>{{ formatPrice(model.meta?.inputPrice) }}</strong>
          </div>
          <div class="stat-card compact">
            <span>{{ t('detail.outputPrice') }}</span>
            <strong>{{ formatPrice(model.meta?.outputPrice) }}</strong>
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
              <strong>{{ formatCategoryValue(category.key, model.scores[category.key]) }}</strong>
            </div>
          </div>
        </div>

        <div class="drawer-section">
          <div class="drawer-block-title">{{ t('detail.codingPlans') }}</div>
          <div v-if="model.codingPlans?.length" class="benchmark-list">
            <div v-for="plan in model.codingPlans" :key="`${plan.providerName}-${localizeText(plan.name, localizeText(plan.price))}`" class="benchmark-row">
              <span>{{ plan.providerName }} · {{ localizeText(plan.name) }}</span>
              <div class="bar-track">
                <div class="bar-fill" style="width: 100%"></div>
              </div>
              <strong>{{ localizeText(plan.price) || localizeText(plan.limits) || '-' }}</strong>
            </div>
            <div v-for="plan in model.codingPlans" :key="`${plan.providerName}-${localizeText(plan.name, localizeText(plan.price))}-notes`" class="drawer-summary">
              {{ localizeText(plan.access) || '' }}{{ localizeText(plan.access) && localizeText(plan.limits) ? ' · ' : '' }}{{ localizeText(plan.limits) || '' }}{{ (localizeText(plan.access) || localizeText(plan.limits)) && localizeText(plan.notes) ? ' · ' : '' }}{{ localizeText(plan.notes) || '' }}
              <template v-if="plan.source">
                · {{ t('detail.providerSource') }}: {{ plan.source }}
              </template>
            </div>
          </div>
          <div v-else class="drawer-summary">{{ t('detail.codingPlansEmpty') }}</div>
        </div>
      </aside>
    </div>
  </Teleport>
</template>

<script setup>
import { useI18n } from '../composables/useI18n'

defineProps({
  title: { type: String, required: true },
  stats: { type: Object, required: true },
  lastUpdated: { type: String, default: '' },
  source: { type: Object, default: null },
  leaderboardStats: { type: Object, default: () => ({}) },
  activeCategory: { type: String, required: true },
  isPriceAscending: { type: Boolean, default: true },
})

defineEmits(['toggle-price-sort'])

function formatUpdateTime(value) {
  if (!value) return '未提供'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat(locale.value, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const { locale, t } = useI18n()
</script>

<template>
  <section class="hero-panel">
    <div>
      <p class="hero-kicker">{{ title }} {{ t('hero.board') }}</p>
      <h1>{{ t('hero.title') }}</h1>
      <p class="hero-updated">{{ t('hero.source') }}: {{ source?.label ?? t('hero.notProvided') }}</p>
      <p class="hero-updated">{{ t('hero.updated') }}: {{ formatUpdateTime(lastUpdated) }}</p>
    </div>

    <div v-if="activeCategory === 'price'" class="hero-actions">
      <button class="ghost-action" @click="$emit('toggle-price-sort')">
        {{ isPriceAscending ? t('hero.priceAsc') : t('hero.priceDesc') }}
      </button>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <span>{{ t('hero.leader') }}</span>
        <strong>{{ stats.leader }}</strong>
      </div>
      <div class="stat-card">
        <span>{{ t('hero.avg') }}</span>
        <strong>{{ stats.avg }}</strong>
      </div>
      <div class="stat-card">
        <span>{{ t('hero.spread') }}</span>
        <strong>{{ stats.spread }}</strong>
      </div>
      <div class="stat-card">
        <span>{{ t('hero.totalModels') }}</span>
        <strong>{{ leaderboardStats.totalModels ?? '-' }}</strong>
      </div>
    </div>
  </section>
</template>

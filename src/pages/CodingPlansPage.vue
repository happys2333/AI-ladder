<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from '../composables/useI18n'
import { fetchCodingPlansData, fetchExchangeRatesData } from '../services/leaderboardService'

const { locale, t, localizeText } = useI18n()

const isLoading = ref(true)
const lastUpdated = ref('')
const providers = ref([])
const expandedProvider = ref('')
const exchangeRates = ref(null)

function formatUpdateTime(value) {
  if (!value) return t('hero.notProvided')

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

function formatFxRate(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return t('hero.notProvided')

  return new Intl.NumberFormat(locale.value, {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(value)
}

function inferStartingPrice(plans) {
  const prices = plans
    .map((plan) => {
      const match = plan.price.match(/([$¥￥])\s?([0-9]+(?:\.[0-9]+)?)/)
      return match ? { symbol: match[1] === '￥' ? '¥' : match[1], value: Number(match[2]) } : null
    })
    .filter((entry) => entry && Number.isFinite(entry.value))

  if (!prices.length) return ''

  const currencyGroups = prices.reduce((groups, entry) => {
    groups[entry.symbol] = groups[entry.symbol] || []
    groups[entry.symbol].push(entry.value)
    return groups
  }, {})

  const [symbol, values] = Object.entries(currencyGroups).sort((a, b) => b[1].length - a[1].length)[0] || []
  if (!symbol || !values?.length) return ''

  return `${symbol}${Math.min(...values)}`
}

function localizedText(value, fallback = '') {
  return localizeText(value, fallback)
}

function toggleProvider(providerSlug) {
  expandedProvider.value = expandedProvider.value === providerSlug ? '' : providerSlug
}

function getSourceHostname(source) {
  if (!source) return ''

  try {
    return new URL(source).hostname.replace(/^www\./, '')
  } catch {
    return source
  }
}

const providerSummaries = computed(() => {
  return providers.value.map((provider) => ({
    ...provider,
    startingPrice: inferStartingPrice(provider.plans),
  }))
})

async function loadPlans() {
  isLoading.value = true

  try {
    const [payload, ratesPayload] = await Promise.all([
      fetchCodingPlansData(),
      fetchExchangeRatesData().catch(() => null),
    ])

    providers.value = payload.providers ?? []
    lastUpdated.value = payload.lastUpdated ?? ''
    expandedProvider.value = payload.providers?.[0]?.providerSlug ?? ''
    exchangeRates.value = ratesPayload
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadPlans()
})
</script>

<template>
  <main class="coding-plans-shell">
    <section class="coding-plans-hero">
      <div>
        <p class="hero-kicker">{{ t('plans.kicker') }}</p>
        <h1>{{ t('plans.title') }}</h1>
        <p class="coding-plans-copy">{{ t('plans.subtitle') }}</p>
      </div>

      <div class="coding-plans-meta">
        <div class="stat-card compact">
          <span>{{ t('plans.updated') }}</span>
          <strong>{{ formatUpdateTime(lastUpdated) }}</strong>
        </div>
        <div class="stat-card compact">
          <span>{{ t('plans.scope') }}</span>
          <strong>{{ t('plans.scopeValue') }}</strong>
        </div>
        <div class="stat-card compact">
          <span>{{ t('plans.fxRate') }}<template v-if="exchangeRates?.date"> · {{ exchangeRates.date }}</template></span>
          <strong>{{ exchangeRates?.pairs?.USD_CNY ? `¥${formatFxRate(exchangeRates.pairs.USD_CNY)}` : t('hero.notProvided') }}</strong>
        </div>
      </div>
    </section>

    <section v-if="isLoading" class="compare-empty">{{ t('plans.loading') }}</section>

    <section v-else class="provider-list">
      <article
        v-for="provider in providerSummaries"
        :key="provider.providerSlug"
        class="provider-card"
        :class="{ 'provider-card--open': expandedProvider === provider.providerSlug }"
      >
        <button class="provider-trigger" @click="toggleProvider(provider.providerSlug)">
          <div class="provider-trigger-copy">
            <p class="provider-kicker">{{ localizedText(provider.productName, provider.providerName) || provider.providerName }}</p>
            <h2>{{ provider.providerName }}</h2>
            <p class="provider-summary">{{ localizedText(provider.summary) }}</p>
          </div>

          <div class="provider-trigger-meta">
            <span class="tier-chip">{{ provider.plans.length }} {{ t('plans.planCount') }}</span>
            <span v-if="provider.startingPrice" class="tier-chip">{{ t('plans.startsAt') }} {{ provider.startingPrice }}</span>
            <span class="material-symbols-outlined provider-trigger-icon">
              {{ expandedProvider === provider.providerSlug ? 'remove' : 'add' }}
            </span>
          </div>
        </button>

        <Transition name="plan-accordion">
          <div v-if="expandedProvider === provider.providerSlug" class="provider-body">
            <div class="provider-body-head">
              <p class="provider-body-notes">{{ localizedText(provider.notes) }}</p>
              <a
                v-if="provider.source"
                class="provider-source-link"
                :href="provider.source"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ t('plans.officialSource') }} · {{ getSourceHostname(provider.source) }}
              </a>
            </div>

            <div class="plans-grid">
              <article v-for="plan in provider.plans" :key="`${provider.providerSlug}-${localizedText(plan.name, plan.price)}`" class="plan-card">
                <div class="plan-card-head">
                  <div>
                    <p class="provider-kicker">{{ localizedText(plan.audience) || localizedText(plan.seats) || t('plans.generalAudience') }}</p>
                    <h3>{{ localizedText(plan.name) }}</h3>
                  </div>
                  <strong class="plan-price">{{ plan.price }}</strong>
                </div>

                <div class="plan-detail-grid">
                  <div class="plan-detail">
                    <span>{{ t('plans.cadence') }}</span>
                    <strong>{{ localizedText(plan.cadence) || '-' }}</strong>
                  </div>
                  <div class="plan-detail">
                    <span>{{ t('plans.seats') }}</span>
                    <strong>{{ localizedText(plan.seats) || '-' }}</strong>
                  </div>
                  <div class="plan-detail">
                    <span>{{ t('plans.access') }}</span>
                    <strong>{{ localizedText(plan.access) || '-' }}</strong>
                  </div>
                  <div class="plan-detail">
                    <span>{{ t('plans.limits') }}</span>
                    <strong>{{ localizedText(plan.limits) || '-' }}</strong>
                  </div>
                </div>

                <p v-if="localizedText(plan.notes)" class="plan-notes">{{ localizedText(plan.notes) }}</p>
              </article>
            </div>
          </div>
        </Transition>
      </article>
    </section>
  </main>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useI18n } from '../composables/useI18n'

const props = defineProps({
  models: { type: Array, required: true },
  category: { type: String, required: true },
  embedded: { type: Boolean, default: false },
})

const { locale, t, translateCategoryLabel } = useI18n()

const hoveredPoint = ref(null)

function getReleaseMonth(model) {
  return model.meta?.releaseYearMonth ?? model.releaseYearMonth ?? null
}

function getScore(model) {
  const value = model?.scores?.[props.category]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function isBetterScore(nextScore, currentScore) {
  if (currentScore === null) return true
  return props.category === 'price' ? nextScore < currentScore : nextScore > currentScore
}

function buildMonthRange(startMonth, endMonth) {
  if (!startMonth || !endMonth) return []

  const [startYear, startRawMonth] = startMonth.split('-').map(Number)
  const [endYear, endRawMonth] = endMonth.split('-').map(Number)
  const months = []

  let year = startYear
  let month = startRawMonth

  while (year < endYear || (year === endYear && month <= endRawMonth)) {
    months.push(`${year}-${String(month).padStart(2, '0')}`)
    month += 1

    if (month > 12) {
      year += 1
      month = 1
    }
  }

  return months
}

function formatMonthLabel(value) {
  if (!value) return ''

  const date = new Date(`${value}-01T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat(locale.value, {
    year: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(date)
}

function formatScore(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'

  if (props.category === 'price') {
    return `$${value.toFixed(2)}`
  }

  return value.toFixed(1)
}

const monthlyLeaders = computed(() => {
  const leadersByMonth = new Map()

  props.models.forEach((model) => {
    const month = getReleaseMonth(model)
    const score = getScore(model)

    if (!month || score === null) return
    if (props.category === 'price' && score <= 0) return

    const current = leadersByMonth.get(month) ?? null

    if (!current || isBetterScore(score, current.score)) {
      leadersByMonth.set(month, {
        month,
        modelId: model.id,
        modelName: model.name,
        score,
      })
    }
  })

  const months = Array.from(leadersByMonth.keys()).sort((a, b) => a.localeCompare(b))
  if (!months.length) return []

  let bestSoFar = null

  return buildMonthRange(months[0], months[months.length - 1]).map((month) => {
    const monthlyLeader = leadersByMonth.get(month) ?? null

    if (monthlyLeader && (!bestSoFar || isBetterScore(monthlyLeader.score, bestSoFar.score))) {
      bestSoFar = monthlyLeader
    }

    return {
      month,
      label: formatMonthLabel(month),
      modelId: bestSoFar?.modelId ?? '',
      modelName: bestSoFar?.modelName ?? '',
      score: bestSoFar?.score ?? null,
    }
  })
})

const chartConfig = computed(() => {
  const entries = monthlyLeaders.value
  const scoredEntries = entries.filter(entry => typeof entry.score === 'number')

  if (!scoredEntries.length) {
    return {
      width: 720,
      height: 260,
      axisTop: '-',
      axisBottom: '-',
      entries,
      path: '',
      gridLines: [],
      labelStep: 1,
    }
  }

  const width = Math.max(720, entries.length * 56)
  const height = 260
  const padding = { top: 16, right: 16, bottom: 38, left: 16 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const scores = scoredEntries.map(entry => entry.score)
  const minScore = Math.min(...scores)
  const maxScore = Math.max(...scores)
  const labelStep = entries.length > 30 ? 3 : entries.length > 18 ? 2 : 1

  const getX = (index) => {
    if (entries.length <= 1) return padding.left + plotWidth / 2
    return padding.left + (plotWidth * index) / (entries.length - 1)
  }

  const getY = (score) => {
    if (maxScore === minScore) return padding.top + plotHeight / 2

    if (props.category === 'price') {
      return padding.top + ((score - minScore) / (maxScore - minScore)) * plotHeight
    }

    return padding.top + ((maxScore - score) / (maxScore - minScore)) * plotHeight
  }

  const points = entries.map((entry, index) => ({
    ...entry,
    index,
    x: getX(index),
    y: typeof entry.score === 'number' ? getY(entry.score) : null,
    showLabel: index % labelStep === 0 || index === entries.length - 1,
  }))

  const path = points
    .filter(point => point.y !== null)
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')

  return {
    width,
    height,
    axisTop: formatScore(props.category === 'price' ? minScore : maxScore),
    axisBottom: formatScore(props.category === 'price' ? maxScore : minScore),
    entries: points,
    path,
    gridLines: [0, 0.25, 0.5, 0.75, 1].map((ratio) => padding.top + plotHeight * ratio),
    labelStep,
  }
})

function handlePointHover(point, event) {
  const clientX = Number.isFinite(event?.clientX) ? event.clientX : window.innerWidth / 2
  const clientY = Number.isFinite(event?.clientY) ? event.clientY : window.innerHeight / 2

  hoveredPoint.value = {
    ...point,
    left: clientX + 14,
    top: clientY - 14,
  }
}

function clearHoveredPoint() {
  hoveredPoint.value = null
}
</script>

<template>
  <section class="trend-panel" :class="{ 'trend-panel--embedded': embedded }">
    <div class="trend-panel-head">
      <div>
        <p class="hero-kicker">{{ translateCategoryLabel(category, category) }}</p>
        <h2>{{ t('hero.trendTitle') }}</h2>
      </div>
      <div class="trend-axis-summary">
        <span>{{ chartConfig.axisTop }}</span>
        <span>{{ chartConfig.axisBottom }}</span>
      </div>
    </div>

    <div v-if="!chartConfig.entries.some((entry) => typeof entry.score === 'number')" class="trend-empty">
      {{ t('hero.trendEmpty') }}
    </div>

    <div v-else class="trend-chart-shell">
      <div class="trend-chart-scroll">
        <svg
          class="trend-chart"
          :viewBox="`0 0 ${chartConfig.width} ${chartConfig.height}`"
          :style="{ width: `${chartConfig.width}px`, height: `${chartConfig.height}px` }"
          role="img"
          :aria-label="t('hero.trendTitle')"
        >
          <defs>
            <linearGradient id="trendGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#00e5ff" />
              <stop offset="100%" stop-color="#00ff66" />
            </linearGradient>
          </defs>

          <g class="trend-grid">
            <line
              v-for="gridLine in chartConfig.gridLines"
              :key="gridLine"
              x1="16"
              :x2="chartConfig.width - 16"
              :y1="gridLine"
              :y2="gridLine"
            />
          </g>

          <path :d="chartConfig.path" class="trend-line" />

          <g
            v-for="entry in chartConfig.entries"
            :key="entry.month"
            class="trend-entry"
            @focusin="entry.y !== null && handlePointHover(entry, $event)"
            @focusout="clearHoveredPoint"
          >
            <line
              class="trend-month-tick"
              :x1="entry.x"
              :x2="entry.x"
              :y1="chartConfig.height - 32"
              :y2="chartConfig.height - 26"
            />

            <text
              v-if="entry.showLabel"
              class="trend-month-label"
              :x="entry.x"
              :y="chartConfig.height - 10"
              text-anchor="middle"
            >
              {{ entry.label }}
            </text>

            <circle
              v-if="entry.y !== null"
              class="trend-point-hitbox"
              :cx="entry.x"
              :cy="entry.y"
              r="14"
              @mouseenter="handlePointHover(entry, $event)"
              @mousemove="handlePointHover(entry, $event)"
              @mouseleave="clearHoveredPoint"
            />

            <circle
              v-if="entry.y !== null"
              class="trend-point"
              :class="{ 'trend-point--active': hoveredPoint?.month === entry.month }"
              :cx="entry.x"
              :cy="entry.y"
              r="5.5"
              tabindex="0"
            />
          </g>
        </svg>
      </div>
    </div>

    <div
      v-if="hoveredPoint"
      class="trend-tooltip"
      :style="{ left: `${hoveredPoint.left}px`, top: `${hoveredPoint.top}px` }"
    >
      <strong>{{ hoveredPoint.modelName }}</strong>
      <span>{{ hoveredPoint.label }} · {{ formatScore(hoveredPoint.score) }}</span>
    </div>
  </section>
</template>

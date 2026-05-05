<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from '../composables/useI18n'

const props = defineProps({
  models: { type: Array, required: true },
  regions: { type: Array, required: true },
  category: { type: String, required: true },
  compareMode: { type: String, required: true },
  selectedIds: { type: Array, required: true },
})

const emit = defineEmits(['toggle-model', 'open-model'])
const { translateRegionLabel } = useI18n()

const cardElements = new Map()
const referenceScore = ref(0)

const visibleModels = computed(() => {
  return props.models.map((model, globalIndex) => ({
    ...model,
    globalRank: globalIndex + 1,
    totalCount: props.models.length,
  }))
})

const groupConfig = computed(() => {
  if (props.compareMode === 'openness') {
    return {
      left: { key: 'open', label: translateRegionLabel('open', 'Open Models'), accentClass: 'cyan' },
      right: { key: 'other', label: translateRegionLabel('other', 'Other Models'), accentClass: 'green' },
    }
  }

  return {
    left: {
      key: props.regions[0]?.key ?? 'left',
      label: translateRegionLabel(props.regions[0]?.key ?? 'left', props.regions[0]?.label ?? 'Left'),
      accentClass: 'cyan',
    },
    right: {
      key: props.regions[1]?.key ?? 'right',
      label: translateRegionLabel(props.regions[1]?.key ?? 'right', props.regions[1]?.label ?? 'Right'),
      accentClass: 'green',
    },
  }
})

const rankedRows = computed(() => {
  return visibleModels.value.map((model) => {
    const side = props.compareMode === 'openness'
      ? model.openness === 'open' ? 'left' : 'right'
      : model.region === groupConfig.value.left.key ? 'left' : 'right'

    return {
      key: model.id,
      leftModel: side === 'left' ? model : null,
      rightModel: side === 'right' ? model : null,
    }
  })
})

const axisLabels = computed(() => {
  const values = visibleModels.value.map((model) => model.scores[props.category]).filter((value) => typeof value === 'number')

  if (!values.length) {
    return { top: '0.0', bottom: '0.0' }
  }

  const max = Math.max(...values)
  const min = Math.min(...values)

  return {
    top: max.toFixed(1),
    bottom: min.toFixed(1),
  }
})

function setCardElement(modelId, element) {
  if (element) {
    cardElements.set(modelId, element)
    return
  }

  cardElements.delete(modelId)
}

function getRelativePercent(score) {
  if (!referenceScore.value) return '100%'
  return `${Math.round((score / referenceScore.value) * 100)}%`
}

function getRelativeScale(score) {
  if (!referenceScore.value) return 1

  const ratio = score / referenceScore.value
  return Math.max(0.44, Math.min(1, Number((0.44 + 0.56 * Math.pow(ratio, 4)).toFixed(3))))
}

function getTier(globalRank, totalCount) {
  if (!totalCount) return { label: 'B', className: 'tier-b' }

  const percentile = globalRank / totalCount

  if (percentile <= 0.01) return { label: 'SSS', className: 'tier-sss' }
  if (percentile <= 0.05) return { label: 'SS', className: 'tier-ss' }
  if (percentile <= 0.1) return { label: 'S', className: 'tier-s' }
  if (percentile <= 0.2) return { label: 'A', className: 'tier-a' }
  if (percentile <= 0.5) return { label: 'B', className: 'tier-b' }

  return { label: 'C', className: 'tier-c' }
}

function updateReferenceScore() {
  const topOffset = 96

  for (const model of visibleModels.value) {
    const element = cardElements.get(model.id)
    if (!element) continue

    const rect = element.getBoundingClientRect()
    const isVisible = rect.bottom >= topOffset && rect.top <= window.innerHeight

    if (isVisible) {
      referenceScore.value = model.scores[props.category]
      return
    }
  }

  referenceScore.value = visibleModels.value[0]?.scores[props.category] ?? 0
}

function handleViewportChange() {
  updateReferenceScore()
}

onMounted(async () => {
  await nextTick()
  updateReferenceScore()
  window.addEventListener('scroll', handleViewportChange, { passive: true })
  window.addEventListener('resize', handleViewportChange)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleViewportChange)
  window.removeEventListener('resize', handleViewportChange)
})

watch(
  () => [props.models, props.category, props.compareMode],
  async () => {
    await nextTick()
    updateReferenceScore()
  },
  { deep: true },
)
</script>

<template>
  <section class="ladder-panel">
    <div class="axis-line"></div>
    <div class="axis-label top">{{ axisLabels.top }}</div>
    <div class="axis-label bottom">{{ axisLabels.bottom }}</div>

    <div class="ladder-grid-head">
      <div class="column-title" :class="groupConfig.left.accentClass">{{ groupConfig.left.label }}</div>
      <div></div>
      <div class="column-title" :class="groupConfig.right.accentClass">{{ groupConfig.right.label }}</div>
    </div>

    <div class="ladder-grid">
      <div v-for="row in rankedRows" :key="row.key" class="ladder-grid-row">
        <div class="ladder-slot slot-left">
          <button
            v-if="row.leftModel"
            :ref="(element) => setCardElement(row.leftModel.id, element)"
            class="ladder-row row-left"
          :class="[
              getTier(row.leftModel.globalRank, row.leftModel.totalCount).className,
              { selected: selectedIds.includes(row.leftModel.id) },
            ]"
            :style="{ '--row-scale': getRelativeScale(row.leftModel.scores[category]) }"
            @click="emit('toggle-model', row.leftModel.id)"
            @dblclick="emit('open-model', row.leftModel.id)"
            :title="`单击选择对比，双击查看 ${row.leftModel.name} 详情`"
          >
            <div class="connector"></div>
            <div class="rank-box">{{ String(row.leftModel.globalRank).padStart(2, '0') }}</div>
            <div class="row-content">
              <div class="row-topline">
                <h3>{{ row.leftModel.name }}</h3>
                <span class="tier-chip">{{ getTier(row.leftModel.globalRank, row.leftModel.totalCount).label }}</span>
              </div>
            </div>
            <div class="score-block">
              <strong>{{ row.leftModel.scores[category].toFixed(1) }}</strong>
              <span>{{ getRelativePercent(row.leftModel.scores[category]) }}</span>
            </div>
          </button>
        </div>

        <div class="ladder-center-spacer"></div>

        <div class="ladder-slot slot-right">
          <button
            v-if="row.rightModel"
            :ref="(element) => setCardElement(row.rightModel.id, element)"
            class="ladder-row row-right"
          :class="[
              getTier(row.rightModel.globalRank, row.rightModel.totalCount).className,
              { selected: selectedIds.includes(row.rightModel.id) },
            ]"
            :style="{ '--row-scale': getRelativeScale(row.rightModel.scores[category]) }"
            @click="emit('toggle-model', row.rightModel.id)"
            @dblclick="emit('open-model', row.rightModel.id)"
            :title="`单击选择对比，双击查看 ${row.rightModel.name} 详情`"
          >
            <div class="connector"></div>
            <div class="rank-box">{{ String(row.rightModel.globalRank).padStart(2, '0') }}</div>
            <div class="row-content">
              <div class="row-topline">
                <h3>{{ row.rightModel.name }}</h3>
                <span class="tier-chip">{{ getTier(row.rightModel.globalRank, row.rightModel.totalCount).label }}</span>
              </div>
            </div>
            <div class="score-block">
              <strong>{{ row.rightModel.scores[category].toFixed(1) }}</strong>
              <span>{{ getRelativePercent(row.rightModel.scores[category]) }}</span>
            </div>
          </button>
        </div>
      </div>
    </div>

    <div class="tier-watermarks">
      <span>SSS</span>
      <span>SS</span>
      <span>S</span>
      <span>A</span>
      <span>B</span>
    </div>
  </section>
</template>

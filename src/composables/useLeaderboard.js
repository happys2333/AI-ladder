import { computed, onMounted, ref } from 'vue'
import { defaultSelectedIds } from '../config/leaderboard'
import { fetchLeaderboardData } from '../services/leaderboardService'

export function useLeaderboard() {
  const categories = ref([])
  const regions = ref([])
  const models = ref([])
  const isLoading = ref(true)
  const lastUpdated = ref('')
  const activeModelId = ref('')
  const source = ref(null)
  const stats = ref({})

  const activeCategory = ref('overall')
  const compareMode = ref('region')
  const search = ref('')
  const selectedIds = ref(defaultSelectedIds)

  const filteredModels = computed(() => {
    const keyword = search.value.trim().toLowerCase()

    return models.value
      .filter((model) => {
        if (!keyword) return true
        const haystack = [model.name, model.vendor, model.summary, ...model.tags].join(' ').toLowerCase()
        return haystack.includes(keyword)
      })
      .sort((a, b) => b.scores[activeCategory.value] - a.scores[activeCategory.value])
  })

  const selectedModels = computed(() => models.value.filter((model) => selectedIds.value.includes(model.id)))
  const activeModel = computed(() => models.value.find((model) => model.id === activeModelId.value) ?? null)

  const overviewStats = computed(() => {
    const visible = filteredModels.value
    if (!visible.length) {
      return { leader: '-', avg: '-', spread: '-' }
    }

    const values = visible.map((item) => item.scores[activeCategory.value])
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length

    return {
      leader: visible[0].name,
      avg: avg.toFixed(1),
      spread: (Math.max(...values) - Math.min(...values)).toFixed(1),
    }
  })

  function toggleSelected(modelId) {
    if (selectedIds.value.includes(modelId)) {
      selectedIds.value = selectedIds.value.filter((id) => id !== modelId)
      return
    }

    selectedIds.value = [...selectedIds.value, modelId].slice(-3)
  }

  function clearSelected() {
    selectedIds.value = []
  }

  function openModelDetails(modelId) {
    activeModelId.value = modelId
  }

  function closeModelDetails() {
    activeModelId.value = ''
  }

  function updateModels(nextModels) {
    models.value = nextModels
  }

  async function loadLeaderboardData(loader = fetchLeaderboardData) {
    isLoading.value = true

    try {
      const payload = await loader()
      categories.value = payload.categories ?? []
      regions.value = payload.regions ?? []
      models.value = payload.models ?? []
      lastUpdated.value = payload.lastUpdated ?? ''
      source.value = payload.source ?? null
      stats.value = payload.stats ?? {}

      selectedIds.value = selectedIds.value.filter((id) => models.value.some((model) => model.id === id))

      if (!categories.value.some((category) => category.key === activeCategory.value)) {
        activeCategory.value = categories.value[0]?.key ?? 'overall'
      }
    } finally {
      isLoading.value = false
    }
  }

  onMounted(() => {
    loadLeaderboardData()
  })

  return {
    categories,
    regions,
    models,
    isLoading,
    lastUpdated,
    source,
    stats,
    activeModel,
    activeCategory,
    compareMode,
    search,
    selectedIds,
    filteredModels,
    selectedModels,
    overviewStats,
    toggleSelected,
    clearSelected,
    openModelDetails,
    closeModelDetails,
    updateModels,
    loadLeaderboardData,
  }
}

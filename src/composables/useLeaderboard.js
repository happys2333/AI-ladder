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
  const isPriceAscending = ref(true)
  const search = ref('')
  const selectedIds = ref(defaultSelectedIds)

  function getCategoryValue(model, category) {
    return model.scores?.[category] ?? 0
  }

  function sortModels(items) {
    return [...items].sort((a, b) => {
      const aValue = getCategoryValue(a, activeCategory.value)
      const bValue = getCategoryValue(b, activeCategory.value)

      if (activeCategory.value === 'price') {
        return isPriceAscending.value ? aValue - bValue : bValue - aValue
      }

      return bValue - aValue
    })
  }

  const filteredModels = computed(() => {
    const keyword = search.value.trim().toLowerCase()

    return sortModels(models.value
      .filter((model) => {
        if (activeCategory.value === 'price' && getCategoryValue(model, 'price') <= 0) {
          return false
        }

        if (!keyword) return true
        const haystack = [model.name, model.vendor, model.summary, ...model.tags].join(' ').toLowerCase()
        return haystack.includes(keyword)
      }))
  })

  const selectedModels = computed(() => models.value.filter((model) => selectedIds.value.includes(model.id)))
  const activeModel = computed(() => models.value.find((model) => model.id === activeModelId.value) ?? null)

  const overviewStats = computed(() => {
    const visible = filteredModels.value
    if (!visible.length) {
      return { leader: '-', avg: '-', spread: '-' }
    }

    const values = visible.map((item) => getCategoryValue(item, activeCategory.value))
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

  function togglePriceSortDirection() {
    isPriceAscending.value = !isPriceAscending.value
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
    isPriceAscending,
    search,
    selectedIds,
    filteredModels,
    selectedModels,
    overviewStats,
    toggleSelected,
    clearSelected,
    openModelDetails,
    closeModelDetails,
    togglePriceSortDirection,
    updateModels,
    loadLeaderboardData,
  }
}

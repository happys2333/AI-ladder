<script setup>
import AppHeader from './layout/AppHeader.vue'
import AppSidebar from './layout/AppSidebar.vue'
import LadderChart from './components/LadderChart.vue'
import CompareOverlay from './components/CompareOverlay.vue'
import BottomActionBar from './components/BottomActionBar.vue'
import ModelDetailDrawer from './components/ModelDetailDrawer.vue'
import CodingPlansPage from './pages/CodingPlansPage.vue'
import HeroPanel from './sections/HeroPanel.vue'
import { useI18n } from './composables/useI18n'
import { useLeaderboard } from './composables/useLeaderboard'
import { computed, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue'

const SIDEBAR_AUTO_OPEN_QUERY = '(min-width: 1201px)'
const VIEW_PATHS = {
  leaderboard: '/',
  codingPlans: '/coding-plans',
}

const { t, translateCategoryLabel } = useI18n()

const {
  categories,
  regions,
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
} = useLeaderboard()

const isCompareOverlayOpen = ref(false)
const isSidebarOpen = ref(false)
const isDesktopSidebar = ref(false)
const currentView = ref(resolveViewFromLocation())
let sidebarMediaQuery = null

const isLeaderboardView = computed(() => currentView.value === 'leaderboard')

function resolveViewFromLocation() {
  if (typeof window === 'undefined') return 'leaderboard'

  const pathname = window.location.pathname.replace(/\/+$/, '') || '/'
  if (pathname === VIEW_PATHS.codingPlans || window.location.hash === '#/coding-plans') {
    return 'codingPlans'
  }

  return 'leaderboard'
}

function openCompareOverlay() {
  if (!selectedModels.value.length) return
  isCompareOverlayOpen.value = true
}

function closeCompareOverlay() {
  isCompareOverlayOpen.value = false
}

function toggleSidebar() {
  isSidebarOpen.value = !isSidebarOpen.value
}

function closeSidebar() {
  isSidebarOpen.value = false
}

function resetTransientPanels() {
  closeSidebar()
  closeCompareOverlay()
  closeModelDetails()
}

function syncSidebarWithViewport(isLargeScreen) {
  isDesktopSidebar.value = isLargeScreen
  isSidebarOpen.value = isLargeScreen && isLeaderboardView.value
}

function handleSidebarViewportChange(event) {
  syncSidebarWithViewport(event.matches)
}

function handleCategoryUpdate(nextCategory) {
  activeCategory.value = nextCategory
  if (!isDesktopSidebar.value) closeSidebar()
}

function handleCompareModeUpdate(nextMode) {
  compareMode.value = nextMode
  if (!isDesktopSidebar.value) closeSidebar()
}

function handleNavigate(nextView) {
  if (!VIEW_PATHS[nextView] || currentView.value === nextView) return

  currentView.value = nextView
  resetTransientPanels()
  if (sidebarMediaQuery) {
    syncSidebarWithViewport(sidebarMediaQuery.matches)
  }
  window.history.pushState({}, '', VIEW_PATHS[nextView])
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function handlePopState() {
  currentView.value = resolveViewFromLocation()
  resetTransientPanels()
  if (sidebarMediaQuery) {
    syncSidebarWithViewport(sidebarMediaQuery.matches)
  }
}

onMounted(() => {
  sidebarMediaQuery = window.matchMedia(SIDEBAR_AUTO_OPEN_QUERY)
  syncSidebarWithViewport(sidebarMediaQuery.matches)
  sidebarMediaQuery.addEventListener('change', handleSidebarViewportChange)
  window.addEventListener('popstate', handlePopState)
})

onBeforeUnmount(() => {
  if (!sidebarMediaQuery) return
  sidebarMediaQuery.removeEventListener('change', handleSidebarViewportChange)
  window.removeEventListener('popstate', handlePopState)
})

watchEffect(() => {
  if (typeof document === 'undefined') return
  document.title = isLeaderboardView.value ? t('app.pageTitle') : t('app.codingPlansTitle')
})
</script>

<template>
  <div class="app-shell">
    <AppHeader
      :search="search"
      :current-view="currentView"
      :show-menu="isLeaderboardView"
      :show-search="isLeaderboardView"
      @update:search="search = $event"
      @open-sidebar="toggleSidebar"
      @navigate="handleNavigate"
    />

    <template v-if="isLeaderboardView">
      <div class="layout-shell" :class="{ 'layout-shell--with-sidebar': isDesktopSidebar && isSidebarOpen }">
        <AppSidebar
          :categories="categories"
          :active-category="activeCategory"
          :compare-mode="compareMode"
          :visible="isSidebarOpen"
          :docked="isDesktopSidebar"
          @update:category="handleCategoryUpdate"
          @update:compare-mode="handleCompareModeUpdate"
          @close="closeSidebar"
        />

        <main class="main-panel">
          <HeroPanel
            :title="translateCategoryLabel(activeCategory, categories.find((item) => item.key === activeCategory)?.label ?? 'Overall')"
            :stats="overviewStats"
            :last-updated="lastUpdated"
            :source="source"
            :leaderboard-stats="stats"
            :active-category="activeCategory"
            :is-price-ascending="isPriceAscending"
            @toggle-price-sort="togglePriceSortDirection"
          />

          <div v-if="isLoading" class="compare-empty">{{ t('app.loading') }}</div>

          <template v-else>
            <LadderChart
              :models="filteredModels"
              :regions="regions"
              :category="activeCategory"
              :compare-mode="compareMode"
              :selected-ids="selectedIds"
              @toggle-model="toggleSelected"
              @open-model="openModelDetails"
            />
          </template>
        </main>
      </div>

      <BottomActionBar :selected-count="selectedIds.length" @clear="clearSelected" @open-compare="openCompareOverlay" />
      <CompareOverlay
        :categories="categories"
        :regions="regions"
        :models="selectedModels"
        :active-category="activeCategory"
        :visible="isCompareOverlayOpen"
        @clear="clearSelected"
        @close="closeCompareOverlay"
      />
      <ModelDetailDrawer :model="activeModel" :categories="categories" :regions="regions" :visible="Boolean(activeModel)" @close="closeModelDetails" />
    </template>

    <CodingPlansPage v-else />
  </div>
</template>

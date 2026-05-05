<script setup>
import { useI18n } from '../composables/useI18n'

defineProps({
  categories: { type: Array, required: true },
  activeCategory: { type: String, required: true },
  compareMode: { type: String, required: true },
  visible: { type: Boolean, required: true },
  docked: { type: Boolean, required: true },
})

const emit = defineEmits(['update:category', 'update:compare-mode', 'close'])
const { t, translateCategoryLabel } = useI18n()
</script>

<template>
  <aside v-if="docked && visible" class="sidebar sidebar-docked">
    <div class="sidebar-topbar">
      <div class="sidebar-head">
        <h2>{{ t('sidebar.title') }}</h2>
        <p>{{ t('sidebar.subtitle') }}</p>
      </div>
    </div>

    <div class="sidebar-section">
      <div class="section-label">{{ t('sidebar.categories') }}</div>
      <button
        v-for="category in categories"
        :key="category.key"
        class="side-nav-item"
        :class="{ active: activeCategory === category.key }"
        @click="emit('update:category', category.key)"
      >
        <span class="material-symbols-outlined">leaderboard</span>
        {{ translateCategoryLabel(category.key, category.label) }}
      </button>
    </div>

    <div class="sidebar-section">
      <div class="section-label">{{ t('sidebar.compareMode') }}</div>
      <div class="pill-row">
        <button class="filter-pill" :class="{ active: compareMode === 'region' }" @click="emit('update:compare-mode', 'region')">{{ t('sidebar.compareByRegion') }}</button>
        <button class="filter-pill" :class="{ active: compareMode === 'openness' }" @click="emit('update:compare-mode', 'openness')">{{ t('sidebar.compareByOpenness') }}</button>
      </div>
    </div>
  </aside>

  <Teleport to="body">
    <Transition name="sidebar-overlay">
      <div v-if="!docked && visible" class="sidebar-overlay" @click="emit('close')">
        <aside class="sidebar sidebar-drawer" @click.stop>
          <div class="sidebar-topbar">
            <div class="sidebar-head">
              <h2>{{ t('sidebar.title') }}</h2>
              <p>{{ t('sidebar.subtitle') }}</p>
            </div>

            <button class="icon-button" @click="emit('close')">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>

          <div class="sidebar-section">
            <div class="section-label">{{ t('sidebar.categories') }}</div>
            <button
              v-for="category in categories"
              :key="category.key"
              class="side-nav-item"
              :class="{ active: activeCategory === category.key }"
              @click="emit('update:category', category.key)"
            >
              <span class="material-symbols-outlined">leaderboard</span>
              {{ translateCategoryLabel(category.key, category.label) }}
            </button>
          </div>

          <div class="sidebar-section">
            <div class="section-label">{{ t('sidebar.compareMode') }}</div>
            <div class="pill-row">
              <button class="filter-pill" :class="{ active: compareMode === 'region' }" @click="emit('update:compare-mode', 'region')">{{ t('sidebar.compareByRegion') }}</button>
              <button class="filter-pill" :class="{ active: compareMode === 'openness' }" @click="emit('update:compare-mode', 'openness')">{{ t('sidebar.compareByOpenness') }}</button>
            </div>
          </div>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

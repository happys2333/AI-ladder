<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from '../composables/useI18n'

defineProps({
  search: { type: String, required: true },
  currentView: { type: String, required: true },
  showMenu: { type: Boolean, default: true },
  showSearch: { type: Boolean, default: true },
})

const emit = defineEmits(['update:search', 'open-sidebar', 'navigate'])
const { locale, supportedLocales, setLocale, t } = useI18n()
const isLocaleMenuOpen = ref(false)
const localeMenuRef = ref(null)

const localeLabels = {
  'zh-CN': '中文',
  'en-US': 'English',
}

const currentLocaleLabel = computed(() => localeLabels[locale.value] || locale.value)

function toggleLocaleMenu() {
  isLocaleMenuOpen.value = !isLocaleMenuOpen.value
}

function handleLocaleSelect(nextLocale) {
  setLocale(nextLocale)
  isLocaleMenuOpen.value = false
}

function handleDocumentPointerDown(event) {
  if (!localeMenuRef.value?.contains(event.target)) {
    isLocaleMenuOpen.value = false
  }
}

function handleDocumentKeydown(event) {
  if (event.key === 'Escape') {
    isLocaleMenuOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  document.addEventListener('keydown', handleDocumentKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  document.removeEventListener('keydown', handleDocumentKeydown)
})
</script>

<template>
  <header class="topbar">
    <div class="header-leading">
      <button v-if="showMenu" class="menu-button" @click="emit('open-sidebar')">
        <span class="material-symbols-outlined">menu</span>
      </button>
      <div class="brand-title">{{ t('app.brand') }}</div>
      <nav class="top-nav">
        <button
          class="top-nav-link"
          :class="{ active: currentView === 'leaderboard' }"
          @click="emit('navigate', 'leaderboard')"
        >
          {{ t('app.navLeaderboard') }}
        </button>
        <button
          class="top-nav-link"
          :class="{ active: currentView === 'codingPlans' }"
          @click="emit('navigate', 'codingPlans')"
        >
          {{ t('app.navCodingPlans') }}
        </button>
      </nav>
    </div>

    <div class="top-actions">
      <div ref="localeMenuRef" class="language-switch">
        <button
          class="language-trigger"
          type="button"
          :aria-expanded="isLocaleMenuOpen ? 'true' : 'false'"
          @click="toggleLocaleMenu"
        >
          <span class="material-symbols-outlined">translate</span>
          <span class="language-trigger-label">{{ currentLocaleLabel }}</span>
          <span class="material-symbols-outlined language-trigger-caret">
            {{ isLocaleMenuOpen ? 'expand_less' : 'expand_more' }}
          </span>
        </button>

        <Transition name="locale-menu">
          <div v-if="isLocaleMenuOpen" class="language-menu">
            <button
              v-for="item in supportedLocales"
              :key="item"
              class="language-option"
              :class="{ active: locale === item }"
              type="button"
              @click="handleLocaleSelect(item)"
            >
              <span>{{ localeLabels[item] || item }}</span>
              <span v-if="locale === item" class="material-symbols-outlined">check</span>
            </button>
          </div>
        </Transition>
      </div>

      <label v-if="showSearch" class="search-box">
        <span class="material-symbols-outlined">search</span>
        <input
          :value="search"
          type="text"
          :placeholder="t('app.searchPlaceholder')"
          @input="emit('update:search', $event.target.value)"
        />
      </label>
    </div>
  </header>
</template>

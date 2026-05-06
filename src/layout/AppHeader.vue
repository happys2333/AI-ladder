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
const githubRepoUrl = 'https://github.com/happys2333/AI-ladder'

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

      <a
        class="github-link"
        :href="githubRepoUrl"
        target="_blank"
        rel="noopener noreferrer"
        :aria-label="t('app.githubRepo')"
        :title="t('app.githubRepo')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 .5C5.65.5.5 5.66.5 12.02c0 5.09 3.29 9.4 7.86 10.92.58.1.79-.25.79-.56 0-.27-.01-1.18-.02-2.14-3.2.7-3.88-1.36-3.88-1.36-.52-1.34-1.28-1.69-1.28-1.69-1.05-.72.08-.71.08-.71 1.16.08 1.76 1.2 1.76 1.2 1.03 1.78 2.71 1.27 3.37.97.1-.75.4-1.27.73-1.57-2.56-.29-5.26-1.29-5.26-5.75 0-1.27.45-2.31 1.2-3.13-.12-.29-.52-1.47.12-3.07 0 0 .97-.31 3.19 1.19a10.9 10.9 0 0 1 5.82 0c2.22-1.5 3.18-1.19 3.18-1.19.64 1.6.24 2.78.12 3.07.75.82 1.2 1.86 1.2 3.13 0 4.47-2.7 5.45-5.28 5.74.41.36.78 1.08.78 2.18 0 1.58-.02 2.85-.02 3.24 0 .31.21.67.8.56 4.56-1.53 7.84-5.83 7.84-10.92C23.5 5.66 18.35.5 12 .5Z"
          />
        </svg>
      </a>

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

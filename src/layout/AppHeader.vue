<script setup>
import { useI18n } from '../composables/useI18n'

defineProps({
  search: { type: String, required: true },
})

const emit = defineEmits(['update:search', 'open-sidebar'])
const { locale, supportedLocales, setLocale, t } = useI18n()
</script>

<template>
  <header class="topbar">
    <div class="header-leading">
      <button class="menu-button" @click="emit('open-sidebar')">
        <span class="material-symbols-outlined">menu</span>
      </button>
      <div class="brand-title">{{ t('app.brand') }}</div>
    </div>

    <div class="top-actions">
      <label class="language-switch">
        <span class="material-symbols-outlined">translate</span>
        <select :value="locale" @change="setLocale($event.target.value)">
          <option v-for="item in supportedLocales" :key="item" :value="item">
            {{ item === 'zh-CN' ? '中文' : 'English' }}
          </option>
        </select>
      </label>

      <label class="search-box">
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

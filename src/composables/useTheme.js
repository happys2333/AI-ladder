import { ref, watch, onMounted } from 'vue'

const THEME_KEY = 'ai-ladder-theme'
const THEMES = ['system', 'light', 'dark']

export function useTheme() {
  const theme = ref('system')
  const actualTheme = ref('dark') // What is actually applied to the DOM

  function applyTheme(targetTheme) {
    let resolved = targetTheme
    if (resolved === 'system') {
      const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches
      resolved = prefersLight ? 'light' : 'dark'
    }

    actualTheme.value = resolved
    document.documentElement.setAttribute('data-theme', resolved)
  }

  function cycleTheme() {
    const currentIndex = THEMES.indexOf(theme.value)
    const nextIndex = (currentIndex + 1) % THEMES.length
    setTheme(THEMES[nextIndex])
  }

  function setTheme(newTheme) {
    if (!THEMES.includes(newTheme)) return
    theme.value = newTheme
    localStorage.setItem(THEME_KEY, newTheme)
    applyTheme(newTheme)
  }

  onMounted(() => {
    // Check local storage
    const storedTheme = localStorage.getItem(THEME_KEY)
    if (storedTheme && THEMES.includes(storedTheme)) {
      theme.value = storedTheme
    } else {
      theme.value = 'system'
    }

    applyTheme(theme.value)

    // Watch for system theme changes if using system
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
      if (theme.value === 'system') {
        applyTheme('system')
      }
    })
  })

  watch(theme, (newTheme) => {
    applyTheme(newTheme)
  })

  return {
    theme,
    actualTheme,
    cycleTheme,
    setTheme,
  }
}

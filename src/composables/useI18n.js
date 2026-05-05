import { ref } from 'vue'

const STORAGE_KEY = 'ai-ladder-locale'
const DEFAULT_LOCALE = 'zh-CN'
const SUPPORTED_LOCALES = ['zh-CN', 'en-US']

const locale = ref(DEFAULT_LOCALE)
let initialized = false

const messages = {
  'zh-CN': {
    app: {
      brand: 'AI Ladder',
      pageTitle: 'AI Ladder | 模型天梯榜',
      searchPlaceholder: '搜索模型 / 厂商 / 标签',
      loading: '正在加载榜单数据...',
    },
    sidebar: {
      title: 'Leaderboard',
      subtitle: '多维模型竞争力观察台',
      categories: '维度',
      compareMode: '对比视角',
      compareByRegion: '按国家',
      compareByOpenness: '按开源',
    },
    hero: {
      board: '榜单',
      title: '模型天梯榜',
      source: '数据源',
      updated: '最近更新',
      leader: '当前领跑',
      avg: '可见均分',
      spread: '分差跨度',
      totalModels: '榜单模型数',
      notProvided: '未提供',
    },
    compare: {
      title: '多维横向对比',
      floatingTitle: '模型对比',
      kicker: 'Compare Models',
      clear: '清空选择',
      empty: '选择榜单中的模型后，这里会显示综合对比面板。',
      price: '价格',
      latency: '延迟',
    },
    actions: {
      compare: '对比模型',
      clear: '清空选择',
    },
    detail: {
      profile: '模型详情',
      inputPrice: '输入价格',
      responseLatency: '响应延迟',
      overallScore: '当前总分',
      multiScore: '多维得分',
    },
    regions: {
      cn: '中国阵营',
      global: '全球阵营',
      open: '开源模型',
      other: '其他模型',
    },
    categories: {
      overall: '智能指数',
      coding: '代码',
      math: '数学',
      reasoning: '推理',
      knowledge: '知识',
      agentic: '代理任务',
      context: '复杂任务',
      instruction: '指令跟随',
      multimodal: '多模态',
      efficiency: '效率',
    },
  },
  'en-US': {
    app: {
      brand: 'AI Ladder',
      pageTitle: 'AI Ladder | Model Ladder',
      searchPlaceholder: 'Search models / creators / tags',
      loading: 'Loading leaderboard data...',
    },
    sidebar: {
      title: 'Leaderboard',
      subtitle: 'Multi-dimensional model benchmark console',
      categories: 'Categories',
      compareMode: 'Compare Mode',
      compareByRegion: 'By Region',
      compareByOpenness: 'By Openness',
    },
    hero: {
      board: 'Board',
      title: 'Model Ladder',
      source: 'Source',
      updated: 'Updated',
      leader: 'Current Leader',
      avg: 'Visible Average',
      spread: 'Score Spread',
      totalModels: 'Models in Board',
      notProvided: 'Not provided',
    },
    compare: {
      title: 'Multi-dimensional Comparison',
      floatingTitle: 'Model Comparison',
      kicker: 'Compare Models',
      clear: 'Clear Selection',
      empty: 'Select models from the leaderboard to view the comparison panel here.',
      price: 'Price',
      latency: 'Latency',
    },
    actions: {
      compare: 'Compare',
      clear: 'Clear',
    },
    detail: {
      profile: 'Model Profile',
      inputPrice: 'Input Price',
      responseLatency: 'Response Latency',
      overallScore: 'Overall Score',
      multiScore: 'Multi-dimensional Scores',
    },
    regions: {
      cn: 'China Group',
      global: 'Global Group',
      open: 'Open Models',
      other: 'Other Models',
    },
    categories: {
      overall: 'Intelligence',
      coding: 'Coding',
      math: 'Math',
      reasoning: 'Reasoning',
      knowledge: 'Knowledge',
      agentic: 'Agentic',
      context: 'Complex Tasks',
      instruction: 'Instruction',
      multimodal: 'Multimodal',
      efficiency: 'Efficiency',
    },
  },
}

function detectInitialLocale() {
  if (typeof window === 'undefined') return DEFAULT_LOCALE

  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored && SUPPORTED_LOCALES.includes(stored)) return stored

  return SUPPORTED_LOCALES.includes(window.navigator.language) ? window.navigator.language : DEFAULT_LOCALE
}

function initializeLocale() {
  if (initialized) return
  locale.value = detectInitialLocale()
  initialized = true
}

function setLocale(nextLocale) {
  if (!SUPPORTED_LOCALES.includes(nextLocale)) return
  locale.value = nextLocale

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, nextLocale)
  }
}

function resolve(path, fallback = '') {
  const segments = path.split('.')
  let current = messages[locale.value]

  for (const segment of segments) {
    current = current?.[segment]
  }

  return current ?? fallback
}

function translateCategoryLabel(key, fallback = key) {
  return resolve(`categories.${key}`, fallback)
}

function translateRegionLabel(key, fallback = key) {
  return resolve(`regions.${key}`, fallback)
}

export function useI18n() {
  initializeLocale()

  return {
    locale,
    supportedLocales: SUPPORTED_LOCALES,
    setLocale,
    t: resolve,
    translateCategoryLabel,
    translateRegionLabel,
  }
}

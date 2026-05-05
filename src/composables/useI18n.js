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
      codingPlansTitle: 'AI Ladder | Coding Plan',
      navLeaderboard: '排行榜',
      navCodingPlans: 'Coding Plan',
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
      priceAsc: '价格: 低到高',
      priceDesc: '价格: 高到低',
    },
    compare: {
      title: '多维横向对比',
      floatingTitle: '模型对比',
      kicker: 'Compare Models',
      clear: '清空选择',
      empty: '选择榜单中的模型后，这里会显示综合对比面板。',
      price: '价格',
      latency: '延迟',
      speed: '速度',
    },
    actions: {
      compare: '对比模型',
      clear: '清空选择',
    },
    detail: {
      profile: '模型详情',
      blendedPrice: '综合价格',
      inputPrice: '输入价格',
      outputPrice: '输出价格',
      responseLatency: '首 token 延迟',
      firstAnswerLatency: '首答案延迟',
      outputSpeed: '输出速度',
      overallScore: '当前总分',
      multiScore: '多维得分',
      codingPlans: 'Coding Plan',
      codingPlansEmpty: '当前未录入该厂商的 coding plan，可在手工 JSON 中补充。',
      providerSource: '来源',
    },
    regions: {
      cn: '中国阵营',
      global: '全球阵营',
      open: '开源模型',
      other: '其他模型',
    },
    categories: {
      overall: '综合指数',
      coding: '代码',
      reasoning: '推理',
      price: '价格',
      speed: '速度',
      context: '复杂任务',
      instruction: '指令跟随',
      multimodal: '多模态',
      efficiency: '效率',
    },
    plans: {
      kicker: 'Official Coding Plans',
      title: 'Coding Plan',
      subtitle: '只展示官网可核对的编码相关订阅或席位信息，便于横向看价格、席位和使用限制。',
      updated: '数据更新时间',
      scope: '数据范围',
      scopeValue: '仅官方来源',
      fxRate: 'USD/CNY 汇率参考',
      loading: '正在加载 coding plan...',
      officialSource: '官方来源',
      planCount: '项计划',
      startsAt: '起步',
      generalAudience: 'General',
      cadence: '计费周期',
      seats: '适用席位',
      access: '编码权益',
      limits: '限制 / 配额',
    },
  },
  'en-US': {
    app: {
      brand: 'AI Ladder',
      pageTitle: 'AI Ladder | Model Ladder',
      codingPlansTitle: 'AI Ladder | Coding Plans',
      navLeaderboard: 'Leaderboard',
      navCodingPlans: 'Coding Plans',
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
      priceAsc: 'Price: Low to High',
      priceDesc: 'Price: High to Low',
    },
    compare: {
      title: 'Multi-dimensional Comparison',
      floatingTitle: 'Model Comparison',
      kicker: 'Compare Models',
      clear: 'Clear Selection',
      empty: 'Select models from the leaderboard to view the comparison panel here.',
      price: 'Price',
      latency: 'Latency',
      speed: 'Speed',
    },
    actions: {
      compare: 'Compare',
      clear: 'Clear',
    },
    detail: {
      profile: 'Model Profile',
      blendedPrice: 'Blended Price',
      inputPrice: 'Input Price',
      outputPrice: 'Output Price',
      responseLatency: 'TTFT',
      firstAnswerLatency: 'First Answer',
      outputSpeed: 'Output Speed',
      overallScore: 'Overall Score',
      multiScore: 'Multi-dimensional Scores',
      codingPlans: 'Coding Plans',
      codingPlansEmpty: 'No coding plans recorded for this provider yet. Update the manual JSON to add them.',
      providerSource: 'Source',
    },
    regions: {
      cn: 'China Group',
      global: 'Global Group',
      open: 'Open Models',
      other: 'Other Models',
    },
    categories: {
      overall: 'Overall Index',
      coding: 'Coding',
      reasoning: 'Reasoning',
      price: 'Price',
      speed: 'Speed',
      context: 'Complex Tasks',
      instruction: 'Instruction',
      multimodal: 'Multimodal',
      efficiency: 'Efficiency',
    },
    plans: {
      kicker: 'Official Coding Plans',
      title: 'Coding Plans',
      subtitle: 'Only official pricing and seat information is shown here, so users can compare coding access, quotas, and billing terms directly.',
      updated: 'Last Verified',
      scope: 'Coverage',
      scopeValue: 'Official sources only',
      fxRate: 'USD/CNY Reference',
      loading: 'Loading coding plans...',
      officialSource: 'Official Source',
      planCount: 'plans',
      startsAt: 'From',
      generalAudience: 'General',
      cadence: 'Cadence',
      seats: 'Seats',
      access: 'Coding Access',
      limits: 'Limits / Quotas',
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

function resolveLocalizedValue(value, fallback = '') {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return fallback

  return (
    value[locale.value]
    ?? value[DEFAULT_LOCALE]
    ?? value['en-US']
    ?? Object.values(value).find((entry) => typeof entry === 'string')
    ?? fallback
  )
}

export function useI18n() {
  initializeLocale()

  return {
    locale,
    supportedLocales: SUPPORTED_LOCALES,
    setLocale,
    t: resolve,
    localizeText: resolveLocalizedValue,
    translateCategoryLabel,
    translateRegionLabel,
  }
}

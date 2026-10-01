import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { fetchLeaderboardData, fetchLeaderboardDataFromApi } from '../src/services/leaderboardService.js'
import { useLeaderboard } from '../src/composables/useLeaderboard.js'
import { buildMonthlyLeaders, formatCategoryValue, formatMetric, getCategoryValue, metricBarWidth } from '../src/utils/metrics.js'

const categories = ['overall', 'coding', 'price', 'speed'].map(key => ({ key, label: key }))
const model = (id, scores, meta = {}) => ({ id, name: id, vendor: 'Test', tags: [], scores, meta })
const fetcherFor = (payload, plans = null) => async (path) => path.includes('coding-plans')
  ? { ok: plans !== null, status: 404, json: async () => plans }
  : { ok: true, json: async () => payload }

async function leaderboardFor(payload) {
  let state
  const app = createSSRApp({
    setup() {
      state = useLeaderboard()
      return () => h('div')
    },
  })
  await renderToString(app)
  await state.loadLeaderboardData(async () => payload)
  return state
}

test('both loaders preserve zero, null and price precision while rejecting non-finite scores', async () => {
  const payload = {
    categories,
    models: [model('mixed', { overall: null, coding: 0, price: 0.025, speed: Infinity, extra: NaN, text: '42', future: null }), model('missing')],
  }
  for (const loader of [fetchLeaderboardData, fetchLeaderboardDataFromApi]) {
    const result = await loader(fetcherFor(payload))
    assert.deepEqual(result.models[0].scores, { overall: null, coding: 0, price: 0.025, speed: null, extra: null, text: null, future: null })
    assert.deepEqual(result.models[1].scores, { overall: null, coding: null, price: null, speed: null })
    assert.equal(payload.models[0].scores.speed, Infinity, 'input is not mutated')
  }
})

test('raw spreads cannot replace normalized arrays, defaults or timestamps', async () => {
  const result = await fetchLeaderboardData(fetcherFor({
    categories: [null, { key: '', label: '' }],
    regions: [null, { key: '', label: '' }],
    models: [null, { id: '', name: '', tags: 'bad', codingPlans: 'bad', scores: null }],
    generatedAt: '2026-09-30T00:00:00Z',
    lastUpdated: '',
  }))
  assert.deepEqual(result.categories, [{ key: 'overall', label: 'Overall' }])
  assert.deepEqual(result.regions, [{ key: 'global', label: 'Global' }])
  assert.equal(result.lastUpdated, '2026-09-30T00:00:00Z')
  assert.equal(result.models[0].id, 'model-0')
  assert.equal(result.models[0].name, 'Unknown Model')
  assert.deepEqual(result.models[0].tags, [])
  assert.deepEqual(result.models[0].codingPlans, [])
  assert.deepEqual(result.models[0].scores, { overall: null })
  const invalidArrays = await fetchLeaderboardData(fetcherFor({ categories: {}, regions: null, models: {} }))
  assert.deepEqual(invalidArrays.models, [])
  assert.deepEqual(invalidArrays.categories, [])
  assert.deepEqual(invalidArrays.regions, [])
})

test('canonical creator slugs attach coding plans after normalization', async () => {
  const result = await fetchLeaderboardData(fetcherFor({
    categories,
    models: [model('test', { overall: null }, { creatorSlug: 'zhipu' })],
  }, {
    providers: [{ providerSlug: 'zhipu', providerName: 'Zhipu', source: 'https://example.com/plans', plans: [{ name: 'Pro' }] }],
  }))
  assert.equal(result.models[0].codingPlans[0].name, 'Pro')
  assert.equal(result.models[0].codingPlans[0].source, 'https://example.com/plans')
  assert.equal(result.models[0].scores.overall, null)
})

test('ranking and averages exclude missing scores and include genuine zero', async () => {
  const state = await leaderboardFor({ categories, models: [
    model('missing', { overall: null, price: null }),
    model('invalid', { overall: Infinity, price: NaN }),
    model('zero', { overall: 0, price: 0 }),
    model('measured', { overall: 20, price: 2 }),
  ] })
  assert.deepEqual(state.filteredModels.value.map(model => model.id), ['measured', 'zero'])
  assert.deepEqual(state.overviewStats.value, { leader: 'measured', avg: '10.0', spread: '20.0' })
  state.activeCategory.value = 'price'
  assert.deepEqual(state.filteredModels.value.map(model => model.id), ['zero', 'measured'])
  assert.deepEqual(state.overviewStats.value, { leader: 'zero', avg: '1.0', spread: '2.0' })
  state.togglePriceSortDirection()
  assert.deepEqual(state.filteredModels.value.map(model => model.id), ['measured', 'zero'])
  state.search.value = 'missing'
  assert.deepEqual(state.filteredModels.value, [])
  assert.deepEqual(state.overviewStats.value, { leader: '-', avg: '-', spread: '-' })
})

test('availability and fallback use measurements instead of stale category flags', async () => {
  const state = await leaderboardFor({
    categories: categories.map(category => ({ ...category, available: category.key === 'overall' })),
    models: [model('zero', { overall: null, coding: null, price: 0, speed: null })],
  })
  assert.equal(state.activeCategory.value, 'price')
  assert.deepEqual(state.categories.value.map(category => category.available), [false, false, true, false])
  state.updateModels([model('only-speed', { speed: 0 })])
  assert.equal(state.activeCategory.value, 'speed')
  state.updateModels([model('unmeasured', { overall: null })])
  assert.equal(state.categories.value.some(category => category.available), false)
  assert.deepEqual(state.filteredModels.value, [])
  assert.deepEqual(state.overviewStats.value, { leader: '-', avg: '-', spread: '-' })
})

test('missing, invalid and zero values are displayed distinctly and safely', () => {
  for (const value of [undefined, null, NaN, Infinity, -Infinity, '1', {}]) {
    assert.equal(formatMetric(value), 'N/A')
    assert.equal(formatCategoryValue('price', value), 'N/A')
    assert.equal(formatCategoryValue('speed', value, { units: true }), 'N/A')
    assert.equal(metricBarWidth(value), '0%')
    assert.equal(getCategoryValue(model('test', { overall: value }), 'overall'), null)
  }
  assert.equal(formatCategoryValue('overall', 0), '0.0')
  assert.equal(formatCategoryValue('price', 0), '$0.00')
  assert.equal(formatCategoryValue('price', 0.001), '$0.001')
  assert.equal(formatCategoryValue('price', 0.0000001), '$1e-7')
  assert.equal(formatCategoryValue('speed', 0, { units: true }), '0.00 tok/s')
  assert.equal(metricBarWidth(0), '0%')
  assert.equal(metricBarWidth(120), '100%')
})

test('monthly trends exclude missing metrics and dates, but preserve zero measurements', () => {
  const input = [
    model('unknown', { overall: null, price: null }, { releaseYearMonth: '2024-01' }),
    model('infinite', { overall: Infinity, price: -Infinity }, { releaseYearMonth: '2024-01' }),
    model('undated', { overall: 100, price: 0 }),
    model('invalid-date', { overall: 100, price: 0 }, { releaseYearMonth: '2024-99' }),
    model('baseline', { overall: 0, price: 2 }, { releaseYearMonth: '2024-02' }),
    model('improved', { overall: 20, price: 0 }, { releaseYearMonth: '2024-04' }),
    model('missing-later', { overall: null, price: null }, { releaseYearMonth: '2024-05' }),
  ]
  assert.deepEqual(buildMonthlyLeaders(input, 'overall').map(({ month, score }) => ({ month, score })), [
    { month: '2024-02', score: 0 }, { month: '2024-03', score: 0 }, { month: '2024-04', score: 20 },
  ])
  assert.deepEqual(buildMonthlyLeaders(input, 'price').map(entry => entry.score), [2, 2, 0])
  assert.deepEqual(buildMonthlyLeaders(input, 'coding'), [])
})

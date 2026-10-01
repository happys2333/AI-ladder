import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createServer } from 'vite'

let vite
const categories = ['overall', 'coding', 'price', 'speed'].map(key => ({ key, label: key }))
const regions = [{ key: 'cn', label: 'China' }, { key: 'global', label: 'Global' }]
const emptyModel = {
  id: 'unmeasured', name: 'Unmeasured Model', vendor: 'Test', region: 'global', tags: [],
  pricing: 'N/A', scores: { overall: null, coding: null, price: null, speed: null },
  meta: { tokensPerSecond: Infinity, timeToFirstTokenSeconds: NaN, inputPrice: -Infinity },
}

before(async () => {
  vite = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)),
    server: { middlewareMode: true },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
  })
  const { useI18n } = await vite.ssrLoadModule('/src/composables/useI18n.js')
  useI18n().setLocale('en-US')
})

after(async () => { await vite?.close() })

async function renderComponent(path, props) {
  const { default: component } = await vite.ssrLoadModule(path)
  const context = {}
  const markup = await renderToString(createSSRApp({ render: () => h(component, props) }), context)
  return markup + Object.values(context.teleports ?? {}).join('')
}

test('comparison renders N/A for absent active category and every invalid metadata value', async () => {
  const markup = await renderComponent('/src/components/CompareDrawer.vue', {
    categories, regions, models: [emptyModel], activeCategory: 'overall',
  })
  assert.match(markup, /class="mono-score">N\/A/)
  assert.match(markup, /width:0%/)
  assert.doesNotMatch(markup, /NaN|Infinity|undefined/)
  assert.equal((markup.match(/N\/A/g) ?? []).length, 8)
})

test('detail drawer safely renders completely missing score object and non-finite metadata', async () => {
  const markup = await renderComponent('/src/components/ModelDetailDrawer.vue', {
    categories, regions, model: { ...emptyModel, scores: undefined }, visible: true,
  })
  assert.match(markup, /Model Profile/)
  assert.match(markup, /width:0%/)
  assert.doesNotMatch(markup, /NaN|Infinity|undefined/)
  assert.ok((markup.match(/N\/A/g) ?? []).length >= 10)
})

test('zero benchmark, price, speed and latency remain visible in comparison and details', async () => {
  const measured = {
    ...emptyModel,
    scores: { overall: 0, coding: 0, price: 0, speed: 0 },
    meta: { tokensPerSecond: 0, timeToFirstTokenSeconds: 0, inputPrice: 0, outputPrice: 0 },
  }
  const compare = await renderComponent('/src/components/CompareDrawer.vue', {
    categories, regions, models: [measured], activeCategory: 'price',
  })
  assert.match(compare, /class="mono-score">\$0\.00/)
  assert.match(compare, /0\.00 tok\/s/)
  assert.match(compare, /0\.00s/)
  const detail = await renderComponent('/src/components/ModelDetailDrawer.vue', {
    categories, regions, model: measured, visible: true,
  })
  assert.match(detail, /\$0\.00 \/ 1M/)
  assert.match(detail, /<strong>0\.0<\/strong>/)
})

test('ladder excludes unmeasured models from ranks and handles zero speed without NaN scale', async () => {
  const markup = await renderComponent('/src/components/LadderChart.vue', {
    regions, category: 'speed', compareMode: 'region', selectedIds: [],
    models: [
      emptyModel,
      { ...emptyModel, id: 'invalid', name: 'Invalid Model', scores: { speed: Infinity } },
      { ...emptyModel, id: 'zero', name: 'Zero Model', scores: { speed: 0 } },
      { ...emptyModel, id: 'fast', name: 'Fast Model', scores: { speed: 10 } },
    ],
  })
  assert.doesNotMatch(markup, /Unmeasured Model|Invalid Model|NaN|Infinity/)
  assert.match(markup, /Zero Model/)
  assert.match(markup, /<strong>0\.0<\/strong>/)
  assert.match(markup, /--row-scale:0\.76/)
  assert.equal((markup.match(/class="rank-box"/g) ?? []).length, 2)
  assert.match(markup, /class="rank-box">01/)
  assert.match(markup, /class="rank-box">02/)
})

test('empty ladder and trends show unavailable state without fabricated zero measurements', async () => {
  const ladder = await renderComponent('/src/components/LadderChart.vue', {
    regions, category: 'overall', compareMode: 'region', selectedIds: [], models: [emptyModel],
  })
  assert.match(ladder, /class="axis-label top">N\/A/)
  assert.doesNotMatch(ladder, /class="rank-box"/)
  const trend = await renderComponent('/src/components/MonthlyTrendChart.vue', {
    category: 'overall', models: [{ ...emptyModel, meta: { releaseYearMonth: '2026-08' } }],
  })
  assert.match(trend, /class="trend-empty"/)
  assert.doesNotMatch(trend, /<svg/)
  const zeroTrend = await renderComponent('/src/components/MonthlyTrendChart.vue', {
    category: 'overall', models: [{ ...emptyModel, scores: { overall: 0 }, meta: { releaseYearMonth: '2026-08' } }],
  })
  assert.match(zeroTrend, /<svg/)
  assert.doesNotMatch(zeroTrend, /NaN|Infinity/)
})

test('sidebar marks unavailable dimensions and disables selecting them', async () => {
  const markup = await renderComponent('/src/layout/AppSidebar.vue', {
    categories: [{ key: 'overall', label: 'Overall', available: false }, { key: 'price', label: 'Price', available: true }],
    activeCategory: 'price', compareMode: 'region', visible: true, docked: true,
  })
  assert.match(markup, /disabled title="No measured scores are available for this category"/)
  assert.match(markup, /Overall Index · N\/A/)
  assert.equal((markup.match(/ disabled/g) ?? []).length, 1)
})

test('sub-cent prices are never displayed as free', async () => {
  const measured = { ...emptyModel, scores: { price: 0.001 }, meta: { inputPrice: 0.001, outputPrice: 0.0000001 } }
  const compare = await renderComponent('/src/components/CompareDrawer.vue', {
    categories, regions, models: [measured], activeCategory: 'price',
  })
  assert.match(compare, /class="mono-score">\$0\.001/)
  const detail = await renderComponent('/src/components/ModelDetailDrawer.vue', {
    categories, regions, model: measured, visible: true,
  })
  assert.match(detail, /\$0\.001 \/ 1M/)
  assert.match(detail, /\$1e-7 \/ 1M/)
  assert.doesNotMatch(detail, /\$0\.00<|\$0\.00 \/ 1M/)
})

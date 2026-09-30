<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from '../composables/useI18n'
import { CODEX_RADAR_SOURCE } from '../config/codexRadar.js'
import { fetchRadarSnapshot, rankRadarRows } from '../services/codexRadarService.js'

const { locale } = useI18n()
const zh = computed(() => locale.value === 'zh-CN')
const copy = (en, cn) => zh.value ? cn : en
const snapshot = ref(null)
const loading = ref(true)
const failed = ref(false)
const boardId = ref('')
const query = ref('')
let controller
const board = computed(() => snapshot.value?.boards.find(item => item.id === boardId.value) ?? snapshot.value?.boards[0] ?? null)
const modelCount = computed(() => new Set((board.value?.rows ?? []).map(row => row.model)).size)
const hasRawScore = computed(() => board.value?.rows.some(row => row.score !== null))
const hasSampleSize = computed(() => board.value?.rows.some(row => row.sampleSize !== null))
const rows = computed(() => rankRadarRows(board.value?.rows ?? []).filter(row => `${row.model} ${row.upstreamId ?? ''} ${row.effort ?? ''}`.toLowerCase().includes(query.value.trim().toLowerCase())))
const number = (value, digits = 1) => value === null ? '—' : new Intl.NumberFormat(locale.value, { maximumFractionDigits: digits }).format(value)
const time = (value) => value ? new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'UTC' }).format(new Date(value)) + ' UTC' : '—'
async function load() {
  controller?.abort()
  const request = new AbortController()
  controller = request
  loading.value = true
  failed.value = false
  try {
    snapshot.value = await fetchRadarSnapshot({ signal: request.signal })
    if (!snapshot.value.boards.some(item => item.id === boardId.value)) boardId.value = snapshot.value.boards[0]?.id ?? ''
  }
  catch (error) { if (error.name !== 'AbortError') { failed.value = true; snapshot.value = null } }
  finally { if (controller === request) loading.value = false }
}
onMounted(load)
onBeforeUnmount(() => controller?.abort())
</script>

<template>
  <main class="radar-page">
    <section class="radar-hero">
      <div class="radar-eyebrow"><span class="material-symbols-outlined" aria-hidden="true">radar</span> CODEX RADAR</div>
      <h1>{{ copy('Real work. Real evaluation.', '真实任务，实战评测。') }}</h1>
      <p>{{ copy('Explore model configurations in reproducible agent tasks. Benchmark-specific IQ stays separate from the Artificial Analysis intelligence index.', '观察模型配置在智能体任务中的实战表现。各基准的 IQ 分数独立展示，不与 Artificial Analysis 智能指数混合。') }}</p>
      <a class="radar-link" :href="CODEX_RADAR_SOURCE" target="_blank" rel="noopener noreferrer">{{ copy('Open original leaderboard', '查看原始榜单') }} ↗</a>
    </section>

    <div class="radar-principles">
      <article><span>01 / {{ copy('SCOPE', '评测范围') }}</span><h2>{{ copy('One benchmark at a time', '按基准独立比较') }}</h2><p>{{ copy('Dataset version and evaluation harness define each comparison.', '数据集版本与评测框架共同限定比较范围。') }}</p></article>
      <article><span>02 / {{ copy('IDENTITY', '配置身份') }}</span><h2>{{ copy('Configuration matters', '配置影响结果') }}</h2><p>{{ copy('Upstream model names and reasoning effort are preserved, without fuzzy matching.', '保留上游模型名称与推理强度，不模糊合并模型。') }}</p></article>
      <article><span>03 / {{ copy('EVIDENCE', '数据依据') }}</span><h2>{{ copy('No invented scores', '不编造分数') }}</h2><p>{{ copy('Missing values stay missing. Snapshot dates and sources remain visible.', '缺失数据不补零，明确展示快照时间与原始来源。') }}</p></article>
    </div>

    <section class="radar-results" :aria-busy="loading">
      <div class="radar-section-head"><h2>{{ copy('Benchmark IQ rankings', '基准 IQ 排名') }}</h2><span class="radar-badge">{{ copy('Independent benchmark', '独立评测') }}</span></div>
      <div v-if="loading" class="radar-empty" role="status">{{ copy('Loading verified snapshot…', '正在读取经验证的快照…') }}</div>
      <div v-else-if="failed" class="radar-empty" role="alert">
        <h3>{{ copy('Snapshot could not be loaded', '快照读取失败') }}</h3><p>{{ copy('The local data file is missing, invalid, or unavailable. No scores are shown.', '本地数据文件缺失、无效或不可用，暂不展示分数。') }}</p>
        <button class="radar-button" @click="load">{{ copy('Try again', '重试') }}</button>
      </div>
      <template v-else>
        <div v-if="snapshot?.status === 'unavailable'" class="radar-empty" role="status">
          <span class="material-symbols-outlined radar-empty-icon" aria-hidden="true">cloud_off</span>
          <h3>{{ copy('Verified rankings are not available yet', '暂未取得可验证的排名数据') }}</h3>
          <p>{{ copy('The documented upstream API returned HTTP 403 during verification. Live synchronization is not enabled, and no sample results are shown as real data.', '验证时，上游文档中的 API 返回 HTTP 403。实时同步尚未启用，也不会将示例结果作为真实数据展示。') }}</p>
          <a class="radar-link" :href="snapshot.sourceUrl" target="_blank" rel="noopener noreferrer">{{ copy('View results at Codex Radar', '前往 Codex Radar 查看结果') }} ↗</a>
          <small>{{ copy('Verification recorded', '验证记录时间') }}: {{ time(snapshot.checkedAt) }}</small>
        </div>
        <template v-else>
          <p class="radar-notice" :class="{ 'radar-stale': snapshot.stale }" role="status">{{ snapshot.stale ? copy('Stale snapshot: more than 7 days old. These results may no longer reflect the upstream board.', '快照已超过 7 天，结果可能已落后于上游榜单。') : snapshot.observation ? copy('Manually captured public-page snapshot. No automatic synchronization.', '公开页面人工采集快照，尚未启用自动同步。') : copy('Imported snapshot, not a live feed.', '已导入的快照，并非实时数据。') }} {{ copy('Captured', '采集时间') }}: {{ time(snapshot.capturedAt) }}</p>
          <div v-if="snapshot.observation" class="radar-observation">
            <strong>{{ copy('Partial coverage: Codex + DeepSWE only', '部分覆盖：仅 Codex + DeepSWE') }}</strong>
            <p>{{ modelCount }} {{ copy('model labels', '个模型名称') }} · {{ board?.rows.length ?? 0 }} {{ copy('effort configurations', '档推理配置') }} · {{ time(snapshot.capturedAt) }} → {{ time(snapshot.observation.observedThrough) }}</p>
            <p>{{ copy('Family tabs were observed sequentially. Other harnesses and mural are not included. Dataset revision was not reported; this is the displayed 112-task library.', '各模型分组依次采集，并非同一原子时刻。未覆盖其他框架和 mural。上游未提供数据集版本；展示范围为页面中的 112 题库。') }}</p>
            <p>{{ copy('Costs are median per-run API-equivalent token usage, not subscription charges. DeepSeek off-peak costs are labeled separately and are not standard-price comparisons.', '费用为每次运行 token 实耗按 API 价格折算的中位数，并非订阅扣费。DeepSeek 低谷价单独标注，不与标准价等同比较。') }}</p>
          </div>
          <div v-if="!snapshot.boards.length" class="radar-empty">{{ copy('This snapshot contains no benchmark boards.', '此快照尚无基准榜单。') }}</div>
          <template v-if="board">
            <div class="radar-filters">
              <label>{{ copy('Benchmark / dataset / harness', '基准 / 数据集 / 框架') }}<select v-model="boardId"><option v-for="item in snapshot.boards" :key="item.id" :value="item.id">{{ item.benchmark }} · {{ item.datasetVersion }} · {{ item.harness }}</option></select></label>
              <label>{{ copy('Filter configurations', '筛选配置') }}<input v-model="query" type="search" :placeholder="copy('Model or reasoning effort', '模型或推理强度')" /></label>
            </div>
            <p class="radar-meta">{{ board.methodology }} · {{ board.aggregation }}</p>
            <div class="radar-table-scroll" role="region" :aria-label="copy('Benchmark rankings', '基准排名')" tabindex="0">
              <table>
                <caption>{{ board.benchmark }} · {{ board.datasetVersion }} · {{ board.harness }} — {{ copy('Local configuration ranks; flagged low-coverage results stay unranked', '本地配置排名；低覆盖率警告项不参与排名') }}</caption>
                <thead><tr>
                  <th scope="col">#</th><th scope="col">{{ copy('Model / effort', '模型 / 推理强度') }}</th><th scope="col">IQ</th>
                  <th v-if="hasRawScore" scope="col">{{ board.metric === 'macro_f1' ? 'Macro-F1' : copy('Pass rate', '通过率') }}</th>
                  <th v-if="hasSampleSize" scope="col">{{ copy('Samples', '样本数') }}</th>
                  <th v-if="snapshot.observation" scope="col">{{ copy('Source count text', '来源计数原文') }}</th>
                  <th scope="col">{{ copy('API-equivalent USD', 'API 折算美元') }}</th><th scope="col">{{ copy('Mean minutes', '平均分钟') }}</th>
                  <th v-if="snapshot.observation" scope="col">{{ copy('Evidence', '数据依据') }}</th>
                </tr></thead>
                <tbody><tr v-for="row in rows" :key="JSON.stringify([row.upstreamId, row.model, row.effort])">
                  <td>{{ row.rank ?? '—' }}</td>
                  <th scope="row"><a :href="row.sourceUrl" target="_blank" rel="noopener noreferrer">{{ row.model }} ↗</a>
                    <small>{{ row.effort ?? copy('Effort not reported', '推理强度未提供') }}<template v-if="row.upstreamId"> · {{ row.upstreamId }}</template></small>
                    <small v-if="row.insufficientData" class="radar-warning">{{ copy('Insufficient coverage · unranked', '覆盖率不足 · 暂不排名') }}</small>
                    <small v-if="row.taskCoverage">{{ copy('Task coverage', '题目覆盖') }}: {{ row.taskCoverage.covered }}/{{ row.taskCoverage.total }} ({{ number(row.taskCoverage.percent) }}%)</small>
                  </th>
                  <td class="radar-iq">{{ number(row.iq) }}</td>
                  <td v-if="hasRawScore">{{ row.score === null ? '—' : `${number(row.score * 100)}%` }}</td>
                  <td v-if="hasSampleSize">{{ number(row.sampleSize, 0) }}</td>
                  <td v-if="snapshot.observation">{{ row.displayCount ?? '—' }}</td>
                  <td>{{ number(row.costUsd, 2) }}<small v-if="row.costBasis" :class="{ 'radar-warning': row.costBasis === 'deepseek_off_peak' }">{{ row.costBasis === 'deepseek_off_peak' ? copy('DeepSeek off-peak', 'DeepSeek 低谷价') : copy('Standard API price', '标准 API 价格') }}</small></td>
                  <td>{{ number(row.durationMinutes) }}</td>
                  <td v-if="snapshot.observation"><details class="radar-evidence"><summary>{{ copy('Source text', '来源原文') }}</summary><p>{{ row.sourceText }}</p><small>{{ time(row.observedAt) }}</small></details></td>
                </tr></tbody>
              </table>
            </div>
            <p v-if="!rows.length" role="status" class="radar-empty">{{ copy('No matching configurations.', '没有匹配的配置。') }}</p>
            <p class="radar-meta">{{ copy('— means unreported or unranked. Source count fractions are copied verbatim, not sample sizes or pass rates. Raw rates are not inferred from rounded IQ. Ties share a rank; filtering preserves ranks.', '— 表示未提供或未排名。来源计数分数原样保留，不视为样本量或通过率，也不从取整 IQ 反推原始通过率。相同 IQ 并列排名，筛选不改变排名。') }} <a :href="board.sourceUrl" target="_blank" rel="noopener noreferrer">{{ copy('Benchmark source', '基准来源') }} ↗</a></p>
          </template>
        </template>
      </template>
    </section>

    <details class="radar-method"><summary>{{ copy('What does this IQ score mean?', '这里的 IQ 分数代表什么？') }}</summary><p>{{ copy('Codex Radar uses task-evaluation metrics scaled to 150: DeepSWE uses mean pass rate, while mural uses Macro-F1. This is a benchmark label, not a measure of human IQ and not the Artificial Analysis intelligence index. Scores across different datasets or evaluation harnesses are not interchangeable.', 'Codex Radar 将任务评测指标映射到 150 分制：DeepSWE 使用平均通过率，mural 使用 Macro-F1。这是基准分数的名称，不代表人类智商，也不是 Artificial Analysis 智能指数。不同数据集或评测框架的分数不能直接互换。') }}</p><p>{{ copy('Only reviewed model-level snapshots are supported here. Task cells are not assumed to be model aggregates. A snapshot older than 7 days is marked stale by AI Ladder’s local display policy.', '此处仅支持经过核验的模型级快照，不将单任务单元格当作模型汇总数据。AI Ladder 的本地展示规则会将超过 7 天的快照标记为过期。') }}</p></details>
  </main>
</template>

<style scoped>
.radar-page { max-width: 1240px; margin: auto; padding: 40px 28px 80px; }
.radar-hero { max-width: 830px; padding: 20px 0 32px; }
.radar-eyebrow { color: var(--blue); font-size: 12px; letter-spacing: .16em; display: flex; gap: 10px; align-items: center; font-weight: 700; }
.radar-hero h1 { font-size: clamp(30px, 4.5vw, 52px); letter-spacing: -.045em; margin: 20px 0 18px; line-height: 1.15; }
.radar-hero p { font-size: 16px; max-width: 750px; line-height: 1.8; color: var(--muted); }
.radar-link { display: inline-block; color: var(--blue); font-size: 14px; margin: 8px 0; }
.radar-principles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 28px; }
.radar-principles article { padding: 22px; border: 1px solid var(--border); border-radius: 16px; background: var(--surface); }
.radar-principles span { font-size: 10px; letter-spacing: .1em; color: var(--blue); }
.radar-principles h2 { font-size: 16px; margin: 14px 0 8px; }
.radar-principles p, .radar-method p { font-size: 13px; line-height: 1.8; color: var(--muted); margin-bottom: 0; }
.radar-results { border: 1px solid var(--border); background: var(--surface); border-radius: 18px; overflow: hidden; }
.radar-section-head { display: flex; justify-content: space-between; gap: 12px; align-items: center; padding: 22px; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
.radar-section-head h2 { font-size: 18px; margin: 0; }
.radar-badge { font-size: 11px; color: var(--blue); background: rgba(var(--blue-rgb), .07); padding: 7px 10px; border-radius: 6px; }
.radar-empty { text-align: center; padding: 48px 24px; }
.radar-empty h3 { font-size: 19px; margin: 18px 0 10px; }
.radar-empty p { max-width: 600px; margin: 0 auto 12px; color: var(--muted); font-size: 14px; line-height: 1.8; }
.radar-empty small { display: block; color: var(--muted); margin-top: 18px; font-size: 11px; }
.radar-empty-icon { font-size: 32px; color: var(--muted); }
.radar-button { cursor: pointer; padding: 10px 18px; color: var(--text); background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; }
.radar-method { margin-top: 24px; padding: 22px; border: 1px solid var(--border); border-radius: 14px; }
.radar-method summary { cursor: pointer; font-size: 14px; font-weight: 600; }
.radar-notice { margin: 20px; font-size: 13px; line-height: 1.8; color: var(--muted); }
.radar-stale, .radar-warning, table small.radar-warning { color: var(--orange); }
.radar-observation { margin: 20px; padding: 16px; border-left: 3px solid var(--blue); background: rgba(var(--blue-rgb), .05); font-size: 13px; line-height: 1.8; }
.radar-observation p { margin: 6px 0 0; color: var(--muted); }
.radar-evidence summary { cursor: pointer; color: var(--blue); font-size: 12px; }
.radar-evidence p { max-width: 240px; white-space: normal; font-size: 12px; }
.radar-filters { display: flex; flex-wrap: wrap; padding: 0 20px; gap: 16px; }
.radar-filters label { display: grid; gap: 8px; font-size: 12px; color: var(--muted); flex: 1; min-width: 0; }
.radar-filters input, .radar-filters select { min-width: 0; width: 100%; padding: 12px; color: var(--text); background: var(--bg); border: 1px solid var(--border); border-radius: 8px; }
.radar-meta { padding: 0 20px; font-size: 12px; color: var(--muted); line-height: 1.8; }
.radar-meta a, table a { color: var(--blue); }
.radar-table-scroll { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; text-align: left; font-size: 13px; }
caption { padding: 16px 20px; text-align: left; font-size: 12px; color: var(--muted); }
th, td { padding: 16px; border-bottom: 1px solid var(--border); white-space: nowrap; }
thead { background: var(--surface-2); font-size: 11px; color: var(--muted); }
tbody th { font-weight: 500; }
table small { display: block; font-size: 10px; color: var(--muted); margin-top: 5px; }
.radar-iq { font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; }
@media (max-width: 680px) { .radar-page { padding: 24px 16px 48px; } .radar-principles { grid-template-columns: 1fr; gap: 10px; } .radar-principles article { padding: 16px; } .radar-principles h2 { margin-top: 8px; } .radar-empty { padding: 32px 18px; } .radar-filters { flex-direction: column; } }
</style>

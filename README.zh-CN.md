# AI Ladder

[English](./README.md)

一个基于 `Vue 3 + Vite` 的 AI 模型榜单与 Coding Plan 浏览项目。

当前项目包含两个核心页面：

- `Leaderboard`：浏览并对比来自 Artificial Analysis 的模型基准数据
- `Coding Plans`：浏览手工维护的各家官方编码订阅方案

## 功能

- 多维榜单排序
- 按模型、厂商、标签搜索
- 最多同时对比 3 个模型
- 模型详情抽屉，展示 benchmark 与价格元数据
- 官方 Coding Plan 浏览，支持双语字段
- `USD/CNY` 汇率参考展示

## 技术栈

- Vue 3
- Vite
- 原生 CSS
- Python 数据抓取脚本
- Node 汇率更新脚本

## 快速开始

安装依赖：

```bash
npm install
```

启动开发环境：

```bash
npm run dev
```

构建：

```bash
npm run build
```

预览生产构建：

```bash
npm run preview
```

## 数据更新

刷新 Artificial Analysis 榜单数据：

```bash
npm run update:artificial-analysis
```

刷新汇率数据：

```bash
npm run update:exchange-rates
```

手工维护的 Coding Plan 数据位于：

```text
public/data/coding-plans.json
```

## 项目结构

```text
.
├── api/                         # Python 数据抓取与转换脚本
├── public/data/                 # 运行时 JSON 数据
├── scripts/                     # 本地数据更新脚本
├── src/
│   ├── components/              # 通用 UI 组件
│   ├── composables/             # 视图状态与 i18n
│   ├── layout/                  # 应用骨架
│   ├── pages/                   # 页面级视图
│   ├── sections/                # 页面分区
│   └── services/                # 数据加载与归一化
├── .github/workflows/           # 定时更新工作流
├── package.json
└── vite.config.js
```

## 数据来源

- Leaderboard：`public/data/artificial-analysis-llms.json`
  - 排名、价格、延迟：Artificial Analysis
  - 发布时间、开源权重、模型元数据：LLM Stats `/v1/models`
  - benchmark 分数矩阵：LLM Stats `/v1/scores`
- Coding Plans：`public/data/coding-plans.json`
- 汇率：`public/data/exchange-rates.json`

`src/services/leaderboardService.js` 是主要的数据归一化层，负责加载 JSON、校验基础字段，并把厂商级 Coding Plan 关联到对应模型。

每个模型的 benchmark 明细会保存在：

```text
meta.benchmarks.llmStats
```

其中包含原始分数、归一化分数、`verified` 标记和 `scoredAt` 时间戳。若只想拉取已验证的 benchmark 记录，可在更新时加上：

```bash
LLM_STATS_VERIFIED_ONLY=true npm run update:artificial-analysis
```

## 多语言

界面文案当前支持：

- `zh-CN`
- `en-US`

`coding-plans.json` 中面向用户展示的字段，既可以是纯字符串，也可以是多语言对象：

```json
{
  "zh-CN": "¥49 / 月",
  "en-US": "¥49 / month"
}
```

## 维护约定

- `Coding Plans` 只收录官网可核对的订阅制或席位制方案
- 配额文案优先简短直接，不保留冗长的溯源说明
- 价格、限制、备注等 UI 展示字段尽量保持中英双语
- 修改数据文件后，建议执行：

```bash
jq . public/data/coding-plans.json >/dev/null
npm run build
```

## Artificial Analysis V2 迁移

更新脚本默认使用 `/api/v2/language/models/free`，原有 Free、Pro、Commercial
API key 均可使用。停用旧 `/api/v2/data/*` 路径；先抓取并验证全部分页，再应用
本地模型数量上限。无效、空白、不完整或没有智能指数测量的响应不会覆盖上次有效快照，
成功生成后以原子方式替换 JSON。

Free 不提供 GPQA 和混合价格。缺失值保留为 `null`，界面显示 `N/A`，不可用的
排行榜分类不展示，不从其他指标推算；输入、输出价格仍可在详情查看。
适配嵌套 `performance`、`gpqa_diamond`、发布日期和厂商别名，并兼容旧模型字段。

如已订阅 Pro/Commercial，可显式设置环境变量或同名 GitHub 仓库变量：

```bash
ARTIFICIAL_ANALYSIS_API_URL=https://artificialanalysis.ai/api/v2/language/models
```

快照记录返回的套餐及智能指数版本。认证/权限错误不重试；临时错误有界退避重试；
每日配额要求等待超过 120 秒时安全失败，留待下次定时更新。

离线验证（Python 需要安装 `api/requirements.txt` 中的 `requests`）：

```bash
npm test
npm run build
```

参考：[Artificial Analysis API 文档](https://artificialanalysis.ai/data-api/docs)。

### Performance v3（2026 年 12 月 10 日切换）

上游将在 2026 年 12 月 10 日把旧 `performance` 字段置空，并忽略 `prompt_type`。
脚本现已在 Free、Pro/Commercial 响应中优先读取 `performance_v3` 的三项均值：

- `mean_output_tokens_per_second` → 速度排行、摘要和 `meta.tokensPerSecond`
- `mean_time_to_first_token_seconds` → TTFT 和 `meta.timeToFirstTokenSeconds`
- `mean_time_to_first_answer_token_seconds` → `meta.timeToFirstAnswerTokenSeconds`

这不是给旧中位数改名。v3 速度包含首 token 等待时间及推理 token，采用五天窗口内
已测工作负载的等权平均；模型数据通常来自代表性端点，必要时使用上游规定的跨端点
回退。因此，切换前后快照的数值变化不能直接当作性能提升或退步。详情及对比卡片
注明测量口径，每个模型的 `meta` 保留 `performanceSchema`、`performanceAggregation`
以及 Pro 可选的 `performanceBucketDate`，快照统计列出使用的 `performanceSchemas`。

只要存在 v3 字段，就以它为准：空对象、空字段、缺失字段或无效数值均保留为缺测，
真实的零值仍为零。仅完全没有 v3 字段时兼容旧嵌套或平铺字段；不会用旧数据填补
v3 缺测，也不会用单工作负载、单任务耗时替代整体均值，或从速度估算首答案延迟。
格式错误会使更新失败，并保留上次有效文件。

两个端点现在都只发送 `page`，`stats.promptType` 始终为空。为兼容旧调用，
`--prompt-type` / `ARTIFICIAL_ANALYSIS_PROMPT_TYPE` 仍可传入，但不再生效；
可从本地及 CI 配置中移除。定时工作流已不再设置性能预设。

`tests/test_artificial_analysis.py` 覆盖契约、缺测、零值及兼容场景，但离线测试不能
代替携带 API key 的真实抓取。现有已提交快照不会被伪装成 v3 或用旧中位数重算。
迁移合并后，下次成功的定时更新将使用 v3。如需手动核验，请先用两个 API key
运行更新脚本，并将 `--output` 指向仓库快照以外的临时路径，检查速度、延迟及
`meta.performanceSchema` 后再替换正式数据。

参考：[接口契约](https://artificialanalysis.ai/data-api/docs/reference)、
[停用说明](https://artificialanalysis.ai/data-api/docs#deprecations)及
[性能测量方法](https://artificialanalysis.ai/methodology/performance-benchmarking)。

## 手动更新 Codex Radar

独立页面 `#/codex-radar` 使用注明时间与来源的公开页面快照。
更新时先采集并核对来源，再运行 `npm run import:codex-radar -- snapshot.json`、
`npm run validate:codex-radar`、测试与构建，提交到新分支并创建草稿 PR。
**AI Ladder CI** 只校验数据、运行测试和构建，不访问上游接口，也不部署。
详见[手动更新指南](docs/codex-radar.md#manual-refresh-source-observation--reviewed-data-pr)，
其中包括数据格式、来源核验、GitHub 界面操作，以及 Run workflow 需工作流先进入默认分支的限制。

速度排名及均值、跨度按统计口径分组显示：v3 均值（有测量值时默认）、
旧版中位数、未标注口径的历史数据。可在速度榜切换查看，搜索不会自动
改变口径。未标注的历史数值保留，但明确提示可比性未知，不推断其口径。
混合数据的排名、统计与月度领跑工具均有离线回归测试。主页仍不显示速度
或价格月度图；月度工具本身也防止混合速度口径。

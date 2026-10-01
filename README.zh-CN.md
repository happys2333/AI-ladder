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
ARTIFICIAL_ANALYSIS_PROMPT_TYPE=long
```

旧 `ARTIFICIAL_ANALYSIS_PROMPT_LENGTH`、`ARTIFICIAL_ANALYSIS_PARALLEL_QUERIES`
改为 `PROMPT_TYPE`，支持 `medium`、`long`、`100k`、`vision_single_image`、
`medium_coding`、`medium_parallel`。Free 仅发送 `page`，不声称使用某个性能预设。
快照记录返回的套餐及智能指数版本。认证/权限错误不重试；临时错误有界退避重试；
每日配额要求等待超过 120 秒时安全失败，留待下次定时更新。

离线验证（Python 需要安装 `api/requirements.txt` 中的 `requests`）：

```bash
npm test
npm run build
```

参考：[Artificial Analysis API 文档](https://artificialanalysis.ai/data-api/docs)。

## 手动更新 Codex Radar

独立页面 `#/codex-radar` 使用注明时间与来源的公开页面快照。
更新时先采集并核对来源，再运行 `npm run import:codex-radar -- snapshot.json`、
`npm run validate:codex-radar`、测试与构建，提交到新分支并创建草稿 PR。
**AI Ladder CI** 只校验数据、运行测试和构建，不访问上游接口，也不部署。
详见[手动更新指南](docs/codex-radar.md#manual-refresh-source-observation--reviewed-data-pr)，
其中包括数据格式、来源核验、GitHub 界面操作，以及 Run workflow 需工作流先进入默认分支的限制。

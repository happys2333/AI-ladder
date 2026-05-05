# AI Ladder

一个基于 `Vue 3 + Vite` 的 AI 模型天梯榜项目，用于多维度比较不同模型的优劣。

项目视觉风格重点参考了仓库中的 `code.html` 与 `DESIGN.md`，采用深色、高密度、偏技术面板的排行榜设计，并将榜单数据抽离为 JSON，方便后续通过 API 定时更新。

## 功能特性

- 多维度榜单切换：综合、代码、推理，以及 API 同步后可直接展示的 benchmark 维度
- 双阵营展示：左侧中国模型，右侧全球模型
- 搜索与筛选：支持按模型名、厂商、标签搜索
- 多指标排序：支持按分数、1M token 综合价格、输出速度、首 token 延迟排序
- 模型横向对比：最多同时选择 3 个模型进行比较
- 双视角对比：支持按国家或按开源/其他分组展示
- 模型详情抽屉：查看单个模型的详细维度分数
- 数据更新时间展示：支持显示榜单最新更新时间
- JSON 驱动数据源：可由 GitHub Actions 自动生成并更新
- 手工补充厂商 Coding Plan：通过独立 JSON 维护

## 技术栈

- Vue 3
- Vite
- 原生 CSS

## 本地开发

安装依赖：

```bash
npm install
```

启动开发环境：

```bash
npm run dev
```

构建生产版本：

```bash
npm run build
```

手动刷新 Artificial Analysis 榜单数据：

```bash
npm run update:artificial-analysis
```

本地预览构建结果：

```bash
npm run preview
```

## 项目结构

```text
.
├── src/
│   ├── components/          # 通用展示组件
│   │   ├── BottomActionBar.vue
│   │   ├── CompareDrawer.vue
│   │   ├── LadderChart.vue
│   │   └── ModelDetailDrawer.vue
│   ├── composables/         # 状态与业务逻辑
│   │   └── useLeaderboard.js
│   ├── config/              # 项目配置与默认值
│   │   └── leaderboard.js
│   ├── data/                # 手工数据或兼容性数据
│   │   └── leaderboard.json
│   ├── layout/              # 页面结构组件
│   │   ├── AppHeader.vue
│   │   └── AppSidebar.vue
│   ├── sections/            # 页面区块组件
│   │   └── HeroPanel.vue
│   ├── services/            # 数据服务层
│   │   └── leaderboardService.js
│   ├── App.vue
│   ├── main.js
│   └── style.css
├── public/
│   └── data/
│       ├── artificial-analysis-llms.json
│       └── coding-plans.json
├── api/
│   ├── artificial_analysis.py
│   ├── requirements.txt
│   └── scripts/
│       └── generate_artificial_analysis.py
├── .github/
│   └── workflows/
│       └── update-artificial-analysis.yml
├── index.html
├── package.json
└── vite.config.js
```

## 数据来源

当前前端默认读取的数据来自：

`public/data/artificial-analysis-llms.json`

示例结构：

```json
{
  "categories": [
    { "key": "overall", "label": "综合" },
    { "key": "coding", "label": "代码" }
  ],
  "regions": [
    { "key": "cn", "label": "中国阵营" },
    { "key": "global", "label": "全球阵营" }
  ],
  "models": [
    {
      "id": "deepseek-r1",
      "name": "DeepSeek-R1",
      "region": "cn",
      "vendor": "DeepSeek",
      "summary": "推理性能强，成本控制优秀",
      "tags": ["MoE", "Reasoning", "Value"],
      "pricing": "$0.55 / 1M in",
      "latency": "1.4s",
      "scores": {
        "overall": 97.6,
        "coding": 95.8,
        "reasoning": 99.1,
        "efficiency": 93.7,
        "context": 90.4,
        "multimodal": 68.0
      }
    }
  ],
  "lastUpdated": "2026-05-04T10:30:00+08:00"
}
```

## 数据字段说明

### `categories`

定义顶部/侧边栏可切换的评分维度。

- `key`: 维度唯一标识，对应 `scores` 中的字段名
- `label`: 页面展示名称

### `regions`

定义模型所属阵营。

- `key`: 阵营唯一标识
- `label`: 页面展示名称

### `models`

定义榜单中的模型条目。

- `id`: 模型唯一标识
- `name`: 模型名称
- `region`: 模型所属阵营，需要与 `regions.key` 对应
- `vendor`: 厂商名
- `summary`: 模型简介
- `tags`: 标签列表
- `pricing`: 价格描述
- `latency`: 延迟描述
- `scores`: 各维度分数对象，字段名需与 `categories.key` 对齐
- `meta`: 原始 API 派生的补充指标，例如价格、速度、延迟与 benchmark 明细
- `codingPlans`: 手工维护的厂商 coding plan 列表

### `lastUpdated`

用于显示榜单更新时间，推荐使用 ISO 时间字符串。

## 如何更新榜单

### 方式一：通过 GitHub Actions 自动生成

当前已实现 `Artificial Analysis` 自动更新链路：

- 工作流：`.github/workflows/update-artificial-analysis.yml`
- 入口脚本：`api/artificial_analysis.py`
- 核心生成器：`api/scripts/generate_artificial_analysis.py`
- 输出文件：`public/data/artificial-analysis-llms.json`

工作流会定时运行 Python 脚本，请求 `https://artificialanalysis.ai/api/v2/data/llms/models`，一次性拉取整批 LLM 榜单数据，转换为前端统一格式，然后自动提交更新后的 JSON 文件。

接口鉴权方式：

- 请求头：`x-api-key`
- GitHub Actions Secret：`ARTIFICIAL_ANALYSIS_API_KEY`

脚本支持以下可配置参数：

- `--api-key`
- `--api-url`
- `--output`
- `--prompt-length`
- `--parallel-queries`

对应环境变量：

- `ARTIFICIAL_ANALYSIS_API_KEY`
- `ARTIFICIAL_ANALYSIS_API_URL`
- `ARTIFICIAL_ANALYSIS_OUTPUT`
- `ARTIFICIAL_ANALYSIS_PROMPT_LENGTH`
- `ARTIFICIAL_ANALYSIS_PARALLEL_QUERIES`

当前策略是每次同步只发起一次主请求，尽量在单次请求里拿到榜单的大部分模型信息，避免逐模型请求导致配额浪费。开源/开放权重分组优先使用 API 直出的字段，只有字段缺失时才做兜底判断。

当前生成器会优先保留官方文档明确给出的 benchmark 与性能字段，包括：

- `artificial_analysis_intelligence_index`
- `artificial_analysis_coding_index`
- `artificial_analysis_math_index`
- `mmlu_pro`
- `gpqa`
- `hle`
- `livecodebench`
- `scicode`
- `math_500`
- `aime`
- `price_1m_blended_3_to_1`
- `price_1m_input_tokens`
- `price_1m_output_tokens`
- `median_output_tokens_per_second`
- `median_time_to_first_token_seconds`
- `median_time_to_first_answer_token`

当前生成器默认只保留综合排序前 `500` 个模型，避免前端数据量过大，同时覆盖大部分榜单头部模型。

本地也可以手动执行：

```bash
npm run update:artificial-analysis
```

### 方式二：直接修改本地 JSON

编辑 `public/data/artificial-analysis-llms.json` 或 `src/data/leaderboard.json` 即可。

手工维护各家 coding plans 时，编辑：

`public/data/coding-plans.json`

适合：

- 手动维护榜单
- 静态展示项目
- 先定义数据结构再对接后端

### 方式三：后续接入更多外部 API

当前已经预留服务层与脚本层：

`src/services/leaderboardService.js`

`api/artificial_analysis.py`

其中包含：

- `fetchLeaderboardData()`：读取生成后的 JSON 文件
- `fetchLeaderboardDataFromApi()`：从 `/api/leaderboard` 拉取数据的预留方法

后续如果你还要接入别的数据源，也可以沿用同一模式：拉取源数据，转换成统一结构，输出到 `public/data/*.json`，再让前端按 source 切换读取。

## 当前交互说明

- 单击模型卡片：加入或移出对比区
- 双击模型卡片：打开模型详情抽屉
- 底部操作条：快速跳转到对比区、清空选择

## 设计说明

本项目重点参考以下设计方向：

- 中轴天梯式排行布局
- 深色高密度技术面板风格
- 使用 `Inter` 负责 UI 文案
- 使用 `Roboto Mono` 展示数值数据
- 用颜色区分榜单层级与交互状态

## 后续建议

- 增加真实后端 API 接入
- 增加历史版本榜单对比
- 增加图表模式，例如雷达图或趋势图
- 增加导出 JSON / CSV 功能
- 增加模型详情中的更多 benchmark 指标

## 说明

当前环境里无法直接读取你提到的 `screen.png`，所以现阶段的视觉实现主要基于 `code.html` 与 `DESIGN.md`。如果后续你补充图片中的关键视觉要素，我可以继续把界面向目标稿进一步收敛。

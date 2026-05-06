# AI Ladder

一个基于 `Vue 3 + Vite` 的 AI 模型信息聚合项目，当前包含两个核心页面：

- `Leaderboard`：聚合 Artificial Analysis 模型榜单，支持多维排序、搜索、对比与详情查看
- `Coding Plans`：手工维护各家官方编码订阅 / 席位方案，统一展示价格、配额、适用人群和权益

项目目标不是做模型调用网关，而是把分散、难比较、更新频繁的模型信息整理成一个可浏览、可对比、可持续维护的前端站点。

## 项目解决的核心痛点

- 模型榜单、价格、速度、延迟、编码订阅方案分散在不同来源，横向比较成本高
- 同一家厂商的编码套餐命名、配额口径、计费方式差异很大，用户很难快速看懂
- 很多官方页面只给模糊文案或活动页口径，需要统一整理为结构化字段
- 面向中文用户时，英文原始数据与人民币价格、汇率参考之间存在理解门槛

## 核心逻辑流

项目当前是一个“数据采集与标准化 + 前端展示”的架构，不包含运行时长链推理，也不包含多 Agent 协作编排。

主流程如下：

1. 通过 `api/artificial_analysis.py` 拉取 Artificial Analysis 数据，并转换为前端统一 JSON。
2. 通过 `public/data/coding-plans.json` 手工维护官方可核对的订阅信息。
3. 通过 `scripts/update-exchange-rates.mjs` 生成 `USD/CNY` 参考汇率。
4. 前端在运行时读取 `public/data/*.json`，进行校验、归一化和展示。
5. `leaderboardService.js` 会按厂商 `vendor / creatorSlug` 将 coding plans 自动挂载到对应模型详情中。

## 功能概览

- 多维榜单切换：综合、代码、推理、价格、速度、复杂任务、多模态等
- 搜索与筛选：按模型名、厂商、标签搜索
- 双视角比较：按区域或按开源属性查看模型分组
- 模型横向对比：最多同时选择 3 个模型
- 模型详情抽屉：查看价格、延迟、速度、基准分数和关联 coding plans
- Coding Plans 页面：按厂商查看官方订阅方案、价格、配额、席位和说明
- 中英双语：静态文案与套餐字段均支持 `zh-CN / en-US`
- 汇率参考：展示 `USD/CNY` 参考值，帮助理解美元订阅价格

## 技术栈

- `Vue 3`
- `Vite`
- 原生 `CSS`
- Python 脚本：用于榜单数据抓取与转换
- Node 脚本：用于汇率数据生成

## 快速开始

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

本地预览：

```bash
npm run preview
```

## 数据更新

刷新 Artificial Analysis 榜单：

```bash
npm run update:artificial-analysis
```

刷新汇率参考：

```bash
npm run update:exchange-rates
```

Python 脚本建议使用 `Python 3.10+`。仓库内已包含 `api/requirements.txt`。

## 页面结构

### `/`

模型天梯榜主页，核心交互包括：

- 切换评分维度
- 切换比较视角
- 搜索模型
- 价格升降序切换
- 选择模型进入对比区
- 打开模型详情抽屉

### `/coding-plans`

编码订阅页，核心交互包括：

- 查看厂商级套餐摘要
- 展开单个厂商的全部订阅档位
- 浏览价格、计费周期、席位、权益和配额
- 跳转官方来源页进行核对

## 数据文件

### `public/data/artificial-analysis-llms.json`

前端主榜单数据源，包含：

- `categories`
- `regions`
- `models`
- `lastUpdated`
- `source`
- `stats`

### `public/data/coding-plans.json`

手工维护的官方编码订阅数据源，按厂商组织：

- `providerSlug`
- `providerName`
- `productName`
- `summary`
- `source`
- `notes`
- `plans[]`

每个 `plan` 当前支持：

- `name`
- `price`
- `cadence`
- `seats`
- `audience`
- `limits`
- `access`
- `notes`

这些字段既可以是纯字符串，也可以是：

```json
{
  "zh-CN": "¥49 / 月",
  "en-US": "¥49 / month"
}
```

### `public/data/exchange-rates.json`

汇率参考数据，当前由欧洲央行日更数据生成，主要供 `Coding Plans` 页面展示 `USD/CNY` 参考值。

## 代码结构

```text
.
├── api/
│   ├── artificial_analysis.py
│   ├── requirements.txt
│   └── scripts/generate_artificial_analysis.py
├── public/data/
│   ├── artificial-analysis-llms.json
│   ├── coding-plans.json
│   └── exchange-rates.json
├── scripts/
│   └── update-exchange-rates.mjs
├── src/
│   ├── components/
│   ├── composables/
│   ├── config/
│   ├── data/
│   ├── layout/
│   ├── pages/
│   ├── sections/
│   ├── services/
│   ├── App.vue
│   ├── main.js
│   └── style.css
├── .github/workflows/
│   ├── update-artificial-analysis.yml
│   └── update-exchange-rates.yml
├── package.json
└── vite.config.js
```

## 关键实现说明

### `src/services/leaderboardService.js`

负责三类工作：

- 读取榜单、coding plans、汇率数据
- 对模型和字段做基础校验与归一化
- 将厂商级 coding plans 自动关联到具体模型详情

### `src/composables/useLeaderboard.js`

负责榜单页状态管理：

- 当前维度
- 当前比较视角
- 搜索词
- 已选模型
- 模型详情抽屉

### `src/composables/useI18n.js`

负责：

- `zh-CN / en-US` 切换
- 本地语言持久化
- 多语言字段解析

## 维护约定

- `Coding Plans` 只收录官网可核对的订阅制或席位制方案
- 文案优先面向用户理解，不保留“已核对于某日”这类低价值说明
- 配额描述尽量短，优先写相对关系或关键数字，不堆长段帮助中心口径
- 所有面向用户展示的价格、限制、备注字段，优先保持中英双语

## 后续可扩展方向

- 引入更多榜单来源并做多源对照
- 增加历史快照与涨跌变化视图
- 为 Coding Plans 增加筛选、排序和差异比较
- 增加更多汇率与地区化价格展示
- 将手工维护的订阅数据接入后台 CMS 或自动校对流程

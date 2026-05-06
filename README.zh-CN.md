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
- Coding Plans：`public/data/coding-plans.json`
- 汇率：`public/data/exchange-rates.json`

`src/services/leaderboardService.js` 是主要的数据归一化层，负责加载 JSON、校验基础字段，并把厂商级 Coding Plan 关联到对应模型。

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

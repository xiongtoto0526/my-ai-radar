# AI Daily Radar

一个轻量级 Node.js 工具项目，用于定时抓取 AI 站点内容，通过兼容 OpenAI 的模型提炼产品摘要，再把结果推送到企业微信机器人。

## 本地运行

1. 安装依赖

```bash
npm install
```

2. 复制环境变量模板并填写实际值

```bash
cp .env.example .env
```

3. 执行任务

```bash
npm run radar
```

## 环境变量

- `LLM_API_KEY`: LLM 接口密钥
- `LLM_BASE_URL`: 兼容 OpenAI 的接口地址，例如 `https://api.openai.com/v1`
- `WECHAT_WEBHOOK`: 企业微信机器人 Webhook 地址
- `LLM_MODEL`: 可选，默认 `gpt-4o-mini`
- `RADAR_TARGET_URLS`: 可选，逗号分隔的抓取地址列表

## 项目结构

```text
.
├── .github/workflows/daily_radar.yml
├── data/history.json
├── src/config.js
├── src/historyStore.js
├── src/index.js
├── src/notifier.js
├── src/processor.js
└── src/scraper.js
```

## 说明

- 抓取使用 `https://r.jina.ai/{URL}`。
- 每个来源抓取失败不会中断整体流程。
- 当模型无结果或解析失败时，会退化为发送“今日暂无重大更新”。
- `data/history.json` 用于本地或单次运行时去重；如果希望 GitHub Actions 跨天保留历史，需要额外接入持久化方案。

## OpenRouter 配置示例

推荐把密钥只放在 `.env` 或 GitHub Secrets 中，不要写进仓库文件。

```env
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_MODEL=openrouter/free
```

## WECHAT_WEBHOOK
Xmaster的企业微信，幸福之家团队

## todo
github action integration
# AI Daily Radar

一个轻量级 Node.js 工具项目，用于抓取 AI 产品 changelog 页面，提取每个来源的最新一条官方更新，补充发布时间和摘要后，推送到企业微信机器人。

## 当前行为

- 抓取通过 `https://r.jina.ai/{URL}` 获取 Markdown。
- 对 changelog 类来源只取“最新一条”更新，而不是整页多条历史记录。
- 如果页面存在官方发布时间，会在推送消息里展示。
- 链接会使用企业微信 Markdown 可点击格式。
- `data/history.json` 使用 `name + publishedAt + sourceUrl` 做去重。
- 某个来源抓取失败或模型解析失败，不会中断其他来源。

## 当前默认来源

- GitHub Copilot Changelog
- Cursor Changelog
- Gemini API Changelog

也可以通过 `.env` 里的 `RADAR_TARGET_URLS` 覆盖。

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

4. 启动 API 服务

```bash
npm run serve
```

## 环境变量

- `LLM_API_KEY`: LLM 接口密钥
- `LLM_BASE_URL`: 兼容 OpenAI 的接口地址
- `WECHAT_WEBHOOK`: 企业微信机器人 Webhook 地址
- `LLM_MODEL`: 可选，OpenRouter 默认推荐 `openrouter/free`
- `LLM_MODEL_FALLBACKS`: 可选，逗号分隔的备用模型列表
- `LLM_REQUEST_TIMEOUT_MS`: 可选，单次 LLM 请求超时，默认 `45000`
- `RADAR_TARGET_URLS`: 可选，逗号分隔的抓取地址列表
- `RADAR_API_KEY`: API 服务调用密钥
- `RADAR_API_PORT`: API 服务监听端口，默认 `3000`

## OpenRouter 示例

```env
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_MODEL=openrouter/free
```

## API 服务

项目现在同时支持两种运行方式：

- `npm run radar`: 直接执行一次任务，适合 GitHub Actions 定时跑
- `npm run serve`: 启动 HTTP API 服务，适合你手动或外部系统触发

API 端点：

- `GET /health`: 健康检查
- `POST /run`: 触发一次雷达任务

认证方式：

- 请求头 `x-api-key: <RADAR_API_KEY>`
- 或 `Authorization: Bearer <RADAR_API_KEY>`

调用示例：

```bash
curl -X POST http://localhost:3000/run \
	-H "Content-Type: application/json" \
	-H "x-api-key: your_api_key" \
	-d '{}'
```

如果你只想执行但不发送企业微信，可以传：

```bash
curl -X POST http://localhost:3000/run \
	-H "Content-Type: application/json" \
	-H "x-api-key: your_api_key" \
	-d '{"notify":false}'
```

返回结果会包含：

- 每个来源的执行状态
- 本次抽取数量
- 去重后数量
- 最终条目列表
- 最新生成的消息内容

注意：`POST /run` 是同步接口，会等本次抓取和 LLM 处理全部完成后再返回。如果某个外部来源或 LLM 较慢，请求会等更久。当前代码已经为单次 LLM 请求加了超时控制，避免无限挂起。

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

## 运行日志

运行时会输出：

- 每个来源抽取到的条目数量
- 每条最终选中的标题、发布时间、直达链接
- 去重前后的数量统计

这样可以直接排查“为什么是 0 条”或者“为什么选中了错误的最新更新”。

## GitHub Actions

仓库已包含 GitHub Actions 工作流文件：[.github/workflows/daily_radar.yml](.github/workflows/daily_radar.yml#L1)

工作流支持：

- 每天 `UTC 01:00` 自动执行
- `workflow_dispatch` 手动触发
- 使用 `npm ci` 安装依赖
- 执行前先跑 `npm run check`
- 每次运行后自动把最新的 `data/history.json` 提交回仓库，作为去重历史
- 仍然使用 `npm run radar` 直接执行，不依赖 API 服务

关于 `history.json` 的持久化行为：

- 每次运行都会直接使用仓库里的 `data/history.json`
- 如果本次有新增条目，workflow 结束后会自动提交更新后的 `data/history.json`
- 如果某天没有新条目，`history.json` 可能基本不变；这是正常现象，说明去重仍在生效
- 这样不会依赖 GitHub Actions cache，也不会出现“仓库文件和 cache 内容不一致”的问题

需要在仓库 Secrets 中配置：

- `LLM_API_KEY`
- `LLM_BASE_URL`
- `WECHAT_WEBHOOK`
- `LLM_MODEL`
- `LLM_MODEL_FALLBACKS`
- `RADAR_TARGET_URLS`

推荐的 GitHub Secrets 示例：

```text
LLM_API_KEY=your_openrouter_key
LLM_BASE_URL=https://openrouter.ai/api/v1
WECHAT_WEBHOOK=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=your_key
LLM_MODEL=openrouter/free
LLM_MODEL_FALLBACKS=
RADAR_TARGET_URLS=https://github.blog/changelog/label/copilot,https://cursor.com/changelog,https://ai.google.dev/gemini-api/docs/changelog
```

配置步骤：

1. 打开仓库 `Settings -> Secrets and variables -> Actions`
2. 逐个新增上面的 secrets
3. 打开 `Actions` 页面
4. 找到 `Daily AI Radar`
5. 点击 `Run workflow` 先手动验证一次

如果手动运行通过，后续就会按 cron 自动执行。
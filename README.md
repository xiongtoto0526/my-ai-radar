# AI Daily Radar

一个轻量级 Node.js 工具项目，用于抓取 AI 产品 changelog 页面，提取每个来源的最新一条官方更新，补充发布时间和摘要后，推送到企业微信机器人。历史去重数据存储在 MongoDB 中，不再依赖本地 `history.json`。

## 当前行为

- 抓取通过 `https://r.jina.ai/{URL}` 获取 Markdown。
- 对 changelog 类来源只取“最新一条”更新，而不是整页多条历史记录。
- 如果页面存在官方发布时间，会在推送消息里展示。
- 链接会使用企业微信 Markdown 可点击格式。
- MongoDB 中的历史记录使用 `name + publishedAt + sourceUrl` 做去重。
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
- `MONGODB_URI`: MongoDB 连接串
- `MONGODB_DB_NAME`: 可选，MongoDB 数据库名，默认 `my_ai_radar`
- `WECHAT_WEBHOOK`: 企业微信机器人 Webhook 地址
- `LLM_MODEL`: 可选，OpenRouter 默认推荐 `openrouter/free`
- `LLM_MODEL_FALLBACKS`: 可选，逗号分隔的备用模型列表
- `LLM_REQUEST_TIMEOUT_MS`: 可选，单次 LLM 请求超时，默认 `45000`
- `RADAR_TARGET_URLS`: 可选，逗号分隔的抓取地址列表
- `RADAR_API_KEY`: API 服务调用密钥
- `RADAR_API_PORT`: API 服务监听端口，默认 `3000`

### 推荐填写格式

```env
LLM_API_KEY=your_openrouter_or_other_compatible_api_key
LLM_BASE_URL=https://openrouter.ai/api/v1
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/?retryWrites=true&w=majority&appName=my-ai-radar
MONGODB_DB_NAME=my_ai_radar
WECHAT_WEBHOOK=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=your_key
RADAR_API_KEY=replace_with_a_long_random_string
RADAR_API_PORT=3000
RADAR_TARGET_URLS=https://github.blog/changelog/label/copilot,https://cursor.com/changelog,https://ai.google.dev/gemini-api/docs/changelog
LLM_MODEL=openrouter/free
LLM_MODEL_FALLBACKS=
LLM_REQUEST_TIMEOUT_MS=45000
```

### 各环境怎么填

- 本地 `.env`：填全部变量，便于同时调试 `npm run radar` 和 `npm run serve`
- Vercel：不需要 `RADAR_API_PORT`，其余变量都建议配置；`RADAR_API_KEY` 必填
- GitHub Actions Secrets：不需要 `RADAR_API_KEY` 和 `RADAR_API_PORT`，因为定时任务不走 HTTP API

### Vercel 建议填写值

- `LLM_API_KEY`: 你的 OpenRouter 或其他兼容模型平台 key
- `LLM_BASE_URL`: 通常填 `https://openrouter.ai/api/v1`
- `MONGODB_URI`: Atlas 给你的完整连接串
- `MONGODB_DB_NAME`: 建议 `my_ai_radar`
- `WECHAT_WEBHOOK`: 企业微信机器人 webhook
- `LLM_MODEL`: 建议 `openrouter/free`
- `LLM_MODEL_FALLBACKS`: 可留空
- `LLM_REQUEST_TIMEOUT_MS`: 建议 `45000`
- `RADAR_TARGET_URLS`: 逗号分隔 URL 列表
- `RADAR_API_KEY`: 你自己生成的长随机字符串

### GitHub Actions Secrets 建议填写值

- `LLM_API_KEY`: 和 Vercel 用同一个也可以
- `LLM_BASE_URL`: 和 Vercel 保持一致
- `MONGODB_URI`: 和 Vercel 指向同一个 Atlas 集群
- `MONGODB_DB_NAME`: 和 Vercel 保持一致
- `WECHAT_WEBHOOK`: 企业微信机器人 webhook
- `LLM_MODEL`: 建议 `openrouter/free`
- `LLM_MODEL_FALLBACKS`: 可留空
- `LLM_REQUEST_TIMEOUT_MS`: 建议 `45000`
- `RADAR_TARGET_URLS`: 和 Vercel 保持一致

## OpenRouter 示例

```env
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_MODEL=openrouter/free
```

## API 服务

项目现在同时支持两种运行方式：

- `npm run radar`: 直接执行一次任务，适合 GitHub Actions 定时跑
- `npm run serve`: 启动 HTTP API 服务，适合你手动或外部系统触发

推荐的线上部署组合：

- `GitHub Actions`: 每日定时执行 `npm run radar`
- `Vercel`: 暴露手动调用 API
- `MongoDB Atlas M0`: 存储去重历史

API 端点：

- `GET /health`: 健康检查
- `GET /history`: 查看最近历史记录
- `POST /run`: 触发一次雷达任务

在 Vercel 上，默认函数路径是：

- `/api/health`
- `/api/history`
- `/api/run`

仓库里已经带了 [vercel.json](/Users/xmaster/Documents/code/vibe/my-ai-radar/vercel.json)，所以部署后也可以直接用更短的路径：

- `/health`
- `/history`
- `/run`

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

历史接口示例：

```bash
curl "http://localhost:3000/history?limit=20" \
	-H "x-api-key: your_api_key"
```

说明：

- `GET /history` 需要同样的 API key 认证
- `limit` 可选，默认 `20`，最大 `100`

注意：`POST /run` 是同步接口，会等本次抓取和 LLM 处理全部完成后再返回。如果某个外部来源或 LLM 较慢，请求会等更久。当前代码已经为单次 LLM 请求加了超时控制，避免无限挂起。

## 项目结构

```text
.
├── .github/workflows/daily_radar.yml
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

## GitHub Actions

仓库已包含 GitHub Actions 工作流文件：[.github/workflows/daily_radar.yml](.github/workflows/daily_radar.yml#L1)

工作流支持：

- 每天 `UTC 01:00` 自动执行
- `workflow_dispatch` 手动触发
- 使用 `npm ci` 安装依赖
- 执行前先跑 `npm run check`
- 仍然使用 `npm run radar` 直接执行，不依赖 API 服务
- 直接连接 MongoDB 读写去重历史，不再提交本地状态文件

## 推荐部署

最终推荐架构：

- `GitHub Actions` 负责每天定时跑一次
- `Vercel` 负责提供手动触发 API
- `MongoDB Atlas M0` 负责共享去重历史

这样做的原因是：

- `GitHub Actions` 更适合这种偏慢的批处理定时任务
- `Vercel` 更适合暴露一个简单的 API 给你手动触发
- `MongoDB Atlas` 让两边共用同一套历史状态，避免重复推送

### Vercel 部署要点

1. 把仓库导入 Vercel
2. 不需要自定义 build 命令
3. 把下面这些环境变量同步到 Vercel Project Settings:

- `LLM_API_KEY`
- `LLM_BASE_URL`
- `MONGODB_URI`
- `MONGODB_DB_NAME`
- `WECHAT_WEBHOOK`
- `LLM_MODEL`
- `LLM_MODEL_FALLBACKS`
- `LLM_REQUEST_TIMEOUT_MS`
- `RADAR_TARGET_URLS`
- `RADAR_API_KEY`

4. 部署完成后，用 `/health` 和 `/run` 验证

### 逐步部署清单

1. 在 MongoDB Atlas 创建 `M0` 免费集群
2. 新建数据库用户，拿到 `MONGODB_URI`
3. 在 Atlas Network Access 里先临时放开 `0.0.0.0/0` 做联调，稳定后再收紧
4. 在 Vercel 导入当前仓库
5. 在 Vercel 项目环境变量里填入所有运行配置，尤其是 `MONGODB_URI` 和 `RADAR_API_KEY`
6. 部署完成后先访问 `/health`
7. 再调用一次 `POST /run`，建议先传 `{"notify":false}` 验证链路
8. 在 GitHub 仓库的 Actions Secrets 中填入同一套 MongoDB 配置
9. 手动执行一次 GitHub Actions，确认它也能访问同一个 MongoDB
10. 最后再开启日常定时，正式投入使用

说明：Vercel 适合暴露 API，但不建议把“每日正式定时任务”完全迁到 Vercel Cron。这个项目依赖外部抓取和 LLM，请求偶尔会慢，GitHub Actions 作为定时执行端更稳。

关于历史数据的持久化行为：

- 每次运行都会从 MongoDB 读取已有 fingerprint 做去重
- 如果本次有新增条目，会把新 fingerprint upsert 到 MongoDB
- 如果某天没有新条目，MongoDB 中的数据可能基本不变；这是正常现象，说明去重仍在生效
- 集合会保留最近 `500` 条历史记录，超出后自动清理更老的数据

需要在仓库 Secrets 中配置：

- `LLM_API_KEY`
- `LLM_BASE_URL`
- `MONGODB_URI`
- `MONGODB_DB_NAME`
- `WECHAT_WEBHOOK`
- `LLM_MODEL`
- `LLM_MODEL_FALLBACKS`
- `LLM_REQUEST_TIMEOUT_MS`
- `RADAR_TARGET_URLS`

推荐的 GitHub Secrets 示例：

```text
LLM_API_KEY=your_openrouter_key
LLM_BASE_URL=https://openrouter.ai/api/v1
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/?retryWrites=true&w=majority&appName=my-ai-radar
MONGODB_DB_NAME=my_ai_radar
WECHAT_WEBHOOK=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=your_key
LLM_MODEL=openrouter/free
LLM_MODEL_FALLBACKS=
LLM_REQUEST_TIMEOUT_MS=45000
RADAR_TARGET_URLS=https://github.blog/changelog/label/copilot,https://cursor.com/changelog,https://ai.google.dev/gemini-api/docs/changelog
```

## 免费 MongoDB 方案

推荐你用 MongoDB Atlas 的 `M0` 免费层。

原因：

- 官方托管，最省心
- 直接给你标准 MongoDB 连接串，当前代码不用额外适配
- 免费层对你这种轻量级去重存储已经够用
- 很适合 GitHub Actions 和小型 Node API 共同访问

如果你后面遇到 Atlas 地域或网络限制，再考虑第二选择：在 Oracle Cloud Always Free 的虚拟机上自建 MongoDB。那样更灵活，但维护成本明显更高。

配置步骤：

1. 打开仓库 `Settings -> Secrets and variables -> Actions`
2. 逐个新增上面的 secrets
3. 打开 `Actions` 页面
4. 找到 `Daily AI Radar`
5. 点击 `Run workflow` 先手动验证一次

如果手动运行通过，后续就会按 cron 自动执行。
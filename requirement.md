
为了让 GitHub Copilot（或 Cursor/Claude）能够精准地生成代码，这份 Markdown 文档就是原始需求。

---

# Project: AI Daily Radar (GitHub Actions Edition)

## 1. 项目目标
构建一个轻量级的自动化系统，每日定时抓取指定 AI 产品站点的更新信息，利用 LLM 进行去重和摘要，最终通过 Webhook 推送至微信（企业微信机器人）。

## 2. 技术栈
- **Runtime**: Node.js (v18+)
- **Automation**: GitHub Actions (Cron Job)
- **Scraper**: Jina Reader API (`r.jina.ai`)
- **LLM**: OpenAI Compatible API (e.g., DeepSeek / GPT-4o)
- **Notification**: Work Wechat Bot Webhook

## 3. 文件结构
```text
.
├── .github/workflows/daily_radar.yml  # GitHub Actions 配置文件
├── src/
│   ├── index.js          # 主入口文件
│   ├── scraper.js        # 网页抓取与解析逻辑
│   ├── processor.js      # 调用 LLM 进行总结与去重
│   └── notifier.js       # Webhook 推送逻辑
├── data/
│   └── history.json      # (可选) 用于增量更新的存储
├── package.json
└── .env.example          # 本地调试环境变量模版
```

## 4. 核心逻辑需求 (Logic Flow)

### A. 抓取层 (Scraper)
- 遍历 `config.js` 中的目标 URL 列表。
- 使用 `https://r.jina.ai/{URL}` 获取 Markdown 格式的网页内容。
- **目标站点示例**: Product Hunt AI 频道, Hacker News Show, 以及特定的 AI 导航站。

### B. 处理层 (Processor)
- **输入**: 原始 Markdown 文本。
- **Prompt 策略**: 
    - 提取：产品名称、核心功能（20字内）、一句话推荐理由。
    - 过滤：剔除广告、无关的新闻或已过时的产品。
- **Token 优化**: 若单次抓取内容过长，需进行简单的切片或仅保留页面前 10k 字符。

### C. 推送层 (Notifier)
- 构造企业微信 Markdown 消息体。
- 格式模板：
  ```markdown
  ### 每日 AI 雷达 (YYYY-MM-DD)
  ---
  **1. [产品名]**
  - 功能：xxx
  - 亮点：xxx
  ---
  *更多详情请查看原始链接...*
  ```

## 5. 环境变量 (Secrets)
项目必须从 `process.env` 读取以下变量，不得硬编码：
- `LLM_API_KEY`: AI 接口密钥。
- `LLM_BASE_URL`: API 基准地址。
- `WECHAT_WEBHOOK`: 企业微信机器人 Webhook URL。

## 6. GitHub Actions 配置
- **定时触发**: 每天 UTC 01:00 (北京时间 09:00)。
- **手动触发**: 开启 `workflow_dispatch` 方便调试。
- **依赖安装**: 运行前执行 `npm install`。 可能需要一个dialy_radar.yml? 

## 7. 异常处理
- 某个 URL 抓取失败时，记录 Error 但不中断其他任务。
- AI 响应为空或格式错误时，发送“今日暂无重大更新”提醒。

---

### 如何开始？
1.  **复制**上面的 Markdown 到你的项目根目录。
2.  **打开 Copilot Chat**（或选中代码块）。
3.  **输入指令**：*"@workspace 按照 PRD.md 的要求，帮我生成完整的 Node.js 项目代码，并确保代码模块化且易于维护。"*

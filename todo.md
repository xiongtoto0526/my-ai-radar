# AI Daily Radar Deployment Todo

## Goal

最终部署组合：

- GitHub Actions 负责每日定时执行
- Vercel 负责暴露手动触发 API
- MongoDB Atlas M0 负责共享去重历史

## Todo List

### 1. 创建 MongoDB Atlas M0 免费集群

1. 打开 MongoDB Atlas 官网并登录
   - 地址：`https://www.mongodb.com/cloud/atlas/register`
   - 如果没有账号，先注册一个个人账号

2. 创建 Project
   - 点击 `New Project`
   - Project Name 建议填：`my-ai-radar`
   - 直接创建，不需要额外团队成员

3. 创建免费集群
   - 进入 Project 后点击 `Build a Database`
   - 选择 `M0` 免费层
   - 云厂商任选：`AWS / GCP / Azure` 都可以
   - 区域优先选离你和 Vercel 更近的地区
   - Cluster Name 建议填：`my-ai-radar`
   - 点击创建

4. 创建数据库用户
   - 左侧进入 `Database Access`
   - 点击 `Add New Database User`
   - 认证方式选 `Password`
   - Username 建议：`radar_user`
   - Password：生成一个强密码并记下来
   - 权限可以先用内置角色 `Read and write to any database`
   - 保存用户

5. 配置网络访问
   - 左侧进入 `Network Access`
   - 点击 `Add IP Address`
   - 联调阶段可以先加：`0.0.0.0/0`
   - 这表示允许任意来源访问，便于先让 Vercel 和 GitHub Actions 跑通
   - 跑通以后，如果你想更保守，可以再收紧

6. 获取连接串
   - 回到 `Database`
   - 点击集群上的 `Connect`
   - 选择 `Drivers`
   - Driver 选 `Node.js`
   - Copy 连接串，形如：

```text
mongodb+srv://radar_user:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=my-ai-radar
```

7. 替换密码占位符
   - 把连接串里的 `<password>` 替换成你刚才创建的真实数据库密码
   - 如果密码里有特殊字符，优先使用 Atlas 生成的可直接复制连接串，避免 URL 编码问题

8. 记录本项目要用的 MongoDB 配置
   - `MONGODB_URI`: 上一步得到的完整连接串
   - `MONGODB_DB_NAME`: 建议 `my_ai_radar`

9. 本地先做一次连通性验证
   - 把上面两项写进本地 `.env`
   - 再执行：`npm run radar`
   - 目标是确认本地能正常读写 MongoDB

### 2. 更新本地 .env

把以下变量填进本地 `.env`：

- `LLM_API_KEY`
- `LLM_BASE_URL`
- `MONGODB_URI`
- `MONGODB_DB_NAME=my_ai_radar`
- `WECHAT_WEBHOOK`
- `LLM_MODEL=openrouter/free`
- `LLM_MODEL_FALLBACKS=`
- `LLM_REQUEST_TIMEOUT_MS=45000`
- `RADAR_TARGET_URLS`
- `RADAR_API_KEY`
- `RADAR_API_PORT=3000`

### 3. 本地验证 MongoDB + API

1. 启动 API：`npm run serve`
2. 验证健康检查：`GET /health`
3. 验证历史接口：`GET /history?limit=20`
4. 验证手动执行：`POST /run`
5. 建议第一次调用用：`{"notify": false}`

### 4. 部署到 Vercel

1. 登录 Vercel
2. 导入当前 GitHub 仓库
3. 不需要自定义 build command
4. 在 Project Settings -> Environment Variables 中填入：
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
5. 部署完成后，验证：
   - `GET /health`
   - `GET /history?limit=20`
   - `POST /run`

### 5. 配置 GitHub Actions Secrets

在 GitHub 仓库 `Settings -> Secrets and variables -> Actions` 中新增：

- `LLM_API_KEY`
- `LLM_BASE_URL`
- `MONGODB_URI`
- `MONGODB_DB_NAME`
- `WECHAT_WEBHOOK`
- `LLM_MODEL`
- `LLM_MODEL_FALLBACKS`
- `LLM_REQUEST_TIMEOUT_MS`
- `RADAR_TARGET_URLS`

注意：

- GitHub Actions 不需要 `RADAR_API_KEY`
- GitHub Actions 不需要 `RADAR_API_PORT`

### 6. 手动跑一次 GitHub Actions

1. 打开仓库的 `Actions`
2. 找到 `Daily AI Radar`
3. 点击 `Run workflow`
4. 查看日志，确认：
   - 能连接 MongoDB
   - 能完成抓取
   - 能正常去重
   - 能正常推送企业微信

### 7. 正式启用

当下面几项都通过后，就可以正式使用：

- 本地 `npm run radar` 可跑通
- 本地 API 可跑通
- Vercel 上 `/health`、`/history`、`/run` 可用
- GitHub Actions 手动执行通过

之后只保留这套职责分工：

- GitHub Actions：负责每天自动跑
- Vercel：负责你手动触发
- MongoDB Atlas：负责共享去重状态

## Notes

- Vercel 适合做手动触发 API，不建议承接正式定时任务
- GitHub Actions 更适合每日定时执行这种偏慢批处理
- MongoDB Atlas M0 对这个项目的历史去重数据量完全够用

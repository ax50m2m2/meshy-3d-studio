# 部署说明（Node.js）

## 当前工程包含什么
- 前端：响应式 AI 建模工作台，文字生成、图片 URL 转 3D、任务进度、本地任务记录、GLB 预览和下载入口。
- 后端：Express API 代理。浏览器不接触 Meshy API Key。
- 配置：通过服务器环境变量提供密钥。

## 本地启动
1. 安装 Node.js 18 或更新版本。
2. 复制 `.env.example` 为 `.env`。
3. 在 `.env` 中填写真实的 `MESHY_API_KEY`。
4. 在项目根目录运行 `npm install`，再运行 `npm start`。
5. 浏览器访问 `http://localhost:8080`。

不要把真实密钥提交到 GitHub。部署平台建议直接使用 Environment Variables / Secrets，而不是上传 .env 文件。

## 部署到 Node.js 托管服务
- Build / Install command: `npm install`
- Start command: `npm start`
- Environment variable: `MESHY_API_KEY`（必填）
- 可选环境变量：`PORT`（大多数平台会自动注入）
- 运行时：Node.js 18+
- HTTPS：由托管平台或反向代理配置。

本工程尚未连接用户的腾讯云服务器，也没有自动购买域名或创建云资源。若要部署到腾讯云，需要服务器 SSH/控制台权限、域名和 DNS 权限（如需绑定域名）、以及已开通的 Meshy API 账户。

## Meshy API 说明
当前代理使用 `https://api.meshy.ai/openapi/v2` 的 text-to-3d 和 image-to-3d 路径。Meshy 的模型、参数和账户权限可能发生变化。若返回 4xx，请以账户可用的官方 API 文档为准核对请求字段。生成模型可能消耗账户积分或费用。

## 上线前检查清单
- [ ] 配置真实的 MESHY_API_KEY，并确认从未提交到 Git。
- [ ] 调用 `/api/health`，确认 `configured: true`。
- [ ] 测试文字生成任务、状态轮询和 GLB 预览。
- [ ] 测试图片 URL 是否能被 Meshy 服务端读取。
- [ ] 核对 Meshy 当前 API 文档中的参数和返回字段。
- [ ] 配置 HTTPS、访问限制、日志和使用额度保护。
- [ ] 为公网部署增加速率限制和滥用防护；不要在未限制的情况下公开收费 API 代理。

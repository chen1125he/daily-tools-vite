# Daily Tools Frontend

用于你的日常小工具集前端（菜谱管理、家务统计等），技术栈为 Vue 3 + Vite + Naive UI。

## 1. 安装依赖

```bash
npm install
```

## 2. 配置后端 API 地址

复制 `env.example` 为 `.env.local`，并按需修改：

```bash
cp env.example .env.local
```

`.env.local` 示例：

```bash
VITE_API_BASE_URL=http://localhost:3000
```

## 3. 本地启动

```bash
npm run dev
```

默认访问地址：

- http://localhost:5173

## 4. 与 Rails API 对接建议

- Rails 端建议提供健康检查接口：`GET /up`
- 开发期请在 Rails 配置 CORS，允许来自 `http://localhost:5173` 的请求

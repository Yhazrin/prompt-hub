# Prompt Hub

> AI 视觉灵感库 — 双向同步飞书知识库

## 功能特性

- ✅ 实时同步飞书知识库文档内容
- ✅ 展示提示词 + 生图效果，支持复制提示词
- ✅ 分类浏览（首页、分类、子分类）
- ✅ 全文搜索
- ✅ Lightbox 大图预览
- ✅ 双向同步：网页编辑 → 飞书知识库
- ✅ 手动 / 自动定时同步

## 快速部署

### 前提条件

- Node.js ≥ 18
- PM2（或 Docker）
- Nginx（或 Caddy）
- 域名 + SSL 证书（可选）

### 1. 上传项目到服务器

```bash
scp -r ~/prompt-hub user@your-server:/opt/prompt-hub
```

### 2. 配置飞书应用

在飞书开放平台创建应用，开启以下权限：
- `wiki:space:readonly` — 读取知识库节点列表
- `docx:document:readonly` — 读取文档内容
- `docx:document:write` — 写入文档（双向同步）

获取 `App ID` 和 `App Secret`，填入 `.env`：

```bash
cp .env.example .env
nano .env
```

### 3. 安装依赖

```bash
cd /opt/prompt-hub
npm install
```

### 4. 启动服务

```bash
# 直接启动
npm start

# 或使用 PM2（推荐）
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # 开机自启
```

### 5. 配置 Nginx

```bash
sudo cp nginx.conf.example /etc/nginx/sites-available/prompt-hub
sudo nano /etc/nginx/sites-available/prompt-hub  # 修改域名为你的
sudo ln -sf /etc/nginx/sites-available/prompt-hub /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 6. 初始化同步

```bash
# 手动触发首次同步
curl -X POST http://localhost:3000/admin/sync

# 或浏览器访问
# http://你的域名/admin/sync
```

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `FEISHU_APP_ID` | ✅ | 飞书应用 App ID |
| `FEISHU_APP_SECRET` | ✅ | 飞书应用 App Secret |
| `FEISHU_WIKI_SPACE_ID` | ✅ | 知识库 Space ID |
| `PORT` | | 服务端口，默认 `3000` |
| `SYNC_INTERVAL_MINUTES` | | 自动同步间隔，默认 `30` 分钟 |

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/prompts` | 获取提示词列表（支持 category/sub/search 分页） |
| GET | `/api/prompts/:id` | 获取单条提示词 |
| GET | `/api/categories` | 获取所有分类 |
| GET | `/api/subs/:category` | 获取子分类列表 |
| GET | `/api/search?q=` | 搜索提示词 |
| GET | `/api/stats` | 统计信息 |
| POST | `/admin/sync` | 手动触发同步 |
| GET | `/admin/sync-log` | 同步日志 |
| GET | `/admin/sync-status` | 同步状态 |

## 数据结构

提示词记录字段：
- `id` — 唯一标识
- `title` — 标题
- `prompt_text` — 提示词正文
- `image_url` — 图片 URL
- `ratio` — 图片比例
- `category_id` — 主分类
- `subcategory` — 子分类
- `wiki_node_token` — 飞书知识库节点 Token
- `wiki_obj_token` — 飞书文档 Token
- `wiki_doc_title` — 来源文档标题
- `favorite` — 收藏标记
- `view_count` — 浏览次数
- `sync_status` — 同步状态

## 知识库格式约定

为确保同步效果良好，建议知识库文档按以下格式组织：

```
## 提示词标题

[可选：生图效果图片]

提示词正文内容
（复制这段提示词即可用于 AI 生图）
```

每组「标题 + 图片 + 提示词」会被识别为一条独立记录。

## 故障排查

### 同步失败
```bash
# 查看同步日志
curl http://localhost:3000/admin/sync-log

# 检查飞书应用权限是否开通
# 检查 App ID / Secret 是否正确
```

### 文档读取失败
飞书文档需要单独授权。请确认：
1. 应用已开通 `docx:document:readonly` 权限
2. 应用已添加到文档的访问权限中

### PM2 日志
```bash
pm2 logs prompt-hub --lines 50
```

#!/bin/bash
# ================================================
# Prompt Hub 部署脚本
# ================================================
set -e

echo "🚀 开始部署 Prompt Hub..."

# 1. 检查环境
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装"
    exit 1
fi

if ! command -v pm2 &> /dev/null; then
    echo "📦 安装 PM2..."
    npm install -g pm2
fi

# 2. 复制项目到服务器
echo "📁 同步项目文件..."
# rsync -avz --delete ./ /opt/prompt-hub/

# 3. 安装依赖
echo "📦 安装依赖..."
cd /opt/prompt-hub
npm install --production

# 4. 复制并配置环境变量
if [ ! -f /opt/prompt-hub/.env ]; then
    echo "⚠️  创建 .env 文件，请编辑填入飞书配置"
    cp /opt/prompt-hub/.env.example /opt/prompt-hub/.env
fi

# 5. 创建日志目录
sudo mkdir -p /var/log/prompt-hub
sudo chown $USER:$USER /var/log/prompt-hub

# 6. 启动 / 重启 PM2
echo "🔄 重启 PM2..."
pm2 restart prompt-hub || pm2 start ecosystem.config.js

# 7. 保存 PM2 开机自启
pm2 save
pm2 startup

# 8. 配置 Nginx（如果需要）
if [ -f /etc/nginx/sites-available/prompt-hub ]; then
    echo "🔗 启用 Nginx 配置..."
    sudo ln -sf /etc/nginx/sites-available/prompt-hub /etc/nginx/sites-enabled/
    sudo nginx -t && sudo systemctl reload nginx
fi

echo "✅ 部署完成!"
echo "📍 服务地址: http://127.0.0.1:3000"
echo "📋 管理接口: http://127.0.0.1:3000/admin/sync-status"
echo ""
echo "⚠️  请编辑 /opt/prompt-hub/.env 填入飞书 App ID 和 App Secret"
echo "⚠️  配置完成后执行: pm2 restart prompt-hub"

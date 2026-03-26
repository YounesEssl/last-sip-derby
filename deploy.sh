#!/bin/bash
set -e

VPS="ubuntu@51.210.254.114"
APP_DIR="/opt/last-sip-derby"

echo "📦 Syncing files to VPS..."
rsync -avz --delete \
  --exclude node_modules \
  --exclude .next \
  --exclude dist \
  --exclude .git \
  --exclude state-dump.json \
  ./ "$VPS:$APP_DIR/"

echo "🐳 Building and starting on VPS..."
ssh "$VPS" "cd $APP_DIR && docker compose up -d --build"

echo ""
echo "✅ Deployed!"
echo "   TV:     http://51.210.254.114:4000"
echo "   Mobile: http://51.210.254.114:4002"

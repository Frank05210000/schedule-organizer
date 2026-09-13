#!/usr/bin/env bash
set -e

# 切換至專案根目錄
cd "$(dirname "$0")"

echo "=========================================="
echo "🚀 準備更新至 Firebase..."
echo "=========================================="

# 1. 執行測試
echo "🧪 [1/3] 執行單元測試..."
npm test

# 2. 建置專案檔案
echo "📦 [2/3] 執行打包建置..."
npm run build

# 3. 部署到 Firebase
if [ "$1" = "--all" ]; then
  echo "🚀 [3/3] 部署 Hosting 與 Firestore 規則/索引..."
  npx firebase deploy
else
  echo "🚀 [3/3] 部署 Hosting (前端網頁)..."
  npx firebase deploy --only hosting
fi

echo ""
echo "=========================================="
echo "🎉 更新成功！"
echo "🌐 線上網址: https://schedule-organizer-115.web.app"
echo "=========================================="

#!/bin/bash

echo "==================================="
echo "   Sales KPI Tracker - 高速起動版"
echo "==================================="
echo ""

# 既存プロセスを停止
pkill -f "node.*server" 2>/dev/null
pkill -f "vite" 2>/dev/null
sleep 1

# バックエンドサーバー起動
echo "🚀 バックエンドサーバーを起動中..."
cd /Users/komiyakouhei/Desktop/KPIファイル/sales-kpi-optimized/backend
PORT=5001 node server.js &
BACKEND_PID=$!

# 起動確認
sleep 2
if curl -s http://localhost:5001/api/health > /dev/null 2>&1; then
    echo "✅ バックエンド: http://localhost:5001 (正常稼働)"
else
    echo "❌ バックエンドの起動に失敗しました"
    exit 1
fi

# フロントエンドサーバー起動
echo "🚀 フロントエンドサーバーを起動中..."
cd /Users/komiyakouhei/Desktop/KPIファイル/sales-kpi-optimized/frontend
npm run dev &
FRONTEND_PID=$!

# 起動確認
sleep 3
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ フロントエンド: http://localhost:3000 (正常稼働)"
else
    echo "❌ フロントエンドの起動に失敗しました"
    exit 1
fi

echo ""
echo "==================================="
echo "🎉 アプリケーションが正常に起動しました！"
echo "==================================="
echo ""
echo "📱 ブラウザでアクセス: http://localhost:3000"
echo "🔌 API: http://localhost:5001"
echo ""
echo "停止するには Ctrl+C を押してください"
echo ""

# プロセスを維持
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo ''; echo 'サーバーを停止しました'; exit" INT
wait
#!/bin/bash

# 백엔드 서버를 중지하는 스크립트

BACKEND_PORT=8000

echo "🛑 Stopping backend server..."

# 포트를 사용하는 프로세스 찾기
PID=$(lsof -ti:$BACKEND_PORT)

if [ -z "$PID" ]; then
    echo "✅ No backend server running on port $BACKEND_PORT"
else
    echo "📍 Found process(es): $PID"
    kill -9 $PID
    echo "✅ Backend server stopped"
fi

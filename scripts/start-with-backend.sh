#!/bin/bash

# 백엔드와 React Native 앱을 함께 실행하는 스크립트

BACKEND_DIR="../ppg-backend"
BACKEND_PORT=8000

echo "🚀 Starting PPG Health App with Backend..."

# 백엔드가 이미 실행 중인지 확인
if lsof -Pi :$BACKEND_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "✅ Backend is already running on port $BACKEND_PORT"
else
    echo "🔧 Starting backend server..."

    # 백엔드 디렉토리로 이동하여 백그라운드로 실행
    (cd "$BACKEND_DIR" && source venv/bin/activate && uvicorn main:app --reload --host 0.0.0.0 --port $BACKEND_PORT > /dev/null 2>&1 &)

    # 백엔드 시작 대기
    echo "⏳ Waiting for backend to start..."
    sleep 3

    # 백엔드 실행 확인
    if lsof -Pi :$BACKEND_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "✅ Backend started successfully on http://localhost:$BACKEND_PORT"
    else
        echo "❌ Failed to start backend"
        exit 1
    fi
fi

echo ""
echo "📱 Starting React Native app..."
echo ""

# React Native 앱 실행
if [ "$1" = "android" ]; then
    npx react-native run-android
elif [ "$1" = "ios" ]; then
    npx react-native run-ios
else
    echo "Usage: $0 [android|ios]"
    exit 1
fi

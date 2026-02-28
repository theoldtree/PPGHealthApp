#!/bin/bash

# 백엔드와 React Native 앱을 함께 실행하는 스크립트

BACKEND_DIR="../ppg-backend"
BACKEND_PORT=8000
METRO_PORT=8081

echo "🚀 Starting PPG Health App with Backend..."

# 백엔드가 이미 실행 중인지 확인
if lsof -Pi :$BACKEND_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "✅ Backend is already running on port $BACKEND_PORT"
else
    echo "🔧 Starting backend server..."

    # 백엔드 디렉토리로 이동하여 백그라운드로 실행
    (cd "$BACKEND_DIR" && source venv/bin/activate && uvicorn main:app --reload --host 0.0.0.0 --port $BACKEND_PORT > /tmp/ppg-backend.log 2>&1 &)

    # 백엔드 시작 대기
    echo "⏳ Waiting for backend to start..."
    for i in $(seq 1 10); do
        sleep 1
        if lsof -Pi :$BACKEND_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
            break
        fi
    done

    # 백엔드 실행 확인
    if lsof -Pi :$BACKEND_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "✅ Backend started successfully on http://localhost:$BACKEND_PORT"
    else
        echo "❌ Failed to start backend. Logs:"
        cat /tmp/ppg-backend.log
        exit 1
    fi
fi

# Metro 번들러가 이미 실행 중인지 확인
if lsof -Pi :$METRO_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "✅ Metro bundler is already running on port $METRO_PORT"
else
    echo "📦 Starting Metro bundler..."
    npx react-native start --port $METRO_PORT > /tmp/ppg-metro.log 2>&1 &
    METRO_PID=$!

    echo "⏳ Waiting for Metro to start..."
    for i in $(seq 1 20); do
        sleep 1
        if lsof -Pi :$METRO_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
            break
        fi
    done

    if lsof -Pi :$METRO_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "✅ Metro bundler started on port $METRO_PORT"
    else
        echo "❌ Failed to start Metro bundler. Logs:"
        cat /tmp/ppg-metro.log
        exit 1
    fi
fi

echo ""
echo "📱 Starting React Native app..."
echo ""

# React Native 앱 실행 (--no-packager: Metro는 이미 위에서 실행됨)
if [ "$1" = "android" ]; then
    npx react-native run-android --no-packager
elif [ "$1" = "ios" ]; then
    npx react-native run-ios --no-packager
else
    echo "Usage: $0 [android|ios]"
    exit 1
fi

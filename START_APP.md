# React Native 앱 실행 가이드

## 사전 준비

### iOS 에뮬레이터 (Mac만 가능)
- Xcode 설치 필요
- Xcode Command Line Tools 설치:
  ```bash
  xcode-select --install
  ```

### Android 에뮬레이터
- Android Studio 설치 필요
- Android SDK 설정
- AVD (Android Virtual Device) 생성

## 1단계: 의존성 설치

```bash
cd /Users/yujeongmu/Desktop/PPGHealthApp

# Node 패키지 설치
npm install

# iOS용 CocoaPods 설치 (iOS만 해당)
cd ios
pod install
cd ..
```

## 2단계: Metro Bundler 실행

새 터미널 창을 열고:
```bash
cd /Users/yujeongmu/Desktop/PPGHealthApp

# Metro bundler 시작
npm start
```

Metro bundler가 실행되면 `http://localhost:8081` 에서 실행됩니다.

## 3단계: 에뮬레이터에서 앱 실행

### iOS 에뮬레이터

**새 터미널 창**을 열고:
```bash
cd /Users/yujeongmu/Desktop/PPGHealthApp

# iOS 시뮬레이터에서 실행
npm run ios

# 또는 특정 디바이스 지정
npx react-native run-ios --simulator="iPhone 15 Pro"
```

사용 가능한 시뮬레이터 확인:
```bash
xcrun simctl list devices
```

### Android 에뮬레이터

1. **Android Studio에서 AVD 실행**
   - Android Studio 열기
   - Tools > AVD Manager
   - 기존 AVD 선택 후 실행 (또는 새로 생성)

2. **새 터미널 창**을 열고:
```bash
cd /Users/yujeongmu/Desktop/PPGHealthApp

# Android 에뮬레이터에서 실행
npm run android
```

## 4단계: API 연결 확인

### API 엔드포인트 설정 확인

`src/config/api.ts` 파일 확인:

```typescript
export const API_BASE_URL = __DEV__
  ? 'http://localhost:8000'  // iOS 시뮬레이터용
  : 'https://your-production-api.com';
```

**중요: Android 에뮬레이터의 경우**

Android는 `localhost`가 에뮬레이터 자체를 가리킵니다.
호스트 머신의 localhost에 접근하려면:

```typescript
export const API_BASE_URL = Platform.select({
  ios: __DEV__ ? 'http://localhost:8000' : 'https://api.production.com',
  android: __DEV__ ? 'http://10.0.2.2:8000' : 'https://api.production.com',
});
```

## 실행 순서 요약

**3개의 터미널이 필요합니다:**

### 터미널 1: 백엔드 서버
```bash
cd /Users/yujeongmu/Desktop/ppg-backend
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 터미널 2: Metro Bundler
```bash
cd /Users/yujeongmu/Desktop/PPGHealthApp
npm start
```

### 터미널 3: 앱 실행
```bash
cd /Users/yujeongmu/Desktop/PPGHealthApp

# iOS
npm run ios

# 또는 Android
npm run android
```

## 앱 테스트 시나리오

1. **앱 실행 확인**
   - 앱이 정상적으로 열리는지 확인
   - "PPG 측정" 화면이 보이는지 확인

2. **측정 시작**
   - "측정 시작" 버튼 클릭
   - 타이머가 00:00부터 시작하는지 확인

3. **QC 피드백 확인**
   - 1초마다 QC 피드백이 업데이트되는지 확인
   - 피드백 메시지가 구체적으로 표시되는지 확인
   - 초록색/주황색 박스가 신호 품질에 따라 변하는지 확인

4. **측정 완료**
   - 60초 후 자동으로 결과 화면으로 이동하는지 확인
   - 심박수, HRV, 스트레스 레벨이 표시되는지 확인
   - 참고 범위가 표시되는지 확인
   - 이모지가 없는지 확인

5. **결과 저장**
   - "저장하고 닫기" 버튼 클릭
   - 메인 화면으로 돌아가는지 확인

## 디버깅

### React Native 디버거
- iOS: `Cmd + D`
- Android: `Cmd + M` (또는 흔들기)
- "Debug" 선택

### 로그 확인
```bash
# iOS 로그
npx react-native log-ios

# Android 로그
npx react-native log-android

# 또는 전체 로그
npm start -- --verbose
```

### API 호출 로그 확인
앱 실행 중 Metro Bundler 터미널과 백엔드 터미널에서 로그 확인

## 트러블슈팅

### "Unable to resolve module" 에러
```bash
# Metro bundler 캐시 삭제
npm start -- --reset-cache

# node_modules 재설치
rm -rf node_modules
npm install
```

### iOS 빌드 실패
```bash
cd ios
pod install
cd ..
npm run ios
```

### Android 연결 안됨
```bash
# ADB 재시작
adb kill-server
adb start-server

# 디바이스 확인
adb devices
```

### API 연결 실패
1. 백엔드 서버가 실행중인지 확인: `curl http://localhost:8000/api/v1/health`
2. Android의 경우 `10.0.2.2:8000` 사용 확인
3. 방화벽 설정 확인

## Hot Reload

코드 변경 시 자동으로 앱이 새로고침됩니다.
- iOS: 자동 리로드
- Android: 자동 리로드 또는 `R` 두 번 누르기

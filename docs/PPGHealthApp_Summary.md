# PPGHealthApp 종합 정리

> 작성일: 2026-03-09
> 기준 브랜치: main

---

## 목차

1. [앱 전체 요구사항](#1-앱-전체-요구사항)
2. [참조 데이터 / 근거 문헌](#2-참조-데이터--근거-문헌)
3. [화면별 요구사항 & FE/BE Flow](#3-화면별-요구사항--febe-flow)
4. [DB 스키마 & Diagram](#4-db-스키마--diagram)
5. [분석 알고리즘 요약](#5-분석-알고리즘-요약)

---

## 1. 앱 전체 요구사항

### 핵심 목적
BLE PPG 센서(루트스 하드웨어)로 60초 측정 → 심혈관 지표 분석 → 개인/집단 대비 → 건강 다이어리 관리

### 기술 스택

| 구분 | 기술 |
|------|------|
| **Frontend** | React Native (Expo bare), TypeScript strict |
| **Navigation** | `@react-navigation/bottom-tabs` |
| **Charts** | 커스텀 `PPGChart` (react-native-svg) |
| **Calendar** | `react-native-calendars` |
| **Local Storage** | `@react-native-async-storage/async-storage` |
| **Backend** | FastAPI (Python), PostgreSQL |
| **Auth** | JWT (이메일 로그인 + Kakao/Google OAuth) |
| **스케줄러** | APScheduler (BackgroundScheduler, FastAPI lifespan) |

### 기능 구현 현황

| # | 기능 | 상태 |
|---|------|:----:|
| 1 | BLE PPG 60초 측정 + 실시간 파형 표시 | ✅ |
| 2 | QC(품질 검증) — SNR 기반 신호 품질 피드백 | ✅ |
| 3 | 분석 결과 화면 — HR / HRV / PI + 집단/개인 대비 | ✅ |
| 4 | 다이어리 — 날짜별 기록 조회 + 태그/메모 | ✅ |
| 5 | 지표 설명 ⓘ 인포 아이콘 + 가이드북 모달 | ✅ |
| 6 | 다이어리 로컬 캐시 (백엔드 미실행 시 fallback) | ✅ |
| 7 | 측정 완료 알림 (mock 포함, 로컬 생성) | ✅ |
| 8 | 알림 탭 뱃지 (미읽음 카운트) | ✅ |
| 9 | 이메일 로그인 / Kakao·Google OAuth | ✅ |
| 10 | 리마인더 알림 — 09:00 / 15:00 KST 미측정 시 | ✅ |
| 11 | 실 BLE 센서 연동 | ⏳ (하드웨어 준비 시) |

### 개발 모드 플래그 (`src/config/measurement.ts`)

```ts
SKIP_AUTH = true           // mock 로그인 (백엔드 JWT 불필요)
USE_MOCK_MEASUREMENT = true // 로컬 분석 (서버 /analyze 호출 없음)
USE_BLE_SENSOR = false      // BUT-PPG mock replay (하드웨어 불필요)
```

> **프로덕션 배포 전**: 세 플래그 모두 `false`로 설정

---

## 2. 참조 데이터 / 근거 문헌

| 지표 | 참조 출처 |
|------|----------|
| **심박수 정상 범위** | American Heart Association (AHA) — 안정 시 60–100 bpm |
| **HRV SDNN / RMSSD** | Task Force of ESC/NASPE (1996) — 표준 HRV 측정 지침 |
| **APG b/a 동맥경직도** | Takazawa K. et al. (1998) — 연령별 APG 파라미터 참조값 |
| **집단 대비 기준 (HR)** | NHANES, Ostchega Y. et al. (2011) — 성별·연령별 독립 표본 n=150–521/그룹 |
| **PI 관류 지수** | Masimo Corporation PI 기준 (0.2–20 %) |
| **Mock PPG 신호** | BUT-PPG 데이터셋 — 5개 기록, 각 17,946 샘플, 60s@300Hz |
| **UI 컬러 레퍼런스** | Withings Health Mate + Samsung Health 디자인 시스템 |

### BUT-PPG 신호 통계 (실측, `src/assets/mock_ppg_data.json`)

```
총 샘플: 89,730 (5개 기록 × 17,946샘플)
샘플링: 300 Hz, 60s/기록

분포:
  min  : 0.000000
  p5   : 0.002000
  p25  : 0.006100
  p50  : 0.143900   ← 중앙값 (이완기/수축기 경계)
  p75  : 0.834300
  p95  : 0.990300
  max  : 1.000000
  mean : 0.364925
  std  : 0.414177

→ 이중 분포(bimodal): 이완기 baseline(≈0~0.01) + 수축기 피크(≈0.7~1.0)
```

### ADC 인코딩 스펙 (BLE 패킷용)

```
float [0, 1.0]  →  10-bit ADC [0, 1023]
adc = round(f × 1023)

패킷 포맷 (20 bytes):
  [0]    Sync  : 0xAA
  [1-2]  Index : uint16 LE (패킷 카운터)
  [3-17] PPG   : 12 × 10-bit, MSB-first bit-packed (15 bytes = 120 bits)
  [18]   BAT   : 0–100 %
  [19]   CRC   : XOR(bytes 0–18)
```

---

## 3. 화면별 요구사항 & FE/BE Flow

---

### 3-1. 인증 (AuthNavigator)

**요구사항**
- 이메일/비밀번호 로그인 · 회원가입
- Kakao / Google OAuth (딥링크 콜백: `ppghealth://auth/callback?access_token=JWT`)
- `SKIP_AUTH=true` → mock 로그인 자동 통과 (개발 전용)

**Flow**

```
[LoginScreen]
    │
    ├─ 이메일 로그인
    │   POST /api/v1/auth/login
    │       → { access_token: JWT }
    │   AsyncStorage.setItem(token)
    │       → MainNavigator
    │
    └─ Kakao/Google OAuth
        GET /api/v1/auth/{kakao|google}/url
            → { url }
        Linking.openURL(url)  [브라우저 열림]
            → 백엔드 OAuth callback
            → redirect to ppghealth://auth/callback?access_token=JWT
        AuthContext.loginWithToken(jwt)
            → MainNavigator
```

---

### 3-2. 측정 화면 (MeasurementScreen)

**요구사항**

| 항목 | 상세 |
|------|------|
| PPG 차트 | 0~60s 고정 X축, 좌→우로 실시간 누적, Y축 ADC [0, 1023] 고정 |
| 실시간 지표 | 심박수(bpm) / HRV / 배터리 잔량 |
| QC 뱃지 | `신호 양호` / `신호 약함 — 손가락 위치 조정` |
| 측정 시간 | 60초 (MIN_MEASUREMENT_SECONDS=15초 이상 시 저장 가능) |
| BLE 모드 | `USE_BLE_SENSOR=false`: BUT-PPG mock replay (동일 BLE 파싱 경로) |

**Flow (USE_MOCK_MEASUREMENT = false — 실서버)**

```
[MeasurementScreen]
    │
    ├─ handleStart()
    │   POST /api/v1/measurements/start  →  { measurement_id }
    │
    ├─ (매 1초) sendDataToServer()
    │   POST /api/v1/measurements/{id}/qc-data
    │       payload: { window_index, timestamp, ppg_data[], battery_level }
    │       → { is_acceptable, feedback_message, snr, peak_count }
    │
    ├─ (60초 완료) completeMeasurement()
    │   POST /api/v1/measurements/{id}/complete
    │
    ├─ analyzeMeasurement()
    │   POST /api/v1/measurements/{id}/analyze
    │       → AnalysisResponse { general, personal, demographic, advice }
    │
    └─ → MeasurementResultScreen (Modal)
```

**Flow (USE_MOCK_MEASUREMENT = true — 로컬)**

```
[MeasurementScreen]
    │
    ├─ handleStart() → measurementId = null (로컬만)
    │
    ├─ (매 1초) QC 로컬 계산
    │   snr = max(ppgData[-20:]) - min(ppgData[-20:])
    │   isGood = snr > 5
    │
    ├─ (60초 완료) runAnalysis()
    │   _buildMockRecord(ppgDisplayRef, duration)  [로컬 계산]
    │   saveLocalRecord(record)                    [AsyncStorage 캐시]
    │   saveMockAnalysis(id, values)               [백엔드 저장 시도, 실패 무시]
    │   addLocalNotification({ type: 'measurement_complete' })
    │   AsyncStorage.setItem('@ppg_measured_YYYY-MM-DD', '1')
    │
    └─ → MeasurementResultScreen (Modal)
```

**BLE 데이터 흐름 (양 모드 공통)**

```
mock: generateDummyData() → float → adc = round(f×1023) → _buildBLEPacket()
real: BLE characteristic notification callback → raw 20-byte packet
                                ↓
                        injectBLEPacket(Uint8Array)
                                ↓
                        parseBLEPacket() : CRC check, bit-unpack
                                ↓
                        injectPPGSample() × 12  →  ppgDataRef[]
                                ↓
                        displayTimerRef (100ms) → setPpgData (downsampled)
                                ↓
                        PPGChart (data=ppgData, Y=[0,1023], X=0~60s)
```

---

### 3-3. 측정 결과 화면 (MeasurementResultScreen)

**요구사항**

| 섹션 | 내용 |
|------|------|
| ① 피드백 배너 | 전체 상태 (excellent/good/normal/poor) + 색상 배경 |
| ② 지표 칩 3개 | 심박수 bpm / HRV SDNN ms / PI % — 상태 라벨 + ⓘ 탭 → 단독 가이드 모달 |
| ③ 집단 대비 | HR 백분위 바 + HRV 집단 참조값 + APG b/a 혈관 경직도 스케일 |
| ④ 개인 대비 | 추세 배너 (first/improving/stable/declining) + 6개 diff 행 |
| ⑤ 어드바이스 | 자동 생성 건강 조언 카드 |
| ⑥ 태그 선택 | 상태 태그 멀티셀렉트 (스트레스, 운동 후, 피로 등) |
| ⑦ 메모 | 자유 텍스트 TextInput |

**Flow**

```
[MeasurementResultScreen]
    │
    └─ 저장 버튼 (handleSaveAndClose)
        PATCH /api/v1/measurements/{id}/diary
            payload: { notes, tags: "태그1,태그2", advice }
        → DiaryScreen (탭 전환)
```

---

### 3-4. 다이어리 화면 (DiaryScreen)

**요구사항**

| 항목 | 상세 |
|------|------|
| 날짜 스트립 | 오늘 ±30일 (61일) 수평 FlatList |
| 기록 카드 | 아코디언 — 확장 시 MeasurementResultScreen과 동일한 분석 UI (read-only) |
| 캘린더 모달 | react-native-calendars — 측정한 날짜에 파란 점 |
| 가이드북 모달 | 전체 지표 설명 ScrollView (METRIC_GUIDES 공유) |
| 로컬 캐시 | AsyncStorage `@ppg_local_records` — 백엔드 실패 시 fallback |

**Flow**

```
[DiaryScreen]  useFocusEffect → 탭 포커스마다 재로드
    │
    ├─ 정상 경로
    │   GET /api/v1/measurements/history  →  MeasurementRecord[]
    │   setAllRecords(history)
    │
    └─ 백엔드 실패
        catch → getLocalRecords()  [AsyncStorage '@ppg_local_records']
        setAllRecords(cached)
```

---

### 3-5. 알림 화면 (NotificationScreen)

**알림 타입**

| type | 트리거 | 생성 위치 | 아이콘 |
|------|--------|----------|:------:|
| `measurement_complete` | 측정 완료 즉시 | FE 로컬 (NotificationContext) | 🔔 |
| `reminder` | 09:00 / 15:00 KST 미측정 | FE 로컬 스케줄러 (AppState) | ⏰ |
| `weekly_report` | 매주 월 09:00 KST | BE APScheduler | 📊 |

**요구사항**
- 오늘 / 이전 섹션 분리
- 미읽음 파란 dot + 탭 뱃지 (숫자)
- 모두 읽음 버튼
- 백엔드 로드 성공 시 로컬 알림 자동 제거 (중복 방지)

**Flow**

```
[NotificationScreen]  useFocusEffect
    │
    ├─ 백엔드 알림 로드
    │   GET /api/v1/notifications  →  Notification[]
    │   setBackendNotifications(mapped)
    │   clearLocalNotifications()          ← 중복 제거
    │   setBackendUnreadCount(unread)
    │
    ├─ 개별 읽음
    │   PATCH /api/v1/notifications/{id}/read
    │
    └─ 전체 읽음
        POST /api/v1/notifications/mark-all-read
        markAllLocalRead()

[NotificationContext]  AppState 'active' 이벤트마다
    │
    ├─ AsyncStorage.getItem('@ppg_measured_YYYY-MM-DD')
    │   → 측정 완료 기록 있으면 종료
    │
    ├─ hourKST() >= 9 AND '@ppg_reminder_morning_DATE' 없음
    │   → addReminder('아침 측정 알림')
    │   → AsyncStorage.setItem('@ppg_reminder_morning_DATE', '1')
    │
    └─ hourKST() >= 15 AND '@ppg_reminder_afternoon_DATE' 없음
        → addReminder('오후 측정 알림')
        → AsyncStorage.setItem('@ppg_reminder_afternoon_DATE', '1')
```

---

### 3-6. 마이페이지 (MyPageScreen)

- 프로필 정보 조회
- 로그아웃 (JWT 삭제 → AuthNavigator)

---

## 4. DB 스키마 & Diagram

### ERD (텍스트)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  users                                                                    │
│  id(PK) · email(UNIQUE) · hashed_pw · name · age · gender · created_at  │
└────────────────────────┬─────────────────────────────────────────────────┘
                         │ 1 : N
                         ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  measurements   ← 세션 + 분석 + 다이어리 통합 단일 테이블               │
│  ────────────────────────────────────────────────────────────────────    │
│  id(PK) · user_id(FK) · started_at · completed_at · duration_sec        │
│  status  ('recording' | 'completed' | 'failed')                          │
│  is_dev  BOOLEAN                                                          │
│  ── 분석 결과 ────────────────────────────────────────────────────────   │
│  heart_rate · hrv_sdnn · hrv_rmssd · pi · ac · dc                       │
│  apg_b_over_a · apg_ai · result_status · percentile                     │
│  age_group_avg · gender_group_avg                                        │
│  ── 다이어리 ─────────────────────────────────────────────────────────   │
│  notes(TEXT) · tags(VARCHAR, 쉼표구분) · advice(TEXT)                   │
└─────────┬──────────────┬──────────────────────────────────────────────────┘
          │ 1:N          │ 1:N
          ▼              ▼
┌──────────────┐  ┌────────────────────────────────────────────────────┐
│  qc_feedback │  │  notifications                                      │
│  ──────────  │  │  ──────────                                         │
│  id(PK)      │  │  id(PK) · user_id(FK) · type · title · message     │
│  measure_id  │  │  data_json(TEXT) · is_read(BOOL) · created_at      │
│  window_idx  │  └────────────────────────────────────────────────────┘
│  timestamp   │
│  is_accept   │  ┌────────────────────────────────────────────────────┐
│  snr(FLOAT)  │  │  user_baselines                (1:1 with users)    │
│  peak_count  │  │  ──────────────                                     │
│  feedback_msg│  │  id(PK) · user_id(FK,UNIQUE) · n(INT)              │
│  battery_lvl │  │  avg_heart_rate · m2_heart_rate                    │
└──────────────┘  │  avg_hrv_sdnn   · m2_hrv_sdnn  · updated_at       │
                  └────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│  demographic_baselines         (age_group + gender UNIQUE)             │
│  ─────────────────────                                                 │
│  id(PK) · age_group('20s'|'30s'|'40s'|'50s'|'60s+') · gender         │
│  n(INT) · avg_heart_rate · m2_heart_rate                               │
│  avg_hrv_sdnn · m2_hrv_sdnn · updated_at                              │
└────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────┐  1:N  ┌──────────────────────────────────┐
│  mock_ppg_sources       │ ────► │  mock_ppg_packets                │
│  id(PK) · name          │       │  id(PK) · source_id(FK)          │
│  sampling_rate · dur_sec│       │  packet_index · ppg_bytes(BYTEA) │
└─────────────────────────┘       └──────────────────────────────────┘
```

### 테이블 목록 (9개)

| 테이블 | 역할 |
|--------|------|
| `users` | 사용자 계정 |
| `measurements` | 측정 세션 + 분석 결과 + 다이어리 **통합** |
| `qc_feedback` | QC 윈도우별 신호 품질 피드백 |
| `notifications` | 앱 알림 (완료/리마인더/주간보고) |
| `user_baselines` | 개인 Welford 평균 (HR, HRV) |
| `demographic_baselines` | 집단 Welford 평균 (NHANES 시드) |
| `mock_ppg_sources` | BUT-PPG 소스 메타데이터 |
| `mock_ppg_packets` | BLE 패킷 형태로 저장된 mock PPG 바이트 |
| `alembic_version` | DB 마이그레이션 버전 |

### Alembic 마이그레이션 체인

```
57c602bc5da0
    └→ a1b2c3d4e5f6
         └→ b2c3d4e5f6a1
              └→ 959e7bb7abf2
                   └→ c3d4e5f6a1b2
                        └→ d4e5f6a1b2c3  ← measurements 테이블 통합
                             └→ e5f6a1b2c3d4  ← Welford M2 컬럼 추가
```

---

## 5. 분석 알고리즘 요약

### 집단 대비 (`demographic_baselines`)

```
초기 시드: NHANES Ostchega 2011 데이터
  → python scripts/build_demographic_baselines.py 로 시드 적재
  → 데이터셋 없을 시 NHANES fallback 자동 적용

업데이트: 새 측정마다 Welford 온라인 알고리즘
  new_mean = old_mean + (value - old_mean) / n
  M2      += (value - old_mean) × (value - new_mean)
  std      = sqrt(M2 / (n-1))

백분위: scipy.stats.norm.cdf(z)  z = (hr - avg) / std

APG b/a : Takazawa 1998 고정값 사용
HRV     : Task Force 1996 고정값 사용
```

### 개인 대비 (`user_baselines`)

```
동일 Welford 알고리즘으로 사용자별 avg_hr, avg_hrv 관리

추세 판정 (trend):
  HR_diff < -5  AND HRV_diff > +5  → 'improving'  (심박↓ + HRV↑)
  |HR_diff| ≤ 5 AND |HRV_diff| ≤ 5 → 'stable'
  else                              → 'declining'
  첫 측정                           → 'first'

주의: is_dev=true(mock 모드) 측정은 demographic/personal baseline 업데이트 안 됨
     save-analysis 경로는 항상 업데이트
```

### QC (신호 품질 검증)

```
snr = max(ppgData[-20 samples]) - min(ppgData[-20 samples])
isGood = snr > 5   (10-bit ADC 카운트 기준)

피드백:
  isGood = true  → "신호 양호"
  isGood = false → "신호 약함 — 손가락 위치 조정"
```

### 주요 지표 계산 (`_buildMockRecord` — 로컬 모드)

```
AC  = max(signal) - min(signal)
DC  = mean(signal)
PI  = (AC / DC) × 100  [%]

HR: 피크 카운트 (local max > mean, 최소 간격 30샘플)
    heartRate = (peaks / duration_s) × 60
    유효 범위: 40–180 bpm, 범위 밖이면 72 bpm fallback

HRV: 현재 mock 모드에서 랜덤 (25–65 ms SDNN)
     실서버: RR 간격 기반 SDNN 계산
```

---

## 6. 백엔드 API 엔드포인트 목록

| Method | Path | 역할 |
|--------|------|------|
| `POST` | `/api/v1/auth/login` | 이메일 로그인 |
| `POST` | `/api/v1/auth/register` | 회원가입 |
| `GET`  | `/api/v1/auth/kakao/url` | Kakao OAuth URL |
| `GET`  | `/api/v1/auth/google/url` | Google OAuth URL |
| `POST` | `/api/v1/measurements/start` | 측정 세션 시작 |
| `POST` | `/api/v1/measurements/{id}/qc-data` | QC 윈도우 전송 |
| `POST` | `/api/v1/measurements/{id}/complete` | 측정 완료 |
| `POST` | `/api/v1/measurements/{id}/analyze` | 분석 실행 + 완료 알림 생성 |
| `POST` | `/api/v1/measurements/{id}/save-analysis` | mock 분석값 직접 저장 |
| `PATCH`| `/api/v1/measurements/{id}/diary` | 노트/태그/어드바이스 저장 |
| `GET`  | `/api/v1/measurements/history` | 측정 기록 목록 (JWT 필요) |
| `GET`  | `/api/v1/notifications` | 알림 목록 (최신 50개) |
| `PATCH`| `/api/v1/notifications/{id}/read` | 개별 읽음 처리 |
| `POST` | `/api/v1/notifications/mark-all-read` | 전체 읽음 처리 |
| `GET`  | `/api/v1/notifications/unread-count` | 미읽음 카운트 |

### 백엔드 스케줄러 (`app/services/scheduler.py`)

| 작업 | 주기 | 조건 |
|------|------|------|
| `reminder` 알림 | 09:00 KST, 15:00 KST 매일 | 오늘 측정 없는 사용자 |
| `weekly_report` 알림 | 매주 월요일 09:00 KST | 지난주 측정 기록 있는 사용자 |

---

## 7. 주요 파일 경로

```
src/
├── assets/
│   └── mock_ppg_data.json          # BUT-PPG 5개 신호 (17,946샘플 각)
├── api/
│   ├── client.ts                   # axios 인스턴스 + JWT 인터셉터
│   ├── auth.ts
│   ├── measurements.ts
│   └── notifications.ts
├── components/
│   └── PPGChart.tsx                # 실시간 PPG 파형 차트
├── config/
│   ├── colors.ts                   # 컬러 시스템 토큰
│   ├── guides.ts                   # 지표 가이드 데이터 (METRIC_GUIDES)
│   └── measurement.ts              # 타이밍/QC/BLE 상수 + 개발 플래그
├── context/
│   ├── AuthContext.tsx
│   └── NotificationContext.tsx     # 로컬 알림 + 리마인더 스케줄러
├── hooks/
│   └── useMeasurement.ts           # 측정 워크플로 (BLE + mock)
├── navigation/
│   ├── AppNavigator.tsx
│   ├── AuthNavigator.tsx
│   └── MainNavigator.tsx           # 하단 탭 + 뱃지
├── screens/
│   ├── MeasurementScreen.tsx
│   ├── MeasurementResultScreen.tsx
│   ├── DiaryScreen.tsx
│   ├── NotificationScreen.tsx
│   └── MyPageScreen.tsx
├── types/
│   └── measurement.ts              # MeasurementRecord, Notification 등
└── utils/
    ├── localCache.ts               # AsyncStorage CRUD
    └── metrics.ts                  # 지표 상태 판정 함수
```

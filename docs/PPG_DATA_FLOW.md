# PPG 데이터 플로우: BLE → 앱 → 서버

## 전체 흐름

```
┌──────────────────┐
│  BLE 디바이스    │  50ms마다 패킷 전송
│  (200 Hz 센서)   │
└────────┬─────────┘
         │ 24 bytes packet
         │ [Header|Index|PPG×10|Battery|CRC]
         ↓
┌──────────────────┐
│  React Native    │  parseBLEPacket() → 10 samples
│  BLE 수신        │  samples.forEach(v => injectPPGSample(v))
└────────┬─────────┘
         │ ppgDataRef (O(1) push, full raw buffer)
         ↓
┌──────────────────────────────────────────────┐
│  Display timer (100ms)                       │
│  setPpgData(ppgDataRef.slice(-600))          │  → PPGChart (10 Hz, last 3s)
└──────────────────────────────────────────────┘
         │
┌──────────────────────────────────────────────┐
│  QC sender (1000ms)                          │
│  ppgDataRef.slice(-400) → /qc-data API       │  → QC 피드백
└──────────────────────────────────────────────┘
         │
┌──────────────────────────────────────────────┐
│  60초 완료 → runAnalysis()                   │
│  ppgDataRef.slice() @ 200 Hz → /analyze API  │  → MeasurementRecord
└──────────────────────────────────────────────┘
```

---

## 타이밍 상세 (200 Hz 기준)

```
시간축 (초):
0.00   0.05   0.10   0.15   ... 2.00
 │      │      │      │          │
Pkt#1  Pkt#2  Pkt#3  Pkt#4  ... Pkt#40
10샘플 10샘플 10샘플 10샘플    10샘플

누적: 10 → 20 → 30 → 40 → ... → 400

2초 후: 400개 샘플 = QC 윈도우 1회 전송
```

---

## Mock 모드 (USE_BLE_SENSOR = false)

실제 BLE 연결 없이 동일한 데이터 흐름을 시뮬레이션:

```
mock_ppg_data.json (300 Hz 소스)
    ↓ 50ms마다 generateDummyData() 호출
    ↓ 300 Hz → 200 Hz 리샘플링
    │   sourceSamplesPerPacket = 300 × 0.05 = 15
    │   resampleStep = 15 / 10 = 1.5
    │   for i in 0..9: srcIdx = base + round(i × 1.5)
    ↓ injectPPGSample() × 10회 호출
    → ppgDataRef에 누적 (실제 BLE와 동일한 200 Hz 흐름)
```

---

## QC 데이터 전송

| 항목 | 값 |
|------|-----|
| 전송 주기 | 1000 ms (DATA_SEND_INTERVAL) |
| 전송 샘플 수 | 400 (QC_WINDOW_SIZE = 2초 @ 200 Hz) |
| 엔드포인트 | `POST /api/v1/measurements/{id}/qc-data` |

---

## 분석 흐름

| 단계 | 동작 |
|------|------|
| 60초 완료 | `stopMeasurement()` → `runAnalysis(mId)` |
| 1. complete | `POST /measurements/{id}/complete` |
| 2a. mock | `_buildMockRecord(ppgDataRef, 200 Hz)` → `saveMockAnalysis()` |
| 2b. real | `POST /measurements/{id}/analyze` (ppgDataRef @ 200 Hz) |
| 결과 | `onAnalysisComplete(MeasurementRecord)` → `MeasurementResultScreen` |

---

## BLE 실제 연동 체크리스트

- [ ] `USE_BLE_SENSOR = true` (`src/config/measurement.ts`)
- [ ] `USE_MOCK_MEASUREMENT = false`
- [ ] BLE 라이브러리 설치 (`react-native-ble-plx`)
- [ ] iOS: Info.plist Bluetooth 권한
- [ ] Android: AndroidManifest.xml 권한
- [ ] `parseBLEPacket()` 구현 (→ `docs/BLE_SPEC.md` 참고)
- [ ] dataGeneratorRef setInterval 제거 → BLE notification callback으로 대체
- [ ] 에러 핸들링: 연결 끊김, 패킷 손실, Checksum 불일치

# BLE 디바이스 스펙 (확정)

## 패킷 구조 (24 bytes)

```
┌──────────────────────────────────────────────────────┐
│ Header │ Index │   PPG Data (10 samples)   │ Batt │CRC│
│ 1 byte │ 1 byte│  2 bytes × 10 = 20 bytes  │ 1 B  │1 B│
└──────────────────────────────────────────────────────┘
  Total: 1 + 1 + 20 + 1 + 1 = 24 bytes per packet
```

| 필드 | 크기 | 설명 |
|------|------|------|
| Header | 1 byte | 패킷 시작 식별자 (0xFF) |
| Index | 1 byte | 패킷 순서 번호 (0–255, 순환) |
| PPG Data | 20 bytes | 10개 샘플 × 2 bytes (Big-endian, 16-bit unsigned) |
| Battery | 1 byte | 배터리 레벨 (0–100) |
| Checksum | 1 byte | XOR of bytes 0–22 |

---

## 타이밍 / 샘플링

| 항목 | 값 |
|------|-----|
| 패킷 전송 주기 | **50 ms** (20 packets/sec) |
| 패킷당 샘플 수 | **10 samples** |
| 유효 샘플링 레이트 | **200 Hz** (10 × 20) |
| QC 윈도우 크기 | **400 samples** (2초 분량) |
| 60초 측정 총 샘플 | 12,000 samples (24 KB) |

---

## 패킷 파싱 — React Native

```typescript
// BLE 패킷 파싱 (24 bytes)
const parseBLEPacket = (packet: Uint8Array): { samples: number[], battery: number } => {
  if (packet[0] !== 0xFF) throw new Error('Invalid header');

  const index = packet[1];

  // PPG: 10 samples × 2 bytes (Big-endian)
  const samples: number[] = [];
  for (let i = 0; i < 10; i++) {
    const offset = 2 + i * 2;
    samples.push((packet[offset] << 8) | packet[offset + 1]);
  }

  // Battery (1 byte, offset 22)
  const battery = packet[22];

  // XOR Checksum
  let calc = 0;
  for (let i = 0; i < 23; i++) calc ^= packet[i];
  if (calc !== packet[23]) console.warn('Checksum mismatch');

  return { samples, battery };
};
```

---

## useMeasurement 연동 (USE_BLE_SENSOR = true)

```typescript
// BLE notification callback
bleDevice.monitorCharacteristicForService(SERVICE_UUID, CHAR_UUID, (err, char) => {
  if (!char?.value) return;
  const packet = new Uint8Array(Buffer.from(char.value, 'base64'));
  const { samples, battery } = parseBLEPacket(packet);

  // 10개 샘플을 각각 inject — QC 버퍼와 분석 버퍼에 자동 누적
  samples.forEach(v => injectPPGSample(v));
});
```

`injectPPGSample`은 O(1) push이므로 10번 호출해도 성능 문제 없음.

---

## 코드 설정값 (`src/config/measurement.ts`)

```typescript
export const PPG_SAMPLING_RATE       = 200;  // Hz
export const BLE_SAMPLES_PER_PACKET  = 10;   // 패킷당 샘플
export const DATA_GENERATION_INTERVAL = 50;  // ms (패킷 주기)
export const QC_WINDOW_SIZE          = 400;  // 2초 @ 200 Hz
```

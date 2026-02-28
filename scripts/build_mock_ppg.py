#!/usr/bin/env python3
"""
BUT-PPG (30 Hz, 10 sec) → Mock PPG (300 Hz, 60 sec) 변환 스크립트

BUT-PPG 두 가지 포맷:
[Format A] 100001-계열: record_name 300 30 1
  - 300 "채널" × 1 샘플 (gain 값 자체가 신호 인코딩)
  - physical = -baseline / gain = 32767 / (-gain)

[Format B] 121040-계열: record_name 3 30 300
  - 3 채널(PPG_R/G/B) × 300 샘플, interleaved
  - physical = (digital - baseline) / gain (채널별 동일 gain)
"""

import os, json, struct, csv, math, random

DATASET_DIR = "/Users/yujeongmu/Desktop/butppg-dataset/brno-university-of-technology-smartphone-ppg-database-but-ppg-2.0.0"
OUTPUT_DIR  = "/Users/yujeongmu/Desktop/PPGHealthApp/src/assets"
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "mock_ppg_data.json")

TARGET_FS        = 300
SOURCE_FS        = 30
UPSAMPLE_FACTOR  = TARGET_FS // SOURCE_FS  # 10
SEGMENT_DURATION = 10
SEGMENTS_NEEDED  = 6
TARGET_SAMPLES   = TARGET_FS * SEGMENT_DURATION * SEGMENTS_NEEDED  # 18,000


# ─── 포맷 감지 + 신호 읽기 ────────────────────────────────────────────────────

def read_ppg_signal(record_id: str) -> list[float] | None:
    hea_path = os.path.join(DATASET_DIR, record_id, f"{record_id}_PPG.hea")
    dat_path = os.path.join(DATASET_DIR, record_id, f"{record_id}_PPG.dat")
    if not os.path.exists(hea_path) or not os.path.exists(dat_path):
        return None

    with open(hea_path) as f:
        lines = f.readlines()

    header   = lines[0].strip().split()
    n_sig    = int(header[1])
    n_samp   = int(header[3]) if len(header) > 3 else 1

    # 신호 정의 파싱
    sig_infos = []
    for line in lines[1:]:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split()
        if len(parts) < 3:
            continue
        gs = parts[2]
        try:
            gain     = float(gs.split("(")[0])
            baseline = int(gs.split("(")[1].split(")")[0])
            sig_infos.append((gain, baseline))
        except Exception:
            continue

    with open(dat_path, "rb") as f:
        raw = f.read()
    total = len(raw) // 2
    if total == 0:
        return None
    raw_ints = struct.unpack(f"<{total}h", raw)

    # ── Format A: n_samp==1, 300 채널 → gain-encoded signal ─────────────────
    if n_samp == 1 and n_sig >= 100:
        if not sig_infos:
            return None
        return [(-b / g) for g, b in sig_infos]

    # ── Format B: n_sig==3 (or small), n_samp==300 → interleaved ────────────
    if n_sig >= 1 and n_samp > 1 and sig_infos:
        # 채널 0 (PPG_R) 추출
        g0, b0 = sig_infos[0]
        ch0 = raw_ints[0::n_sig]
        return [(v - b0) / g0 for v in ch0]

    return None


# ─── 신호 처리 ─────────────────────────────────────────────────────────────────

def catmull_rom_upsample(signal: list[float], factor: int) -> list[float]:
    """Catmull-Rom 스플라인 업샘플링 (순수 Python)"""
    n = len(signal)
    result = []
    for i in range(n - 1):
        p0 = signal[max(0, i - 1)]
        p1 = signal[i]
        p2 = signal[i + 1]
        p3 = signal[min(n - 1, i + 2)]
        for j in range(factor):
            t  = j / factor
            t2 = t * t
            t3 = t2 * t
            v  = 0.5 * (
                2 * p1
                + (-p0 + p2) * t
                + (2*p0 - 5*p1 + 4*p2 - p3) * t2
                + (-p0 + 3*p1 - 3*p2 + p3) * t3
            )
            result.append(v)
    result.append(signal[-1])
    return result


def normalize(signal: list[float]) -> list[float]:
    lo, hi = min(signal), max(signal)
    rng = hi - lo
    if rng < 1e-9:
        return [0.5] * len(signal)
    return [(v - lo) / rng for v in signal]


def detect_peaks(signal: list[float], fs: int) -> list[int]:
    """Simple local maxima peak detection for HR computation"""
    min_dist = int(fs * 0.4)   # 최대 150 bpm
    window   = int(fs * 0.2)   # 평활화 윈도우
    # 이동평균 평활화
    smooth = []
    for i in range(len(signal)):
        lo = max(0, i - window // 2)
        hi = min(len(signal), i + window // 2)
        smooth.append(sum(signal[lo:hi]) / (hi - lo))

    threshold = 0.5
    peaks = []
    for i in range(1, len(smooth) - 1):
        if smooth[i] > threshold and smooth[i] > smooth[i-1] and smooth[i] > smooth[i+1]:
            if not peaks or (i - peaks[-1]) >= min_dist:
                peaks.append(i)
    return peaks


def compute_hr_hrv(peaks: list[int], fs: int) -> dict:
    if len(peaks) < 3:
        return {"hr": 72.0, "hrv_rmssd": 38.0}  # fallback
    rr = [(peaks[i+1] - peaks[i]) / fs * 1000 for i in range(len(peaks)-1)]
    hr = 60 / (sum(rr) / len(rr) / 1000)
    diffs_sq = [(rr[i+1] - rr[i])**2 for i in range(len(rr)-1)]
    hrv = math.sqrt(sum(diffs_sq) / len(diffs_sq)) if diffs_sq else 30.0
    # 생리적 범위 클리핑
    hr  = max(45.0, min(120.0, hr))
    hrv = max(10.0, min(100.0, hrv))
    return {"hr": round(hr, 1), "hrv_rmssd": round(hrv, 1)}


def compute_pi_ac_dc(signal: list[float], fs: int) -> dict:
    """비트 단위 PI, AC, DC 계산"""
    w = fs  # 1초 윈도우
    acs, dcs = [], []
    for i in range(0, len(signal) - w, w // 2):
        seg = signal[i:i+w]
        ac  = max(seg) - min(seg)
        dc  = sum(seg) / len(seg)
        if dc > 0.05:   # DC가 너무 작으면 제외
            acs.append(ac)
            dcs.append(dc)
    if not acs:
        return {"pi": 2.0, "ac": 0.05, "dc": 0.5}
    ac_m = sum(acs) / len(acs)
    dc_m = sum(dcs) / len(dcs)
    pi   = (ac_m / dc_m) * 100
    return {"pi": round(pi, 2), "ac": round(ac_m, 4), "dc": round(dc_m, 4)}


# ─── 조언 생성 ─────────────────────────────────────────────────────────────────

ADVICE_RULES = [
    {
        "cond": lambda hr, hrv, hr_d, hrv_d: hrv < 28,
        "text": "HRV가 낮아요. 충분한 수면과 휴식이 필요할 수 있어요. 카페인을 줄이고 이완 활동을 시도해보세요.",
        "tags": ["수면부족", "피로", "스트레스"],
    },
    {
        "cond": lambda hr, hrv, hr_d, hrv_d: hr_d > 10,
        "text": "심박수가 평소보다 높아요. 운동 후이거나 긴장 상태일 수 있어요. 잠시 깊은 호흡을 해보세요.",
        "tags": ["운동후", "카페인", "긴장"],
    },
    {
        "cond": lambda hr, hrv, hr_d, hrv_d: hrv_d > 8 and hrv > 45,
        "text": "오늘 자율신경계 균형이 평소보다 좋아요. 현재 컨디션을 유지해보세요.",
        "tags": ["컨디션좋음"],
    },
    {
        "cond": lambda hr, hrv, hr_d, hrv_d: hr < 58,
        "text": "심박수가 약간 낮아요. 규칙적인 유산소 운동 효과일 수 있어요.",
        "tags": ["운동효과", "안정"],
    },
]

def generate_advice(hr, hrv, hr_diff, hrv_diff):
    for rule in ADVICE_RULES:
        if rule["cond"](hr, hrv, hr_diff, hrv_diff):
            return {"text": rule["text"], "tags": rule["tags"]}
    return {
        "text": "심박수와 자율신경계가 안정적입니다. 오늘 컨디션이 좋네요!",
        "tags": ["컨디션좋음", "안정"],
    }

def classify_status(hr, hrv):
    if 60 <= hr <= 80 and hrv >= 40: return "excellent"
    if 55 <= hr <= 90 and hrv >= 25: return "good"
    if 50 <= hr <= 100:              return "normal"
    return "poor"


# ─── 메인 빌드 ─────────────────────────────────────────────────────────────────

def load_quality_records():
    path = os.path.join(DATASET_DIR, "quality-hr-ann.csv")
    recs = []
    with open(path, encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            if row["Quality"] == "1":
                recs.append({"id": row["ID"], "hr_ref": int(row["HR"])})
    return recs


BASE_DATES = [
    ("2026-02-28", "09:30:00"),
    ("2026-02-28", "14:20:00"),
    ("2026-02-27", "08:45:00"),
    ("2026-02-26", "10:00:00"),
    ("2026-02-25", "19:30:00"),
]
HR_BASELINE  = 74.0
HRV_BASELINE = 42.0
AGE_AVG_HR   = 73.0


def build_mock_measurements(n_records: int = 5) -> list[dict]:
    quality_recs = load_quality_records()
    # HR 70-90 범위 우선 선택 (더 현실적)
    priority = [r for r in quality_recs if 60 <= r["hr_ref"] <= 95]
    rest     = [r for r in quality_recs if r not in priority]
    pool     = priority + rest

    measurements = []
    used_idx = 0

    for rec_idx in range(min(n_records, len(BASE_DATES))):
        date, time = BASE_DATES[rec_idx]
        combined: list[float] = []

        # 6개 레코딩 수집 (실패 시 다음으로 교체)
        seg_count = 0
        while seg_count < SEGMENTS_NEEDED and used_idx < len(pool):
            r = pool[used_idx]
            used_idx += 1
            sig = read_ppg_signal(r["id"])
            if sig is None or len(sig) < 30:
                continue
            upsampled = catmull_rom_upsample(sig, UPSAMPLE_FACTOR)
            combined.extend(upsampled)
            seg_count += 1

        if seg_count < SEGMENTS_NEEDED:
            print(f"  [{rec_idx+1}] 세그먼트 부족 ({seg_count}/{SEGMENTS_NEEDED}) — 건너뜀")
            continue

        # 정규화
        norm = normalize(combined)

        # 지표 계산
        peaks  = detect_peaks(norm, TARGET_FS)
        hm     = compute_hr_hrv(peaks, TARGET_FS)
        pi_m   = compute_pi_ac_dc(norm, TARGET_FS)
        hr, hrv = hm["hr"], hm["hrv_rmssd"]

        hr_diff  = round(hr  - HR_BASELINE,  1)
        hrv_diff = round(hrv - HRV_BASELINE, 1)
        pct      = max(10, min(90, round(50 + (AGE_AVG_HR - hr) * 2)))
        adv      = generate_advice(hr, hrv, hr_diff, hrv_diff)

        measurements.append({
            "id":        str(rec_idx + 1),
            "userId":    "user1",
            "date":      date,
            "time":      time,
            "timestamp": 1740700000 + rec_idx * 18000,
            "duration":  60,
            "ppgSignal": [round(v, 4) for v in norm[:TARGET_SAMPLES]],
            "notes":     "",
            "advice":    adv["text"],
            "tags":      adv["tags"],
            "analysis": {
                "general": {
                    "heartRate": round(hr),
                    "hrv":       round(hrv),
                    "pi":        pi_m["pi"],
                    "ac":        pi_m["ac"],
                    "dc":        pi_m["dc"],
                    "status":    classify_status(hr, hrv),
                },
                "personal": {
                    "heartRateDiff": int(hr_diff),
                    "hrvDiff":       int(hrv_diff),
                    "trend": "improving" if hrv_diff > 3 else ("declining" if hrv_diff < -3 else "stable"),
                },
                "demographic": {
                    "percentile":    pct,
                    "ageGroupAvg":   int(AGE_AVG_HR),
                    "genderGroupAvg": int(AGE_AVG_HR - 2),
                    "comparison": "above_average" if pct > 60 else ("below_average" if pct < 40 else "average"),
                },
            },
        })
        print(f"  [{rec_idx+1}/{n_records}] {date} {time} — HR:{round(hr)} HRV:{round(hrv)} PI:{pi_m['pi']}% peaks:{len(peaks)} samples:{len(norm)}")

    return measurements


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print("BUT-PPG Mock 데이터 생성 중...")
    print(f"  목표: {SEGMENTS_NEEDED}개 세그먼트 × {UPSAMPLE_FACTOR}x 업샘플 → {TARGET_SAMPLES} 샘플/측정\n")

    measurements = build_mock_measurements(5)

    output = {
        "generatedAt":   "2026-02-28",
        "sourceDataset": "BUT-PPG 2.0.0 (Brno University of Technology)",
        "samplingRate":  TARGET_FS,
        "durationSec":   SEGMENT_DURATION * SEGMENTS_NEEDED,
        "note":          "30Hz→300Hz 업샘플링 (Catmull-Rom). b/a·AI 계산 불가. HR/HRV/PI 및 UI 테스트용.",
        "measurements":  measurements,
    }

    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    kb = os.path.getsize(OUTPUT_FILE) / 1024
    print(f"\n완료: {OUTPUT_FILE}")
    print(f"  측정 기록 {len(measurements)}개 / {kb:.1f} KB")


if __name__ == "__main__":
    main()

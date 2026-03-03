# PPG 분석 설계 문서

## 1. 분석 지표 분류 체계

### 집단 대비 중심 (Z-score / Percentile)
> 혈관 탄성·노화 지표. 개인 내 변화보다 집단 기준과의 비교가 의미 있음.

| 지표 | 설명 | 기준 범위 |
|---|---|---|
| **b/a** | APG 2차 미분 피크 비율. 혈관 탄성 지수. 음수일수록 노화 진행 | -0.3 ~ -0.6 (연령별 상이) |
| **AI** (Augmentation Index) | (d-c)/a. 동맥 경직도 반영 | 낮을수록 좋음 |
| **HR** | 심박수 (bpm) | 집단 분포 대비 백분위 |

**집단 참조 데이터 전략**
- HR: NHANES Ostchega 2011 독립 표본 (n=150-521/그룹) — Welford 온라인 업데이트로 앱 데이터 축적 시 자동 보정
- b/a, AI: 문헌 기반 연령대별 참조값 고정 (Takazawa 1998, Imanaga 1998)
  - 30 Hz PPG는 APG 해상도 부족으로 부적합 (1주기 22샘플 → b 피크 오차 ±16 ms)
  - 자체 디바이스(200 Hz) b/a와 30 Hz 기준값은 직접 비교 불가
- HRV: Task Force 1996 문헌값 고정 (avg_hrv_sdnn, std_hrv_sdnn)

---

### 개인 대비 중심 (Baseline 대비 변화)
> 말초혈류·자율신경 지표. 개인 간 차이가 크므로 집단 기준보다 개인 baseline과의 비교가 의미 있음.

| 지표 | 계산 방법 | 의미 |
|---|---|---|
| **PI** (Perfusion Index) | AC / DC × 100 (%) | 말초혈류 충실도. 손가락 접촉 압력·혈류량 반영 |
| **AC** | PPG 신호의 AC 진폭 (최댓값 - 최솟값) | 박동성 혈류량 |
| **DC** | PPG 신호의 DC 레벨 (이동 평균) | 정적 조직 흡수광 |
| **HR** | 피크 간격 역수 × 60 (bpm) | 심박수 |
| **HRV** (SDNN, RMSSD) | RR 인터벌 통계 | 자율신경계 균형 |

**개인 baseline 관리 (user_baselines 테이블)**
- Welford 온라인 알고리즘: `avg`, `M2` 저장 → `std = sqrt(M2/(n-1))` 온-더-플라이 계산
- 첫 측정: `trend="first"` → 앱에서 배너 표시
- 이후: `trend` = improving / stable / declining (HR_diff, HRV_diff 기준)
- PI, AC, DC는 디바이스·측정 조건 의존성이 높아 집단 비교 불가 (개인 추이만 표시)

---

## 2. 참조 데이터 설계

### 2-1. demographic_baselines 테이블

| 컬럼 | 타입 | 설명 |
|---|---|---|
| gender | VARCHAR(10) | male / female / all |
| age_group | INTEGER | 10세 단위: 20, 30, 40, 50, 60 |
| avg_heart_rate | FLOAT | Welford 평균 |
| std_heart_rate | FLOAT | 표준편차 (legacy) |
| m2_heart_rate | FLOAT | Welford M2 → std = sqrt(M2/(n-1)) |
| sample_count | INTEGER | Welford n |
| b_over_a_ref | FLOAT | Takazawa 1998 고정값 |
| b_over_a_std | FLOAT | Takazawa 1998 고정 std |
| avg_hrv_sdnn | FLOAT | Task Force 1996 고정값 |
| std_hrv_sdnn | FLOAT | Task Force 1996 고정 std |

**초기 시드**: NHANES Ostchega 2011 (HR), Task Force 1996 (HRV), Takazawa 1998 (b/a)
- `python scripts/build_demographic_baselines.py` 실행

### 2-2. 문헌 기반 b/a 참조값 (Takazawa 1998)

| 연령대 | b/a mean | b/a std | 해석 |
|---|---|---|---|
| 20대 | -0.29 | 0.13 | 혈관 탄성 양호 |
| 30대 | -0.33 | 0.14 | 정상 |
| 40대 | -0.40 | 0.15 | 경미한 노화 시작 |
| 50대 | -0.47 | 0.16 | 혈관 경직 진행 |
| 60대 | -0.53 | 0.18 | 유의미한 혈관 노화 |

b/a 해석 기준:
- `> -0.40`: 혈관 탄성 양호
- `-0.40 ~ -0.55`: 경미한 혈관 노화
- `< -0.55`: 유의미한 혈관 경직

---

## 3. 구현 현황

### ✅ 완료

- [x] `demographic_baselines` 테이블 (Alembic migration d4e5f6a1b2c3 + e5f6a1b2c3d4)
- [x] NHANES 시드 (`scripts/build_demographic_baselines.py`)
- [x] 분석 API (`POST /api/v1/measurements/{id}/analyze`) — 실제 PPG 신호 분석
- [x] 모의 분석 (`POST /api/v1/measurements/{id}/save-analysis`) — mock 모드용
- [x] `app/services/analysis_service.py` — HR, HRV, PI, AC, DC, b/a, AI, percentile
- [x] Welford 온라인 알고리즘 — user_baselines, demographic_baselines 모두 적용
- [x] 개인 대비 trend: improving / stable / declining / first
- [x] 집단 대비: Z-score 기반 백분위 (scipy.stats.norm.cdf)
- [x] DB 통합: measurements 단일 테이블 (세션 + 분석 + 다이어리)

---

## 4. 주요 제약사항 및 주의점

1. **b/a 집단 비교의 한계**: 측정 조건(압력, 온도, 움직임)이 b/a에 영향. 동일 디바이스로 표준화된 조건에서 측정한 값끼리 비교해야 의미 있음.

2. **PI의 절대값 해석 주의**: PI는 피부 색소, 주변 광, 손가락 접촉 압력에 민감. 집단 기준보다 개인 내 변화 트렌드로 해석 권장.

3. **HRV 단기 측정 한계**: 60초 측정에서는 단기 HRV(RMSSD, pNN50)만 신뢰할 수 있음. 장기 HRV(SDNN 24h 등)는 불가.

4. **HR 집단 기준 인종 편향**: NHANES는 미국 성인 기준. 향후 한국인 데이터셋으로 보완 권장.

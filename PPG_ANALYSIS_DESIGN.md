# PPG 분석 설계 문서

## 1. 분석 지표 분류 체계

### 집단 대비 중심 (Z-score / Mahalanobis)
> 혈관 탄성·노화 지표. 개인 내 변화보다 집단 기준과의 비교가 의미 있음.

| 지표 | 설명 | 기준 범위 |
|---|---|---|
| **b/a** | APG 2차 미분 피크 비율. 혈관 탄성 지수. 음수일수록 노화 진행 | -0.3 ~ -0.6 (연령별 상이) |
| **AI** (Augmentation Index) | (d-c)/a. 동맥 경직도 반영 | 낮을수록 좋음 |

**집단 참조 데이터 전략**
- b/a, AI: 문헌 기반 연령대별 노마티브 데이터 사용 (Takazawa, Imanaga 등)
  - BUT-PPG(30 Hz)는 APG 해상도 부족으로 부적합 (1주기 22샘플 → b 피크 오차 ±16 ms)
  - 자체 디바이스(300 Hz, 1주기 225샘플)에서 계산한 b/a와 30 Hz 기준값은 직접 비교 불가
- HR: BUT-PPG 활용 가능 (ECG 기반 정답값, 샘플링 레이트 무관)

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

**개인 baseline 관리**
- 첫 3~5회 측정값으로 baseline 수립 (`user_baselines` 테이블)
- 이후 측정값은 baseline 대비 변화량(Δ)으로 해석
- PI, AC, DC는 디바이스·측정 조건 의존성이 높아 타인 기준과 비교 불가

---

## 2. BUT-PPG 데이터셋 활용 범위

**위치**: `/Users/yujeongmu/Desktop/butppg-dataset/`
**포맷**: WFDB (.dat + .hea + .qrs), 3,888 레코딩

| 활용 항목 | 사용 여부 | 이유 |
|---|---|---|
| HR 집단 통계 (연령/성별별) | ✅ 사용 | ECG QRS 기반 정답값, 신뢰도 높음 |
| b/a 집단 통계 | ❌ 미사용 | 30 Hz → APG 해상도 부족 |
| AI 집단 통계 | ❌ 미사용 | 동일 이유 |
| HRV 집단 통계 | ⚠️ 제한적 | 30 Hz → ±16 ms 오차, 보간 시 사용 가능 |
| PI / AC / DC | ❌ 불필요 | 개인 대비 지표, 집단 참조 불필요 |

---

## 3. 참조 데이터 설계

### 3-1. demographic_baselines 테이블 (신규 추가)

```sql
CREATE TABLE demographic_baselines (
    id              INTEGER PRIMARY KEY,
    age_min         INTEGER NOT NULL,   -- 연령대 하한 (예: 20)
    age_max         INTEGER NOT NULL,   -- 연령대 상한 (예: 29)
    gender          VARCHAR(10),        -- 'male' | 'female' | NULL(전체)
    metric          VARCHAR(30) NOT NULL, -- 'hr' | 'hrv_sdnn' | 'ba_ratio' | 'ai'
    source          VARCHAR(50),        -- 'butppg' | 'literature'
    sample_count    INTEGER,
    mean            FLOAT NOT NULL,
    std             FLOAT NOT NULL,
    p10             FLOAT,
    p25             FLOAT,
    p50             FLOAT,
    p75             FLOAT,
    p90             FLOAT
);
```

### 3-2. 문헌 기반 b/a 참조값

출처: Takazawa et al. (1998), Imanaga et al. (1998), 다수 후속 연구

| 연령대 | b/a mean | b/a std | 해석 |
|---|---|---|---|
| 20대 | -0.32 | 0.14 | 혈관 탄성 양호 |
| 30대 | -0.38 | 0.12 | 정상 |
| 40대 | -0.45 | 0.13 | 경미한 노화 시작 |
| 50대 | -0.52 | 0.14 | 혈관 경직 진행 |
| 60대+ | -0.58 | 0.16 | 유의미한 혈관 노화 |

b/a 해석 기준:
- `> -0.40`: 혈관 탄성 양호
- `-0.40 ~ -0.55`: 경미한 혈관 노화
- `< -0.55`: 유의미한 혈관 경직

### 3-3. BUT-PPG 기반 HR 참조값 추출 계획

```python
# scripts/build_demographic_baselines.py
# 1. quality-hr-ann.csv에서 Quality=1인 레코딩만 필터링
# 2. subject-info.csv와 병합 (나이, 성별)
# 3. 10세 단위 연령대 그룹핑
# 4. 그룹별 HR 통계 계산 (mean, std, percentiles)
# 5. demographic_baselines 테이블에 INSERT
```

---

## 4. 구현 로드맵

### Phase 1: 데이터 기반 구축 (백엔드)
- [ ] `demographic_baselines` 테이블 추가 (Alembic migration)
- [ ] `build_demographic_baselines.py` 스크립트 작성 및 실행
  - BUT-PPG → HR 통계 추출
  - 문헌 기반 b/a, AI 값 하드코딩 입력
- [ ] 분석 API (`POST /measurements/analyze`) 실제 구현
  - PPG 신호 → HR, HRV, PI, AC, DC 계산
  - b/a, AI 계산 (300 Hz 기준)
  - demographic_baselines 조회 → Z-score/백분위 계산

### Phase 2: 분석 서비스 구현 (백엔드)
- [ ] `app/services/analysis_service.py` 작성
  - `compute_hr(ppg, fs=300)`: 피크 검출 → HR
  - `compute_hrv(ppg, fs=300)`: RR 인터벌 → SDNN, RMSSD
  - `compute_pi_ac_dc(ppg)`: PI, AC, DC
  - `compute_apg_indices(ppg, fs=300)`: b/a, AI (300 Hz 최적화)
  - `compute_percentile(value, metric, age, gender)`: 집단 백분위

### Phase 3: 앱 연동
- [ ] `analysis_results` 테이블에 PI, AC, DC 컬럼 추가
- [ ] 프론트엔드 결과 화면 지표 업데이트

---

## 5. 주요 제약사항 및 주의점

1. **b/a 집단 비교의 한계**: 측정 조건(압력, 온도, 움직임)이 b/a에 영향을 미침. 동일 디바이스로 표준화된 조건에서 측정한 값끼리 비교해야 의미 있음.

2. **PI의 절대값 해석 주의**: PI는 피부 색소, 주변 광, 손가락 접촉 압력에 민감. 집단 기준보다 개인 내 변화 트렌드로 해석 권장.

3. **HRV 단기 측정 한계**: 60초 측정에서는 단기 HRV(RMSSD, pNN50)만 신뢰할 수 있음. 장기 HRV(SDNN 24h 등)는 불가.

4. **BUT-PPG의 인구통계적 편향**: 체코 Brno 대학 피험자 중심으로 한국인 집단과 인종적 차이 가능. 향후 한국인 데이터셋으로 보완 권장.

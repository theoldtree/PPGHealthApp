/**
 * Metric Guide Data
 * Used by MeasurementResultScreen (per-metric modal) and DiaryScreen (guidebook modal).
 */

import {Colors} from './colors';

export interface MetricRange {
  label: string;
  color: string;
  desc: string;
}

export interface MetricGuide {
  key: string;
  title: string;
  unit: string;
  description: string;
  ranges: MetricRange[];
  reference?: string;
}

export const METRIC_GUIDES: MetricGuide[] = [
  {
    key: 'heartRate',
    title: '심박수 (HR)',
    unit: 'bpm',
    description:
      '1분 동안 심장이 박동하는 횟수입니다. 안정 시 정상 범위는 60~100 bpm이며, 운동·스트레스·카페인 등의 영향을 받습니다. 장기적으로 낮은 안정 심박수(50~60 bpm)는 심폐 기능이 우수함을 나타냅니다.',
    ranges: [
      {label: '낮음', color: Colors.statusWarning, desc: '< 60 bpm (서맥)'},
      {label: '정상', color: Colors.statusGood,    desc: '60 – 100 bpm'},
      {label: '높음', color: Colors.statusDanger,   desc: '> 100 bpm (빈맥)'},
    ],
    reference: 'AHA (American Heart Association) 기준',
  },
  {
    key: 'hrv',
    title: 'HRV SDNN',
    unit: 'ms',
    description:
      '연속된 심박(RR 간격)의 표준 편차로, 자율신경계 균형을 반영합니다. 높을수록 스트레스 회복력이 좋고 부교감신경이 활성화된 상태입니다. 나이·체력·수면 품질에 따라 개인차가 큽니다.',
    ranges: [
      {label: '낮음', color: Colors.statusDanger,   desc: '< 20 ms (자율신경 불균형 주의)'},
      {label: '보통', color: Colors.statusWarning, desc: '20 – 50 ms'},
      {label: '양호', color: Colors.statusGood,    desc: '> 50 ms'},
    ],
    reference: 'Task Force of ESC/NASPE (1996)',
  },
  {
    key: 'hrvRmssd',
    title: 'HRV RMSSD',
    unit: 'ms',
    description:
      '연속된 RR 간격 차이의 제곱평균제곱근(RMSSD)으로, 부교감신경(미주신경) 활성도를 직접 반영합니다. SDNN보다 단기 변동성에 민감하며, 스트레스·회복 상태 평가에 자주 사용됩니다. 높을수록 심장이 환경 변화에 유연하게 반응하는 상태입니다.',
    ranges: [
      {label: '낮음', color: Colors.statusDanger,   desc: '< 20 ms (부교감 활성 저하)'},
      {label: '보통', color: Colors.statusWarning, desc: '20 – 40 ms'},
      {label: '양호', color: Colors.statusGood,    desc: '> 40 ms'},
    ],
    reference: 'Task Force of ESC/NASPE (1996)',
  },
  {
    key: 'pi',
    title: '관류 지수 (PI)',
    unit: '%',
    description:
      'PPG 신호의 맥파 진폭(AC)을 기저 혈류(DC)로 나눈 비율입니다. 말초 혈관의 혈류량을 간접 반영하며, 손가락 혈액 순환 상태를 나타냅니다. 저체온·혈관 수축 시 낮아집니다.',
    ranges: [
      {label: '낮음', color: Colors.statusWarning, desc: '< 0.2 % (말초 혈류 부족)'},
      {label: '정상', color: Colors.statusGood,    desc: '0.2 – 20 %'},
      {label: '높음', color: Colors.statusWarning, desc: '> 20 % (혈관 과팽창 가능)'},
    ],
    reference: 'Masimo Corporation PI 기준',
  },
  {
    key: 'apgBOverA',
    title: '동맥 경직도 (APG b/a)',
    unit: '',
    description:
      '가속도 맥파(APG)의 b파를 a파로 나눈 비율로, 혈관 탄성을 평가합니다. 값이 높을수록(0에 가까울수록) 혈관이 탄력적이며, 낮을수록(-0.55 이하) 혈관이 경직된 상태입니다.',
    ranges: [
      {label: '양호',       color: Colors.statusGood,    desc: '> -0.40'},
      {label: '경미한 노화', color: Colors.statusWarning, desc: '-0.40 ~ -0.55'},
      {label: '혈관 경직',   color: Colors.statusDanger,  desc: '< -0.55'},
    ],
    reference: 'Takazawa et al. (1998)',
  },
  {
    key: 'ac',
    title: 'AC (맥파 진폭)',
    unit: '',
    description:
      'PPG 신호에서 심장 박동으로 발생하는 혈류 진동 성분(교류 성분)입니다. 심박 주기마다 혈관이 팽창·수축하는 진폭을 나타내며, 말초 혈관 수축 시 감소합니다.',
    ranges: [
      {label: '측정값이 높을수록', color: Colors.statusGood, desc: '말초 혈관 개방, 혈류 양호'},
      {label: '낮은 경우',         color: Colors.statusWarning, desc: '혈관 수축, 저체온 등 가능'},
    ],
  },
  {
    key: 'dc',
    title: 'DC (기저 혈류)',
    unit: '',
    description:
      'PPG 신호의 직류 성분으로, 조직에 상시 흐르는 기저 혈류량을 반영합니다. 피부·조직 색소, 센서 접촉 상태에 따라 변동되므로 AC/DC 비율(PI)로 해석하는 것이 더 의미 있습니다.',
    ranges: [
      {label: '참고 지표', color: Colors.statusNeutral, desc: 'PI = AC ÷ DC × 100 (%)'},
    ],
  },
];

export function getGuide(key: string): MetricGuide | undefined {
  return METRIC_GUIDES.find(g => g.key === key);
}

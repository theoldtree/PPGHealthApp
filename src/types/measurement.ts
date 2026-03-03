export interface MeasurementRecord {
  id: string;
  userId: string;
  date: string;       // YYYY-MM-DD
  time: string;       // HH:mm:ss
  timestamp: number;
  duration: number;   // seconds
  ppgSignal?: number[];
  notes?: string;
  advice?: string;    // 자동 생성 조언
  tags?: string[];    // 사용자 선택 태그
  analysis?: {
    general:     GeneralAnalysis;
    personal:    PersonalComparison;
    demographic: DemographicComparison;
  };
}

export interface GeneralAnalysis {
  heartRate: number;       // bpm
  hrv:       number;       // ms SDNN
  hrvRmssd?: number;       // ms RMSSD
  pi:        number;       // % Perfusion Index
  ac:        number;       // AC amplitude
  dc:        number;       // DC level
  apgBOverA?: number;      // APG b/a ratio (arterial stiffness)
  apgAI?:    number;       // APG aging index
  status:    'excellent' | 'good' | 'normal' | 'poor';
}

export interface PersonalComparison {
  heartRateDiff: number;   // +/- from personal baseline
  hrvDiff:       number;
  trend:         'improving' | 'stable' | 'declining' | 'first';
}

export interface DemographicComparison {
  percentile:     number;   // 0-100 (HR percentile vs same age/gender)
  ageGroupAvg:    number;
  genderGroupAvg: number;
  comparison:     'above_average' | 'average' | 'below_average';
  apgBOverARef?:  number;   // Takazawa reference b/a for this age/gender
  apgBOverAStd?:  number;   // std of reference
  avgHrvSdnn?:    number;   // literature-based HRV SDNN avg for this age group (ms)
  stdHrvSdnn?:    number;   // std (ms)
}

export interface MarkedDates {
  [date: string]: {
    marked:    boolean;
    dotColor?: string;
    count?:    number;
  };
}

/** 다이어리 날짜별 그룹 */
export interface DailyGroup {
  date:    string;
  records: MeasurementRecord[];
}

/** 알림 */
export type NotificationType = 'measurement_complete' | 'reminder' | 'weekly_report';

export interface Notification {
  id:        string;
  type:      NotificationType;
  title:     string;
  body:      string;
  createdAt: string;   // ISO timestamp
  isRead:    boolean;
  recordId?: string;
  data?:     Record<string, unknown>;
}

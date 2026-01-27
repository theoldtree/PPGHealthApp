export interface MeasurementRecord {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm:ss
  timestamp: number;
  duration: number; // seconds
  notes?: string;
  // 분석 결과
  analysis?: {
    general: GeneralAnalysis;
    personal: PersonalComparison;
    demographic: DemographicComparison;
  };
}

export interface GeneralAnalysis {
  heartRate: number; // bpm
  hrv: number; // ms
  stressLevel: number; // 0-100
  status: 'excellent' | 'good' | 'normal' | 'poor';
}

export interface PersonalComparison {
  heartRateDiff: number; // +/- from personal average
  hrvDiff: number;
  trend: 'improving' | 'stable' | 'declining';
}

export interface DemographicComparison {
  percentile: number; // 0-100
  ageGroupAvg: number;
  genderGroupAvg: number;
  comparison: 'above_average' | 'average' | 'below_average';
}

export interface MarkedDates {
  [date: string]: {
    marked: boolean;
    dotColor?: string;
    count?: number;
  };
}

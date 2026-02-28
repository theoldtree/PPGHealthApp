/**
 * Medical-grade color system
 * Reference: Withings Health Mate + Samsung Health
 */
export const Colors = {
  // Brand
  primary:      '#0066CC',
  primaryLight: '#E8F2FF',
  primaryDark:  '#004C99',

  // Backgrounds
  background:   '#F4F7FB',
  card:         '#FFFFFF',
  border:       '#E2EAF4',

  // Text
  textPrimary:   '#1B2E4B',
  textSecondary: '#6B7C93',
  textTertiary:  '#A0AEC0',

  // Status
  statusGood:    '#16A34A',
  statusWarning: '#D97706',
  statusDanger:  '#DC2626',
  statusNeutral: '#6B7C93',

  // Tab
  tabActive:   '#0066CC',
  tabInactive: '#9CA3AF',
  tabBar:      '#FFFFFF',

  // Misc
  white:       '#FFFFFF',
  black:       '#000000',
  overlay:     'rgba(27, 46, 75, 0.5)',
} as const;

export type StatusLevel = 'excellent' | 'good' | 'normal' | 'poor';

export const StatusColors: Record<StatusLevel, string> = {
  excellent: '#0066CC',
  good:      '#16A34A',
  normal:    '#D97706',
  poor:      '#DC2626',
};

export const StatusLabels: Record<StatusLevel, string> = {
  excellent: '매우 좋음',
  good:      '좋음',
  normal:    '보통',
  poor:      '주의',
};

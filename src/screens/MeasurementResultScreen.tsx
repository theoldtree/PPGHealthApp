import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';
import type {MeasurementRecord} from '../types/measurement';
import {
  getHeartRateStatus,
  getHRVStatus,
  getPIStatus,
  getPercentileExplanation,
  getOverallFeedback,
} from '../utils/metrics';
import {Colors, StatusColors} from '../config/colors';

// ── 조언 규칙 기반 태그 세트 ──────────────────────────────────────────────────
const TAG_OPTIONS = [
  {key: '수면부족',    emoji: '😴'},
  {key: '피로',       emoji: '😓'},
  {key: '스트레스',   emoji: '😰'},
  {key: '운동후',     emoji: '🏃'},
  {key: '카페인',     emoji: '☕'},
  {key: '긴장',       emoji: '😤'},
  {key: '컨디션좋음', emoji: '😊'},
  {key: '안정',       emoji: '🧘'},
];

interface Props {
  record: MeasurementRecord;
  onSaveAndClose: (notes: string, tags: string[]) => void;
}

export const MeasurementResultScreen: React.FC<Props> = ({record, onSaveAndClose}) => {
  const {analysis} = record;

  // 조언에서 추천 태그 추출 (mock: record.tags 기반)
  const suggestedTags = record.tags ?? [];

  const [selectedTags, setSelectedTags] = useState<string[]>(suggestedTags);
  const [notes, setNotes]               = useState(record.notes ?? '');

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag],
    );
  };

  if (!analysis) {
    return (
      <View style={st.container}>
        <Text style={st.errorText}>분석 결과를 불러올 수 없습니다</Text>
      </View>
    );
  }

  const hrStatus  = getHeartRateStatus(analysis.general.heartRate);
  const hrvStatus = getHRVStatus(analysis.general.hrv);
  const piStatus  = getPIStatus(analysis.general.pi);
  const feedback  = getOverallFeedback(analysis.general.heartRate, analysis.general.hrv);

  const statusColor = StatusColors[analysis.general.status] ?? Colors.statusNeutral;

  return (
    <ScrollView style={st.container} showsVerticalScrollIndicator={false}
      contentContainerStyle={{paddingBottom: 40}}>

      {/* ① 헤더 */}
      <View style={st.header}>
        <Text style={st.headerSub}>{record.date} {record.time.slice(0, 5)}</Text>
        <Text style={st.headerTitle}>측정 완료</Text>
      </View>

      {/* ② 종합 피드백 배너 */}
      <View style={[st.feedbackBanner, {borderLeftColor: feedback.color}]}>
        <View style={st.feedbackTop}>
          <View style={[st.feedbackDot, {backgroundColor: feedback.color}]} />
          <Text style={[st.feedbackSummary, {color: feedback.color}]}>
            {feedback.summary}
          </Text>
        </View>
        <Text style={st.feedbackAdvice}>{feedback.advice}</Text>
      </View>

      {/* ③ 핵심 지표 3종 */}
      <View style={st.metricsRow}>
        <MetricChip
          label="심박수"
          value={`${analysis.general.heartRate}`}
          unit="bpm"
          statusText={hrStatus.text}
          statusColor={hrStatus.color}
        />
        <MetricChip
          label="HRV"
          value={`${analysis.general.hrv}`}
          unit="ms"
          statusText={hrvStatus.text}
          statusColor={hrvStatus.color}
        />
        <MetricChip
          label="PI"
          value={`${analysis.general.pi}`}
          unit="%"
          statusText={piStatus.text}
          statusColor={piStatus.color}
        />
      </View>

      {/* ④ 나의 평균 대비 */}
      <View style={st.section}>
        <Text style={st.sectionTitle}>나의 평균 대비</Text>
        <View style={st.card}>
          <CompareRow label="심박수" diff={analysis.personal.heartRateDiff} unit="bpm" higherIsBetter={false} />
          <CompareRow label="HRV"   diff={analysis.personal.hrvDiff}        unit="ms"  higherIsBetter={true}  />
        </View>
      </View>

      {/* ⑤ 동일 연령대 비교 */}
      <View style={st.section}>
        <Text style={st.sectionTitle}>동일 연령대 비교</Text>
        <View style={st.card}>
          <View style={st.pctRow}>
            <View style={st.pctBlock}>
              <Text style={st.pctLabel}>상위</Text>
              <Text style={[st.pctValue, {color: statusColor}]}>
                {analysis.demographic.percentile}%
              </Text>
            </View>
            <Text style={st.pctNote}>
              {getPercentileExplanation(analysis.demographic.percentile)}
            </Text>
          </View>

          {/* 퍼센타일 바 */}
          <View style={st.barBg}>
            <View style={[st.barFill, {
              width: `${Math.max(4, Math.min(94, analysis.demographic.percentile))}%`,
              backgroundColor: statusColor,
            }]} />
            <View style={[st.barDot, {
              left: `${Math.max(4, Math.min(94, analysis.demographic.percentile))}%` as any,
              backgroundColor: statusColor,
            }]} />
          </View>

          <DemoRow label="내 심박수"   value={`${analysis.general.heartRate} bpm`} />
          <DemoRow label="연령대 평균" value={`${analysis.demographic.ageGroupAvg} bpm`} />
          <DemoRow
            label="차이"
            value={`${analysis.general.heartRate - analysis.demographic.ageGroupAvg > 0 ? '+' : ''}${analysis.general.heartRate - analysis.demographic.ageGroupAvg} bpm`}
            valueColor={analysis.general.heartRate < analysis.demographic.ageGroupAvg ? Colors.statusGood : Colors.statusDanger}
            last
          />
        </View>
      </View>

      {/* ⑥ 자동 조언 */}
      {record.advice && (
        <View style={st.section}>
          <Text style={st.sectionTitle}>오늘의 조언</Text>
          <View style={st.adviceCard}>
            <Text style={st.adviceIcon}>💡</Text>
            <Text style={st.adviceText}>{record.advice}</Text>
          </View>
        </View>
      )}

      {/* ⑦ 태그 선택 */}
      <View style={st.section}>
        <Text style={st.sectionTitle}>오늘 상태 태그</Text>
        <View style={st.tagGrid}>
          {TAG_OPTIONS.map(({key, emoji}) => {
            const selected = selectedTags.includes(key);
            return (
              <TouchableOpacity
                key={key}
                style={[st.tagChip, selected && st.tagChipSel]}
                onPress={() => toggleTag(key)}
                activeOpacity={0.7}>
                <Text style={st.tagEmoji}>{emoji}</Text>
                <Text style={[st.tagText, selected && st.tagTextSel]}>#{key}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ⑧ 메모 */}
      <View style={st.section}>
        <Text style={st.sectionTitle}>메모 (선택)</Text>
        <TextInput
          style={st.notesInput}
          placeholder="오늘의 컨디션을 기록해보세요..."
          placeholderTextColor={Colors.textTertiary}
          multiline
          numberOfLines={3}
          value={notes}
          onChangeText={setNotes}
          textAlignVertical="top"
        />
      </View>

      {/* 참고 안내 */}
      <View style={{paddingHorizontal: 16, marginBottom: 8}}>
        <Text style={st.notice}>
          ※ 이 결과는 참고용이며 의학적 진단을 대체하지 않습니다.
        </Text>
      </View>

      {/* 저장 버튼 */}
      <View style={{paddingHorizontal: 16}}>
        <TouchableOpacity
          style={st.saveBtn}
          onPress={() => onSaveAndClose(notes, selectedTags)}
          activeOpacity={0.85}>
          <Text style={st.saveBtnTxt}>저장하고 닫기</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

// ── 서브 컴포넌트들 ────────────────────────────────────────────────────────────

const MetricChip = ({label, value, unit, statusText, statusColor}: {
  label: string; value: string; unit: string; statusText: string; statusColor: string;
}) => (
  <View style={st.metricChip}>
    <Text style={st.metricChipLabel}>{label}</Text>
    <Text style={st.metricChipValue}>
      {value}<Text style={st.metricChipUnit}> {unit}</Text>
    </Text>
    <View style={[st.statusBadge, {backgroundColor: statusColor}]}>
      <Text style={st.statusBadgeText}>{statusText}</Text>
    </View>
  </View>
);

const CompareRow = ({label, diff, unit, higherIsBetter}: {
  label: string; diff: number; unit: string; higherIsBetter: boolean;
}) => {
  const isGood = diff === 0 ? null : (higherIsBetter ? diff > 0 : diff < 0);
  const color  = diff === 0 ? Colors.textSecondary : isGood ? Colors.statusGood : Colors.statusDanger;
  const arrow  = diff === 0 ? '─' : diff > 0 ? '▲' : '▼';
  return (
    <View style={st.compareRow}>
      <Text style={st.compareLabel}>{label}</Text>
      <View style={st.compareRight}>
        <Text style={[st.compareValue, {color}]}>
          {arrow} {diff > 0 ? '+' : ''}{diff} {unit}
        </Text>
        <Text style={st.compareNote}>
          {diff === 0 ? '평균과 동일' : `${Math.abs(diff)} ${unit} ${diff > 0 ? '높음' : '낮음'}`}
        </Text>
      </View>
    </View>
  );
};

const DemoRow = ({label, value, valueColor, last}: {
  label: string; value: string; valueColor?: string; last?: boolean;
}) => (
  <View style={[st.demoRow, last && {borderBottomWidth: 0}]}>
    <Text style={st.demoLabel}>{label}</Text>
    <Text style={[st.demoValue, valueColor ? {color: valueColor, fontWeight: '700'} : {}]}>
      {value}
    </Text>
  </View>
);

// ── 스타일 ────────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},

  header: {
    backgroundColor: Colors.card,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerSub:   {fontSize: 12, color: Colors.textSecondary, marginBottom: 2},
  headerTitle: {fontSize: 24, fontWeight: '800', color: Colors.textPrimary},

  feedbackBanner: {
    margin: 16,
    padding: 16,
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderLeftWidth: 4,
    shadowColor: '#000', shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  feedbackTop:    {flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8},
  feedbackDot:    {width: 8, height: 8, borderRadius: 4},
  feedbackSummary:{fontSize: 15, fontWeight: '700', flex: 1},
  feedbackAdvice: {fontSize: 13, color: Colors.textSecondary, lineHeight: 20},

  metricsRow: {flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 4, gap: 8},
  metricChip: {
    flex: 1, backgroundColor: Colors.card, borderRadius: 14, padding: 14,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  metricChipLabel: {fontSize: 11, color: Colors.textSecondary, marginBottom: 4},
  metricChipValue: {fontSize: 22, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6},
  metricChipUnit:  {fontSize: 12, fontWeight: '400', color: Colors.textSecondary},
  statusBadge:     {paddingVertical: 3, paddingHorizontal: 8, borderRadius: 8},
  statusBadgeText: {fontSize: 11, fontWeight: '600', color: Colors.white},

  section:      {paddingHorizontal: 16, paddingBottom: 4, paddingTop: 12},
  sectionTitle: {fontSize: 14, fontWeight: '700', color: Colors.textSecondary, marginBottom: 10},

  card: {
    backgroundColor: Colors.card, borderRadius: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },

  compareRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 13, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  compareLabel: {fontSize: 14, color: Colors.textSecondary, fontWeight: '500'},
  compareRight: {alignItems: 'flex-end'},
  compareValue: {fontSize: 18, fontWeight: '700', marginBottom: 2},
  compareNote:  {fontSize: 12, color: Colors.textTertiary},

  pctRow:   {flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14},
  pctBlock: {alignItems: 'center'},
  pctLabel: {fontSize: 12, color: Colors.textSecondary},
  pctValue: {fontSize: 34, fontWeight: '800'},
  pctNote:  {flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 20},

  barBg:  {height: 6, backgroundColor: Colors.border, marginHorizontal: 16, marginBottom: 4, position: 'relative', borderRadius: 3},
  barFill:{height: '100%', borderRadius: 3, position: 'absolute'},
  barDot: {width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: Colors.white, position: 'absolute', top: -4, marginLeft: -7},

  demoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 11, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  demoLabel: {fontSize: 13, color: Colors.textSecondary},
  demoValue: {fontSize: 14, fontWeight: '600', color: Colors.textPrimary},

  adviceCard: {
    flexDirection: 'row', backgroundColor: Colors.primaryLight, borderRadius: 14,
    padding: 14, gap: 10,
  },
  adviceIcon: {fontSize: 20},
  adviceText: {flex: 1, fontSize: 14, color: Colors.textPrimary, lineHeight: 22},

  tagGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  tagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.card, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  tagChipSel: {backgroundColor: Colors.primaryLight, borderColor: Colors.primary},
  tagEmoji:   {fontSize: 14},
  tagText:    {fontSize: 13, color: Colors.textSecondary, fontWeight: '500'},
  tagTextSel: {color: Colors.primary, fontWeight: '700'},

  notesInput: {
    backgroundColor: Colors.card, borderRadius: 12, padding: 14,
    fontSize: 14, color: Colors.textPrimary, lineHeight: 22,
    minHeight: 88, borderWidth: 1, borderColor: Colors.border,
  },

  notice: {fontSize: 12, color: Colors.textTertiary, lineHeight: 18},

  saveBtn:    {backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center'},
  saveBtnTxt: {fontSize: 16, fontWeight: '700', color: Colors.white},

  errorText: {fontSize: 16, color: Colors.statusDanger, textAlign: 'center', margin: 32},
});

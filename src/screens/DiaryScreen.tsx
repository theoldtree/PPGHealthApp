import React, {useState, useRef, useCallback, useMemo} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Modal,
  Pressable,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {Calendar} from 'react-native-calendars';
import Svg, {Path} from 'react-native-svg';
import {Colors, StatusColors} from '../config/colors';
import type {MeasurementRecord} from '../types/measurement';
import {getMeasurementHistory} from '../api/measurements';
import {METRIC_GUIDES} from '../config/guides';
import {getLocalRecords, clearLocalCache} from '../utils/localCache';
import {
  getHeartRateStatus,
  getHRVStatus,
  getPIStatus,
  getOverallFeedback,
  getPercentileExplanation,
} from '../utils/metrics';

// ── 유틸 ──────────────────────────────────────────────────────────────────────
const DAY_KOR = ['일', '월', '화', '수', '목', '금', '토'];

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const TODAY = localDateStr(new Date());

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${DAY_KOR[d.getDay()]}요일`;
}

function getKoreanMonth(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}

function buildDateRange(center: string, days = 30): string[] {
  const result: string[] = [];
  const base = new Date(center + 'T00:00:00');
  for (let i = -days; i <= days; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    result.push(localDateStr(d));
  }
  return result;
}

function groupByDate(records: MeasurementRecord[]): Record<string, MeasurementRecord[]> {
  const map: Record<string, MeasurementRecord[]> = {};
  for (const r of records) {
    if (!map[r.date]) map[r.date] = [];
    map[r.date].push(r);
  }
  return map;
}

// ── APG 경직도 레이블 ──────────────────────────────────────────────────────────
function apgLabel(bOverA: number): {text: string; color: string} {
  if (bOverA > -0.40) return {text: '양호', color: Colors.statusGood};
  if (bOverA >= -0.55) return {text: '경미한 노화', color: Colors.statusWarning};
  return {text: '혈관 경직', color: Colors.statusDanger};
}

// ── 지표 칩 ───────────────────────────────────────────────────────────────────
const MetricChip = ({label, value, unit, statusText, statusColor}: {
  label: string; value: string; unit: string; statusText: string; statusColor: string;
}) => (
  <View style={chipSt.chip}>
    <Text style={chipSt.label}>{label}</Text>
    <Text style={chipSt.value}>
      {value}<Text style={chipSt.unit}> {unit}</Text>
    </Text>
    <View style={[chipSt.badge, {backgroundColor: statusColor}]}>
      <Text style={chipSt.badgeText}>{statusText}</Text>
    </View>
  </View>
);

const chipSt = StyleSheet.create({
  chip:      {flex: 1, backgroundColor: Colors.card, borderRadius: 14, padding: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1},
  label:     {fontSize: 10, color: Colors.textSecondary, marginBottom: 4},
  value:     {fontSize: 20, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6},
  unit:      {fontSize: 11, fontWeight: '400', color: Colors.textSecondary},
  badge:     {paddingVertical: 3, paddingHorizontal: 8, borderRadius: 8},
  badgeText: {fontSize: 11, fontWeight: '600', color: Colors.white},
});

// ── DemoRow ────────────────────────────────────────────────────────────────────
const DemoRow = ({label, value, valueColor, last}: {
  label: string; value: string; valueColor?: string; last?: boolean;
}) => (
  <View style={[cardSt.demoRow, last && {borderBottomWidth: 0}]}>
    <Text style={cardSt.demoLabel}>{label}</Text>
    <Text style={[cardSt.demoValue, valueColor ? {color: valueColor, fontWeight: '700'} : {}]}>
      {value}
    </Text>
  </View>
);

// ── MetricDetailRow ────────────────────────────────────────────────────────────
const MetricDetailRow = ({label, value, valueColor, desc, diff, diffColor, last}: {
  label: string; value: string; valueColor: string; desc: string;
  diff?: string; diffColor?: string; last?: boolean;
}) => (
  <View style={[cardSt.detailRow, last && {borderBottomWidth: 0}]}>
    <View style={cardSt.detailLeft}>
      <Text style={cardSt.detailLabel}>{label}</Text>
      <Text style={cardSt.detailDesc}>{desc}</Text>
    </View>
    <View style={cardSt.detailRight}>
      <Text style={[cardSt.detailValue, {color: valueColor}]}>{value}</Text>
      {diff !== undefined && (
        <Text style={[cardSt.detailDiff, {color: diffColor ?? Colors.textSecondary}]}>{diff}</Text>
      )}
    </View>
  </View>
);

// ── ApgScaleItem ───────────────────────────────────────────────────────────────
const ApgScaleItem = ({value, label, color}: {value: string; label: string; color: string}) => (
  <View style={cardSt.apgScaleItem}>
    <View style={[cardSt.apgScaleDot, {backgroundColor: color}]} />
    <Text style={cardSt.apgScaleVal}>{value}</Text>
    <Text style={cardSt.apgScaleLbl}>{label}</Text>
  </View>
);

// ── 측정 카드 (아코디언) ──────────────────────────────────────────────────────
const RecordCard = ({record}: {record: MeasurementRecord}) => {
  const [expanded, setExpanded] = useState(false);
  const {analysis} = record;
  const statusColor = analysis ? (StatusColors[analysis.general.status] ?? Colors.statusNeutral) : Colors.statusNeutral;

  return (
    <View style={cardSt.wrap}>
      <TouchableOpacity style={cardSt.header} onPress={() => setExpanded(e => !e)} activeOpacity={0.7}>
        <View style={{flexDirection: 'row', alignItems: 'center', flex: 1}}>
          <View style={[cardSt.dot, {backgroundColor: statusColor}]} />
          <Text style={cardSt.time}>{record.time.slice(0, 5)}</Text>
          {analysis && (
            <Text style={cardSt.summary} numberOfLines={1}>
              심박수 {analysis.general.heartRate} bpm · HRV {analysis.general.hrv} ms
            </Text>
          )}
        </View>
        <Text style={cardSt.toggle}>{expanded ? '∧ 접기' : '∨ 펼치기'}</Text>
      </TouchableOpacity>

      {expanded && analysis && (() => {
        const {general, personal, demographic} = analysis;
        const hrStatus  = getHeartRateStatus(general.heartRate);
        const hrvStatus = getHRVStatus(general.hrv);
        const piStatus  = getPIStatus(general.pi);
        const feedback  = getOverallFeedback(general.heartRate, general.hrv);
        const sColor    = StatusColors[general.status] ?? Colors.statusNeutral;

        return (
          <View style={cardSt.body}>

            {/* ② 종합 피드백 배너 */}
            <View style={[cardSt.feedbackBanner, {borderLeftColor: feedback.color}]}>
              <View style={cardSt.feedbackTop}>
                <View style={[cardSt.feedbackDot, {backgroundColor: feedback.color}]} />
                <Text style={[cardSt.feedbackSummary, {color: feedback.color}]}>
                  {feedback.summary}
                </Text>
              </View>
              <Text style={cardSt.feedbackAdvice}>{feedback.advice}</Text>
            </View>

            {/* ③ 핵심 지표 3종 */}
            <View style={cardSt.metricsRow}>
              <MetricChip label="심박수" value={`${general.heartRate}`} unit="bpm" statusText={hrStatus.text} statusColor={hrStatus.color} />
              <MetricChip label="HRV"   value={`${general.hrv}`}       unit="ms"  statusText={hrvStatus.text} statusColor={hrvStatus.color} />
              <MetricChip label="PI"    value={`${general.pi}`}        unit="%"   statusText={piStatus.text}  statusColor={piStatus.color} />
            </View>

            {/* ④ 집단 대비 분석 */}
            <Text style={cardSt.secTitle}>집단 대비 분석</Text>

            {/* 심박수 백분위 */}
            <View style={cardSt.card}>
              <View style={cardSt.cardHeader}>
                <Text style={cardSt.cardHeaderTitle}>심박수 백분위</Text>
                <Text style={cardSt.cardHeaderDesc}>동일 연령·성별 집단 내 위치</Text>
              </View>
              <View style={cardSt.pctRow}>
                <View style={cardSt.pctBlock}>
                  <Text style={cardSt.pctLabel}>상위</Text>
                  <Text style={[cardSt.pctValue, {color: sColor}]}>{demographic.percentile}%</Text>
                </View>
                <Text style={cardSt.pctNote}>{getPercentileExplanation(demographic.percentile)}</Text>
              </View>
              <View style={cardSt.barBg}>
                <View style={[cardSt.barFill, {
                  width: `${Math.max(4, Math.min(94, demographic.percentile))}%` as any,
                  backgroundColor: sColor,
                }]} />
                <View style={[cardSt.barDot, {
                  left: `${Math.max(4, Math.min(94, demographic.percentile))}%` as any,
                  backgroundColor: sColor,
                }]} />
              </View>
              <DemoRow label="내 심박수"   value={`${general.heartRate} bpm`} />
              <DemoRow label="연령대 평균" value={`${demographic.ageGroupAvg} bpm`} />
              <DemoRow
                label="차이"
                value={`${general.heartRate - demographic.ageGroupAvg > 0 ? '+' : ''}${general.heartRate - demographic.ageGroupAvg} bpm`}
                valueColor={general.heartRate <= demographic.ageGroupAvg ? Colors.statusGood : Colors.statusDanger}
                last
              />
            </View>

            {/* HRV 집단 대비 */}
            {demographic.avgHrvSdnn !== undefined && demographic.avgHrvSdnn !== null && (
              <View style={[cardSt.card, {marginBottom: 10}]}>
                <View style={cardSt.cardHeader}>
                  <Text style={cardSt.cardHeaderTitle}>HRV 집단 대비</Text>
                  <Text style={cardSt.cardHeaderDesc}>동일 연령대 HRV SDNN 기준값 (Task Force 1996)</Text>
                </View>
                <DemoRow label="내 HRV"      value={`${general.hrv} ms`} />
                <DemoRow label="연령대 평균" value={`${demographic.avgHrvSdnn} ms`} />
                <DemoRow
                  label="차이"
                  value={`${general.hrv - demographic.avgHrvSdnn > 0 ? '+' : ''}${general.hrv - demographic.avgHrvSdnn} ms`}
                  valueColor={general.hrv >= demographic.avgHrvSdnn ? Colors.statusGood : Colors.statusDanger}
                  last
                />
              </View>
            )}

            {/* APG b/a 동맥 경직도 */}
            {general.apgBOverA !== undefined && general.apgBOverA !== null && (() => {
              const {text, color} = apgLabel(general.apgBOverA);
              return (
                <View style={[cardSt.card, {marginBottom: 10}]}>
                  <View style={cardSt.cardHeader}>
                    <Text style={cardSt.cardHeaderTitle}>동맥 경직도 (APG b/a)</Text>
                    <Text style={cardSt.cardHeaderDesc}>가속도 맥파 b파/a파 비율 · 혈관 탄성 지표</Text>
                  </View>
                  <View style={cardSt.apgRow}>
                    <View style={cardSt.apgValueBlock}>
                      <Text style={[cardSt.apgValue, {color}]}>{general.apgBOverA.toFixed(3)}</Text>
                      <View style={[cardSt.statusBadge, {backgroundColor: color}]}>
                        <Text style={cardSt.statusBadgeText}>{text}</Text>
                      </View>
                    </View>
                    <View style={cardSt.apgRefBlock}>
                      <Text style={cardSt.apgRefLabel}>연령대 기준값</Text>
                      <Text style={cardSt.apgRefValue}>
                        {demographic.apgBOverARef !== undefined && demographic.apgBOverARef !== null
                          ? `${demographic.apgBOverARef.toFixed(2)} ± ${(demographic.apgBOverAStd ?? 0.14).toFixed(2)}`
                          : '–'}
                      </Text>
                    </View>
                  </View>
                  <View style={cardSt.apgScaleRow}>
                    <ApgScaleItem value="> -0.40"    label="양호"       color={Colors.statusGood} />
                    <ApgScaleItem value="-0.40~-0.55" label="경미한 노화" color={Colors.statusWarning} />
                    <ApgScaleItem value="< -0.55"    label="혈관 경직"  color={Colors.statusDanger} />
                  </View>
                </View>
              );
            })()}

            {/* ⑤ 개인 대비 분석 */}
            <Text style={cardSt.secTitle}>개인 대비 분석</Text>
            {personal.trend === 'first' && (
              <View style={cardSt.firstBanner}>
                <Text style={cardSt.firstBannerText}>
                  첫 번째 측정입니다. 측정을 반복할수록 개인 기준값이 쌓여 변화 추이를 확인할 수 있습니다.
                </Text>
              </View>
            )}
            <View style={cardSt.card}>
              <MetricDetailRow
                label="심박수 변화"
                value={personal.trend === 'first' ? '–' : `${personal.heartRateDiff > 0 ? '+' : ''}${personal.heartRateDiff} bpm`}
                valueColor={Colors.textSecondary}
                desc="나의 평균 심박수 대비 오늘의 변화량"
              />
              <MetricDetailRow
                label="HRV SDNN"
                value={`${general.hrv} ms`}
                valueColor={general.hrv >= 50 ? Colors.statusGood : general.hrv >= 30 ? Colors.statusWarning : Colors.statusDanger}
                desc="심박 변동성 (자율신경계 활성 지표. 50ms↑ 양호)"
                diff={personal.hrvDiff !== 0 ? `${personal.hrvDiff > 0 ? '+' : ''}${personal.hrvDiff} ms` : undefined}
                diffColor={personal.hrvDiff > 0 ? Colors.statusGood : Colors.statusDanger}
              />
              {general.hrvRmssd !== undefined && general.hrvRmssd !== null && (
                <MetricDetailRow
                  label="HRV RMSSD"
                  value={`${general.hrvRmssd} ms`}
                  valueColor={general.hrvRmssd >= 40 ? Colors.statusGood : general.hrvRmssd >= 20 ? Colors.statusWarning : Colors.statusDanger}
                  desc="부교감신경 활성도 (높을수록 안정. 40ms↑ 양호)"
                />
              )}
              <MetricDetailRow
                label="관류 지수 (PI)"
                value={`${general.pi.toFixed(2)} %`}
                valueColor={piStatus.color}
                desc="말초 혈류량 지표. 0.2~20% 정상 범위"
              />
              <MetricDetailRow
                label="AC (맥파 진폭)"
                value={general.ac.toFixed(2)}
                valueColor={Colors.textPrimary}
                desc="맥파 교류 성분 — 심장 박동에 의한 혈류 진동"
              />
              <MetricDetailRow
                label="DC (기저 혈류)"
                value={general.dc.toFixed(2)}
                valueColor={Colors.textPrimary}
                desc="맥파 직류 성분 — 조직의 기저 혈류량"
                last
              />
            </View>

            {/* ⑥ 조언 */}
            {record.advice && (
              <View style={cardSt.adviceCard}>
                <Text style={cardSt.adviceIcon}>💡</Text>
                <Text style={cardSt.adviceText}>{record.advice}</Text>
              </View>
            )}

            {/* 태그 */}
            {record.tags && record.tags.length > 0 && (
              <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8, marginTop: 4}}>
                {record.tags.map(tag => (
                  <View key={tag} style={cardSt.tag}>
                    <Text style={cardSt.tagText}>#{tag}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* 나의 메모 */}
            <Text style={cardSt.secTitle}>나의 메모</Text>
            <View style={cardSt.memoBox}>
              <Text style={record.notes ? cardSt.notes : cardSt.notesEmpty}>
                {record.notes || '메모가 없습니다'}
              </Text>
            </View>

          </View>
        );
      })()}
    </View>
  );
};

const cardSt = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    shadowColor: Colors.primary,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  header:  {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14},
  dot:     {width: 8, height: 8, borderRadius: 4, marginRight: 8},
  time:    {fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginRight: 8},
  summary: {fontSize: 13, color: Colors.textSecondary, flex: 1},
  toggle:  {fontSize: 12, color: Colors.primary, fontWeight: '600', marginLeft: 8},
  body:    {paddingHorizontal: 12, paddingBottom: 14},

  secTitle: {fontSize: 12, fontWeight: '700', color: Colors.textSecondary, marginBottom: 8, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5},

  // Feedback banner
  feedbackBanner:  {padding: 12, backgroundColor: Colors.background, borderRadius: 12, borderLeftWidth: 4, marginBottom: 12},
  feedbackTop:     {flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8},
  feedbackDot:     {width: 8, height: 8, borderRadius: 4},
  feedbackSummary: {fontSize: 14, fontWeight: '700', flex: 1},
  feedbackAdvice:  {fontSize: 12, color: Colors.textSecondary, lineHeight: 18},

  // Metrics row
  metricsRow: {flexDirection: 'row', gap: 8, marginBottom: 14},

  // Inner card (section)
  card:            {backgroundColor: Colors.background, borderRadius: 12, overflow: 'hidden', marginBottom: 10},
  cardHeader:      {paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: Colors.border},
  cardHeaderTitle: {fontSize: 13, fontWeight: '700', color: Colors.textPrimary},
  cardHeaderDesc:  {fontSize: 11, color: Colors.textSecondary, marginTop: 2},

  // Percentile bar
  pctRow:   {flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12},
  pctBlock: {alignItems: 'center'},
  pctLabel: {fontSize: 11, color: Colors.textSecondary},
  pctValue: {fontSize: 28, fontWeight: '800'},
  pctNote:  {flex: 1, fontSize: 12, color: Colors.textSecondary, lineHeight: 18},
  barBg:    {height: 6, backgroundColor: Colors.border, marginHorizontal: 12, marginBottom: 10, position: 'relative', borderRadius: 3},
  barFill:  {height: '100%', borderRadius: 3, position: 'absolute'},
  barDot:   {width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: Colors.white, position: 'absolute', top: -3, marginLeft: -6},

  // DemoRow
  demoRow:   {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: Colors.border},
  demoLabel: {fontSize: 12, color: Colors.textSecondary},
  demoValue: {fontSize: 13, fontWeight: '600', color: Colors.textPrimary},

  // APG section
  apgRow:          {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border},
  apgValueBlock:   {alignItems: 'flex-start', gap: 6},
  apgValue:        {fontSize: 24, fontWeight: '800'},
  statusBadge:     {paddingVertical: 3, paddingHorizontal: 8, borderRadius: 8},
  statusBadgeText: {fontSize: 11, fontWeight: '600', color: Colors.white},
  apgRefBlock:     {alignItems: 'flex-end'},
  apgRefLabel:     {fontSize: 11, color: Colors.textSecondary, marginBottom: 2},
  apgRefValue:     {fontSize: 13, fontWeight: '600', color: Colors.textPrimary},
  apgScaleRow:     {flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, gap: 8},
  apgScaleItem:    {flex: 1, alignItems: 'center', gap: 3},
  apgScaleDot:     {width: 7, height: 7, borderRadius: 3.5},
  apgScaleVal:     {fontSize: 9, color: Colors.textSecondary, textAlign: 'center'},
  apgScaleLbl:     {fontSize: 9, fontWeight: '600', color: Colors.textPrimary, textAlign: 'center'},

  // MetricDetailRow
  detailRow:   {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: Colors.border},
  detailLeft:  {flex: 1, marginRight: 10},
  detailLabel: {fontSize: 13, fontWeight: '600', color: Colors.textPrimary, marginBottom: 2},
  detailDesc:  {fontSize: 11, color: Colors.textTertiary, lineHeight: 15},
  detailRight: {alignItems: 'flex-end'},
  detailValue: {fontSize: 15, fontWeight: '700'},
  detailDiff:  {fontSize: 11, marginTop: 2},

  // First measurement banner
  firstBanner:     {backgroundColor: Colors.primaryLight, borderRadius: 10, padding: 10, marginBottom: 10},
  firstBannerText: {fontSize: 12, color: Colors.primary, lineHeight: 18},

  // Advice
  adviceCard: {flexDirection: 'row', backgroundColor: Colors.primaryLight, borderRadius: 12, padding: 12, gap: 8, marginBottom: 8, marginTop: 4},
  adviceIcon: {fontSize: 18},
  adviceText: {flex: 1, fontSize: 13, color: Colors.textPrimary, lineHeight: 20},

  // Tags
  tag:     {backgroundColor: Colors.primaryLight, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4},
  tagText: {fontSize: 12, color: Colors.primary, fontWeight: '600'},

  // Notes
  memoBox:    {backgroundColor: Colors.background, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 4, minHeight: 40},
  notes:      {fontSize: 13, color: Colors.textPrimary, lineHeight: 18},
  notesEmpty: {fontSize: 13, color: Colors.textTertiary, lineHeight: 18, fontStyle: 'italic'},
});

// ── 날짜 스트립 셀 ────────────────────────────────────────────────────────────
const CELL_W = 52;

const DateCell = ({dateStr, isSelected, count, onPress}: {
  dateStr: string; isSelected: boolean; count: number; onPress: () => void;
}) => {
  const d      = new Date(dateStr + 'T00:00:00');
  const day    = DAY_KOR[d.getDay()];
  const num    = d.getDate();
  const isToday = dateStr === TODAY;
  return (
    <TouchableOpacity style={cellSt.cell} onPress={onPress} activeOpacity={0.75}>
      <Text style={[cellSt.day, isSelected && {color: Colors.primary}]}>{day}</Text>
      <View style={[
        cellSt.numBg,
        isSelected        && cellSt.numBgSel,
        isToday && !isSelected && cellSt.numBgToday,
      ]}>
        <Text style={[
          cellSt.num,
          isSelected        && {color: Colors.white},
          isToday && !isSelected && {color: Colors.primary},
        ]}>{num}</Text>
      </View>
      <Text style={[cellSt.cnt, count > 0 && cellSt.cntActive]}>
        {count > 0 ? `${count}회` : '─'}
      </Text>
    </TouchableOpacity>
  );
};

const cellSt = StyleSheet.create({
  cell:       {width: CELL_W, alignItems: 'center', paddingVertical: 8},
  day:        {fontSize: 11, color: Colors.textTertiary, marginBottom: 4},
  numBg:      {width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center'},
  numBgSel:   {backgroundColor: Colors.primary},
  numBgToday: {borderWidth: 1.5, borderColor: Colors.primary},
  num:        {fontSize: 16, fontWeight: '600', color: Colors.textPrimary},
  cnt:        {fontSize: 11, color: Colors.textTertiary, marginTop: 4},
  cntActive:  {color: Colors.primary, fontWeight: '600'},
});

// ── SVG 아이콘들 ──────────────────────────────────────────────────────────────
const CalendarIcon = ({color}: {color: string}) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path
      d="M8 2v3M16 2v3M3 9h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
      stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
    />
  </Svg>
);

const BookIcon = ({color}: {color: string}) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path
      d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"
      stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
    />
    <Path
      d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"
      stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
    />
  </Svg>
);

// ── 지표 가이드북 모달 ────────────────────────────────────────────────────────
const GuideModal = ({visible, onClose}: {visible: boolean; onClose: () => void}) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <Pressable style={gdSt.overlay} onPress={onClose}>
      <Pressable style={gdSt.sheet} onPress={e => e.stopPropagation()}>
        <View style={gdSt.handle} />
        <Text style={gdSt.sheetTitle}>지표 가이드북</Text>
        <ScrollView showsVerticalScrollIndicator={false}>
          {METRIC_GUIDES.map(guide => (
            <View key={guide.key} style={gdSt.guideCard}>
              <View style={gdSt.guideTitleRow}>
                <Text style={gdSt.guideTitle}>{guide.title}</Text>
                {guide.unit ? <Text style={gdSt.guideUnit}>{guide.unit}</Text> : null}
              </View>
              <Text style={gdSt.guideDesc}>{guide.description}</Text>
              <View style={gdSt.rangeSection}>
                {guide.ranges.map((r, i) => (
                  <View key={i} style={gdSt.rangeRow}>
                    <View style={[gdSt.rangeDot, {backgroundColor: r.color}]} />
                    <Text style={gdSt.rangeLabel}>{r.label}</Text>
                    <Text style={gdSt.rangeDesc}>{r.desc}</Text>
                  </View>
                ))}
              </View>
              {guide.reference && (
                <Text style={gdSt.reference}>출처: {guide.reference}</Text>
              )}
            </View>
          ))}
          <View style={{height: 32}} />
        </ScrollView>
        <TouchableOpacity style={gdSt.closeBtn} onPress={onClose} activeOpacity={0.8}>
          <Text style={gdSt.closeBtnTxt}>닫기</Text>
        </TouchableOpacity>
      </Pressable>
    </Pressable>
  </Modal>
);

const gdSt = StyleSheet.create({
  overlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end'},
  sheet: {
    backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: '88%',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border,
    alignSelf: 'center', marginBottom: 16,
  },
  sheetTitle: {fontSize: 18, fontWeight: '800', color: Colors.textPrimary, marginBottom: 16},
  guideCard: {
    backgroundColor: Colors.background, borderRadius: 14,
    padding: 14, marginBottom: 12,
  },
  guideTitleRow: {flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 6},
  guideTitle:    {fontSize: 15, fontWeight: '700', color: Colors.textPrimary},
  guideUnit:     {fontSize: 12, color: Colors.textTertiary},
  guideDesc:     {fontSize: 13, color: Colors.textSecondary, lineHeight: 20, marginBottom: 10},
  rangeSection:  {gap: 6},
  rangeRow:      {flexDirection: 'row', alignItems: 'center', gap: 6},
  rangeDot:      {width: 7, height: 7, borderRadius: 3.5, flexShrink: 0},
  rangeLabel:    {fontSize: 11, fontWeight: '700', color: Colors.textPrimary, width: 76},
  rangeDesc:     {fontSize: 11, color: Colors.textSecondary, flex: 1},
  reference:     {fontSize: 10, color: Colors.textTertiary, marginTop: 8, fontStyle: 'italic'},
  closeBtn:      {backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8},
  closeBtnTxt:   {fontSize: 15, fontWeight: '700', color: Colors.white},
});

// ── 메인 ─────────────────────────────────────────────────────────────────────
export const DiaryScreen: React.FC = () => {
  const [selectedDate, setSelectedDate]       = useState(TODAY);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [guideVisible, setGuideVisible]       = useState(false);
  const [allRecords, setAllRecords]           = useState<MeasurementRecord[]>([]);
  const [isLoading, setIsLoading]             = useState(false);

  const dateRange = useMemo(() => buildDateRange(TODAY), []);
  const stripRef  = useRef<FlatList>(null);

  // Reload measurements every time the diary tab is focused
  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        setIsLoading(true);
        try {
          const history = await getMeasurementHistory();
          setAllRecords(history);               // empty array also resets state
          if (history.length === 0) {
            await clearLocalCache();            // DB is empty → invalidate stale cache
          }
        } catch {
          // Backend not available — fall back to local cache
          const cached = await getLocalRecords();
          if (cached.length > 0) {
            setAllRecords(cached);
          }
        } finally {
          setIsLoading(false);
        }
      };
      load();
    }, []),
  );

  const recordsMap = useMemo(() => groupByDate(allRecords), [allRecords]);

  const onStripLayout = useCallback(() => {
    const idx = dateRange.indexOf(TODAY);
    if (idx >= 0) {
      stripRef.current?.scrollToIndex({index: idx, viewPosition: 0.5, animated: false});
    }
  }, [dateRange]);

  const selectedRecords = recordsMap[selectedDate] ?? [];

  const markedDates = useMemo(() => {
    const m: Record<string, any> = {};
    for (const [date, recs] of Object.entries(recordsMap)) {
      m[date] = {marked: true, dotColor: Colors.primary, count: recs.length};
    }
    if (selectedDate) {
      m[selectedDate] = {
        ...(m[selectedDate] ?? {}),
        selected: true,
        selectedColor: Colors.primary,
      };
    }
    return m;
  }, [recordsMap, selectedDate]);

  const selectDate = (date: string) => {
    setSelectedDate(date);
    const idx = dateRange.indexOf(date);
    if (idx >= 0) {
      stripRef.current?.scrollToIndex({index: idx, viewPosition: 0.5, animated: true});
    }
  };

  return (
    <View style={st.screen}>
      {/* 헤더: 월 + 가이드북 버튼 + 달력 버튼 */}
      <View style={st.header}>
        <Text style={st.headerMonth}>{getKoreanMonth(selectedDate)}</Text>
        <View style={st.headerBtns}>
          <TouchableOpacity style={st.calBtn} onPress={() => setGuideVisible(true)} activeOpacity={0.7}>
            <BookIcon color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={st.calBtn} onPress={() => setCalendarVisible(true)} activeOpacity={0.7}>
            <CalendarIcon color={Colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 날짜 스트립 */}
      <View style={st.stripWrap}>
        <FlatList
          ref={stripRef}
          data={dateRange}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={d => d}
          getItemLayout={(_, i) => ({length: CELL_W, offset: CELL_W * i, index: i})}
          onLayout={onStripLayout}
          renderItem={({item}) => (
            <DateCell
              dateStr={item}
              isSelected={item === selectedDate}
              count={recordsMap[item]?.length ?? 0}
              onPress={() => selectDate(item)}
            />
          )}
          contentContainerStyle={{paddingHorizontal: 8}}
        />
      </View>

      {/* 날짜 레이블 */}
      <View style={st.dateRow}>
        <Text style={st.dateLabel}>{formatDateLabel(selectedDate)}</Text>
        {selectedRecords.length > 0 && (
          <View style={st.countBadge}>
            <Text style={st.countBadgeText}>{selectedRecords.length}건</Text>
          </View>
        )}
      </View>

      {/* 기록 목록 */}
      <ScrollView style={{flex: 1}} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={st.empty}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : selectedRecords.length === 0 ? (
          <View style={st.empty}>
            <Text style={st.emptyIcon}>📋</Text>
            <Text style={st.emptyText}>이 날의 측정 기록이 없어요</Text>
          </View>
        ) : (
          selectedRecords.map(r => <RecordCard key={r.id} record={r} />)
        )}
        <View style={{height: 32}} />
      </ScrollView>

      {/* 지표 가이드북 모달 */}
      <GuideModal visible={guideVisible} onClose={() => setGuideVisible(false)} />

      {/* 달력 모달 */}
      <Modal
        visible={calendarVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCalendarVisible(false)}>
        <Pressable style={st.overlay} onPress={() => setCalendarVisible(false)}>
          <Pressable style={st.modalCard} onPress={e => e.stopPropagation()}>
            <Text style={st.modalTitle}>날짜 선택</Text>
            <Calendar
              current={selectedDate}
              onDayPress={day => {
                selectDate(day.dateString);
                setCalendarVisible(false);
              }}
              markedDates={markedDates}
              theme={{
                todayTextColor:             Colors.primary,
                selectedDayBackgroundColor: Colors.primary,
                dotColor:                   Colors.primary,
                arrowColor:                 Colors.primary,
                calendarBackground:         Colors.card,
                dayTextColor:               Colors.textPrimary,
                textDisabledColor:          Colors.textTertiary,
                textDayFontWeight:          '500',
                textMonthFontWeight:        '700',
              }}
            />
            <TouchableOpacity style={st.modalCloseBtn} onPress={() => setCalendarVisible(false)}>
              <Text style={st.modalCloseTxt}>닫기</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const st = StyleSheet.create({
  screen: {flex: 1, backgroundColor: Colors.background},

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop:  Platform.OS === 'ios' ? 8 : 10,
    paddingBottom: 10,
    backgroundColor: Colors.card,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerMonth: {fontSize: 15, fontWeight: '700', color: Colors.textPrimary},
  headerBtns:  {flexDirection: 'row', alignItems: 'center', gap: 4},
  calBtn:      {padding: 8},

  stripWrap: {
    backgroundColor: Colors.card,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },

  dateRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12, gap: 10,
  },
  dateLabel:      {fontSize: 15, fontWeight: '700', color: Colors.textPrimary},
  countBadge:     {backgroundColor: Colors.primary, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3},
  countBadgeText: {fontSize: 12, fontWeight: '700', color: Colors.white},

  empty:     {alignItems: 'center', paddingTop: 60},
  emptyIcon: {fontSize: 40, marginBottom: 12},
  emptyText: {fontSize: 15, color: Colors.textSecondary},

  overlay: {flex: 1, backgroundColor: Colors.overlay, justifyContent: 'center', alignItems: 'center'},
  modalCard: {
    width: '90%', backgroundColor: Colors.card, borderRadius: 20, padding: 20,
    shadowColor: '#000', shadowOffset: {width: 0, height: 8}, shadowOpacity: 0.15,
    shadowRadius: 20, elevation: 10,
  },
  modalTitle:    {fontSize: 17, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center', marginBottom: 12},
  modalCloseBtn: {marginTop: 16, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center'},
  modalCloseTxt: {fontSize: 15, fontWeight: '700', color: Colors.white},
});

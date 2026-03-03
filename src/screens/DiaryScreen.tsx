import React, {useState, useRef, useCallback, useMemo, useEffect} from 'react';
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
import {Colors, StatusColors, StatusLabels} from '../config/colors';
import type {MeasurementRecord} from '../types/measurement';
import {getMeasurementHistory} from '../api/measurements';

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

// ── 지표 칩 ───────────────────────────────────────────────────────────────────
const MetricChip = ({label, value, unit, status}: {
  label: string; value: number; unit: string; status?: string;
}) => (
  <View style={chipSt.chip}>
    <Text style={chipSt.label}>{label}</Text>
    <Text style={chipSt.value}>
      {value}<Text style={chipSt.unit}> {unit}</Text>
    </Text>
    {status && (
      <View style={[chipSt.badge, {
        backgroundColor: StatusColors[status as keyof typeof StatusColors] ?? Colors.statusNeutral,
      }]}>
        <Text style={chipSt.badgeText}>
          {StatusLabels[status as keyof typeof StatusLabels] ?? status}
        </Text>
      </View>
    )}
  </View>
);

const chipSt = StyleSheet.create({
  chip:      {flex: 1, backgroundColor: Colors.primaryLight, borderRadius: 10, padding: 10, alignItems: 'center', marginHorizontal: 3},
  label:     {fontSize: 10, color: Colors.textSecondary, marginBottom: 2},
  value:     {fontSize: 18, fontWeight: '700', color: Colors.textPrimary},
  unit:      {fontSize: 11, fontWeight: '400', color: Colors.textSecondary},
  badge:     {marginTop: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6},
  badgeText: {fontSize: 10, fontWeight: '600', color: Colors.white},
});

// ── 비교 행 ───────────────────────────────────────────────────────────────────
const CompareRow = ({label, diff, unit, higherIsBetter}: {
  label: string; diff: number; unit: string; higherIsBetter: boolean;
}) => {
  const isGood = diff === 0 ? null : (higherIsBetter ? diff > 0 : diff < 0);
  const color  = diff === 0 ? Colors.textSecondary : isGood ? Colors.statusGood : Colors.statusDanger;
  const arrow  = diff === 0 ? '─' : diff > 0 ? '▲' : '▼';
  return (
    <View style={cmpSt.row}>
      <Text style={cmpSt.label}>{label}</Text>
      <Text style={[cmpSt.diff, {color}]}>{arrow} {diff > 0 ? '+' : ''}{diff} {unit}</Text>
      <Text style={cmpSt.note}>
        {diff === 0 ? '평균과 동일' : `${Math.abs(diff)} ${unit} ${diff > 0 ? '높음' : '낮음'}`}
      </Text>
    </View>
  );
};

const cmpSt = StyleSheet.create({
  row:   {flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: Colors.border},
  label: {width: 44, fontSize: 13, color: Colors.textSecondary},
  diff:  {fontSize: 14, fontWeight: '700', marginHorizontal: 8, minWidth: 72},
  note:  {flex: 1, fontSize: 12, color: Colors.textTertiary, textAlign: 'right'},
});

// ── 퍼센타일 바 ───────────────────────────────────────────────────────────────
const PercentileBar = ({percentile, ageAvg, myHR}: {
  percentile: number; ageAvg: number; myHR: number;
}) => {
  const pct = Math.max(4, Math.min(94, percentile));
  return (
    <View>
      <View style={pctSt.barBg}>
        <View style={[pctSt.barFill, {width: `${pct}%` as any}]} />
        <View style={[pctSt.dot, {left: `${pct}%` as any}]} />
      </View>
      <View style={pctSt.labels}>
        <Text style={pctSt.edge}>낮음</Text>
        <View style={{alignItems: 'center'}}>
          <Text style={pctSt.myVal}>{myHR} bpm</Text>
          <Text style={pctSt.avgVal}>연령 평균 {ageAvg} bpm</Text>
        </View>
        <Text style={pctSt.edge}>높음</Text>
      </View>
    </View>
  );
};

const pctSt = StyleSheet.create({
  barBg:  {height: 6, backgroundColor: Colors.border, borderRadius: 3, marginVertical: 8, position: 'relative'},
  barFill:{height: '100%', backgroundColor: Colors.primary, borderRadius: 3, position: 'absolute'},
  dot:    {width: 14, height: 14, borderRadius: 7, backgroundColor: Colors.primary, borderWidth: 2, borderColor: Colors.white, position: 'absolute', top: -4, marginLeft: -7},
  labels: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  edge:   {fontSize: 11, color: Colors.textTertiary},
  myVal:  {fontSize: 12, fontWeight: '700', color: Colors.primary},
  avgVal: {fontSize: 11, color: Colors.textTertiary},
});

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

      {expanded && analysis && (
        <View style={cardSt.body}>
          {/* 지표 칩 */}
          <View style={{flexDirection: 'row', marginBottom: 14}}>
            <MetricChip label="심박수" value={analysis.general.heartRate} unit="bpm" status={analysis.general.status} />
            <MetricChip label="HRV"   value={analysis.general.hrv}       unit="ms" />
            <MetricChip label="PI"    value={analysis.general.pi}        unit="%" />
          </View>

          {/* 나의 평균 대비 */}
          <Text style={cardSt.secTitle}>나의 평균 대비</Text>
          <View style={cardSt.box}>
            <CompareRow label="심박수" diff={analysis.personal.heartRateDiff} unit="bpm" higherIsBetter={false} />
            <CompareRow label="HRV"   diff={analysis.personal.hrvDiff}        unit="ms"  higherIsBetter={true}  />
          </View>

          {/* 집단 대비 — 심박수 */}
          <Text style={cardSt.secTitle}>동일 연령대 비교</Text>
          <View style={cardSt.box}>
            <View style={{flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 2}}>
              <Text style={cardSt.secTitle}>HR 상위</Text>
              <Text style={[{fontSize: 26, fontWeight: '800'}, {color: statusColor}]}>
                {analysis.demographic.percentile}%
              </Text>
            </View>
            <PercentileBar
              percentile={analysis.demographic.percentile}
              ageAvg={analysis.demographic.ageGroupAvg}
              myHR={analysis.general.heartRate}
            />
            {/* HRV 집단 대비 */}
            {analysis.demographic.avgHrvSdnn !== undefined && analysis.demographic.avgHrvSdnn !== null && (
              <View style={{marginTop: 8, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 8}}>
                <Text style={[cardSt.secTitle, {marginBottom: 4}]}>HRV 연령대 기준 ({analysis.demographic.avgHrvSdnn} ms 평균)</Text>
                <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                  <Text style={{fontSize: 12, color: Colors.textSecondary}}>내 HRV</Text>
                  <Text style={{
                    fontSize: 13, fontWeight: '700',
                    color: analysis.general.hrv >= analysis.demographic.avgHrvSdnn ? Colors.statusGood : Colors.statusDanger,
                  }}>
                    {analysis.general.hrv} ms {analysis.general.hrv >= analysis.demographic.avgHrvSdnn ? '▲' : '▼'} {Math.abs(analysis.general.hrv - analysis.demographic.avgHrvSdnn)} ms
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* 조언 */}
          {record.advice && (
            <View style={cardSt.adviceBox}>
              <Text style={{fontSize: 16, marginRight: 8}}>💡</Text>
              <Text style={cardSt.adviceText}>{record.advice}</Text>
            </View>
          )}

          {/* 태그 */}
          {record.tags && record.tags.length > 0 && (
            <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6}}>
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
      )}
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
  body:    {paddingHorizontal: 14, paddingBottom: 14},
  secTitle:{fontSize: 12, fontWeight: '700', color: Colors.textSecondary, marginBottom: 6, marginTop: 4},
  box:     {backgroundColor: Colors.background, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 10},
  adviceBox:{flexDirection: 'row', backgroundColor: Colors.primaryLight, borderRadius: 10, padding: 12, marginBottom: 8},
  adviceText:{flex: 1, fontSize: 13, color: Colors.textPrimary, lineHeight: 20},
  tag:        {backgroundColor: Colors.primaryLight, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4},
  tagText:    {fontSize: 12, color: Colors.primary, fontWeight: '600'},
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

// ── 달력 SVG 아이콘 ───────────────────────────────────────────────────────────
const CalendarIcon = ({color}: {color: string}) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path
      d="M8 2v3M16 2v3M3 9h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
      stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
    />
  </Svg>
);

// ── 메인 ─────────────────────────────────────────────────────────────────────
export const DiaryScreen: React.FC = () => {
  const [selectedDate, setSelectedDate]       = useState(TODAY);
  const [calendarVisible, setCalendarVisible] = useState(false);
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
          if (history.length > 0) {
            setAllRecords(history);
          }
        } catch {
          // Backend not available — keep mock data
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
      {/* 헤더: 월 + 달력 버튼 */}
      <View style={st.header}>
        <Text style={st.headerMonth}>{getKoreanMonth(selectedDate)}</Text>
        <TouchableOpacity style={st.calBtn} onPress={() => setCalendarVisible(true)} activeOpacity={0.7}>
          <CalendarIcon color={Colors.primary} />
        </TouchableOpacity>
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

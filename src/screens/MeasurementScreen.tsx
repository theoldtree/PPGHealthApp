import React, {useState} from 'react';
import {View, Text, StyleSheet, Modal} from 'react-native';
import {Button} from '../components/Button';
import {PPGChart} from '../components/PPGChart';
import {MeasurementResultScreen} from './MeasurementResultScreen';
import type {MeasurementRecord} from '../types/measurement';
import {formatTime} from '../utils/metrics';
import {
  MEASUREMENT_DURATION,
  BATTERY_THRESHOLD_GOOD,
  BATTERY_THRESHOLD_LOW,
} from '../config/measurement';
import {useMeasurement} from '../hooks/useMeasurement';

export const MeasurementScreen: React.FC = () => {
  const [showResult, setShowResult] = useState(false);
  const [measurementResult, setMeasurementResult] =
    useState<MeasurementRecord | null>(null);

  // Use custom measurement hook
  const {
    isRecording,
    elapsedTime,
    ppgData,
    batteryLevel,
    qcFeedback,
    qcIsAcceptable,
    progress,
    startMeasurement,
    cancelMeasurement,
  } = useMeasurement((result: MeasurementRecord) => {
    setMeasurementResult(result);
    setShowResult(true);
  });

  // Handle result save
  const handleSaveResult = (notes: string) => {
    console.log('Saving measurement result with notes:', notes);
    setShowResult(false);
  };

  return (
    <View style={styles.container}>
      {!isRecording && ppgData.length === 0 && (
        <View style={styles.initialState}>
          <Text style={styles.title}>PPG 측정</Text>
          <Text style={styles.subtitle}>
            손가락을 카메라에 대고 측정을 시작하세요
          </Text>
          <Text style={styles.info}>측정 시간: 1분</Text>

          <Button title="측정 시작" onPress={startMeasurement} />
        </View>
      )}

      {(isRecording || ppgData.length > 0) && !showResult && (
        <View style={styles.recordingState}>
          {/* 배터리 표시 */}
          <View style={styles.batteryContainer}>
            <Text style={styles.batteryLabel}>기기 배터리</Text>
            <View style={styles.batteryIndicator}>
              <View
                style={[
                  styles.batteryFill,
                  {
                    width: `${batteryLevel}%`,
                    backgroundColor:
                      batteryLevel > BATTERY_THRESHOLD_GOOD
                        ? '#34C759'
                        : batteryLevel > BATTERY_THRESHOLD_LOW
                          ? '#FF9500'
                          : '#FF3B30',
                  },
                ]}
              />
            </View>
            <Text
              style={[
                styles.batteryText,
                {
                  color:
                    batteryLevel > BATTERY_THRESHOLD_GOOD
                      ? '#34C759'
                      : batteryLevel > BATTERY_THRESHOLD_LOW
                        ? '#FF9500'
                        : '#FF3B30',
                },
              ]}>
              {batteryLevel}%
            </Text>
          </View>

          {/* QC 피드백 */}
          {qcFeedback && (
            <View
              style={[
                styles.qcFeedbackContainer,
                {
                  backgroundColor: qcIsAcceptable ? '#E8F5E9' : '#FFF3E0',
                  borderLeftWidth: 3,
                  borderLeftColor: qcIsAcceptable ? '#34C759' : '#FF9500',
                },
              ]}>
              <Text
                style={[
                  styles.qcFeedbackText,
                  {color: qcIsAcceptable ? '#2E7D32' : '#E65100'},
                ]}>
                {qcFeedback}
              </Text>
            </View>
          )}

          {/* 타이머 */}
          <View style={styles.timerContainer}>
            <Text style={styles.timerText}>
              {formatTime(elapsedTime)} / {formatTime(MEASUREMENT_DURATION)}
            </Text>
            <View style={styles.progressBar}>
              <View
                style={[styles.progressFill, {width: `${progress}%`}]}
              />
            </View>
          </View>

          {/* 실시간 그래프 */}
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>실시간 PPG 데이터</Text>
            <PPGChart data={ppgData} isRecording={isRecording} />
            {isRecording && (
              <Text style={styles.chartInfo}>
                데이터 포인트: {ppgData.length}
              </Text>
            )}
          </View>

          {/* 컨트롤 버튼 */}
          <View style={styles.controls}>
            {isRecording ? (
              <Button
                title="측정 취소"
                onPress={cancelMeasurement}
                variant="outline"
              />
            ) : (
              <Button title="다시 측정" onPress={startMeasurement} />
            )}
          </View>

          {isRecording && (
            <Text style={styles.statusText}>
              측정 중... 기기를 움직이지 마세요
            </Text>
          )}
        </View>
      )}

      {/* 결과 모달 */}
      <Modal visible={showResult} animationType="slide">
        {measurementResult && (
          <MeasurementResultScreen
            record={measurementResult}
            onSaveAndClose={handleSaveResult}
          />
        )}
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  initialState: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  recordingState: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 16,
    textAlign: 'center',
  },
  info: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 32,
    textAlign: 'center',
  },
  timerContainer: {
    marginBottom: 24,
  },
  timerText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E5EA',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  chartContainer: {
    flex: 1,
    marginBottom: 24,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  chartInfo: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 8,
  },
  controls: {
    marginBottom: 16,
  },
  statusText: {
    fontSize: 14,
    color: '#FF9500',
    textAlign: 'center',
    fontWeight: '500',
  },
  batteryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  batteryLabel: {
    fontSize: 14,
    color: '#3C3C43',
    fontWeight: '500',
    marginRight: 12,
  },
  batteryIndicator: {
    flex: 1,
    height: 8,
    backgroundColor: '#E5E5EA',
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 12,
  },
  batteryFill: {
    height: '100%',
    borderRadius: 4,
  },
  batteryText: {
    fontSize: 16,
    fontWeight: '600',
  },
  qcFeedbackContainer: {
    backgroundColor: '#F2F2F7',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  qcFeedbackText: {
    fontSize: 14,
    color: '#3C3C43',
    textAlign: 'center',
  },
});

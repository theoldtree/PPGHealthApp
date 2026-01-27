/**
 * Custom hook for managing PPG measurement workflow
 */
import {useState, useRef, useEffect} from 'react';
import {Alert} from 'react-native';
import {
  startMeasurement as apiStartMeasurement,
  submitQCData,
  completeMeasurement,
  analyzeMeasurement as apiAnalyzeMeasurement,
  convertAnalysisToRecord,
} from '../api/measurements';
import type {MeasurementRecord} from '../types/measurement';
import {
  MEASUREMENT_DURATION,
  DATA_SEND_INTERVAL,
  DATA_GENERATION_INTERVAL,
  QC_WINDOW_SIZE,
  MIN_DATA_POINTS,
} from '../config/measurement';

export interface UseMeasurementResult {
  isRecording: boolean;
  elapsedTime: number;
  ppgData: number[];
  batteryLevel: number;
  qcFeedback: string;
  qcIsAcceptable: boolean;
  progress: number;
  startMeasurement: () => Promise<void>;
  stopMeasurement: () => void;
  cancelMeasurement: () => void;
}

export const useMeasurement = (
  onAnalysisComplete: (result: MeasurementRecord) => void,
) => {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [ppgData, setPpgData] = useState<number[]>([]);
  const [batteryLevel, setBatteryLevel] = useState(100);
  const [qcFeedback, setQcFeedback] = useState<string>('');
  const [qcIsAcceptable, setQcIsAcceptable] = useState<boolean>(true);
  const [measurementId, setMeasurementId] = useState<number | null>(null);
  const [windowIndex, setWindowIndex] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dataGeneratorRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dataSenderRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (dataGeneratorRef.current) clearInterval(dataGeneratorRef.current);
      if (dataSenderRef.current) clearInterval(dataSenderRef.current);
    };
  }, []);

  // Generate dummy PPG data (to be replaced with BLE sensor data)
  const generateDummyData = () => {
    setPpgData(prev => {
      const newValue = 70 + Math.sin(Date.now() / 1000) * 10 + Math.random() * 5;
      return [...prev, Math.round(newValue)];
    });

    // Simulate battery drain
    if (Math.random() < 0.01) {
      setBatteryLevel(prev => Math.max(0, prev - 1));
    }
  };

  // Send data to server for QC feedback
  const sendDataToServer = async () => {
    if (!isRecording || !measurementId) {
      return;
    }

    try {
      const recentData = ppgData.slice(-20);

      if (recentData.length >= MIN_DATA_POINTS) {
        // Pad to QC_WINDOW_SIZE (600 samples)
        const paddedData = new Array(QC_WINDOW_SIZE).fill(0).map((_, i) => {
          const sourceIndex = Math.floor((i * recentData.length) / QC_WINDOW_SIZE);
          return recentData[sourceIndex] || recentData[0];
        });

        const qcResponse = await submitQCData(
          measurementId,
          windowIndex,
          elapsedTime,
          paddedData,
          batteryLevel,
        );

        // Use detailed feedback message from server
        setQcFeedback(qcResponse.feedback_message || '측정 중...');
        setQcIsAcceptable(qcResponse.is_acceptable);
        setWindowIndex(prev => prev + 1);

        console.log('QC Feedback:', {
          acceptable: qcResponse.is_acceptable,
          message: qcResponse.feedback_message,
          snr: qcResponse.snr,
          peak_count: qcResponse.peak_count,
        });
      }
    } catch (error) {
      console.error('Failed to send data:', error);
    }
  };

  // Analyze completed measurement
  const analyzeMeasurement = async () => {
    if (!measurementId) {
      return;
    }

    try {
      await completeMeasurement(measurementId, '');
      const analysisData = await apiAnalyzeMeasurement(measurementId);
      const record = convertAnalysisToRecord(analysisData, MEASUREMENT_DURATION);
      onAnalysisComplete(record);
    } catch (error) {
      console.error('Failed to analyze measurement:', error);
      Alert.alert('오류', '분석에 실패했습니다.');
    }
  };

  // Start measurement
  const startMeasurement = async () => {
    try {
      const response = await apiStartMeasurement(1); // TODO: Use actual user_id
      setMeasurementId(response.measurement_id);
      setWindowIndex(0);
      setQcFeedback('측정 시작됨');

      setIsRecording(true);
      setElapsedTime(0);
      setPpgData([]);

      // Start timer
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => {
          if (prev >= MEASUREMENT_DURATION - 1) {
            stopMeasurement();
            return MEASUREMENT_DURATION;
          }
          return prev + 1;
        });
      }, 1000);

      // Start data generation
      dataGeneratorRef.current = setInterval(() => {
        generateDummyData();
      }, DATA_GENERATION_INTERVAL);

      // Start data transmission
      dataSenderRef.current = setInterval(() => {
        sendDataToServer();
      }, DATA_SEND_INTERVAL);
    } catch (error) {
      console.error('Failed to start measurement:', error);
      Alert.alert('오류', '측정을 시작할 수 없습니다.');
    }
  };

  // Stop measurement
  const stopMeasurement = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (dataGeneratorRef.current) clearInterval(dataGeneratorRef.current);
    if (dataSenderRef.current) clearInterval(dataSenderRef.current);

    setIsRecording(false);

    // Analyze if measurement completed
    if (elapsedTime >= MEASUREMENT_DURATION - 1 && measurementId) {
      analyzeMeasurement();
    }
  };

  // Cancel measurement
  const cancelMeasurement = () => {
    Alert.alert('측정 취소', '정말 측정을 취소하시겠습니까?', [
      {text: '아니오', style: 'cancel'},
      {
        text: '예',
        style: 'destructive',
        onPress: () => {
          stopMeasurement();
          setPpgData([]);
          setElapsedTime(0);
          setMeasurementId(null);
          setQcFeedback('');
        },
      },
    ]);
  };

  const progress = (elapsedTime / MEASUREMENT_DURATION) * 100;

  return {
    isRecording,
    elapsedTime,
    ppgData,
    batteryLevel,
    qcFeedback,
    qcIsAcceptable,
    progress,
    startMeasurement,
    stopMeasurement,
    cancelMeasurement,
  };
};

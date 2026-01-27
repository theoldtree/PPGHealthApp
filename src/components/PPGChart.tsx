import React, {useEffect, useRef} from 'react';
import {View, Dimensions, StyleSheet} from 'react-native';
import {LineChart} from 'react-native-chart-kit';

interface PPGChartProps {
  data: number[];
  isRecording: boolean;
}

const CHART_WIDTH = Dimensions.get('window').width - 48;
const CHART_HEIGHT = 220;
const MAX_DATA_POINTS = 60; // 1분간 1초당 1개 데이터

export const PPGChart: React.FC<PPGChartProps> = React.memo(
  ({data, isRecording}) => {
    // 최근 MAX_DATA_POINTS개만 표시
    const displayData = data.slice(-MAX_DATA_POINTS);

    // 데이터가 없으면 0으로 채우기
    const chartData =
      displayData.length > 0 ? displayData : [0, 0, 0, 0, 0];

    // Y축 범위 계산
    const minValue = Math.min(...chartData);
    const maxValue = Math.max(...chartData);
    const padding = (maxValue - minValue) * 0.1 || 10;

    return (
      <View style={styles.container}>
        <LineChart
          data={{
            labels: [],
            datasets: [
              {
                data: chartData,
              },
            ],
          }}
          width={CHART_WIDTH}
          height={CHART_HEIGHT}
          chartConfig={{
            backgroundColor: '#FFFFFF',
            backgroundGradientFrom: '#F2F2F7',
            backgroundGradientTo: '#F2F2F7',
            decimalPlaces: 0,
            color: (opacity = 1) =>
              isRecording
                ? `rgba(0, 122, 255, ${opacity})`
                : `rgba(142, 142, 147, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(60, 60, 67, ${opacity})`,
            style: {
              borderRadius: 16,
            },
            propsForDots: {
              r: '0',
            },
            propsForBackgroundLines: {
              strokeDasharray: '',
              stroke: '#E5E5EA',
              strokeWidth: 1,
            },
          }}
          bezier
          style={styles.chart}
          withInnerLines
          withOuterLines
          withVerticalLabels={false}
          withHorizontalLabels
          fromZero={false}
          segments={4}
        />
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    padding: 8,
  },
  chart: {
    borderRadius: 16,
  },
});

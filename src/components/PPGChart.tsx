import React from 'react';
import {View, Dimensions, StyleSheet} from 'react-native';
import {LineChart} from 'react-native-chart-kit';

interface PPGChartProps {
  data: number[];
  isRecording: boolean;
  width?: number;
  height?: number;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const DEFAULT_HEIGHT = 200;
const MAX_DATA_POINTS = 60;

export const PPGChart: React.FC<PPGChartProps> = React.memo(
  ({data, isRecording, width = SCREEN_WIDTH, height = DEFAULT_HEIGHT}) => {
    const displayData = data.slice(-MAX_DATA_POINTS);
    const chartData = displayData.length > 0 ? displayData : [0, 0, 0, 0, 0];

    const minValue = Math.min(...chartData);
    const maxValue = Math.max(...chartData);
    const range = maxValue - minValue || 10;
    const padding = range * 0.15;

    return (
      <View style={styles.container}>
        <LineChart
          data={{
            labels: [],
            datasets: [
              {
                data: chartData,
                withDots: false,
              },
            ],
          }}
          width={width}
          height={height}
          chartConfig={{
            backgroundColor: '#F8F8FA',
            backgroundGradientFrom: '#F8F8FA',
            backgroundGradientTo: '#F8F8FA',
            decimalPlaces: 0,
            color: (opacity = 1) =>
              isRecording
                ? `rgba(26, 26, 46, ${opacity})`
                : `rgba(180, 180, 190, ${opacity})`,
            labelColor: () => 'transparent',
            style: {
              borderRadius: 0,
            },
            propsForDots: {
              r: '0',
            },
            propsForBackgroundLines: {
              strokeDasharray: '',
              stroke: 'transparent',
            },
          }}
          bezier
          style={styles.chart}
          withInnerLines={false}
          withOuterLines={false}
          withVerticalLabels={false}
          withHorizontalLabels={false}
          fromZero={false}
          yAxisInterval={1}
        />
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F8F8FA',
    overflow: 'hidden',
  },
  chart: {
    borderRadius: 0,
  },
});

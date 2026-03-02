import React from 'react';
import {View} from 'react-native';
import Svg, {Path, Defs, LinearGradient, Stop} from 'react-native-svg';
import {Colors} from '../config/colors';

interface PPGChartProps {
  data: number[];
  isRecording: boolean;
  width?: number;
  height?: number;
}

const MAX_POINTS = 80;

export const PPGChart: React.FC<PPGChartProps> = React.memo(
  ({data, isRecording, width = 300, height = 180}) => {
    const pts = data.slice(-MAX_POINTS);

    // Flat line when no data yet
    if (pts.length < 2) {
      const mid = (height / 2).toFixed(1);
      return (
        <View style={{width, height, backgroundColor: '#F8F9FC'}}>
          <Svg width={width} height={height}>
            <Path
              d={`M 0 ${mid} L ${width} ${mid}`}
              stroke="#D8DCE8"
              strokeWidth="1.5"
              fill="none"
            />
          </Svg>
        </View>
      );
    }

    // Compute y-scale (auto-fit with padding)
    const min = Math.min(...pts);
    const max = Math.max(...pts);
    const range = max - min || 1;
    const padY = range * 0.18;
    const lo = min - padY;
    const hi = max + padY;
    const yRange = hi - lo;

    const padX = 2;
    const drawW = width - padX * 2;
    const drawH = height - 8;

    const toX = (i: number) => padX + (i / (pts.length - 1)) * drawW;
    const toY = (v: number) => 4 + ((hi - v) / yRange) * drawH;

    // SVG path
    const linePath = pts
      .map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`)
      .join(' ');

    // Filled area path
    const areaPath =
      linePath +
      ` L ${toX(pts.length - 1).toFixed(1)} ${height}` +
      ` L ${toX(0).toFixed(1)} ${height} Z`;

    const lineColor = isRecording ? Colors.primary : '#A0AABF';

    return (
      <View style={{width, height, backgroundColor: '#F8F9FC'}}>
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="ppgGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={lineColor} stopOpacity="0.25" />
              <Stop offset="1" stopColor={lineColor} stopOpacity="0.01" />
            </LinearGradient>
          </Defs>
          {/* Gradient fill */}
          <Path d={areaPath} fill="url(#ppgGrad)" />
          {/* Waveform line */}
          <Path
            d={linePath}
            stroke={lineColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      </View>
    );
  },
);

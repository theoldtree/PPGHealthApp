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

    const padX = 12;
    const padYTop = 12;
    const padYBot = 12;

    // Flat line when no data yet
    if (pts.length < 2) {
      const mid = (height / 2).toFixed(1);
      return (
        <View style={{width, height, backgroundColor: '#F8F9FC', borderRadius: 8}}>
          <Svg width={width} height={height}>
            <Path
              d={`M ${padX} ${mid} L ${width - padX} ${mid}`}
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
    const padY = range * 0.15;
    const lo = min - padY;
    const hi = max + padY;
    const yRange = hi - lo;

    const drawW = width - padX * 2;
    const drawH = height - padYTop - padYBot;

    const toX = (i: number) => padX + (i / (pts.length - 1)) * drawW;
    const toY = (v: number) => padYTop + ((hi - v) / yRange) * drawH;

    // Smooth cubic bezier path (catmull-rom style: midpoint control points)
    const linePath = pts
      .map((v, i) => {
        const x = toX(i).toFixed(1);
        const y = toY(v).toFixed(1);
        if (i === 0) return `M ${x} ${y}`;
        const px = toX(i - 1);
        const py = toY(pts[i - 1]);
        const cx = ((px + toX(i)) / 2).toFixed(1);
        return `C ${cx} ${py.toFixed(1)}, ${cx} ${y}, ${x} ${y}`;
      })
      .join(' ');

    // Filled area path (close down to bottom)
    const areaPath =
      linePath +
      ` L ${toX(pts.length - 1).toFixed(1)} ${height - padYBot}` +
      ` L ${toX(0).toFixed(1)} ${height - padYBot} Z`;

    const lineColor = isRecording ? Colors.primary : '#A0AABF';

    return (
      <View style={{width, height, backgroundColor: '#F8F9FC', borderRadius: 8}}>
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

import React from 'react';
import {View, Text} from 'react-native';
import Svg, {Path, Line, Defs, LinearGradient, Stop} from 'react-native-svg';
import {Colors} from '../config/colors';
import {MEASUREMENT_DURATION} from '../config/measurement';

interface PPGChartProps {
  data: number[];          // downsampled accumulated samples
  isRecording: boolean;
  elapsedTime: number;     // seconds elapsed (0–totalDurationS)
  totalDurationS?: number; // default MEASUREMENT_DURATION (60)
  width?: number;
  height?: number;
}

const LABEL_H = 20;
const PAD_L   = 6;
const PAD_R   = 6;
const PAD_TOP = 10;
const PAD_BOT = 6;

export const PPGChart: React.FC<PPGChartProps> = React.memo(
  ({data, isRecording, elapsedTime, totalDurationS = MEASUREMENT_DURATION, width = 300, height = 180}) => {
    const svgH  = height - LABEL_H;
    const drawW = width - PAD_L - PAD_R;
    const drawH = svgH - PAD_TOP - PAD_BOT;

    const lineColor = isRecording ? Colors.primary : '#A0AABF';

    /**
     * Fixed 0 → totalDurationS (60s) axis, always.
     * Data fills from left to right as elapsedTime grows.
     * Sample i of n maps to x = PAD_L + (i/(n-1)) * (elapsedTime/totalDurationS) * drawW
     * Recording cursor sits at x = PAD_L + (elapsedTime/totalDurationS) * drawW
     */

    // Y scale: fixed 10-bit ADC range [0, 1023].
    // Real PPG signal sits within a sub-range of this (DC offset ± AC swing),
    // so the waveform is always stable — no rescaling during recording.
    const Y_MIN = 0;
    const Y_MAX = 1023;
    const toY = (v: number) => {
      const clamped = Math.max(Y_MIN, Math.min(Y_MAX, v));
      return PAD_TOP + ((Y_MAX - clamped) / (Y_MAX - Y_MIN)) * drawH;
    };

    // X: each sample mapped to its time position on the fixed 0-60s axis
    const n       = data.length;
    const elapsed = Math.min(elapsedTime, totalDurationS);
    const toX = (i: number) =>
      PAD_L + (n > 1 ? (i / (n - 1)) : 0) * (elapsed / totalDurationS) * drawW;

    // Waveform path (midpoint cubic bezier for smooth curves)
    let linePath = '';
    let areaPath = '';
    if (n >= 2) {
      linePath = data
        .map((v, i) => {
          const x = toX(i).toFixed(1);
          const y = toY(v).toFixed(1);
          if (i === 0) { return `M ${x} ${y}`; }
          const px = toX(i - 1);
          const py = toY(data[i - 1]);
          const cx = ((px + toX(i)) / 2).toFixed(1);
          return `C ${cx} ${py.toFixed(1)}, ${cx} ${y}, ${x} ${y}`;
        })
        .join(' ');

      const lastX  = toX(n - 1).toFixed(1);
      const firstX = toX(0).toFixed(1);
      const baseY  = (PAD_TOP + drawH).toFixed(1);
      areaPath = `${linePath} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`;
    }

    // Fixed ticks: 0, 15, 30, 45, 60 (every 15s for 60s window)
    const ticks = [0, 15, 30, 45, totalDurationS].filter((v, i, a) => a.indexOf(v) === i);

    // Time → x pixel (always on the fixed 0-60s axis)
    const timeToX = (t: number) => PAD_L + (t / totalDurationS) * drawW;

    // Recording cursor x position
    const cursorX = timeToX(elapsed);

    const midY = (PAD_TOP + drawH / 2).toFixed(1);

    return (
      <View style={{width, height, backgroundColor: '#EEF2FB', borderRadius: 10, overflow: 'hidden'}}>

        {/* Waveform SVG */}
        <Svg width={width} height={svgH}>
          <Defs>
            <LinearGradient id="ppgGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={lineColor} stopOpacity="0.22" />
              <Stop offset="1" stopColor={lineColor} stopOpacity="0.01" />
            </LinearGradient>
          </Defs>

          {/* Vertical grid lines at tick positions */}
          {ticks.map(t => (
            <Line
              key={t}
              x1={timeToX(t).toFixed(1)} y1={PAD_TOP}
              x2={timeToX(t).toFixed(1)} y2={PAD_TOP + drawH}
              stroke="#C4CCE0" strokeWidth="0.6"
            />
          ))}

          {/* Horizontal center baseline (dashed) */}
          <Line
            x1={PAD_L} y1={midY}
            x2={width - PAD_R} y2={midY}
            stroke="#C4CCE0" strokeWidth="0.6" strokeDasharray="4 5"
          />

          {/* Gradient fill */}
          {areaPath ? <Path d={areaPath} fill="url(#ppgGrad)" /> : null}

          {/* Waveform line or placeholder */}
          {linePath
            ? <Path
                d={linePath}
                stroke={lineColor}
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            : <Line
                x1={PAD_L} y1={midY}
                x2={width - PAD_R} y2={midY}
                stroke="#C4CCE0" strokeWidth="1" strokeDasharray="3 7"
              />
          }

          {/* Recording cursor at current elapsed time position */}
          {isRecording && elapsed > 0 && (
            <Line
              x1={cursorX.toFixed(1)} y1={PAD_TOP}
              x2={cursorX.toFixed(1)} y2={PAD_TOP + drawH}
              stroke={lineColor} strokeWidth="1.5" strokeOpacity="0.7"
            />
          )}
        </Svg>

        {/* X-axis time labels */}
        <View style={{height: LABEL_H, position: 'relative'}}>
          {ticks.map((t, idx) => {
            const x      = timeToX(t);
            const isFirst = idx === 0;
            const isLast  = idx === ticks.length - 1;
            const offset  = isFirst ? 0 : isLast ? -20 : -8;
            return (
              <Text
                key={t}
                style={{
                  position: 'absolute',
                  left: x + offset,
                  top: 3,
                  fontSize: 9,
                  color: '#8A94A8',
                  fontWeight: '500',
                  letterSpacing: 0.2,
                }}>
                {t}s
              </Text>
            );
          })}
        </View>
      </View>
    );
  },
);

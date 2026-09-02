import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, spacing } from '../theme';

export interface DonutSlice {
  key: string;
  label: string;
  amount: number;
  pct: number;
  color: string;
}

interface Props {
  slices: DonutSlice[];
  size?: number;
  strokeWidth?: number;
  centerLabel: string;
  centerValue: string;
}

// Dona construida con react-native-svg (Circle + strokeDasharray), rotada
// -90° para empezar arriba. Siempre se acompaña de una leyenda con etiquetas
// visibles debajo (relief rule de la skill de dataviz: 3 de estos 5 colores
// no alcanzan 3:1 de contraste solos, así que el color nunca es la única
// forma de identificar una porción).
export function DonutChart({ slices, size = 160, strokeWidth = 22, centerLabel, centerValue }: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offsetAcc = 0;

  const visibleSlices = slices.filter((s) => s.amount > 0);

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ width: size, height: size, alignSelf: 'center' }}>
        <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.gridline}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {visibleSlices.map((slice) => {
            const arcLength = slice.pct * circumference;
            const dashArray = `${Math.max(arcLength - 2, 0)} ${circumference - arcLength + 2}`;
            const dashOffset = -offsetAcc;
            offsetAcc += arcLength;
            return (
              <Circle
                key={slice.key}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={slice.color}
                strokeWidth={strokeWidth}
                strokeDasharray={dashArray}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                fill="none"
              />
            );
          })}
        </Svg>
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.center}>
            <Text style={styles.centerValue}>{centerValue}</Text>
            <Text style={styles.centerLabel}>{centerLabel}</Text>
          </View>
        </View>
      </View>

      <View style={styles.legend}>
        {slices.map((slice) => (
          <View key={slice.key} style={styles.legendRow}>
            <View style={[styles.swatch, { backgroundColor: slice.color }]} />
            <Text style={styles.legendLabel} numberOfLines={1}>
              {slice.label}
            </Text>
            <Text style={styles.legendValue}>
              ${slice.amount.toFixed(0)} · {(slice.pct * 100).toFixed(0)}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerValue: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  centerLabel: { fontSize: 11, color: colors.muted },
  legend: { gap: spacing.xs },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  legendLabel: { flex: 1, fontSize: 13, color: colors.textPrimary },
  legendValue: { fontSize: 12, color: colors.textSecondary, fontVariant: ['tabular-nums'] },
});

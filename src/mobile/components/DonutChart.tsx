import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { G, Path, Text as SvgText } from "react-native-svg";
import { colors } from "../theme/colors";

export const DONUT_COLORS = [
  "#6366F1", "#22C55E", "#F59E0B", "#EF4444",
  "#8B5CF6", "#06B6D4", "#F97316", "#EC4899",
  "#14B8A6", "#A78BFA",
];

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arc(cx: number, cy: number, oR: number, iR: number, start: number, end: number): string {
  const sweep = end - start;
  if (sweep >= 359.9) {
    // Full circle via two half-arcs
    const m = start + 180;
    const a = polar(cx, cy, oR, start);
    const b = polar(cx, cy, oR, m);
    const c = polar(cx, cy, iR, start);
    const d = polar(cx, cy, iR, m);
    return [
      `M ${a.x} ${a.y}`,
      `A ${oR} ${oR} 0 1 1 ${b.x} ${b.y}`,
      `A ${oR} ${oR} 0 1 1 ${a.x} ${a.y}`,
      `Z`,
      `M ${c.x} ${c.y}`,
      `A ${iR} ${iR} 0 1 0 ${d.x} ${d.y}`,
      `A ${iR} ${iR} 0 1 0 ${c.x} ${c.y}`,
      `Z`,
    ].join(" ");
  }
  const large = sweep > 180 ? 1 : 0;
  const o1 = polar(cx, cy, oR, start);
  const o2 = polar(cx, cy, oR, end);
  const i1 = polar(cx, cy, iR, end);
  const i2 = polar(cx, cy, iR, start);
  return [
    `M ${o1.x} ${o1.y}`,
    `A ${oR} ${oR} 0 ${large} 1 ${o2.x} ${o2.y}`,
    `L ${i1.x} ${i1.y}`,
    `A ${iR} ${iR} 0 ${large} 0 ${i2.x} ${i2.y}`,
    `Z`,
  ].join(" ");
}

interface Slice {
  label: string;
  value: number;
  color?: string;
}

interface Props {
  data: Slice[];
  size?: number;
  centerLabel?: string;
  centerSub?: string;
}

export function DonutChart({ data, size = 180, centerLabel, centerSub }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const oR = size * 0.42;
  const iR = size * 0.28;

  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  let angle = 0;
  const slices = data.map((item, i) => {
    const sweep = (item.value / total) * 360;
    const start = angle;
    angle += sweep;
    return { ...item, path: arc(cx, cy, oR, iR, start, angle), color: item.color ?? DONUT_COLORS[i % DONUT_COLORS.length] };
  });

  // legend: top 5
  const legend = slices.slice(0, 5);

  return (
    <View style={styles.wrapper}>
      <View style={styles.chartRow}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <G>
            {slices.map((s, i) => (
              <Path key={i} d={s.path} fill={s.color} opacity={0.92} />
            ))}
          </G>
          {centerLabel ? (
            <>
              <SvgText x={cx} y={cy - 7} textAnchor="middle" fill={colors.textMuted} fontSize={10} fontWeight="600">
                {centerSub ?? "Total"}
              </SvgText>
              <SvgText x={cx} y={cy + 12} textAnchor="middle" fill={colors.text} fontSize={13} fontWeight="800">
                {centerLabel}
              </SvgText>
            </>
          ) : null}
        </Svg>

        {/* Legend */}
        <View style={styles.legend}>
          {legend.map((s, i) => (
            <View key={i} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: s.color }]} />
              <Text style={styles.legendLabel} numberOfLines={1}>{s.label}</Text>
              <Text style={styles.legendPct}>{Math.round((s.value / total) * 100)}%</Text>
            </View>
          ))}
          {slices.length > 5 && (
            <Text style={styles.legendMore}>+{slices.length - 5} más</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 4 },
  chartRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  legend: { flex: 1, gap: 8 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendDot: { width: 9, height: 9, borderRadius: 5, flexShrink: 0 },
  legendLabel: { flex: 1, color: colors.textSub, fontSize: 12, fontWeight: "600" },
  legendPct: { color: colors.text, fontSize: 12, fontWeight: "700" },
  legendMore: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
});

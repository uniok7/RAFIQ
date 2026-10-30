// Score ring (OxeAI dashboards). progress 0..1, value/label centered.
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { c } from '@/lib/theme';

export function ProgressRing({
  progress,
  size = 64,
  stroke = 6,
  color = c.accent,
  value,
  label,
}: {
  progress: number;
  size?: number;
  stroke?: number;
  color?: string;
  value?: string;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.line} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circ * clamped} ${circ}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {(value || label) && (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          {value ? <Text style={{ color: c.text, fontWeight: '700', fontSize: size * 0.26 }}>{value}</Text> : null}
          {label ? <Text style={{ color: c.dim, fontSize: size * 0.14 }}>{label}</Text> : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({ center: { alignItems: 'center', justifyContent: 'center' } });

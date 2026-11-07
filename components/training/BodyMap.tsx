import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { fontSize, fontWeight, radius, spacing } from '../../constants/theme';
import { muscleLabel, type Muscle } from '../../domain/training';
import { useTheme } from '../../store/themeStore';
import anatomy from '../../assets/body/anatomy.json';
import { BODY_REGION_MUSCLES } from './bodyRegions';

// Dữ liệu SVG kèm giấy phép MIT tại assets/body/LICENSE; không cần tải ảnh khi chạy.
export default function BodyMap({ selected, emphasized, onToggle, compact = false }: {
  selected: Muscle[]; emphasized?: Muscle[]; onToggle?: (muscle: Muscle) => void; compact?: boolean;
}) {
  const { colors } = useTheme();
  const [lastMuscle, setLastMuscle] = useState<Muscle | null>(null);
  const hasEmphasis = emphasized?.some(m => selected.includes(m)) ?? false;
  return <View testID="body-map" style={styles.container}>
    <View style={styles.row}>
      {(['front', 'back'] as const).map(side => <View key={side}
        style={[styles.figure, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.text }]}>{side === 'front' ? 'Mặt trước' : 'Mặt sau'}</Text>
        <View style={[styles.canvas, compact && styles.compact]}>
          <Svg width="100%" height="100%" viewBox={side === 'front' ? '0 0 724 1448' : '724 0 724 1448'}
            accessibilityLabel={`Sơ đồ nhóm cơ ${side === 'front' ? 'mặt trước' : 'mặt sau'}`}>
            <Path d={anatomy.outlines[side]} stroke={colors.textMuted} strokeOpacity={0.45} strokeWidth={2} fill="none" pointerEvents="none" />
            {anatomy[side].map(part => {
              const muscle = BODY_REGION_MUSCLES[part.slug];
              const active = !!muscle && selected.includes(muscle);
              return part.paths.map((d, index) => <Path key={`${part.slug}-${index}`} id={`${side}-${part.slug}-${index}`}
                d={d} fill={active ? hasEmphasis && !emphasized?.includes(muscle) ? colors.primaryMuted : colors.primary : colors.textMuted}
                fillOpacity={active ? 1 : muscle ? 0.44 : 0.18}
                stroke={active ? colors.primaryDark : colors.surface} strokeWidth={active ? 1.5 : 0.8}
                accessibilityLabel={muscle ? muscleLabel(muscle) : undefined}
                onPress={muscle && onToggle ? () => {
                  onToggle(muscle);
                  setLastMuscle(muscle);
                } : undefined}
              />);
            })}
          </Svg>
        </View>
      </View>)}
    </View>
    {!!onToggle && <Text accessibilityLiveRegion="polite" style={[styles.hint, { color: colors.textSecondary }]}>
      {lastMuscle ? `${muscleLabel(lastMuscle)} · ${selected.includes(lastMuscle) ? 'Đã chọn' : 'Chưa chọn'}` : 'Chạm vùng cơ để chọn.'}
    </Text>}
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm, width: '100%' },
  row: { flexDirection: 'row', gap: spacing.md, width: '100%' },
  figure: { flex: 1, borderRadius: radius.lg, borderWidth: 1, padding: spacing.sm, alignItems: 'center' },
  label: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold, marginTop: spacing.sm },
  canvas: { width: '100%', aspectRatio: 0.5, maxHeight: 520 },
  compact: { maxHeight: 280 },
  hint: { fontSize: fontSize.caption, lineHeight: 22 },
});

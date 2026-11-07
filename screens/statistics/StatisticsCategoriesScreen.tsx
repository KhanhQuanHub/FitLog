import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Card from '../../components/ui/Card';
import { fontSize, fontWeight, layout, spacing } from '../../constants/theme';
import { useTheme } from '../../store/themeStore';
import { statisticsCategories } from './statisticsRoutes';
import type { StatisticsDestination } from './statisticsRoutes';

export default function StatisticsCategoriesScreen({ today, onBack, onOpenDetail }: {
  today: string; onBack: () => void; onOpenDetail: (destination: StatisticsDestination) => void;
}) {
  const { colors } = useTheme();
  return <SafeAreaView edges={['top', 'left', 'right']} style={[styles.safe, { backgroundColor: colors.background }]}>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.heading}>
        <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={onBack} style={styles.back}>
          <Text style={[styles.title, { color: colors.text }]}>‹</Text>
        </Pressable>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Tất cả danh mục</Text>
      </View>
      {statisticsCategories.map(item => <Card key={item.key} onPress={() => onOpenDetail({ category: item.key, kind: item.kind, anchor: today })}
        accessibilityLabel={`${item.title}. Xem chi tiết`}>
        <View style={styles.row}><Text style={[styles.label, { color: colors.text }]}>{item.title}</Text>
          <Text accessible={false} style={[styles.label, { color: colors.primary }]}>›</Text></View>
        <Text style={[styles.description, { color: colors.textSecondary }]}>{item.description}</Text>
      </Card>)}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1 }, content: { padding: layout.screenPadding, paddingBottom: spacing.xxxl, gap: spacing.md },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  back: { minHeight: layout.minTouchSize, minWidth: layout.minTouchSize, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: fontSize.headline, fontWeight: fontWeight.bold, flexShrink: 1 },
  row: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between', marginBottom: spacing.sm },
  label: { fontSize: fontSize.body, fontWeight: fontWeight.semibold, flexShrink: 1 },
  description: { fontSize: fontSize.caption, lineHeight: 22 },
});

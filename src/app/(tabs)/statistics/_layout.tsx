import { Stack } from 'expo-router';
import { StatisticsDataProvider } from '../../../../screens/statistics/StatisticsDataProvider';
export const unstable_settings = { initialRouteName: 'index' };
export default function StatisticsLayout() {
  return <StatisticsDataProvider><Stack screenOptions={{ headerShown: false }}>
    <Stack.Screen name="index" /><Stack.Screen name="categories" /><Stack.Screen name="[category]" />
  </Stack></StatisticsDataProvider>;
}

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { color } from '../src/ui/theme';
import { useAppFonts } from '../src/ui/fonts';

export default function RootLayout() {
  const fontsLoaded = useAppFonts();

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {/* The ground is painted before anything else, so the first frame after
          the splash is never a white flash on a dark app. */}
      {fontsLoaded ? (
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: color.ink },
            animation: 'fade',
          }}
        />
      ) : (
        <View style={{ flex: 1, backgroundColor: color.ink }} />
      )}
    </SafeAreaProvider>
  );
}

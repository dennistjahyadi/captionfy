import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { pruneDownloadedModels } from '../src/asr/models';
import { syncEntitlement } from '../src/policy/entitlement-store';
import { color } from '../src/ui/theme';
import { useAppFonts } from '../src/ui/fonts';

export default function RootLayout() {
  const fontsLoaded = useAppFonts();

  useEffect(() => {
    // Both fire and forget, and neither is on the way to anything. The store
    // query is the only network call the app makes and it must never be the
    // reason a screen is late; the prune is 83 MB an older build downloaded and
    // this one carries in the APK instead.
    pruneDownloadedModels();
    void syncEntitlement();
  }, []);

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

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { pruneDownloadedModels } from '../src/asr/models';
import { syncEntitlement } from '../src/policy/entitlement-store';
import { color } from '../src/ui/theme';
import { useAppFonts } from '../src/ui/fonts';
import { useReducedMotion } from '../src/ui/motion';

export default function RootLayout() {
  const fontsLoaded = useAppFonts();
  // The caption rise has honoured this setting since slice 1b, through the
  // layout. The chrome had not: a screen that fades and a sheet that slides are
  // motion too, and somebody who turned animations off asked for neither.
  const reducedMotion = useReducedMotion();

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
            animation: reducedMotion ? 'none' : 'fade',
          }}
        />
      ) : (
        <View style={{ flex: 1, backgroundColor: color.ink }} />
      )}
    </SafeAreaProvider>
  );
}

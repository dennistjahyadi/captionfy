/**
 * Welcome. First launch, once, and never again.
 *
 * No carousel. The one thing worth saying before somebody picks a video is what
 * this app does not do with it, and the only reason this screen still exists now
 * that the models ride in the APK is that the promise needs saying at all.
 *
 * Restore is here rather than only in Settings because a reinstall lands on this
 * screen, and a paying user should not have to hunt through a settings list to
 * prove they already bought it.
 */
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { syncEntitlement } from '../src/policy/entitlement-store';
import { markWelcomeSeen } from '../src/project/settings';
import { Label, PrimaryButton, QuietButton, Screen } from '../src/ui/atoms';
import { DEFAULT_ACCENT, space } from '../src/ui/theme';

export default function Welcome() {
  const insets = useSafeAreaInsets();
  const [restoring, setRestoring] = useState(false);
  const [message, setMessage] = useState('');

  const start = useCallback(() => {
    markWelcomeSeen();
    router.replace('/');
  }, []);

  const restore = useCallback(async () => {
    setRestoring(true);
    setMessage('');

    // Seen or not, this person has now been through Welcome. Restoring is a
    // stronger signal than "Get started": they have used this app before.
    const restored = await syncEntitlement();
    setRestoring(false);

    if (restored) {
      markWelcomeSeen();
      router.replace({ pathname: '/unlock', params: { from: 'welcome' } });
      return;
    }
    setMessage('No purchase found for this account.');
  }, []);

  return (
    <Screen>
      <View style={[styles.body, { paddingTop: insets.top + space.huge, paddingBottom: insets.bottom + space.xl }]}>
        <Label variant="serif" style={styles.headline}>
          Captions that look edited.
        </Label>

        <Label variant="body" tone="mute" style={styles.blurb}>
          Everything runs on your phone. No account. No upload. No watermark.
        </Label>

        <View style={styles.actions}>
          <PrimaryButton title="Get started" accent={DEFAULT_ACCENT} onPress={start} busy={restoring} />
          <QuietButton title="Already bought it? Restore" onPress={restore} />
          {message ? (
            <Label variant="micro" tone="mute" style={styles.message}>
              {message}
            </Label>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: space.lg, justifyContent: 'flex-end', gap: space.lg },
  headline: { color: DEFAULT_ACCENT, maxWidth: 340 },
  blurb: { maxWidth: 320 },
  actions: { marginTop: space.huge, gap: space.xs },
  message: { textAlign: 'center' },
});

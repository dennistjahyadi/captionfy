/**
 * Settings.
 *
 * Five rows and an honest About. Everything here is either the user's own words,
 * what they have paid for, or what the app is — there are no preferences, because
 * a caption app with a preferences screen has usually failed to decide something.
 */
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { STYLE_PRESETS } from '../../src/domain';
import { loadDictionary } from '../../src/project/dictionary-store';
import { loadSettings } from '../../src/project/settings';
import { loadEntitlement } from '../../src/policy/entitlement-store';
import { freeTierStatus } from '../../src/policy/free-tier';
import { Divider, Label, QuietButton, Screen } from '../../src/ui/atoms';
import { plural } from '../../src/ui/describe';
import { askHowToSendFeedback } from '../../src/ui/feedback';
import { MIN_TOUCH, space } from '../../src/ui/theme';

export default function Settings() {
  const insets = useSafeAreaInsets();
  const [words, setWords] = useState(0);
  const [styleName, setStyleName] = useState('');
  const [entitlement, setEntitlement] = useState(loadEntitlement);

  useFocusEffect(
    useCallback(() => {
      setWords(loadDictionary().length);
      setEntitlement(loadEntitlement());
      const { styleId } = loadSettings();
      setStyleName(STYLE_PRESETS.find((preset) => preset.id === styleId)?.name ?? '');
    }, [])
  );

  const tier = freeTierStatus(entitlement);

  return (
    <Screen>
      <View style={[styles.bar, { paddingTop: insets.top + space.sm }]}>
        <QuietButton title="Back" onPress={() => router.back()} />
        <Label variant="label" tone="mute">
          Settings
        </Label>
        <View style={styles.balance} />
      </View>

      <View style={styles.rows}>
        <Row
          title="Your words"
          detail={words === 0 ? 'Nothing yet' : plural(words, 'word')}
          onPress={() => router.push('/settings/dictionary')}
        />
        <Divider />
        <Row
          title={entitlement.unlocked ? 'Unlocked' : 'Unlock everything'}
          detail={entitlement.unlocked ? unlockedOn(entitlement.unlockedAt) : tier.line}
          onPress={() => router.push({ pathname: '/unlock', params: { from: 'settings' } })}
        />
        <Divider />
        <Row
          title="Default style"
          detail={styleName}
          onPress={() => router.push('/settings/style')}
        />
        <Divider />
        {/* Permanent, and the half of this feature that matters. The card on Saved
            is one nudge at a good moment; this is the channel it points at, and it
            is here for the person who thinks of something a fortnight later. */}
        <Row title="Give feedback" detail="Email or TikTok" onPress={askHowToSendFeedback} />
        <Divider />
        <Row title="About" onPress={about} />
      </View>

      <View style={styles.foot}>
        <Label variant="micro" tone="mute">
          Wordburn {Constants.expoConfig?.version ?? ''} · your videos never leave this phone
        </Label>
      </View>
    </Screen>
  );
}

/**
 * When it was bought, in the phone's own locale.
 *
 * The row still opens Unlock afterwards, which is where Restore lives: somebody
 * who has changed phones needs a way in that is not a paywall, and this is the
 * only one that is not.
 */
function unlockedOn(at?: string): string {
  if (!at) return 'Thank you';
  const when = new Date(at);
  if (Number.isNaN(when.getTime())) return 'Thank you';
  return when.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function about() {
  Alert.alert(
    `Wordburn ${Constants.expoConfig?.version ?? ''}`,
    [
      'Your videos never leave this phone. There is no account and no server.',
      '',
      'Type is set in Be Vietnam Pro and Spectral, both under the SIL Open Font License.',
      'Speech recognition by whisper.cpp, MIT licensed.',
    ].join('\n')
  );
}

function Row({
  title,
  detail,
  onPress,
}: {
  title: string;
  detail?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed && onPress ? 0.6 : 1 }]}
    >
      <Label variant="body">{title}</Label>
      <View style={styles.detail}>
        {detail ? (
          <Label variant="label" tone="mute">
            {detail}
          </Label>
        ) : null}
        {onPress ? (
          <Label variant="label" tone="mute">
            ›
          </Label>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.sm,
    paddingBottom: space.sm,
  },
  balance: { width: 72 },
  rows: { paddingHorizontal: space.lg, marginTop: space.lg },
  row: {
    minHeight: MIN_TOUCH + 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  detail: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  foot: { marginTop: 'auto', padding: space.lg, alignItems: 'center' },
});

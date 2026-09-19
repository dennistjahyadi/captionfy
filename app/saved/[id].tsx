/**
 * Saved.
 *
 * The end of the only path that produces a file, so it says where the file went,
 * how big it is, and what is left of the free tier. Three ways on: share it,
 * back to the words, or home for the next clip.
 */
import * as Sharing from 'expo-sharing';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { accentColor, projectStyle } from '../../src/domain';
import { loadEntitlement } from '../../src/policy/entitlement-store';
import { freeTierStatus } from '../../src/policy/free-tier';
import { loadSettings } from '../../src/project/settings';
import { loadProject } from '../../src/project/store';
import { Label, PrimaryButton, QuietButton, Screen } from '../../src/ui/atoms';
import { describeBytes } from '../../src/ui/describe';
import { FeedbackCard } from '../../src/ui/feedback';
import { shouldAskForFeedback } from '../../src/ui/support';
import { FreeTierLine } from '../../src/ui/tier';
import { color, DEFAULT_ACCENT, radius, space } from '../../src/ui/theme';

export default function Saved() {
  const { id, name, bytes, path, srt, seconds } = useLocalSearchParams<{
    id: string;
    name: string;
    bytes: string;
    path: string;
    srt: string;
    seconds: string;
  }>();
  const insets = useSafeAreaInsets();

  const project = useMemo(() => (id ? loadProject(id) : null), [id]);
  const tier = freeTierStatus(loadEntitlement());
  const accent = project ? accentColor(projectStyle(project)) : DEFAULT_ACCENT;

  /**
   * What goes in the one slot at the foot of the screen.
   *
   * Read once on mount rather than on focus: `runExport` has already counted this
   * export, so the answer cannot change while the screen is up. Answering the
   * card leaves the slot empty for the rest of the visit instead of falling back
   * to the tier line — an unlock nudge appearing the instant somebody declines to
   * write in would read as the price of saying no.
   */
  const [slot, setSlot] = useState<'feedback' | 'tier' | 'none'>(() =>
    shouldAskForFeedback(loadSettings()) ? 'feedback' : 'tier'
  );

  const share = useCallback(async () => {
    if (!path) return;

    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Nothing to share with', 'This phone has no app that takes a video.');
        return;
      }
      await Sharing.shareAsync(`file://${path}`, { mimeType: 'video/mp4' });
    } catch (error) {
      Alert.alert('That could not be shared', error instanceof Error ? error.message : String(error));
    }
  }, [path]);

  return (
    <Screen>
      <View style={[styles.body, { paddingTop: insets.top + space.huge }]}>
        <View style={styles.check}>
          <Label variant="display" style={styles.tick}>
            ✓
          </Label>
        </View>

        <Label variant="title">Saved to gallery</Label>
        <Label variant="body" tone="mute" style={styles.centre}>
          {name}
          {bytes ? ` · ${describeBytes(Number(bytes))}` : ''}
          {seconds ? ` · rendered in ${seconds}s` : ''}
        </Label>
        {srt ? (
          <Label variant="micro" tone="mute" style={styles.centre}>
            {srt} is in your Downloads
          </Label>
        ) : null}

        <View style={styles.actions}>
          <PrimaryButton title="Share" accent={accent} onPress={share} />
          <QuietButton
            title="Back to editor"
            onPress={() => router.replace({ pathname: '/project/[id]', params: { id: String(id) } })}
          />
          <QuietButton title="Home" onPress={() => router.replace('/')} />
        </View>

        {/* One ask per screen. On the single export where the feedback card is
            due it takes the tier line's place rather than sitting under it:
            stacking a request for help on top of a request for money makes both
            of them read as the same thing, and the unlock nudge is on every other
            export this person will ever make. */}
        {slot === 'feedback' ? <FeedbackCard accent={accent} onAnswered={() => setSlot('none')} /> : null}
        {slot === 'tier' ? (
          /* The count is one lower than it was a moment ago on Export, because a
             free export is spent when the file exists and not before. */
          <FreeTierLine
            tier={tier}
            accent={accent}
            onPress={() => router.push({ pathname: '/unlock', params: { from: 'saved', id: String(id) } })}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', paddingHorizontal: space.lg, gap: space.md },
  check: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: color.good,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  tick: { color: color.good },
  centre: { textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: space.sm, marginTop: space.xl },
});

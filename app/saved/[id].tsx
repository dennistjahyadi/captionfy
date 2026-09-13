/**
 * Saved.
 *
 * The end of the only path that produces a file, so it says where the file went,
 * how big it is, and what is left of the free tier. Three ways on: share it,
 * back to the words, or home for the next clip.
 */
import * as Sharing from 'expo-sharing';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { accentColor, projectStyle } from '../../src/domain';
import { loadEntitlement } from '../../src/policy/entitlement-store';
import { freeTierStatus } from '../../src/policy/free-tier';
import { loadProject } from '../../src/project/store';
import { Label, PrimaryButton, QuietButton, Screen } from '../../src/ui/atoms';
import { describeBytes } from '../../src/ui/describe';
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

        {tier.line === '' ? null : (
          <Label variant="micro" tone="mute">
            {tier.line}
          </Label>
        )}
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

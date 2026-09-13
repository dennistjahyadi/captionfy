/**
 * Export.
 *
 * The last screen before a file exists, and the last place a surprise would be
 * forgivable. What it costs is on Home before the picker and it is here again
 * before the button, so nothing new can appear after the render (invariant 5).
 *
 * Rendering happens through `runExport`, which owns the plan, the foreground
 * service and what counts against the free tier. This screen shows a bar and a
 * way out.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { accentColor, projectStyle, type Project } from '../../src/domain';
import {
  canSaveToGallery,
  cancelExport,
  plannedSize,
  probeSource,
  runExport,
  type ResolutionChoice,
} from '../../src/export/run';
import { loadEntitlement } from '../../src/policy/entitlement-store';
import { freeTierStatus } from '../../src/policy/free-tier';
import { loadProject, thumbnailFile } from '../../src/project/store';
import { createMeasureText } from '../../src/render/measure';
import { useCaptionFonts } from '../../src/render/typefaces';
import { Label, PrimaryButton, ProgressBar, QuietButton, Screen } from '../../src/ui/atoms';
import { describeBytes } from '../../src/ui/describe';
import { useReducedMotion } from '../../src/ui/motion';
import { color, MIN_TOUCH, radius, space } from '../../src/ui/theme';
import type { VideoInfo } from '../../modules/burn-in';

const RESOLUTIONS: ResolutionChoice[] = ['720p', '1080p', 'source'];

export default function Export() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const [project] = useState<Project | null>(() => (id ? loadProject(id) : null));
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [resolution, setResolution] = useState<ResolutionChoice>('1080p');
  const [alsoSrt, setAlsoSrt] = useState(false);
  const [options, setOptions] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [done, setDone] = useState(0);

  const fonts = useCaptionFonts();
  const reducedMotion = useReducedMotion();
  const measure = useMemo(() => (fonts ? createMeasureText(fonts) : null), [fonts]);
  const entitlement = useMemo(() => loadEntitlement(), []);
  const tier = freeTierStatus(entitlement);

  useEffect(() => {
    if (!project) return;
    let alive = true;

    probeSource(project)
      .then((probed) => {
        if (alive) setInfo(probed);
      })
      .catch(() => undefined);

    return () => {
      alive = false;
    };
  }, [project]);

  const save = useCallback(async () => {
    if (!project || !measure || rendering) return;

    // Asked before the render, not after it: a minute of encoding followed by a
    // permission sheet is an export that failed at the last step, and saying no
    // here costs the user nothing.
    if (!(await canSaveToGallery())) {
      Alert.alert(
        'Captionfy cannot reach your gallery',
        'Allow it to save videos in Settings, and the export will land in your gallery.'
      );
      return;
    }

    setRendering(true);
    setDone(0);

    try {
      const outcome = await runExport({
        project,
        measure,
        resolution,
        alsoSrt,
        reducedMotion,
        onProgress: setDone,
      });

      router.replace({
        pathname: '/saved/[id]',
        params: {
          id: project.id,
          name: outcome.video.name,
          bytes: String(outcome.video.byteLength),
          path: outcome.localPath,
          srt: outcome.srt?.name ?? '',
          seconds: String(Math.round(outcome.elapsedMs / 1000)),
        },
      });
    } catch (error) {
      setRendering(false);
      const message = describe(error);
      // Cancelling is not a failure, and an alert saying so would make it feel
      // like one.
      if (!message.toLowerCase().includes('cancel')) {
        Alert.alert('That export did not finish', message);
      }
    }
  }, [alsoSrt, measure, project, reducedMotion, rendering, resolution]);

  if (!project) {
    return (
      <Screen>
        <View style={[styles.empty, { paddingTop: insets.top + space.huge }]}>
          <Label variant="heading">That project is gone</Label>
          <QuietButton title="Back to Home" onPress={() => router.replace('/')} />
        </View>
      </Screen>
    );
  }

  const accent = accentColor(projectStyle(project));
  const size = info ? plannedSize(info, resolution) : null;
  const thumb = thumbnailFile(project.id);

  return (
    <Screen>
      <View style={[styles.bar, { paddingTop: insets.top + space.sm }]}>
        <QuietButton title="Back" onPress={() => router.back()} />
        <Label variant="label" tone="mute">
          Export
        </Label>
        <View style={styles.balance} />
      </View>

      <View style={styles.frame}>
        {thumb.exists ? (
          <Image source={{ uri: thumb.uri }} style={styles.still} resizeMode="contain" />
        ) : null}
      </View>

      <Label variant="label" tone="mute" style={styles.spec}>
        {size ? `${size.width} × ${size.height}` : 'Reading the video'}
        {info ? ` · ${Math.round(info.fps)} fps` : ''} · no watermark
      </Label>

      {rendering ? (
        <View style={styles.progress}>
          <ProgressBar fraction={done} accent={accent} />
          <Label variant="label" tone="mute">
            {Math.round(done * 100)}% · you can leave the app
          </Label>
          <QuietButton title="Cancel" tone="signal" onPress={cancelExport} />
        </View>
      ) : (
        <View style={styles.actions}>
          <PrimaryButton
            title={tier.blocked ? 'Unlock to export' : 'Save to gallery'}
            accent={accent}
            disabled={!measure || !info}
            onPress={tier.blocked ? unlockNotReady : save}
          />

          {tier.line === '' ? null : (
            <Label variant="micro" tone="mute">
              {tier.blocked ? 'Free exports used' : tier.line}
            </Label>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: options }}
            onPress={() => setOptions((open) => !open)}
            style={styles.disclosure}
          >
            <Label variant="label" tone="mute">
              {options ? 'Options ▴' : 'Options ▾'}
            </Label>
          </Pressable>

          {options ? (
            <View style={styles.options}>
              <View style={styles.row}>
                {RESOLUTIONS.map((choice) => (
                  <Pressable
                    key={choice}
                    accessibilityRole="button"
                    accessibilityState={{ selected: choice === resolution }}
                    onPress={() => setResolution(choice)}
                    style={({ pressed }) => [
                      styles.choice,
                      choice === resolution && { borderColor: accent, backgroundColor: color.line },
                      { opacity: pressed ? 0.6 : 1 },
                    ]}
                  >
                    <Label variant="label" tone={choice === resolution ? 'paper' : 'mute'}>
                      {choice}
                    </Label>
                  </Pressable>
                ))}
              </View>

              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: alsoSrt }}
                onPress={() => setAlsoSrt((on) => !on)}
                style={({ pressed }) => [
                  styles.toggle,
                  alsoSrt && { borderColor: accent },
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Label variant="label" tone={alsoSrt ? 'paper' : 'mute'}>
                  Also save .srt
                </Label>
              </Pressable>
            </View>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

/**
 * The store is not wired up until the slice that wires it up.
 *
 * Said plainly rather than hidden behind a disabled button: a button that does
 * nothing is a bug report, and this is a half-built app talking to the person
 * building it.
 */
function unlockNotReady() {
  Alert.alert('Unlocking is not built yet', 'The one-time purchase arrives in a later slice.');
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
  frame: { flex: 1, margin: space.lg, backgroundColor: '#000000', borderRadius: radius.control, overflow: 'hidden' },
  still: { flex: 1 },
  spec: { paddingHorizontal: space.lg },
  actions: { padding: space.lg, gap: space.md, alignItems: 'stretch' },
  progress: { padding: space.lg, gap: space.md },
  disclosure: { minHeight: MIN_TOUCH, justifyContent: 'center' },
  options: { gap: space.md },
  row: { flexDirection: 'row', gap: space.sm },
  choice: {
    flex: 1,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: color.line,
  },
  toggle: {
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: color.line,
  },
  empty: { flex: 1, alignItems: 'center', gap: space.lg },
});

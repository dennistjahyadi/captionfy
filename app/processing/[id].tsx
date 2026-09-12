/**
 * Processing.
 *
 * The video is the hero and it plays with sound while the work happens, because
 * a minute of staring at a progress bar is a minute the user spends deciding
 * whether to leave. Underneath: one determinate bar driven by real audio
 * processed, one short status line, and the transcript arriving as it lands.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { accentColor, projectStyle, projectUnits, type Project } from '../../src/domain';
import { cancelRun, currentRun, startRun, STAGE_LABEL, subscribe, type RunState } from '../../src/asr/runner';
import { loadProject } from '../../src/project/store';
import { Label, ProgressBar, QuietButton, Screen } from '../../src/ui/atoms';
import { color, radius, space } from '../../src/ui/theme';

export default function Processing() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [stored] = useState<Project | null>(() => (id ? loadProject(id) : null));
  const [run, setRun] = useState<RunState | null>(() => currentRun());

  useEffect(() => {
    if (!stored) return;

    const unsubscribe = subscribe((state) => {
      if (state.projectId === stored.id) setRun(state);
    });

    const resume = () => {
      const latest = loadProject(stored.id);
      // Reopening the app on an unfinished project picks up from the last
      // checkpoint rather than starting the clip again.
      if (latest && latest.status !== 'ready') startRun(latest);
    };

    resume();
    // iOS stops at the end of the current chunk when the app leaves the screen,
    // so coming back is what starts the rest of the work.
    const appState = AppState.addEventListener('change', (status) => {
      if (status === 'active') resume();
    });

    return () => {
      unsubscribe();
      appState.remove();
    };
  }, [stored]);

  const project = run?.project ?? stored;

  useEffect(() => {
    // Straight into the editor. No "Done!" interstitial, and `replace` so that
    // going back from the editor lands on Home rather than on a finished bar.
    if (run?.stage === 'ready') router.replace(`/project/${run.project.id}`);
  }, [run?.stage]);

  if (!project) {
    return (
      <Screen>
        <View style={[styles.empty, { paddingTop: insets.top + space.huge }]}>
          <Label variant="heading">That project is gone</Label>
          <QuietButton title="Back to Home" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const accent = accentColor(projectStyle(project));
  const stage = run?.stage ?? (project.status === 'failed' ? 'failed' : 'queued');

  return (
    <Screen>
      <View style={{ paddingTop: insets.top, height: insets.top + windowHeight * 0.5 }}>
        <Preview project={project} />
      </View>

      <View style={styles.status}>
        <ProgressBar fraction={run?.fraction ?? 0} accent={accent} />
        <View style={styles.statusRow}>
          <Label variant="label" tone={stage === 'failed' ? 'signal' : 'mute'}>
            {stage === 'failed' ? (run?.error ?? STAGE_LABEL.failed) : STAGE_LABEL[stage]}
          </Label>
          <Label variant="label" tone="mute">
            {Math.round((run?.fraction ?? 0) * 100)}%
          </Label>
        </View>
        {run?.etaMs !== undefined && stage === 'transcribing' ? (
          <Label variant="micro" tone="mute">
            About {formatSeconds(run.etaMs)} left
          </Label>
        ) : null}
      </View>

      <Transcript project={project} settled={stage === 'ready'} />

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
        {stage === 'ready' ? (
          <QuietButton title="Back to Home" onPress={() => router.back()} />
        ) : (
          <QuietButton
            title="Cancel"
            tone="signal"
            onPress={() => {
              cancelRun();
              router.back();
            }}
          />
        )}
      </View>
    </Screen>
  );
}

/** Tap to play or pause, with sound. Nothing about this screen is muted. */
function Preview({ project }: { project: Project }) {
  const player = useVideoPlayer(project.sourceUri, (instance) => {
    instance.loop = true;
    instance.muted = false;
  });
  const [playing, setPlaying] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={playing ? 'Pause' : 'Play'}
      onPress={() => {
        if (playing) player.pause();
        else player.play();
        setPlaying(!playing);
      }}
      style={styles.preview}
    >
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        nativeControls={false}
      />
      {!playing ? (
        <View style={styles.playHint}>
          <Label variant="label" tone="mute">
            Tap to play
          </Label>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * Lines as they land.
 *
 * The tail is greyed while it is still being worked on, so the user can see the
 * difference between a line that is finished and one that is still arriving.
 * Nothing here is editable until the whole pass is done.
 */
function Transcript({ project, settled }: { project: Project; settled: boolean }) {
  const scroller = useRef<ScrollView>(null);
  const lines = useMemo(() => projectUnits(project), [project]);

  useEffect(() => {
    scroller.current?.scrollToEnd({ animated: true });
  }, [lines.length]);

  if (lines.length === 0) {
    return (
      <View style={styles.transcriptEmpty}>
        <Label variant="label" tone="mute">
          The first words will appear here.
        </Label>
      </View>
    );
  }

  return (
    <ScrollView ref={scroller} style={styles.transcript} contentContainerStyle={styles.transcriptBody}>
      {lines.map((line, index) => (
        <Label
          key={line.words[0].id}
          variant="body"
          tone={!settled && index === lines.length - 1 ? 'mute' : 'paper'}
        >
          {line.words.map((word) => word.text).join(' ')}
        </Label>
      ))}
    </ScrollView>
  );
}

function formatSeconds(ms: number): string {
  const seconds = Math.max(1, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds} s`;
  return `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}

const styles = StyleSheet.create({
  preview: {
    flex: 1,
    width: '100%',
    backgroundColor: '#000000',
    // Never rounded: the export is not rounded either.
    borderRadius: radius.video,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  playHint: { paddingBottom: space.lg },
  status: { paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.sm },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  transcript: { flex: 1, marginTop: space.lg },
  transcriptBody: { paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.sm },
  transcriptEmpty: { flex: 1, paddingHorizontal: space.lg, paddingTop: space.xl },
  footer: {
    borderTopWidth: 1,
    borderTopColor: color.line,
    alignItems: 'center',
    paddingTop: space.sm,
  },
  empty: { flex: 1, alignItems: 'center', gap: space.lg },
});

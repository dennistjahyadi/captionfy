/**
 * Editor, read only.
 *
 * The video is the hero and it plays with sound. Over it sits the caption
 * overlay, drawn from `layoutCaptionFrame` and nothing else, so what is on the
 * preview is what the export will burn in (invariant 2). Under it, the
 * transcript follows the playhead and a tap on any word seeks to it.
 *
 * The screen itself never re-renders while the video plays. One clock reads the
 * player once per frame and the three pieces that follow playback subscribe to
 * it, which is what keeps the video view out of the render loop.
 */
import { useEvent } from 'expo';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { accentColor, type CaptionLine, type Ms, type Project, type Word } from '../../src/domain';
import { CaptionOverlay } from '../../src/render/CaptionOverlay';
import { createFrameSource, type FrameSource } from '../../src/render/frame';
import { createMeasureText } from '../../src/render/measure';
import { useCaptionFonts, type FontLookup } from '../../src/render/typefaces';
import { adoptSource, sourceExists } from '../../src/project/source';
import { deleteProject, loadProject, saveProject, thumbnailFile } from '../../src/project/store';
import { Label, PrimaryButton, QuietButton, Screen } from '../../src/ui/atoms';
import { useClock, type Clock } from '../../src/ui/clock';
import { useReducedMotion } from '../../src/ui/motion';
import { formatClock } from '../../src/ui/time';
import { color, DEFAULT_ACCENT, MIN_TOUCH, radius, space } from '../../src/ui/theme';

/**
 * Shows how many draw lists the overlay produced in the last second.
 *
 * An instrument, not a feature: a preview that drops to fifteen frames a second
 * on the target phone is a caption that lies about when a word lands, and the
 * only way to know is to read the number off a release build.
 */
const SHOW_OVERLAY_FPS = true;

/** What the preview falls back to before it knows the video's shape. */
const DEFAULT_ASPECT = 9 / 16;

/** The share of the screen the video gets. The rest is the transcript. */
const STAGE_SHARE = 0.46;

/** The scrubber redraws at this rate. The overlay gets the rest of the budget. */
const SCRUB_INTERVAL_MS = 100;

/**
 * How far a replacement video's length may differ before the user is warned.
 *
 * The captions are timed to the clip they were made from, so a different take is
 * a transcript that drifts further out of sync the longer it plays.
 */
const RELINK_TOLERANCE_MS = 1000;

export default function Editor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const [project, setProject] = useState<Project | null>(() => (id ? loadProject(id) : null));
  const [missing, setMissing] = useState(false);
  const [relinking, setRelinking] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      const stored = loadProject(id);
      setProject(stored);
      // Checked on every entry rather than once: the file can go away between
      // one visit and the next, which is the whole reason this state exists.
      setMissing(stored !== null && !sourceExists(stored));
    }, [id])
  );

  const player = useVideoPlayer(project?.sourceUri ?? null, (instance) => {
    instance.loop = true;
    instance.muted = false;
  });

  // One read per display frame, shared by the overlay, the scrubber and the
  // transcript. `currentTime` is seconds; everything above this line is integer
  // milliseconds (invariant 7).
  const clock = useClock(useCallback(() => Math.round(player.currentTime * 1000), [player]));
  const playing = useEvent(player, 'playingChange', { isPlaying: player.playing })?.isPlaying ?? false;
  const status = useEvent(player, 'statusChange', { status: player.status })?.status ?? 'idle';

  const fonts = useCaptionFonts();
  const reducedMotion = useReducedMotion();
  const source = useMemo(() => (project ? createFrameSource(project) : null), [project]);
  const info = useSourceInfo(player, project);
  const [fps, setFps] = useState(0);

  const stage = containRect(windowWidth, Math.round(windowHeight * STAGE_SHARE), info.aspect);

  const seekTo = useCallback(
    (tMs: Ms) => {
      player.currentTime = Math.max(0, tMs) / 1000;
    },
    [player]
  );

  /** Writes a new source onto the project and drops what described the old one. */
  const useVideo = useCallback(
    (pickedUri: string) => {
      if (!project) return;

      try {
        const next: Project = { ...project, sourceUri: adoptSource(project.id, pickedUri) };
        // The still on Home was taken from the video that is gone, and its shape
        // is what the preview sizes itself from until the player knows better.
        const thumb = thumbnailFile(project.id);
        if (thumb.exists) thumb.delete();

        saveProject(next);
        setProject(next);
        setMissing(!sourceExists(next));
      } catch (error) {
        Alert.alert('That video could not be used', describe(error));
      }
    },
    [project]
  );

  /**
   * Points the project at the video again.
   *
   * The transcript is the expensive part and it is still here, so a lost file is
   * worth a second pick rather than a second transcription. The project keeps its
   * own copy this time.
   */
  const chooseVideoAgain = useCallback(async () => {
    if (!project) return;
    setRelinking(true);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsMultipleSelection: false,
        quality: 1,
      });
      if (result.canceled) return;

      const picked = result.assets[0];
      const pickedMs = Math.round(picked.duration ?? 0);

      // Asked, not awaited: an Android alert reports a dismissal as well as a
      // button press, so a promise around it cannot tell "Use it anyway" from
      // the dialog closing afterwards. The work happens in the button instead.
      if (pickedMs > 0 && Math.abs(pickedMs - project.durationMs) > RELINK_TOLERANCE_MS) {
        askAboutDifferentLength(project.durationMs, pickedMs, () => useVideo(picked.uri));
        return;
      }

      useVideo(picked.uri);
    } catch (error) {
      Alert.alert('That video could not be opened', describe(error));
    } finally {
      setRelinking(false);
    }
  }, [project, useVideo]);

  const confirmDelete = useCallback(() => {
    if (!project) return;
    Alert.alert('Delete this project?', 'The transcript goes with it. This cannot be undone.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteProject(project.id);
          router.replace('/');
        },
      },
    ]);
  }, [project]);

  if (!project || !source) {
    return (
      <Screen>
        <View style={[styles.empty, { paddingTop: insets.top + space.huge }]}>
          <Label variant="heading">That project is gone</Label>
          <QuietButton title="Back to Home" onPress={() => router.replace('/')} />
        </View>
      </Screen>
    );
  }

  // A black rectangle and a play button that does nothing is the worst way to
  // say this. The transcript is safe and the way back is one pick.
  if (missing) {
    return (
      <Screen>
        <View style={[styles.bar, { paddingTop: insets.top + space.sm }]}>
          <QuietButton title="Back" onPress={() => router.replace('/')} />
        </View>
        <View style={styles.missing}>
          <Label variant="title">Can’t find this video</Label>
          <Label variant="body" tone="mute">
            The file this project was made from is not on the phone any more. Your{' '}
            {project.words.length} words are safe: pick the same video again and the captions come
            back with it.
          </Label>
          <PrimaryButton
            title="Choose the video again"
            onPress={chooseVideoAgain}
            accent={DEFAULT_ACCENT}
            busy={relinking}
          />
          <QuietButton title="Delete project" tone="signal" onPress={confirmDelete} />
        </View>
      </Screen>
    );
  }

  const accent = accentColor(source.style);

  return (
    <Screen>
      <View style={[styles.bar, { paddingTop: insets.top + space.sm }]}>
        <QuietButton title="Back" onPress={() => router.back()} />
        <Label variant="label" tone="mute">
          {formatClock(info.durationMs)} · {project.words.length} words
        </Label>
        <QuietButton
          title="Export"
          onPress={() =>
            Alert.alert('Export is not built yet', 'Burn-in and Export arrive in a later slice.')
          }
        />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playing ? 'Pause' : 'Play'}
        onPress={() => (playing ? player.pause() : player.play())}
        style={[styles.stage, { height: Math.round(windowHeight * STAGE_SHARE) }]}
      >
        <View style={{ width: stage.width, height: stage.height }}>
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            nativeControls={false}
          />
          {fonts ? (
            <CaptionLayer
              source={source}
              clock={clock}
              fonts={fonts}
              width={stage.width}
              height={stage.height}
              reducedMotion={reducedMotion}
              onFps={SHOW_OVERLAY_FPS ? setFps : undefined}
            />
          ) : null}
        </View>
      </Pressable>

      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Pause' : 'Play'}
          onPress={() => (playing ? player.pause() : player.play())}
          style={styles.transport}
        >
          <Label variant="heading">{playing ? '॥' : '▶'}</Label>
        </Pressable>

        <Scrubber clock={clock} durationMs={info.durationMs} accent={accent} onSeek={seekTo} />
      </View>

      {/* A player that will not open the file has to say so. Silence here is a
          play button that does nothing. */}
      {status === 'error' ? (
        <Label variant="micro" tone="signal" style={styles.fps}>
          Couldn’t play this video on this phone. Try another file.
        </Label>
      ) : SHOW_OVERLAY_FPS ? (
        <Label variant="micro" tone="mute" style={styles.fps}>
          overlay {fps} fps
        </Label>
      ) : null}

      <Transcript
        source={source}
        clock={clock}
        accent={accent}
        onPickWord={(word) => seekTo(source.seekTimeFor(word))}
      />
    </Screen>
  );
}

/**
 * The caption overlay, and the only thing on this screen that redraws per frame.
 *
 * The canvas is the video's own rectangle, not the screen's, so a caption a
 * fifth of the way down the preview is a fifth of the way down the exported
 * file whatever the phone's aspect ratio is.
 */
const CaptionLayer = memo(function CaptionLayer({
  source,
  clock,
  fonts,
  width,
  height,
  reducedMotion,
  onFps,
}: {
  source: FrameSource;
  clock: Clock;
  fonts: FontLookup;
  width: number;
  height: number;
  reducedMotion: boolean;
  onFps?: (fps: number) => void;
}) {
  const [tMs, setTMs] = useState(0);
  useEffect(() => clock.subscribe(setTMs), [clock]);

  const measure = useMemo(() => createMeasureText(fonts), [fonts]);
  const canvas = useMemo(() => ({ width, height }), [width, height]);
  const frame = source.frameAt(tMs, canvas, measure, { reducedMotion });

  useDrawCounter(onFps);

  return <CaptionOverlay frame={frame} width={width} height={height} fonts={fonts} />;
});

/** Tap or drag anywhere on the track to seek. */
const Scrubber = memo(function Scrubber({
  clock,
  durationMs,
  accent,
  onSeek,
}: {
  clock: Clock;
  durationMs: Ms;
  accent: string;
  onSeek: (tMs: Ms) => void;
}) {
  const [tMs, setTMs] = useState(0);
  const width = useRef(0);
  const dragging = useRef(false);
  const shown = useRef(0);

  useEffect(
    () =>
      clock.subscribe((next) => {
        // The playhead is a hairline on a sixty second track, so it costs the
        // overlay nothing to move it ten times a second instead of sixty.
        if (dragging.current || Math.abs(next - shown.current) < SCRUB_INTERVAL_MS) return;
        shown.current = next;
        setTMs(next);
      }),
    [clock]
  );

  const seekFromTouch = useCallback(
    (x: number) => {
      if (width.current <= 0 || durationMs <= 0) return;
      const fraction = Math.min(1, Math.max(0, x / width.current));
      const next = Math.round(fraction * durationMs);
      shown.current = next;
      setTMs(next);
      onSeek(next);
    },
    [durationMs, onSeek]
  );

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          dragging.current = true;
          seekFromTouch(event.nativeEvent.locationX);
        },
        onPanResponderMove: (event) => seekFromTouch(event.nativeEvent.locationX),
        onPanResponderRelease: () => {
          dragging.current = false;
        },
        onPanResponderTerminate: () => {
          dragging.current = false;
        },
      }),
    [seekFromTouch]
  );

  const fraction = durationMs > 0 ? Math.min(1, Math.max(0, tMs / durationMs)) : 0;

  return (
    <View style={styles.scrubber}>
      <View
        {...responder.panHandlers}
        onLayout={(event) => {
          width.current = event.nativeEvent.layout.width;
        }}
        style={styles.trackTouch}
      >
        <View style={styles.track}>
          <View style={[styles.trackFill, { width: `${fraction * 100}%`, backgroundColor: accent }]} />
        </View>
      </View>
      <Label variant="micro" tone="mute">
        {formatClock(tMs)} / {formatClock(durationMs)}
      </Label>
    </View>
  );
});

/**
 * The transcript, grouped the way the viewer sees it.
 *
 * One row per display unit, so what is on a line here is what lands on a line on
 * the video. Only the row holding the active word re-renders as playback moves.
 */
const Transcript = memo(function Transcript({
  source,
  clock,
  accent,
  onPickWord,
}: {
  source: FrameSource;
  clock: Clock;
  accent: string;
  onPickWord: (word: Word) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const scroller = useRef<ScrollView>(null);
  const tops = useRef<number[]>([]);

  useEffect(
    () => clock.subscribe((tMs) => setActiveId(source.wordAt(tMs)?.id ?? null)),
    [clock, source]
  );

  const unitOfWord = useMemo(() => {
    const map = new Map<string, number>();
    source.units.forEach((unit) => unit.words.forEach((word) => map.set(word.id, unit.index)));
    return map;
  }, [source]);

  const activeUnit = activeId ? (unitOfWord.get(activeId) ?? -1) : -1;

  useEffect(() => {
    const top = tops.current[activeUnit];
    if (activeUnit < 0 || top === undefined) return;
    // Kept a little below the top edge, so the line being spoken has the line
    // before it in view and does not read as the first thing in the clip.
    scroller.current?.scrollTo({ y: Math.max(0, top - space.huge), animated: true });
  }, [activeUnit]);

  if (source.units.length === 0) {
    return (
      <View style={styles.transcriptEmpty}>
        <Label variant="label" tone="mute">
          This project has no words yet.
        </Label>
      </View>
    );
  }

  return (
    <ScrollView ref={scroller} style={styles.transcript} contentContainerStyle={styles.transcriptBody}>
      {source.units.map((unit) => (
        <UnitRow
          key={unit.words[0].id}
          unit={unit}
          activeId={activeId !== null && unitOfWord.get(activeId) === unit.index ? activeId : null}
          accent={accent}
          onPickWord={onPickWord}
          onTop={(y) => {
            tops.current[unit.index] = y;
          }}
        />
      ))}
    </ScrollView>
  );
});

const UnitRow = memo(function UnitRow({
  unit,
  activeId,
  accent,
  onPickWord,
  onTop,
}: {
  unit: CaptionLine;
  activeId: string | null;
  accent: string;
  onPickWord: (word: Word) => void;
  onTop: (y: number) => void;
}) {
  return (
    <View style={styles.unit} onLayout={(event) => onTop(event.nativeEvent.layout.y)}>
      {unit.words.map((word) => {
        const active = word.id === activeId;
        return (
          <Pressable
            key={word.id}
            accessibilityRole="button"
            onPress={() => onPickWord(word)}
            style={({ pressed }) => [
              styles.chip,
              active && { backgroundColor: accent },
              pressed && !active && { backgroundColor: color.line },
            ]}
          >
            <Label variant="body" style={active ? styles.chipActiveText : undefined}>
              {word.text}
            </Label>
          </Pressable>
        );
      })}
    </View>
  );
});

/**
 * The video's shape and length, from the most trustworthy source available.
 *
 * The thumbnail is a decoded upright still, so it already carries the rotation a
 * phone recording keeps in metadata rather than in its track dimensions. The
 * track is the fallback for a project whose thumbnail never got made.
 */
function useSourceInfo(player: VideoPlayer, project: Project | null) {
  const [aspect, setAspect] = useState(DEFAULT_ASPECT);
  const [durationMs, setDurationMs] = useState(project?.durationMs ?? 0);
  const fromThumbnail = useRef(false);

  useEffect(() => {
    if (!project) return;
    let alive = true;
    setDurationMs(project.durationMs);
    fromThumbnail.current = false;

    const thumb = thumbnailFile(project.id);
    if (thumb.exists) {
      Image.getSize(
        thumb.uri,
        (width, height) => {
          if (!alive || height <= 0) return;
          fromThumbnail.current = true;
          setAspect(width / height);
        },
        () => undefined
      );
    }

    return () => {
      alive = false;
    };
  }, [project]);

  useEffect(() => {
    // The player can finish loading before this effect runs, and `sourceLoad`
    // does not fire again for a listener that arrived late. So the track is read
    // now as well as on every change, and a screen that opens on an already
    // loaded video still knows the shape of it.
    const read = () => {
      if (player.duration > 0) setDurationMs(Math.round(player.duration * 1000));

      const size = player.videoTrack?.size;
      if (!fromThumbnail.current && size && size.width > 0 && size.height > 0) {
        setAspect(size.width / size.height);
      }
    };

    read();
    const onStatus = player.addListener('statusChange', read);
    const onLoad = player.addListener('sourceLoad', read);
    const onTrack = player.addListener('videoTrackChange', read);

    return () => {
      onStatus.remove();
      onLoad.remove();
      onTrack.remove();
    };
  }, [player]);

  return { aspect, durationMs };
}

/** Counts committed draw lists per second. */
function useDrawCounter(report?: (fps: number) => void) {
  const drawn = useRef(0);

  useEffect(() => {
    drawn.current += 1;
  });

  useEffect(() => {
    if (!report) return;
    const handle = setInterval(() => {
      report(drawn.current);
      drawn.current = 0;
    }, 1000);
    return () => clearInterval(handle);
  }, [report]);
}

/**
 * Asks before accepting a replacement of a different length.
 *
 * A different take is not the same clip, and captions timed to the old one drift
 * further out with every second. It is still the user's call: a re-encode or a
 * trimmed second at the end is a length change they may well accept.
 */
function askAboutDifferentLength(projectMs: Ms, pickedMs: Ms, accept: () => void): void {
  Alert.alert(
    'That looks like a different video',
    `The captions are timed to a ${formatClock(projectMs)} clip and this one is ${formatClock(
      pickedMs
    )}. They will not line up.`,
    [
      { text: 'Pick another', style: 'cancel' },
      { text: 'Use it anyway', onPress: accept },
    ]
  );
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** The largest box of `aspect` that fits, which is what `contentFit="contain"` draws. */
function containRect(boxWidth: number, boxHeight: number, aspect: number) {
  const width = boxHeight * aspect;
  return width <= boxWidth
    ? { width: Math.round(width), height: boxHeight }
    : { width: boxWidth, height: Math.round(boxWidth / aspect) };
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.sm,
    paddingBottom: space.sm,
  },
  stage: { backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    gap: space.md,
  },
  transport: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrubber: { flex: 1, gap: space.xs },
  trackTouch: { height: MIN_TOUCH, justifyContent: 'center' },
  track: { height: 4, borderRadius: radius.pill, backgroundColor: color.line, overflow: 'hidden' },
  trackFill: { height: '100%' },
  fps: { paddingHorizontal: space.lg },
  transcript: { flex: 1, marginTop: space.sm },
  transcriptBody: { paddingHorizontal: space.lg, paddingBottom: space.huge, gap: space.xs },
  transcriptEmpty: { flex: 1, paddingHorizontal: space.lg, paddingTop: space.xl },
  unit: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  chip: {
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.control,
    minHeight: MIN_TOUCH,
    justifyContent: 'center',
  },
  chipActiveText: { color: '#111111' },
  empty: { flex: 1, alignItems: 'center', gap: space.lg },
  missing: { flex: 1, paddingHorizontal: space.lg, paddingTop: space.xxl, gap: space.lg },
});

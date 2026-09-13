/**
 * The editor.
 *
 * The video is the hero and it plays with sound. Over it sits the caption
 * overlay, drawn from `layoutCaptionFrame` and nothing else, so what is on the
 * preview is what the export will burn in (invariant 2). Under it, the
 * transcript follows the playhead, and a tap on any word loops that word and
 * opens the sheet that can change it.
 *
 * This file is two screens. `Editor` finds the project and deals with a video
 * that is not there; `Workspace` is the editing surface, and it only exists once
 * there is something to play. Nothing above the pieces that subscribe to the
 * clock re-renders while the video plays, which is what keeps the video view out
 * of the render loop.
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

import {
  accentColor,
  confirmWord,
  createIdFactory,
  deleteWord,
  editWordsText,
  isLowConfidence,
  lowConfidenceCount,
  mergeWords,
  nextLowConfidenceWordId,
  sameHeardWordIds,
  safeZoneUnion,
  setBreakAfter,
  setEmphasis,
  shiftAll,
  styleOverridesFor,
  type CaptionLine,
  type MeasureText,
  type Ms,
  type Project,
  type StyleChoices,
  type Word,
} from '../../src/domain';
import { Sheet } from '../../src/editor/Sheet';
import { ShiftSheet } from '../../src/editor/ShiftSheet';
import { StylePicker } from '../../src/editor/StylePicker';
import { TimingSheet } from '../../src/editor/TimingSheet';
import { WordSheet, type WordFacts, type WordSheetActions } from '../../src/editor/WordSheet';
import { useProjectEditor, type ProjectEditor } from '../../src/editor/useProjectEditor';
import { CaptionOverlay } from '../../src/render/CaptionOverlay';
import { createFrameSource, type FrameSource } from '../../src/render/frame';
import { createMeasureText } from '../../src/render/measure';
import { useCaptionFonts, type FontLookup } from '../../src/render/typefaces';
import { adoptSource, sourceExists } from '../../src/project/source';
import { loadSettings, markCoachCardSeen, rememberStyle } from '../../src/project/settings';
import { deleteProject, loadProject, saveProject, thumbnailFile } from '../../src/project/store';
import { Label, PrimaryButton, QuietButton, Screen } from '../../src/ui/atoms';
import { useClock, type Clock } from '../../src/ui/clock';
import { describeProject, plural } from '../../src/ui/describe';
import { useReducedMotion } from '../../src/ui/motion';
import { formatClock } from '../../src/ui/time';
import { color, DEFAULT_ACCENT, font, MIN_TOUCH, radius, space } from '../../src/ui/theme';

/**
 * Shows how many draw lists the overlay produced in the last second.
 *
 * An instrument, not a feature, and off in what ships: a readout under the
 * scrubber is the sort of thing that survives to the store. Switch it on and
 * rebuild when a preview needs measuring, because a preview that drops to
 * fifteen frames a second on the target phone is a caption that lies about when
 * a word lands, and the only way to know is to read the number off a release
 * build. The counter behind it stays wired either way.
 */
const SHOW_OVERLAY_FPS = false;

/** What the preview falls back to before it knows the video's shape. */
const DEFAULT_ASPECT = 9 / 16;

/** The share of the screen the video gets. The rest is the transcript. */
const STAGE_SHARE = 0.46;

/**
 * What it shrinks to while the style sheet is open.
 *
 * That sheet is the tall one, and the thing it is for sits in the lower third of
 * the frame. A preview with the captions behind the sheet would be asking the
 * user to choose a look they cannot see.
 */
const STAGE_SHARE_STYLING = 0.3;

/** The scrubber redraws at this rate. The overlay gets the rest of the budget. */
const SCRUB_INTERVAL_MS = 100;

/**
 * How far a replacement video's length may differ before the user is warned.
 *
 * The captions are timed to the clip they were made from, so a different take is
 * a transcript that drifts further out of sync the longer it plays.
 */
const RELINK_TOLERANCE_MS = 1000;

/**
 * The run-up and run-out around a word being checked.
 *
 * A word played from its own first millisecond is hard to hear and impossible to
 * judge. Three hundred milliseconds either side is enough context to tell
 * whether the engine heard it right.
 */
const LOOP_PRE_ROLL_MS = 300;
const LOOP_POST_ROLL_MS = 300;

export default function Editor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

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
    Alert.alert(
      'Delete this project?',
      `${describeProject(project)}\n\nThe transcript goes with it. This cannot be undone.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteProject(project.id);
            router.replace('/');
          },
        },
      ]
    );
  }, [project]);

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
            {plural(project.words.length, 'word')} are safe: pick the same video again and the
            captions come back with it.
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

  // Keyed on the source so a relink rebuilds the player and everything under it.
  return <Workspace key={project.sourceUri} stored={project} />;
}

function Workspace({ stored }: { stored: Project }) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const editor = useProjectEditor(stored);
  const project = editor.project;

  const player = useVideoPlayer(project.sourceUri, (instance) => {
    instance.loop = true;
    instance.muted = false;
  });

  // One read per display frame, shared by the overlay, the scrubber, the
  // transcript and the loop. `currentTime` is seconds; everything above this
  // line is integer milliseconds (invariant 7).
  const clock = useClock(useCallback(() => Math.round(player.currentTime * 1000), [player]));
  const playing = useEvent(player, 'playingChange', { isPlaying: player.playing })?.isPlaying ?? false;
  const status = useEvent(player, 'statusChange', { status: player.status })?.status ?? 'idle';

  const fonts = useCaptionFonts();
  // One measurer for the screen, not one per canvas: the preview and the four
  // style tiles have to agree about the width of a word, and two measurers would
  // be two layouts (invariant 2).
  const measure = useMemo(() => (fonts ? createMeasureText(fonts) : null), [fonts]);
  const reducedMotion = useReducedMotion();
  const info = useSourceInfo(player, stored);
  const [fps, setFps] = useState(0);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIndex = selectedId ? project.words.findIndex((word) => word.id === selectedId) : -1;
  const selected = selectedIndex === -1 ? null : project.words[selectedIndex];

  /**
   * What a sheet is proposing, before it is applied.
   *
   * A timing draft and a shift draft are both whole projects, so the preview is
   * the same object the editor would have produced and the overlay, the
   * transcript and the loop all see the change without any of them learning what
   * a draft is. Nothing here is written to disk: cancelling drops it.
   */
  const [preview, setPreview] = useState<Project | null>(null);
  const [timingId, setTimingId] = useState<string | null>(null);
  const [shiftLine, setShiftLine] = useState<{ startMs: Ms; endMs: Ms } | null>(null);
  const [styling, setStyling] = useState(false);

  const shown = preview ?? project;
  const source = useMemo(() => createFrameSource(shown), [shown]);
  const timingWord = timingId ? (project.words.find((word) => word.id === timingId) ?? null) : null;

  const stageHeight = Math.round(windowHeight * (styling ? STAGE_SHARE_STYLING : STAGE_SHARE));
  const stage = containRect(windowWidth, stageHeight, info.aspect);
  const toCheck = lowConfidenceCount(project);

  // Ids for words an edit has to invent. One factory per visit to the editor,
  // prefixed with the time, so a split can never hand out an id a previous
  // session already used in this project.
  const newId = useMemo(() => createIdFactory(`e${Date.now().toString(36)}x`), [project.id]);

  const seekTo = useCallback(
    (tMs: Ms) => {
      player.currentTime = Math.max(0, tMs) / 1000;
    },
    [player]
  );

  const loop = useRef<{ startMs: Ms; endMs: Ms } | null>(null);
  /** The last clock reading, for the sheets that need to know where we are. */
  const now = useRef(0);

  useEffect(
    () =>
      clock.subscribe((tMs) => {
        now.current = tMs;
        const window = loop.current;
        // Only the far edge re-seeks. Reacting to the near edge as well would
        // fight the seek that has just been asked for and has not landed yet.
        if (window && tMs > window.endMs) seekTo(window.startMs);
      }),
    [clock, seekTo]
  );

  /**
   * Plays a span over and over, with the run-up and run-out around it.
   *
   * Every editing surface listens to what it is about to change, so every one of
   * them comes through here and the pre-roll is the same wherever you are.
   */
  const loopSpan = useCallback(
    (startMs: Ms, endMs: Ms) => {
      loop.current = {
        startMs: Math.max(0, startMs - LOOP_PRE_ROLL_MS),
        endMs: endMs + LOOP_POST_ROLL_MS,
      };
      seekTo(loop.current.startMs);
      player.play();
    },
    [player, seekTo]
  );

  const stopLoop = useCallback(() => {
    loop.current = null;
  }, []);

  const offsetMs = project.globalOffsetMs;

  /** Loops a word and opens its sheet. The two always happen together. */
  const openWord = useCallback(
    (word: Word) => {
      loopSpan(word.start + offsetMs, word.end + offsetMs);
      setSelectedId(word.id);
    },
    [loopSpan, offsetMs]
  );

  const closeWord = useCallback(() => {
    stopLoop();
    setSelectedId(null);
  }, [stopLoop]);

  /** The chip walks forward through the words the engine was unsure about. */
  const checkNext = useCallback(() => {
    const next = nextLowConfidenceWordId(project, selectedId ?? undefined);
    const word = next ? project.words.find((entry) => entry.id === next) : undefined;
    if (word) openWord(word);
  }, [openWord, project, selectedId]);

  /**
   * A timing draft: preview it, and play it if the sheet is listening.
   *
   * The draft is never written. What is on the video while the sheet is open is
   * the same draw list the export would make of it, which is the only way to tell
   * whether a boundary is right.
   */
  const onTimingChange = useCallback(
    (words: Word[], looping: boolean) => {
      setPreview({ ...project, words });

      const drafted = words.find((word) => word.id === timingId);
      if (!drafted) return;
      if (looping) loopSpan(drafted.start + offsetMs, drafted.end + offsetMs);
      else stopLoop();
    },
    [loopSpan, offsetMs, project, stopLoop, timingId]
  );

  /**
   * Commits the draft as one undo step.
   *
   * The draft is taken whole rather than rebuilt from two numbers, because a
   * handle on a shared edge moved the neighbour as well and applying only the
   * word's own times would clamp the boundary straight back. What may have moved
   * is the word and the two either side of it, and `editTiming` refuses anything
   * that reached further.
   */
  const applyTiming = useCallback(
    (words: Word[]) => {
      const index = project.words.findIndex((word) => word.id === timingId);
      if (index === -1) return;

      const moving = [project.words[index - 1], project.words[index], project.words[index + 1]]
        .filter((word): word is Word => word !== undefined)
        .map((word) => word.id);

      editor.editTiming('Timing', () => words, moving);
      setPreview(null);
      setTimingId(null);
    },
    [editor, project.words, timingId]
  );

  /** Backing out of the timing sheet drops the draft and listens to the word again. */
  const closeTiming = useCallback(() => {
    setPreview(null);
    setTimingId(null);
    if (timingWord) loopSpan(timingWord.start + offsetMs, timingWord.end + offsetMs);
  }, [loopSpan, offsetMs, timingWord]);

  /**
   * Opens shift-all on the line that is on screen.
   *
   * An offset is judged against a line you can hear, not against a number, and
   * the line under the playhead is the one the user was looking at when they
   * decided the captions were late.
   */
  const openShift = useCallback(() => {
    const line = source.lineAt(now.current) ?? source.units[0];
    if (!line) return;
    setShiftLine({ startMs: line.startMs, endMs: line.endMs });
  }, [source]);

  const onShiftChange = useCallback(
    (nextOffsetMs: Ms) => {
      setPreview({ ...project, globalOffsetMs: nextOffsetMs });
      if (shiftLine) loopSpan(shiftLine.startMs + nextOffsetMs, shiftLine.endMs + nextOffsetMs);
    },
    [loopSpan, project, shiftLine]
  );

  const applyShift = useCallback(
    (nextOffsetMs: Ms) => {
      editor.editProject('Shift captions', (current) =>
        shiftAll(current, nextOffsetMs - current.globalOffsetMs)
      );
      setPreview(null);
      setShiftLine(null);
      stopLoop();
    },
    [editor, stopLoop]
  );

  const closeShift = useCallback(() => {
    setPreview(null);
    setShiftLine(null);
    stopLoop();
  }, [stopLoop]);

  /**
   * Opens the style sheet on the line that is on screen, and loops it.
   *
   * Four presets side by side are only comparable on the same words, and the
   * words the user was looking at are the ones they want to see in each.
   */
  const openStyle = useCallback(() => {
    const line = source.lineAt(now.current) ?? source.units[0];
    if (line) loopSpan(line.startMs + offsetMs, line.endMs + offsetMs);
    setStyling(true);
  }, [loopSpan, offsetMs, source]);

  /**
   * A style change: live, and not an undo step.
   *
   * Applied through `restyle`, which puts it on every snapshot in the history as
   * well as on the present, so undoing a word edit later cannot take the look
   * back with it.
   */
  const onStyleChange = useCallback(
    (styleId: string, choices: StyleChoices) => {
      editor.restyle((current) => ({
        ...current,
        styleId,
        styleOverrides: styleOverridesFor(styleId, choices),
      }));
    },
    [editor]
  );

  const closeStyle = useCallback(() => {
    setStyling(false);
    stopLoop();
    // Remembered on the way out rather than on every tap: what the user settled
    // on is the style the next project should start in, not everything they
    // looked at on the way there.
    rememberStyle(project.styleId, project.styleOverrides);
  }, [project.styleId, project.styleOverrides, stopLoop]);

  const accent = accentColor(source.style);

  return (
    <Screen>
      <View style={[styles.bar, { paddingTop: insets.top + space.sm }]}>
        <QuietButton title="Back" onPress={() => router.back()} />
        <Label variant="label" tone="mute">
          {formatClock(info.durationMs)} · {plural(project.words.length, 'word')}
        </Label>
        <QuietButton
          title="Export"
          onPress={() => router.push({ pathname: '/export/[id]', params: { id: project.id } })}
        />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playing ? 'Pause' : 'Play'}
        onPress={() => (playing ? player.pause() : player.play())}
        style={[styles.stage, { height: stageHeight }]}
      >
        <View style={{ width: stage.width, height: stage.height }}>
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            nativeControls={false}
          />
          {fonts && measure ? (
            <CaptionLayer
              source={source}
              clock={clock}
              fonts={fonts}
              measure={measure}
              width={stage.width}
              height={stage.height}
              reducedMotion={reducedMotion}
              onFps={SHOW_OVERLAY_FPS ? setFps : undefined}
            />
          ) : null}

          {/* Only while the style sheet is open. A permanent overlay would be a
              set of crop marks on somebody's video. */}
          {styling ? <SafeZone /> : null}
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

        <Scrubber
          clock={clock}
          durationMs={info.durationMs}
          accent={accent}
          onSeek={(tMs) => {
            // Scrubbing by hand is the end of the loop: the user has said where
            // they want to be.
            loop.current = null;
            seekTo(tMs);
          }}
        />
      </View>

      <View style={styles.toolbar}>
        {toCheck > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${toCheck} words to check`}
            onPress={checkNext}
            style={({ pressed }) => [styles.chip, { borderColor: accent, opacity: pressed ? 0.6 : 1 }]}
          >
            <Label variant="label">{toCheck} to check</Label>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Style"
          onPress={openStyle}
          style={({ pressed }) => [styles.chip, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Label variant="label" tone="mute">
            Style
          </Label>
        </Pressable>

        {/* A plain chip rather than the spec's overflow menu: Rename and Delete
            join it in a later slice, and one item is not a menu. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Shift all captions"
          onPress={openShift}
          style={({ pressed }) => [styles.chip, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Label variant="label" tone="mute">
            Shift all
          </Label>
        </Pressable>

        <View style={styles.toolbarRight}>
          <StepButton
            label="↶"
            accessibilityLabel={editor.undoLabel ? `Undo ${editor.undoLabel}` : 'Undo'}
            disabled={!editor.canUndo}
            onPress={editor.undo}
          />
          <StepButton
            label="↷"
            accessibilityLabel={editor.redoLabel ? `Redo ${editor.redoLabel}` : 'Redo'}
            disabled={!editor.canRedo}
            onPress={editor.redo}
          />
        </View>
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
        selectedId={selectedId}
        onPickWord={openWord}
      />

      {/* One sheet, whose contents change. Timing opens over the word sheet and
          hands the word back to it, so cancelling lands where it was opened from.
          They share a `Sheet` because unmounting one Modal in the same commit
          that mounts another leaves Android showing neither. */}
      {timingWord || selected || shiftLine || styling ? (
        <Sheet
          onClose={
            timingWord ? closeTiming : selected ? closeWord : shiftLine ? closeShift : closeStyle
          }
        >
          {timingWord ? (
            <TimingSheet
              word={timingWord}
              words={project.words}
              envelope={editor.envelope()}
              offsetMs={offsetMs}
              accent={accent}
              clock={clock}
              onChange={onTimingChange}
              onApply={applyTiming}
              onClose={closeTiming}
            />
          ) : selected ? (
            <WordSheet
              word={selected}
              accent={accent}
              facts={factsFor(project, selected, selectedIndex)}
              actions={actionsFor(editor, selected, selectedIndex, newId, closeWord, setTimingId)}
              onClose={closeWord}
            />
          ) : shiftLine ? (
            <ShiftSheet
              project={project}
              accent={accent}
              onChange={onShiftChange}
              onApply={applyShift}
              onClose={closeShift}
            />
          ) : fonts && measure ? (
            <StylePicker
              project={project}
              aspect={info.aspect}
              fonts={fonts}
              measure={measure}
              clock={clock}
              reducedMotion={reducedMotion}
              onChange={onStyleChange}
              onClose={closeStyle}
            />
          ) : null}
        </Sheet>
      ) : (
        <CoachCard toCheck={toCheck} onShowMe={checkNext} />
      )}
    </Screen>
  );
}

/** What the sheet says about the word, worked out where the project is. */
function factsFor(project: Project, word: Word, index: number): WordFacts {
  return {
    lowConfidence: isLowConfidence(word),
    emphasised: word.emphasis === 'on' || (word.emphasis !== 'off' && project.autoEmphasis.includes(word.id)),
    emphasisAutomatic: word.emphasis === undefined,
    fromDictionary: word.origin === 'dictionary',
    sameHeardCount: sameHeardWordIds(project.words, word.id).length,
    hasNext: index >= 0 && index < project.words.length - 1,
  };
}

/**
 * What each action on the sheet means.
 *
 * Every one of them is a domain function and one undo step. Invariant 1 is the
 * reason none of them moves a word's start or end: the one action here that can
 * is Timing, and all it does is open the sheet that owns that question.
 */
function actionsFor(
  editor: ProjectEditor,
  word: Word,
  index: number,
  newId: () => string,
  onRemoved: () => void,
  onTiming: (id: string) => void
): WordSheetActions {
  const project = editor.project;

  return {
    openTiming() {
      onTiming(word.id);
    },

    setText(text, alsoTheSameHeard) {
      const ids = alsoTheSameHeard
        ? [word.id, ...sameHeardWordIds(project.words, word.id)]
        : [word.id];
      editor.edit(
        ids.length > 1 ? `Fix ${ids.length} words` : 'Edit word',
        (words) => editWordsText(words, ids, text, newId),
        ids
      );
    },

    joinWithNext() {
      const next = project.words[index + 1];
      if (!next) return;
      editor.edit('Join words', (words) => mergeWords(words, [word.id, next.id]), [word.id]);
    },

    setEmphasis(on) {
      editor.edit(
        on ? 'Make big' : 'Make normal',
        (words) => setEmphasis(words, word.id, on ? 'on' : 'off'),
        [word.id]
      );
    },

    confirm() {
      editor.edit('Looks right', (words) => confirmWord(words, word.id), [word.id]);
    },

    toggleLineBreak() {
      const breakAfter = word.breakAfter === 'line' ? 'auto' : 'line';
      editor.edit('Line break', (words) => setBreakAfter(words, word.id, breakAfter), [word.id]);
    },

    remove() {
      editor.edit('Delete word', (words) => deleteWord(words, word.id), [word.id]);
      onRemoved();
    },
  };
}

/**
 * The one coach card.
 *
 * Shown on the first project that has anything to check and never again, because
 * a dotted underline is not self-explanatory the first time and is obvious the
 * second. Not shown at all if the engine was sure about everything: a tip about
 * words to check, on a transcript with none, teaches the wrong thing.
 */
function CoachCard({ toCheck, onShowMe }: { toCheck: number; onShowMe: () => void }) {
  const [show, setShow] = useState(() => toCheck > 0 && !loadSettings().coachCardSeen);

  const dismiss = useCallback(() => {
    setShow(false);
    markCoachCardSeen();
  }, []);

  if (!show || toCheck === 0) return null;

  return (
    <Pressable accessibilityRole="button" style={styles.coach} onPress={dismiss}>
      <Label variant="body">
        Dotted words are ones the engine wasn’t sure about. Tap one to fix it.
      </Label>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          dismiss();
          onShowMe();
        }}
        style={styles.coachAction}
      >
        <Label variant="label">Show me</Label>
      </Pressable>
    </Pressable>
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
  measure,
  width,
  height,
  reducedMotion,
  onFps,
}: {
  source: FrameSource;
  clock: Clock;
  fonts: FontLookup;
  measure: MeasureText;
  width: number;
  height: number;
  reducedMotion: boolean;
  onFps?: (fps: number) => void;
}) {
  const [tMs, setTMs] = useState(0);
  useEffect(() => clock.subscribe(setTMs), [clock]);

  const canvas = useMemo(() => ({ width, height }), [width, height]);
  const frame = source.frameAt(tMs, canvas, measure, { reducedMotion });

  useDrawCounter(onFps);

  return <CaptionOverlay frame={frame} width={width} height={height} fonts={fonts} />;
});

/**
 * What all three platforms leave uncovered, dashed over the preview.
 *
 * Fractions of the frame, so it lands in the same place on the export, and drawn
 * over the video rather than over the stage: the letterbox is not part of
 * anybody's post. A warning and not a rule — a caption is allowed to sit outside
 * it, and some of them should.
 */
function SafeZone() {
  const zone = safeZoneUnion();

  return (
    <View
      pointerEvents="none"
      style={[
        styles.safeZone,
        {
          top: `${zone.top * 100}%`,
          bottom: `${zone.bottom * 100}%`,
          left: `${zone.left * 100}%`,
          right: `${zone.right * 100}%`,
        },
      ]}
    />
  );
}

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
  selectedId,
  onPickWord,
}: {
  source: FrameSource;
  clock: Clock;
  accent: string;
  selectedId: string | null;
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
          selectedId={selectedId}
          emphasisIds={source.emphasisIds}
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
  selectedId,
  emphasisIds,
  accent,
  onPickWord,
  onTop,
}: {
  unit: CaptionLine;
  activeId: string | null;
  selectedId: string | null;
  emphasisIds: ReadonlySet<string>;
  accent: string;
  onPickWord: (word: Word) => void;
  onTop: (y: number) => void;
}) {
  return (
    <View style={styles.unit} onLayout={(event) => onTop(event.nativeEvent.layout.y)}>
      {unit.words.map((word) => {
        const active = word.id === activeId;
        // Invariant 6: the dotted underline is a transcript mark. It is not in
        // the draw list, so it cannot reach the preview or the export.
        const unsure = isLowConfidence(word);

        return (
          <Pressable
            key={word.id}
            accessibilityRole="button"
            accessibilityLabel={unsure ? `${word.text}, not sure about this one` : word.text}
            onPress={() => onPickWord(word)}
            style={({ pressed }) => [
              styles.chipWord,
              active && { backgroundColor: accent },
              !active && word.id === selectedId && { borderColor: accent },
              pressed && !active && { backgroundColor: color.line },
            ]}
          >
            <View style={[styles.wordUnderline, unsure && styles.unsure]}>
              <Label
                variant="body"
                style={[
                  emphasisIds.has(word.id) && styles.emphasised,
                  active && styles.onAccent,
                ]}
              >
                {word.text}
              </Label>
            </View>
            {word.origin === 'dictionary' ? (
              <View style={[styles.dictionaryMark, { backgroundColor: accent }]} />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
});

function StepButton({
  label,
  accessibilityLabel,
  disabled,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.step, { opacity: disabled ? 0.3 : pressed ? 0.6 : 1 }]}
    >
      <Label variant="heading" tone={disabled ? 'mute' : 'paper'}>
        {label}
      </Label>
    </Pressable>
  );
}

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
  safeZone: {
    position: 'absolute',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: color.signal,
    borderRadius: radius.control,
  },
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
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    minHeight: MIN_TOUCH,
  },
  chip: {
    minHeight: MIN_TOUCH,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  toolbarRight: { flexDirection: 'row', gap: space.sm, marginLeft: 'auto' },
  step: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fps: { paddingHorizontal: space.lg },
  transcript: { flex: 1, marginTop: space.sm },
  transcriptBody: { paddingHorizontal: space.lg, paddingBottom: space.huge, gap: space.xs },
  transcriptEmpty: { flex: 1, paddingHorizontal: space.lg, paddingTop: space.xl },
  unit: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  chipWord: {
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: 'transparent',
    minHeight: MIN_TOUCH,
    justifyContent: 'center',
  },
  wordUnderline: { borderBottomWidth: 0, borderColor: color.mute },
  /** Dotted, neutral, and only here: low confidence never reaches the video. */
  unsure: { borderBottomWidth: 2, borderStyle: 'dotted' },
  emphasised: { fontFamily: font.bold },
  onAccent: { color: '#111111' },
  dictionaryMark: {
    position: 'absolute',
    top: space.xs,
    right: space.xs,
    width: 4,
    height: 4,
    borderRadius: radius.pill,
  },
  coach: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    bottom: space.xl,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.sheet,
    padding: space.lg,
    gap: space.sm,
  },
  coachAction: { minHeight: MIN_TOUCH, justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', gap: space.lg },
  missing: { flex: 1, paddingHorizontal: space.lg, paddingTop: space.xxl, gap: space.lg },
});

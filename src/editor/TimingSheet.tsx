/**
 * The timing sheet.
 *
 * The one surface where a word's start and end move. It shows a second of the
 * clip either side of the word, drawn from the envelope ASR already produced, and
 * it loops what it is about to commit, because the question "does this word start
 * here" is answered by ear and never by reading a number.
 *
 * Nothing in here writes to the project. The draft is this component's own state
 * until Apply, so backing out costs nothing, and one visit is one undo step
 * however many times a handle moved. Every move goes through `nudgeWord`, so the
 * clamping a handle stops against is the same clamping the steppers obey and the
 * same one the unit tests prove.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, View } from 'react-native';

import {
  nudgeWord,
  NUDGE_STEP_MS,
  peaksForRange,
  type Ms,
  type NudgeEdge,
  type Word,
} from '../domain';
import { Label } from '../ui/atoms';
import type { Clock } from '../ui/clock';
import { color, MIN_TOUCH, radius, space } from '../ui/theme';
import { formatPrecise } from '../ui/time';
import { RepeatButton, SheetAction } from './Sheet';
import { msPerPixel, timingWindow, wordsInWindow, xForMs, type TimingWindow } from './timingWindow';

/** Half the hit area each handle gets, so the two of them are 44 pt wide. */
const GRAB_PX = 22;

/** The waveform strip. Tall enough to read an attack, short enough to leave room. */
const WAVE_HEIGHT = 96;

/** One bar per this many pixels. Denser than this is noise at this height. */
const BAR_PITCH_PX = 4;

/**
 * The quietest window the waveform will scale to full height.
 *
 * Without a floor, a window holding nothing but room tone would draw that room
 * tone as a full-height waveform and the user would go looking for a word in it.
 */
const WAVE_FLOOR = 0.02;

/** Below this the playhead has not moved enough to be worth a re-render. */
const PLAYHEAD_STEP_PX = 2;

export interface TimingSheetProps {
  /** The word as it is committed. The window is fixed around this. */
  word: Word;
  /** The whole transcript, which is what every move is clamped against. */
  words: Word[];
  /** `envelope.f32`, or null for a project transcribed before it existed. */
  envelope: Float32Array | null;
  /** The caption offset: the word is heard at `start + offsetMs` in the video. */
  offsetMs: Ms;
  accent: string;
  clock: Clock;
  /** A discrete change: a stepper tap, or a handle let go of. */
  onChange(words: Word[], looping: boolean): void;
  /** The whole draft: a shared boundary moved a neighbour too. */
  onApply(words: Word[]): void;
  onClose(): void;
}

export function TimingSheet({
  word,
  words,
  envelope,
  offsetMs,
  accent,
  clock,
  onChange,
  onApply,
  onClose,
}: TimingSheetProps) {
  // Two drafts: `draft` is what would be applied, `live` is what the finger is
  // currently doing. Separating them is what keeps the preview and the loop off
  // the drag itself, where they would re-seek the player sixty times a second and
  // re-lay out the transcript under the sheet along with it.
  const [draftWords, setDraftWords] = useState(words);
  const [live, setLive] = useState<Word[] | null>(null);
  const [looping, setLooping] = useState(true);
  const [width, setWidth] = useState(0);

  const window = useMemo(() => timingWindow(word), [word.id]);
  const shown = live ?? draftWords;
  const draft = shown.find((entry) => entry.id === word.id) ?? word;

  // The logic reads refs rather than state: a stepper announces itself when the
  // finger comes up, and whether React has re-rendered by then is not something
  // the loop should depend on. State is here to draw with.
  const held = useRef<{ edge: NudgeEdge; from: Word[] } | null>(null);
  const drafted = useRef(words);
  const liveDraft = useRef<Word[] | null>(null);
  const loopingNow = useRef(true);
  const view = useRef({ width: 0, window });
  view.current = { width, window };

  const announce = useRef(onChange);
  announce.current = onChange;

  /** One change, once: the parent previews it and loops it. */
  const publish = useCallback(() => {
    announce.current(drafted.current, loopingNow.current);
  }, []);

  // Opening the sheet is itself a change to announce: it is what starts the loop
  // on the word the user came here to listen to.
  useEffect(() => {
    publish();
  }, [publish]);

  const step = useCallback(
    (edge: NudgeEdge, deltaMs: Ms) => {
      drafted.current = nudgeWord(drafted.current, word.id, edge, deltaMs);
      setDraftWords(drafted.current);
    },
    [word.id]
  );

  const toggleLoop = useCallback(() => {
    loopingNow.current = !loopingNow.current;
    setLooping(loopingNow.current);
    publish();
  }, [publish]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,

        onPanResponderGrant: (event) => {
          const { width: stripWidth, window: strip } = view.current;
          const from = drafted.current;
          const at = from.find((entry) => entry.id === word.id);
          if (stripWidth <= 0 || !at) return;

          const edge = edgeUnder(
            event.nativeEvent.locationX,
            xForMs(at.start, strip, stripWidth),
            xForMs(at.end, strip, stripWidth)
          );
          held.current = edge ? { edge, from } : null;
        },

        onPanResponderMove: (_event, gesture) => {
          const grabbed = held.current;
          const { width: stripWidth, window: strip } = view.current;
          if (!grabbed || stripWidth <= 0) return;

          // Measured from where the finger went down rather than accumulated per
          // move, so dragging out past a clamp and back lands where the finger is
          // and not wherever the clamped steps added up to.
          const deltaMs = Math.round(gesture.dx * msPerPixel(strip, stripWidth));
          liveDraft.current = nudgeWord(grabbed.from, word.id, grabbed.edge, deltaMs);
          setLive(liveDraft.current);
        },

        onPanResponderRelease: () => settle(),
        onPanResponderTerminate: () => settle(),
      }),
    [word.id]
  );

  /** The finger came up: the drag becomes the draft, and the draft is announced. */
  function settle() {
    const grabbed = held.current;
    const moved = liveDraft.current;
    held.current = null;
    liveDraft.current = null;
    setLive(null);

    if (grabbed && moved) {
      drafted.current = moved;
      setDraftWords(moved);
    }
    publish();
  }

  // Taken from the draft rather than from the committed words: a handle on a
  // shared edge moves the neighbour, and a wall that stayed where it was would be
  // telling the user their drag had not happened.
  const neighbours = useMemo(
    () => wordsInWindow(shown, window).filter((entry) => entry.id !== word.id),
    [shown, window, word.id]
  );

  const left = xForMs(draft.start, window, width);
  const right = xForMs(draft.end, window, width);

  return (
    <>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Label variant="title">Timing</Label>
          <Label variant="label" tone="mute">
            {formatPrecise(draft.start)} → {formatPrecise(draft.end)} · {draft.end - draft.start} ms
          </Label>
        </View>
        <SheetAction label="Apply" onPress={() => onApply(shown)} tone="accent" accent={accent} />
      </View>

      <View
        {...responder.panHandlers}
        onLayout={(event) => setWidth(Math.round(event.nativeEvent.layout.width))}
        style={styles.strip}
      >
        {width > 0 ? (
          <>
            {neighbours.map((entry) => (
              <View
                key={entry.id}
                pointerEvents="none"
                style={[
                  styles.neighbour,
                  {
                    left: xForMs(entry.start, window, width),
                    // A pixel short of its own end, so two words that touch are
                    // two blocks rather than one long band.
                    width: Math.max(1, xForMs(entry.end, window, width) - xForMs(entry.start, window, width) - 1),
                  },
                ]}
              />
            ))}

            <Waveform envelope={envelope} window={window} width={width} />

            <View
              pointerEvents="none"
              style={[styles.span, { left, width: Math.max(2, right - left), backgroundColor: `${accent}33` }]}
            />
            <Handle x={left} accent={accent} />
            <Handle x={right} accent={accent} />

            <Playhead clock={clock} window={window} width={width} offsetMs={offsetMs} accent={accent} />
          </>
        ) : null}
      </View>

      <View style={styles.steppers}>
        <StepperRow label="Start" edge="start" onStep={step} onSettle={publish} />
        <StepperRow label="End" edge="end" onStep={step} onSettle={publish} />
        <StepperRow label="Move" edge="both" onStep={step} onSettle={publish} />
      </View>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: looping }}
          accessibilityLabel="Loop this word"
          onPress={toggleLoop}
          style={({ pressed }) => [
            styles.loop,
            looping && { borderColor: accent },
            { opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Label variant="label" tone={looping ? 'paper' : 'mute'}>
            {looping ? 'Looping' : 'Loop'}
          </Label>
        </Pressable>

        <SheetAction label="Cancel" onPress={onClose} tone="quiet" accent={accent} />
      </View>
    </>
  );
}

/** Which edge a touch at `x` has taken hold of, or the body of the word. */
function edgeUnder(x: number, xStart: number, xEnd: number): NudgeEdge | null {
  const toStart = Math.abs(x - xStart);
  const toEnd = Math.abs(x - xEnd);

  if (Math.min(toStart, toEnd) <= GRAB_PX) return toStart <= toEnd ? 'start' : 'end';
  return x > xStart && x < xEnd ? 'both' : null;
}

function StepperRow({
  label,
  edge,
  onStep,
  onSettle,
}: {
  label: string;
  edge: NudgeEdge;
  onStep: (edge: NudgeEdge, deltaMs: Ms) => void;
  onSettle: () => void;
}) {
  return (
    <View style={styles.stepperRow}>
      <Label variant="label" tone="mute" style={styles.stepperLabel}>
        {label}
      </Label>
      <RepeatButton
        label={`−${NUDGE_STEP_MS} ms`}
        accessibilityLabel={`${label} ${NUDGE_STEP_MS} milliseconds earlier`}
        onStep={() => onStep(edge, -NUDGE_STEP_MS)}
        onSettle={onSettle}
      />
      <RepeatButton
        label={`+${NUDGE_STEP_MS} ms`}
        accessibilityLabel={`${label} ${NUDGE_STEP_MS} milliseconds later`}
        onStep={() => onStep(edge, NUDGE_STEP_MS)}
        onSettle={onSettle}
      />
    </View>
  );
}

/** A grab bar. Wider than a hairline so it can be seen, and 44 pt to the touch. */
function Handle({ x, accent }: { x: number; accent: string }) {
  return (
    <View pointerEvents="none" style={[styles.handle, { left: x - 1.5 }]}>
      <View style={[styles.handleBar, { backgroundColor: accent }]} />
      <View style={[styles.handleKnob, { backgroundColor: accent }]} />
    </View>
  );
}

/**
 * The window's own waveform, from the envelope ASR already produced.
 *
 * Memoised on the window, not on the draft: the audio does not change while the
 * handles move, and re-laying a hundred bars out per drag frame is the one thing
 * on this sheet that could cost the preview its frame rate.
 */
const Waveform = memo(function Waveform({
  envelope,
  window,
  width,
}: {
  envelope: Float32Array | null;
  window: TimingWindow;
  width: number;
}) {
  const peaks = useMemo(() => {
    if (!envelope) return null;
    return peaksForRange(envelope, window.fromMs, window.toMs, Math.max(1, Math.floor(width / BAR_PITCH_PX)));
  }, [envelope, window, width]);

  if (!peaks) {
    return (
      <View pointerEvents="none" style={styles.noWave}>
        <Label variant="micro" tone="mute">
          No waveform for this project. The steppers and the loop still work.
        </Label>
      </View>
    );
  }

  const loudest = peaks.reduce((high, peak) => Math.max(high, peak), 0);
  const scale = Math.max(WAVE_FLOOR, loudest);

  return (
    <View pointerEvents="none" style={styles.bars}>
      {Array.from(peaks).map((peak, index) => (
        <View key={index} style={[styles.bar, { height: Math.max(2, (peak / scale) * WAVE_HEIGHT) }]} />
      ))}
    </View>
  );
});

/**
 * Where the player is, inside the window.
 *
 * The word is heard at `start + offsetMs`, so the playhead comes back through the
 * offset to the words' own clock, which is the clock the window is drawn in.
 */
const Playhead = memo(function Playhead({
  clock,
  window,
  width,
  offsetMs,
  accent,
}: {
  clock: Clock;
  window: TimingWindow;
  width: number;
  offsetMs: Ms;
  accent: string;
}) {
  const [x, setX] = useState<number | null>(null);
  const shown = useRef(0);

  useEffect(
    () =>
      clock.subscribe((tMs) => {
        const at = tMs - offsetMs;
        if (at < window.fromMs || at > window.toMs) {
          if (shown.current !== -1) {
            shown.current = -1;
            setX(null);
          }
          return;
        }

        const next = xForMs(at, window, width);
        if (Math.abs(next - shown.current) < PLAYHEAD_STEP_PX) return;
        shown.current = next;
        setX(next);
      }),
    [clock, window, width, offsetMs]
  );

  if (x === null) return null;
  return <View pointerEvents="none" style={[styles.playhead, { left: x, backgroundColor: accent }]} />;
});

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  headerText: { flex: 1, gap: space.xs },
  strip: {
    height: WAVE_HEIGHT,
    borderRadius: radius.control,
    backgroundColor: color.ink,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  bars: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  bar: { flex: 1, backgroundColor: color.mute, borderRadius: radius.pill, opacity: 0.75 },
  noWave: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.md,
  },
  /** A word in the window that is not the one being edited: a wall, not a target. */
  neighbour: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: color.line,
  },
  span: { position: 'absolute', top: 0, bottom: 0 },
  handle: { position: 'absolute', top: 0, bottom: 0, width: 3, alignItems: 'center' },
  handleBar: { flex: 1, width: 3 },
  handleKnob: {
    position: 'absolute',
    top: '50%',
    marginTop: -14,
    width: 11,
    height: 28,
    borderRadius: radius.pill,
  },
  playhead: { position: 'absolute', top: 0, bottom: 0, width: 1, opacity: 0.8 },
  steppers: { gap: space.sm },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  stepperLabel: { flex: 1 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  loop: {
    minHeight: MIN_TOUCH,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.line,
  },
});

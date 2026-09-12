/**
 * Shift all captions.
 *
 * One number for the whole project, because the usual timing complaint is not
 * about a word, it is about every caption landing a beat late. The offset is a
 * property of the project and never touched into the words themselves, so walking
 * it out to +300 and back to zero leaves the transcript exactly as the engine
 * timed it.
 *
 * The sheet works in totals rather than in increments: the readout is where the
 * captions are, so opening it a second time says what the first visit decided.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { NUDGE_STEP_MS, shiftAll, type Ms, type Project } from '../domain';
import { Label } from '../ui/atoms';
import { space } from '../ui/theme';
import { formatOffset } from '../ui/time';
import { RepeatButton, SheetAction } from './Sheet';

export function ShiftSheet({
  project,
  accent,
  onChange,
  onApply,
  onClose,
}: {
  project: Project;
  accent: string;
  /** A settled change: the parent previews the offset and re-loops the line. */
  onChange(offsetMs: Ms): void;
  onApply(offsetMs: Ms): void;
  onClose(): void;
}) {
  const [offsetMs, setOffsetMs] = useState(project.globalOffsetMs);

  const drafted = useRef(project.globalOffsetMs);
  const announce = useRef(onChange);
  announce.current = onChange;

  const publish = useCallback(() => announce.current(drafted.current), []);

  // Opening the sheet starts the line looping, which is the only way to judge an
  // offset: a number of milliseconds means nothing until it is heard.
  useEffect(() => {
    publish();
  }, [publish]);

  const step = useCallback(
    (deltaMs: Ms) => {
      // Through the domain, so the clamp that stops the first caption arriving
      // before the video starts is the same clamp Apply will land on.
      drafted.current = shiftAll(
        { ...project, globalOffsetMs: drafted.current },
        deltaMs
      ).globalOffsetMs;
      setOffsetMs(drafted.current);
    },
    [project]
  );

  return (
    <>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Label variant="title">Shift all captions</Label>
          <Label variant="micro" tone="mute">
            Every caption moves together. The words keep the timings they were said at.
          </Label>
        </View>
        <SheetAction label="Apply" onPress={() => onApply(offsetMs)} tone="accent" accent={accent} />
      </View>

      <View style={styles.readout}>
        <RepeatButton
          label={`−${NUDGE_STEP_MS} ms`}
          accessibilityLabel={`Captions ${NUDGE_STEP_MS} milliseconds earlier`}
          onStep={() => step(-NUDGE_STEP_MS)}
          onSettle={publish}
        />

        <View style={styles.value}>
          <Label variant="title">{formatOffset(offsetMs)}</Label>
          <Label variant="micro" tone="mute">
            {describeOffset(offsetMs)}
          </Label>
        </View>

        <RepeatButton
          label={`+${NUDGE_STEP_MS} ms`}
          accessibilityLabel={`Captions ${NUDGE_STEP_MS} milliseconds later`}
          onStep={() => step(NUDGE_STEP_MS)}
          onSettle={publish}
        />
      </View>

      <SheetAction label="Cancel" onPress={onClose} tone="quiet" accent={accent} />
    </>
  );
}

/** What the number means, in the terms the user complained in. */
function describeOffset(offsetMs: Ms): string {
  if (offsetMs === 0) return 'Captions land where the words were heard';
  return offsetMs > 0 ? 'Captions land later' : 'Captions land earlier';
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  headerText: { flex: 1, gap: space.xs },
  readout: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  value: { flex: 1, alignItems: 'center', gap: space.xs },
});

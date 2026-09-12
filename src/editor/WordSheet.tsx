/**
 * The word sheet.
 *
 * One word, the facts about it, and everything that can be done to it. It knows
 * nothing about projects: the editor works out what is true of the word and what
 * each action means, so this file stays a sheet and the editing policy stays in
 * one place.
 *
 * The keyboard opens on "Edit" and on nothing else. A sheet that raises the
 * keyboard just for being opened buries its own actions under it.
 */
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import type { Word } from '../domain';
import { Label } from '../ui/atoms';
import { color, font, MIN_TOUCH, radius, space, type } from '../ui/theme';

/** What the editor has worked out about this word. */
export interface WordFacts {
  /** Below the threshold and not confirmed. Transcript only, never the video. */
  lowConfidence: boolean;
  /** Emphasised as things stand, however that was decided. */
  emphasised: boolean;
  /** Emphasised by the rule rather than by the user. */
  emphasisAutomatic: boolean;
  fromDictionary: boolean;
  /** Other words the engine misheard the same way, behind "Fix N more like this". */
  sameHeardCount: number;
  /** Whether there is a next word to join to. */
  hasNext: boolean;
}

export interface WordSheetActions {
  setText(text: string, alsoTheSameHeard: boolean): void;
  joinWithNext(): void;
  setEmphasis(on: boolean): void;
  confirm(): void;
  toggleLineBreak(): void;
  remove(): void;
}

export function WordSheet({
  word,
  facts,
  accent,
  actions,
  onClose,
}: {
  word: Word;
  facts: WordFacts;
  accent: string;
  actions: WordSheetActions;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(word.text);
  const field = useRef<TextInput>(null);

  // A different word in the same sheet is a different subject: drop the draft
  // and the keyboard with it.
  useEffect(() => {
    setEditing(false);
    setDraft(word.text);
  }, [word.id]);

  const trimmed = draft.trim();
  const changed = trimmed !== '' && trimmed !== word.text;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={styles.backdrop}
        onPress={onClose}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.dock}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              {editing ? (
                <TextInput
                  ref={field}
                  value={draft}
                  onChangeText={setDraft}
                  autoFocus
                  autoCapitalize="none"
                  autoCorrect={false}
                  selectTextOnFocus
                  returnKeyType="done"
                  onSubmitEditing={() => commit(false)}
                  style={styles.field}
                  placeholderTextColor={color.mute}
                />
              ) : (
                <Label variant="title" numberOfLines={2}>
                  {word.text}
                </Label>
              )}
              <Subline facts={facts} />
            </View>

            <Action
              label={editing ? 'Save' : 'Done'}
              onPress={() => (editing ? commit(false) : onClose())}
              tone={editing && changed ? 'accent' : 'quiet'}
              accent={accent}
            />
          </View>

          {editing ? (
            <View style={styles.editRow}>
              {/* Correcting one mishearing usually means correcting all of them,
                  and it is one undo step either way. */}
              {facts.sameHeardCount > 0 && changed ? (
                <Action
                  label={`Fix ${facts.sameHeardCount} more like this`}
                  onPress={() => commit(true)}
                  tone="quiet"
                  accent={accent}
                />
              ) : null}
              <Label variant="micro" tone="mute">
                A space splits the word in two.
              </Label>
            </View>
          ) : (
            <>
              <View style={styles.row}>
                <Action label="Edit" onPress={() => setEditing(true)} tone="tile" accent={accent} />
                <Action
                  label={facts.emphasised ? 'Make normal' : 'Make big'}
                  onPress={() => actions.setEmphasis(!facts.emphasised)}
                  tone="tile"
                  accent={accent}
                />
              </View>

              <View style={styles.row}>
                {facts.lowConfidence ? (
                  <Action
                    label="Looks right"
                    onPress={actions.confirm}
                    tone="tile"
                    accent={accent}
                  />
                ) : null}
                <Action
                  label={word.breakAfter === 'line' ? 'No line break' : 'Line break'}
                  onPress={actions.toggleLineBreak}
                  tone="tile"
                  accent={accent}
                />
                {facts.hasNext ? (
                  <Action
                    label="Join with next"
                    onPress={actions.joinWithNext}
                    tone="tile"
                    accent={accent}
                  />
                ) : null}
              </View>

              <Action label="Delete word" onPress={actions.remove} tone="danger" accent={accent} />
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  function commit(alsoTheSameHeard: boolean) {
    if (changed) actions.setText(trimmed, alsoTheSameHeard);
    setEditing(false);
  }
}

/**
 * Everything true about this word, in one line.
 *
 * "Not sure about this one" rather than "low confidence": the user did not ask
 * the engine for a probability.
 */
function Subline({ facts }: { facts: WordFacts }) {
  const notes: string[] = [];
  if (facts.lowConfidence) notes.push('Not sure about this one');
  if (facts.emphasised) notes.push(facts.emphasisAutomatic ? 'made big automatically' : 'made big');
  if (facts.fromDictionary) notes.push('changed by your dictionary');

  if (notes.length === 0) return null;
  return (
    <Label variant="micro" tone="mute" numberOfLines={2}>
      {notes.join(' · ')}
    </Label>
  );
}

function Action({
  label,
  onPress,
  tone,
  accent,
}: {
  label: string;
  onPress: () => void;
  tone: 'tile' | 'quiet' | 'accent' | 'danger';
  accent: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        tone === 'tile' && styles.tile,
        tone === 'accent' && { backgroundColor: accent, borderColor: accent },
        { opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Label
        variant="label"
        tone={tone === 'danger' ? 'signal' : 'paper'}
        style={tone === 'accent' ? styles.onAccent : undefined}
      >
        {label}
      </Label>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#00000099' },
  dock: { justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: color.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderTopWidth: 1,
    borderColor: color.line,
    padding: space.lg,
    paddingBottom: space.xxl,
    gap: space.md,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  headerText: { flex: 1, gap: space.xs },
  field: {
    ...type.title,
    fontFamily: font.bold,
    color: color.paper,
    borderBottomWidth: 1,
    borderBottomColor: color.line,
    paddingVertical: space.xs,
  },
  editRow: { gap: space.sm, alignItems: 'flex-start' },
  row: { flexDirection: 'row', gap: space.sm },
  action: {
    minHeight: MIN_TOUCH,
    borderRadius: radius.control,
    paddingHorizontal: space.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tile: {
    flex: 1,
    borderWidth: 1,
    borderColor: color.line,
  },
  onAccent: { color: '#111111' },
});

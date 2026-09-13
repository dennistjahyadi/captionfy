/**
 * Your words.
 *
 * A creator says the same brand name in every video and whisper gets it wrong in
 * every video. This is the list that makes one correction the last one, and the
 * screen a word sheet hands a half-written entry to.
 *
 * Deleting is undoable and the undo has no timer on it: a list of a dozen words
 * a user typed by hand is not a place to hurry them.
 */
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { normalizeForMatch, type DictionaryEntry } from '../../src/domain';
import { Sheet, SheetAction } from '../../src/editor/Sheet';
import {
  FREE_DICTIONARY_LIMIT,
  loadDictionary,
  newEntryId,
  putEntry,
  removeEntry,
} from '../../src/project/dictionary-store';
import { loadEntitlement } from '../../src/policy/entitlement-store';
import { Divider, Label, QuietButton, Screen } from '../../src/ui/atoms';
import { color, DEFAULT_ACCENT, MIN_TOUCH, radius, space } from '../../src/ui/theme';

export default function Dictionary() {
  const insets = useSafeAreaInsets();
  const { spelling, heard } = useLocalSearchParams<{ spelling?: string; heard?: string }>();

  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [editing, setEditing] = useState<DictionaryEntry | null>(null);
  const [undoable, setUndoable] = useState<DictionaryEntry | null>(null);

  // A word sheet sends the correction it just made. Opening straight into the
  // editor is what makes that one tap rather than four.
  const [seeded, setSeeded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const held = loadDictionary();
      setEntries(held);

      if (!seeded && spelling) {
        setSeeded(true);
        setEditing({
          id: newEntryId(),
          spelling,
          heardAs: heard ? [heard] : [],
          createdAt: new Date().toISOString(),
        });
      }
    }, [heard, seeded, spelling])
  );

  const unlocked = loadEntitlement().unlocked;
  const full = !unlocked && entries.length >= FREE_DICTIONARY_LIMIT;

  const add = useCallback(() => {
    if (full) {
      // The cap is stated in the dialog, and the way past it is one tap. The
      // navigation sits in the button's own callback rather than after an
      // awaited alert: on Android `onDismiss` fires for a button press too.
      Alert.alert(
        `The free list holds ${FREE_DICTIONARY_LIMIT} words`,
        'Unlocking lifts the limit for good. Your words stay either way.',
        [
          { text: 'Not now', style: 'cancel' },
          {
            text: 'Unlock',
            onPress: () => router.push({ pathname: '/unlock', params: { from: 'dictionary' } }),
          },
        ]
      );
      return;
    }

    setEditing({ id: newEntryId(), spelling: '', heardAs: [], createdAt: new Date().toISOString() });
  }, [full]);

  const save = useCallback(
    (entry: DictionaryEntry) => {
      setEntries(putEntry(entry));
      setEditing(null);
      setUndoable(null);
      // Straight back to whatever asked for it, which is the editor when the
      // entry came from a word sheet.
      if (spelling) router.back();
    },
    [spelling]
  );

  const remove = useCallback((entry: DictionaryEntry) => {
    setEntries(removeEntry(entry.id));
    setEditing(null);
    setUndoable(entry);
  }, []);

  const undo = useCallback(() => {
    if (!undoable) return;
    setEntries(putEntry(undoable));
    setUndoable(null);
  }, [undoable]);

  return (
    <Screen>
      <View style={[styles.bar, { paddingTop: insets.top + space.sm }]}>
        <QuietButton title="Back" onPress={() => router.back()} />
        <Label variant="label" tone="mute">
          Your words
        </Label>
        <Pressable accessibilityRole="button" accessibilityLabel="Add a word" onPress={add} style={styles.add}>
          <Label variant="heading" tone={full ? 'mute' : 'paper'}>
            +
          </Label>
        </Pressable>
      </View>

      {entries.length === 0 ? (
        <View style={styles.empty}>
          <Label variant="title">No words yet</Label>
          <Label variant="body" tone="mute" style={styles.centre}>
            Fix a word in the editor and add it here, and every video after this one gets it right
            the first time.
          </Label>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {entries.map((entry, index) => (
            <View key={entry.id}>
              {index === 0 ? null : <Divider />}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Edit ${entry.spelling}`}
                onPress={() => setEditing(entry)}
                style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Label variant="body">{entry.spelling}</Label>
                <Label variant="micro" tone="mute" numberOfLines={2}>
                  {entry.heardAs.length === 0
                    ? 'Nothing heard yet'
                    : `heard as ${entry.heardAs.join(', ')}`}
                </Label>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}

      {undoable ? (
        <Pressable accessibilityRole="button" onPress={undo} style={styles.undo}>
          <Label variant="label">Deleted “{undoable.spelling}”</Label>
          <Label variant="label" tone="mute">
            Undo
          </Label>
        </Pressable>
      ) : null}

      <View style={styles.foot}>
        <Label variant="micro" tone="mute">
          Used on every new video. Words fixed this way are marked in the transcript.
          {unlocked || entries.length === 0
            ? ''
            : ` ${entries.length} of ${FREE_DICTIONARY_LIMIT} free.`}
        </Label>
      </View>

      {editing ? (
        <Sheet onClose={() => setEditing(null)}>
          <EntryEditor
            entry={editing}
            onSave={save}
            onDelete={() => remove(editing)}
            onClose={() => setEditing(null)}
          />
        </Sheet>
      ) : null}
    </Screen>
  );
}

/**
 * One word and the ways the engine gets it wrong.
 *
 * The spelling is what gets written; every "heard as" is a phrase that becomes
 * it. They are normalised on the way in, because that is how they are compared
 * on the way out, and a variant stored with a capital letter would silently
 * never match.
 */
function EntryEditor({
  entry,
  onSave,
  onDelete,
  onClose,
}: {
  entry: DictionaryEntry;
  onSave: (entry: DictionaryEntry) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [spelling, setSpelling] = useState(entry.spelling);
  const [heardAs, setHeardAs] = useState(entry.heardAs);
  const [draft, setDraft] = useState('');

  const addVariant = () => {
    const variant = normalizeForMatch(draft.trim());
    if (variant === '' || heardAs.includes(variant)) {
      setDraft('');
      return;
    }
    setHeardAs([...heardAs, variant]);
    setDraft('');
  };

  const ready = spelling.trim() !== '';

  return (
    <>
      <View style={styles.header}>
        <Label variant="title">{entry.spelling === '' ? 'New word' : entry.spelling}</Label>
        <SheetAction
          label="Save"
          tone={ready ? 'accent' : 'quiet'}
          accent={DEFAULT_ACCENT}
          disabled={!ready}
          onPress={() => onSave({ ...entry, spelling: spelling.trim(), heardAs })}
        />
      </View>

      <Label variant="micro" tone="mute">
        Spelling
      </Label>
      <TextInput
        value={spelling}
        onChangeText={setSpelling}
        // A new word is a keyboard, because there is nothing else to do on this
        // sheet first. An entry that came from a word sheet already has its
        // spelling, so it opens quiet.
        autoFocus={entry.spelling === ''}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="KitVerify"
        placeholderTextColor={color.mute}
        style={styles.field}
      />

      <Label variant="micro" tone="mute">
        Heard as
      </Label>
      <View style={styles.chips}>
        {heardAs.map((variant) => (
          <Pressable
            key={variant}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${variant}`}
            onPress={() => setHeardAs(heardAs.filter((held) => held !== variant))}
            style={({ pressed }) => [styles.chip, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Label variant="label" tone="mute">
              {variant} ×
            </Label>
          </Pressable>
        ))}
      </View>

      <View style={styles.variantRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={addVariant}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          placeholder="what the engine writes instead"
          placeholderTextColor={color.mute}
          style={[styles.field, styles.variantField]}
        />
        <SheetAction label="Add" tone="quiet" accent={DEFAULT_ACCENT} onPress={addVariant} />
      </View>

      <View style={styles.footRow}>
        <SheetAction label="Delete" tone="danger" accent={DEFAULT_ACCENT} onPress={onDelete} />
        <SheetAction label="Cancel" tone="quiet" accent={DEFAULT_ACCENT} onPress={onClose} />
      </View>
    </>
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
  add: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', paddingHorizontal: space.xl, paddingTop: space.huge, gap: space.md },
  centre: { textAlign: 'center' },
  list: { paddingHorizontal: space.lg },
  row: { minHeight: MIN_TOUCH + 12, justifyContent: 'center', gap: space.xs, paddingVertical: space.sm },
  undo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    margin: space.lg,
    padding: space.md,
    borderRadius: radius.control,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
  },
  foot: { marginTop: 'auto', padding: space.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  field: {
    minHeight: MIN_TOUCH,
    color: color.paper,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.control,
    paddingHorizontal: space.md,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    minHeight: MIN_TOUCH,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.line,
  },
  variantRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  variantField: { flex: 1 },
  footRow: { flexDirection: 'row', justifyContent: 'space-between' },
});

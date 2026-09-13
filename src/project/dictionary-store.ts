/**
 * The user's own words, on disk.
 *
 * One file for the whole app rather than one per project: a creator's brand name
 * is spelled the same way in every video they will ever make, which is the whole
 * point of writing it down once.
 */
import { File, Paths } from 'expo-file-system';

import type { DictionaryEntry } from '../domain';

/**
 * How many words the free tier holds.
 *
 * A config value because it may well go: twenty is enough to be useful and few
 * enough to be worth paying past, and which of those matters more is not
 * something this file can decide.
 */
export const FREE_DICTIONARY_LIMIT = 20;

function dictionaryFile(): File {
  return new File(Paths.document, 'dictionary.json');
}

export function loadDictionary(): DictionaryEntry[] {
  const file = dictionaryFile();
  if (!file.exists) return [];

  try {
    const parsed = JSON.parse(file.textSync()) as DictionaryEntry[];
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch {
    // A half-written file costs the user their word list, which is bad, but
    // failing to open the app over it is worse.
    return [];
  }
}

export function saveDictionary(entries: DictionaryEntry[]): void {
  dictionaryFile().write(JSON.stringify(entries));
}

/** Adds or replaces one entry and writes the file. Returns the new list. */
export function putEntry(entry: DictionaryEntry): DictionaryEntry[] {
  const entries = loadDictionary();
  const at = entries.findIndex((held) => held.id === entry.id);
  const next = at === -1 ? [...entries, entry] : entries.with(at, entry);

  saveDictionary(next);
  return next;
}

export function removeEntry(id: string): DictionaryEntry[] {
  const next = loadDictionary().filter((entry) => entry.id !== id);
  saveDictionary(next);
  return next;
}

export function newEntryId(): string {
  return `d${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

function isEntry(value: unknown): value is DictionaryEntry {
  const entry = value as Partial<DictionaryEntry> | null;
  return (
    typeof entry?.id === 'string' &&
    typeof entry.spelling === 'string' &&
    Array.isArray(entry.heardAs)
  );
}

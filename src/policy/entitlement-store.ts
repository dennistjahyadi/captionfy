/**
 * What the user has paid for, on disk.
 *
 * Read on Home before a video is picked, because the free-tier line has to be
 * there before the work starts (invariant 5). This file is the app's memory of
 * what the store said; `store.ts` is the only thing that asks the store.
 */
import { File, Paths } from 'expo-file-system';

import { NEW_ENTITLEMENT, recordUnlock, type Entitlement } from './free-tier';
import { findUnlock } from './store';

function entitlementFile(): File {
  return new File(Paths.document, 'entitlement.json');
}

export function loadEntitlement(): Entitlement {
  const file = entitlementFile();
  if (!file.exists) {
    const fresh = { ...NEW_ENTITLEMENT, firstRunAt: new Date().toISOString() };
    saveEntitlement(fresh);
    return fresh;
  }

  try {
    return { ...NEW_ENTITLEMENT, ...(JSON.parse(file.textSync()) as Partial<Entitlement>) };
  } catch {
    return { ...NEW_ENTITLEMENT, firstRunAt: new Date().toISOString() };
  }
}

export function saveEntitlement(entitlement: Entitlement): void {
  entitlementFile().write(JSON.stringify(entitlement));
}

/** Writes down that this account owns the unlock, and hands back the new state. */
export function markUnlocked(): Entitlement {
  const unlocked = recordUnlock(loadEntitlement());
  saveEntitlement(unlocked);
  return unlocked;
}

/**
 * Asks the store what this account owns, and remembers a yes.
 *
 * Runs at launch and when the Unlock screen opens. Three things it deliberately
 * does not do: block anything, tell the user when the answer is no, and ever
 * take an unlock away. A phone in a tunnel, a Play Services that is updating and
 * a genuine refund all look identical from here, and only one of them should
 * cost somebody the thing they bought — a refund will be caught by the store
 * itself long before this app could tell the difference.
 *
 * Returns the entitlement only when it changed, so a caller can redraw once
 * instead of on every launch.
 */
export async function syncEntitlement(): Promise<Entitlement | null> {
  if (loadEntitlement().unlocked) return null;
  if (!(await findUnlock())) return null;

  return markUnlocked();
}

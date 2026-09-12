/**
 * What the user has paid for, on disk.
 *
 * Read on Home before a video is picked, because the free-tier line has to be
 * there before the work starts (invariant 5). The receipt itself comes from the
 * store in slice 9; this file only remembers what the app was told.
 */
import { File, Paths } from 'expo-file-system';

import { NEW_ENTITLEMENT, type Entitlement } from './free-tier';

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

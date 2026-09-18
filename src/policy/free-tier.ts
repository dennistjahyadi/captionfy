/**
 * What the free tier allows.
 *
 * Pure TypeScript, no platform imports.
 *
 * Invariant 5: whatever the limit is, the user sees it on Home before they pick
 * a video, and the Export screen never introduces a new wall. Discovering a
 * paywall after the work is done is the loudest complaint in this whole market.
 *
 * The policy is one object so the three candidates stay a one-line change.
 */

export type FreeTierPolicy =
  | { kind: 'exports'; freeExports: number }
  | { kind: 'watermark' }
  | { kind: 'trial'; trialDays: number };

/**
 * The policy in force. Change this line, not the code that reads it.
 *
 * Unlimited exports, full quality, carrying a small mark. It was three clean
 * exports until it was not, and the argument that moved it is that **three was a
 * wall in front of the wrong thing**. Checking that the captions match the audio
 * never needed an export: the editor plays the real overlay through the real
 * layout, free and unlimited, which is invariant 2 doing its second job. What the
 * counter actually rationed was finished files — and it charged again for every
 * re-export after a style tweak, so three went in an afternoon.
 *
 * A mark trades that wall for a visible one. Nobody is stopped, the thing being
 * evaluated is still the real thing, and the unlock buys back the frame.
 * `layoutWatermark` holds where it goes and why it is small.
 */
export const FREE_TIER: FreeTierPolicy = { kind: 'watermark' };

export interface Entitlement {
  /** True once the one-time purchase is restored or bought. */
  unlocked: boolean;
  /** Clean exports already taken on the free tier. */
  exportsUsed: number;
  /** ISO date of first launch, which a trial policy counts from. */
  firstRunAt: string;
  /** ISO date the purchase was first seen on this phone. Settings shows it. */
  unlockedAt?: string;
}

export const NEW_ENTITLEMENT: Entitlement = {
  unlocked: false,
  exportsUsed: 0,
  firstRunAt: '',
};

export interface FreeTierStatus {
  /** The line under the New video button. Empty once the user has unlocked. */
  line: string;
  /** True when the next export needs an unlock first. */
  blocked: boolean;
  /** True when the next export carries a watermark. */
  watermark: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function freeTierStatus(
  entitlement: Entitlement,
  now: Date = new Date(),
  policy: FreeTierPolicy = FREE_TIER
): FreeTierStatus {
  if (entitlement.unlocked) return { line: '', blocked: false, watermark: false };

  if (policy.kind === 'watermark') {
    return { line: 'Free exports carry a small watermark', blocked: false, watermark: true };
  }

  if (policy.kind === 'trial') {
    const left = daysLeft(entitlement.firstRunAt, now, policy.trialDays);
    if (left <= 0) return { line: 'Your trial has ended', blocked: true, watermark: false };
    return {
      line: left === 1 ? 'Last day of your trial' : `${left} days left in your trial`,
      blocked: false,
      watermark: false,
    };
  }

  const left = Math.max(0, policy.freeExports - entitlement.exportsUsed);
  // The spec's words for this state, and the only ones: Home, Export, Saved and
  // Settings all read this line, so a second phrasing anywhere would be the app
  // describing the same fact two ways on two screens.
  if (left === 0) return { line: 'Free exports used', blocked: true, watermark: false };
  return {
    line: left === 1 ? '1 free export left' : `${left} free exports left`,
    blocked: false,
    watermark: false,
  };
}

/** Records an export against the free tier. Unlocked users are never counted. */
export function recordExport(entitlement: Entitlement): Entitlement {
  if (entitlement.unlocked) return entitlement;
  return { ...entitlement, exportsUsed: entitlement.exportsUsed + 1 };
}

/**
 * Records what the store said this account owns.
 *
 * `exportsUsed` is left exactly where it was. "Your free exports stay yours
 * either way" is on the Unlock screen, and a refund that put someone back on the
 * free tier must not hand them three more than they had. The date is kept from
 * the first time the unlock was seen, so reinstalling does not restart it.
 */
export function recordUnlock(entitlement: Entitlement, at: Date = new Date()): Entitlement {
  if (entitlement.unlocked) return entitlement;
  return { ...entitlement, unlocked: true, unlockedAt: at.toISOString() };
}

function daysLeft(firstRunAt: string, now: Date, trialDays: number): number {
  const started = Date.parse(firstRunAt);
  if (Number.isNaN(started)) return trialDays;
  const elapsed = Math.floor((now.getTime() - started) / DAY_MS);
  return Math.max(0, trialDays - elapsed);
}

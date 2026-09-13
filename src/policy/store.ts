/**
 * The only place the store is called.
 *
 * Every screen that sells or restores the unlock goes through here, the way
 * `src/asr` is the only caller of whisper and `src/export/run.ts` the only caller
 * of the burn-in. What is awkward about billing is stated once: the connection is
 * lazy and never throws, a purchase arrives on an event rather than as a return
 * value, and Play will hand back a purchase that has not been acknowledged yet
 * and refund it three days later if nobody does.
 *
 * This is also the one part of the app that touches the network, and it is why
 * invariant 9 says "after the model is on disk" rather than "never". Nothing here
 * is ever awaited on a path that leads to a caption: the launch check is fire and
 * forget, and everywhere else the user asked for it and is watching a spinner.
 *
 * There is no receipt validation. It would need a server, this app has none by
 * design, and the thing being protected is a one-time unlock on the user's own
 * phone. Play's own answer to `getAvailablePurchases` is the source of truth.
 */
import { Platform } from 'react-native';
import {
  ErrorCode,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  restorePurchases,
  type Purchase,
} from 'expo-iap';

/** One non-consumable, the same id in both stores. */
export const UNLOCK_PRODUCT_ID = 'captions_unlock_v1';

export type PurchaseOutcome =
  /** Play or the App Store says this account owns it. Write it down and move on. */
  | { kind: 'unlocked' }
  /** Play's "pending" state: cash, a parent's approval, a bank that is thinking. */
  | { kind: 'pending' }
  /** The user backed out of the sheet. Not a failure and never an alert. */
  | { kind: 'cancelled' }
  | { kind: 'failed'; message: string };

/**
 * The connection, opened once and reused.
 *
 * A rejection is cached as `false` rather than thrown: a phone with no Play
 * Services, a build the store has never heard of and a plane with no signal all
 * arrive here, and none of them is an error the user can act on. Every caller
 * checks the boolean.
 */
let connection: Promise<boolean> | null = null;

export function connectToStore(): Promise<boolean> {
  connection ??= initConnection()
    .then((ready) => ready !== false)
    .catch(() => false);
  return connection;
}

/**
 * What the unlock costs, and why there is no price when there is no price.
 *
 * Three answers, because the two failures are not the same failure and the user
 * is owed the difference: a phone that cannot reach the store at all, and a store
 * that answered and has nothing to sell this account.
 */
export type PriceLookup =
  | { kind: 'priced'; price: string }
  /** The store answered. It does not offer this product to this account. */
  | { kind: 'unavailable' }
  /** No answer at all: no connection, no Play Services, no store. */
  | { kind: 'offline' };

/**
 * The price, as the store itself writes it.
 *
 * Never composed here. `displayPrice` is already "Rp 99.000" or "$4.99" with the
 * right symbol, separators and position for the account's country, and any
 * attempt to build that string from a number gets it wrong somewhere.
 *
 * The emptiness check is not defensive tidying. Play Billing 8 stopped omitting
 * a SKU it cannot find and now returns a `Product` for it with the fields blank
 * and `productStatusAndroid` saying why — so an unpublished app gets an object
 * back, and a `?? null` on `displayPrice` sails straight past it. The A54 showed
 * this as a button reading "Unlock for " with nothing after it.
 */
export async function unlockPrice(): Promise<PriceLookup> {
  if (!(await connectToStore())) return { kind: 'offline' };

  try {
    const products = await fetchProducts({ skus: [UNLOCK_PRODUCT_ID], type: 'in-app' });
    const product = (products ?? []).find((candidate) => candidate.id === UNLOCK_PRODUCT_ID);
    const price = product?.displayPrice?.trim();

    return price ? { kind: 'priced', price } : { kind: 'unavailable' };
  } catch {
    return { kind: 'offline' };
  }
}

/**
 * Buys the unlock, and resolves with what actually happened.
 *
 * `requestPurchase` returns as soon as the sheet is up; the answer comes back on
 * a listener. Both listeners are attached before the sheet opens, because a
 * purchase that completes while nothing is listening is a user who paid and saw
 * nothing happen.
 */
export async function buyUnlock(): Promise<PurchaseOutcome> {
  if (!(await connectToStore())) {
    return { kind: 'failed', message: storeUnreachable() };
  }

  return new Promise<PurchaseOutcome>((resolve) => {
    let settled = false;

    const done = (outcome: PurchaseOutcome) => {
      if (settled) return;
      settled = true;
      updates.remove();
      errors.remove();
      resolve(outcome);
    };

    const updates = purchaseUpdatedListener((purchase) => {
      if (purchase.productId !== UNLOCK_PRODUCT_ID) return;

      if (purchase.purchaseState === 'pending') {
        done({ kind: 'pending' });
        return;
      }

      // Acknowledged before the promise resolves. Play refunds an unacknowledged
      // purchase after three days, and there is no server here to do it later.
      void acknowledge(purchase);
      done({ kind: 'unlocked' });
    });

    const errors = purchaseErrorListener((error) => {
      if (error.code === ErrorCode.UserCancelled) {
        done({ kind: 'cancelled' });
        return;
      }
      // Somebody who already owns it and lost the local record has not failed at
      // anything; they have restored it.
      if (error.code === ErrorCode.AlreadyOwned) {
        done({ kind: 'unlocked' });
        return;
      }
      done({ kind: 'failed', message: error.message || 'The store did not finish that.' });
    });

    requestPurchase({
      type: 'in-app',
      request: {
        google: { skus: [UNLOCK_PRODUCT_ID] },
        apple: { sku: UNLOCK_PRODUCT_ID },
      },
    }).catch((error: unknown) => {
      done({ kind: 'failed', message: describe(error) });
    });
  });
}

/**
 * Asks the store what this account already owns.
 *
 * The same query answers Restore and the quiet check at launch, because on both
 * stores restoring is a query and not a transaction. Anything owned but never
 * acknowledged is acknowledged here: that is a purchase that completed while the
 * app was being killed, and Play is counting down to refunding it.
 */
export async function findUnlock(): Promise<boolean> {
  if (!(await connectToStore())) return false;

  try {
    // iOS needs a sync before the query to see a purchase made on another device.
    // On Android this is the query, so calling both is one round trip either way.
    if (Platform.OS === 'ios') await restorePurchases();

    const owned = await getAvailablePurchases();
    const unlock = owned.find(
      (purchase) =>
        purchase.productId === UNLOCK_PRODUCT_ID && purchase.purchaseState === 'purchased'
    );
    if (!unlock) return false;

    void acknowledge(unlock);
    return true;
  } catch {
    return false;
  }
}

/**
 * Tells the store the goods were handed over.
 *
 * `isConsumable: false`, always: this product is bought once and owning it is the
 * point. Acknowledging twice is an error on Play, so an acknowledged purchase is
 * left alone, and a failure here is swallowed — the user has their unlock either
 * way and the next launch queries again.
 */
async function acknowledge(purchase: Purchase): Promise<void> {
  if ('isAcknowledgedAndroid' in purchase && purchase.isAcknowledgedAndroid) return;

  try {
    await finishTransaction({ purchase, isConsumable: false });
  } catch {
    // Nothing the user can do, and nothing worth showing them.
  }
}

/** What to say when the store cannot be reached at all. */
export function storeUnreachable(): string {
  return Platform.OS === 'android'
    ? 'Google Play could not be reached on this phone. Check your connection and try again.'
    : 'The App Store could not be reached. Check your connection and try again.';
}

/** What to say when the store answered and has nothing to sell this account. */
export function storeHasNothing(): string {
  return Platform.OS === 'android'
    ? 'Google Play is not offering this unlock to your account yet. Try again later.'
    : 'The App Store is not offering this unlock to your account yet. Try again later.';
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

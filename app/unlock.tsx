/**
 * Unlock.
 *
 * The only screen in the app that asks for money, reachable from Home, Export,
 * Saved, Settings and Welcome. It arrives before a render rather than after one
 * (invariant 5), which is the whole reason the Export button changes its own
 * label at zero instead of failing at the end.
 *
 * The price is never composed here. `displayPrice` comes from the store already
 * carrying the right symbol, separators and position for the account's country,
 * and a hardcoded "Rp 99.000" is wrong the moment somebody opens the app abroad.
 *
 * Nothing on this screen decides anything about entitlement. `store.ts` asks the
 * store, `entitlement-store.ts` writes down the answer, and this draws it.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { loadEntitlement, markUnlocked, syncEntitlement } from '../src/policy/entitlement-store';
import { buyUnlock, storeHasNothing, storeUnreachable, unlockPrice } from '../src/policy/store';
import { Label, PrimaryButton, QuietButton, Screen } from '../src/ui/atoms';
import { color, DEFAULT_ACCENT, MIN_TOUCH, radius, space } from '../src/ui/theme';

/** Four, in the order somebody weighing it up would ask them. */
const PROMISES = [
  'Unlimited exports, full quality, no watermark',
  'All caption styles',
  'Unlimited dictionary words',
  'No subscription, no account, ever',
];

type Phase =
  | { kind: 'pricing' }
  | { kind: 'ready' }
  | { kind: 'buying' }
  | { kind: 'pending' }
  | { kind: 'failed'; message: string }
  | { kind: 'unlocked' };

export default function Unlock() {
  const { from, id } = useLocalSearchParams<{ from?: string; id?: string }>();
  const insets = useSafeAreaInsets();

  const [price, setPrice] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>(() =>
    loadEntitlement().unlocked ? { kind: 'unlocked' } : { kind: 'pricing' }
  );

  const load = useCallback(async () => {
    setPhase({ kind: 'pricing' });

    // Both at once: someone who bought this on another phone should see
    // "Unlocked" rather than a price they have already paid.
    const [restored, found] = await Promise.all([syncEntitlement(), unlockPrice()]);

    setPrice(found.kind === 'priced' ? found.price : null);
    if (restored) {
      setPhase({ kind: 'unlocked' });
      return;
    }

    switch (found.kind) {
      case 'priced':
        setPhase({ kind: 'ready' });
        return;
      case 'unavailable':
        setPhase({ kind: 'failed', message: storeHasNothing() });
        return;
      case 'offline':
        setPhase({ kind: 'failed', message: storeUnreachable() });
    }
  }, []);

  useEffect(() => {
    if (loadEntitlement().unlocked) return;
    void load();
  }, [load]);

  const buy = useCallback(async () => {
    setPhase({ kind: 'buying' });
    const outcome = await buyUnlock();

    switch (outcome.kind) {
      case 'unlocked':
        markUnlocked();
        setPhase({ kind: 'unlocked' });
        return;
      case 'pending':
        setPhase({ kind: 'pending' });
        return;
      case 'cancelled':
        // Backing out of the sheet is an answer, not an error. Nothing is said.
        setPhase({ kind: 'ready' });
        return;
      case 'failed':
        setPhase({ kind: 'failed', message: outcome.message });
    }
  }, []);

  const restore = useCallback(async () => {
    setPhase({ kind: 'pricing' });
    if (await syncEntitlement()) {
      setPhase({ kind: 'unlocked' });
      return;
    }
    setPhase({ kind: 'failed', message: 'No purchase found for this account.' });
  }, []);

  /** Back where they came from, or Home if they arrived from somewhere with no way back. */
  const leave = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/');
  }, []);

  if (phase.kind === 'unlocked') {
    return <Unlocked from={from} id={id} onLeave={leave} />;
  }

  const busy = phase.kind === 'pricing' || phase.kind === 'buying';

  return (
    <Screen>
      <View style={[styles.bar, { paddingTop: insets.top + space.sm }]}>
        <QuietButton title="✕" onPress={leave} />
        <QuietButton title="Restore" onPress={restore} />
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.xl }]}>
        <Label variant="title">Buy it once. Keep it forever.</Label>

        <View style={styles.promises}>
          {PROMISES.map((promise) => (
            <View key={promise} style={styles.promise}>
              <Label variant="body" style={{ color: DEFAULT_ACCENT }}>
                ✓
              </Label>
              <Label variant="body" style={styles.promiseText}>
                {promise}
              </Label>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <PrimaryButton
            title={price === null ? 'Try again' : `Unlock for ${price}`}
            accent={DEFAULT_ACCENT}
            busy={busy}
            onPress={price === null ? load : buy}
          />

          {phase.kind === 'pending' ? (
            <Label variant="label" tone="mute" style={styles.centre}>
              Waiting for payment confirmation. You can close this — it unlocks itself when the
              payment clears.
            </Label>
          ) : null}

          {phase.kind === 'failed' ? (
            <Label variant="label" tone="signal" style={styles.centre}>
              {phase.message}
            </Label>
          ) : null}

          <Label variant="micro" tone="mute" style={styles.centre}>
            One payment. Not a subscription. Your free exports stay yours either way.
          </Label>
        </View>
      </ScrollView>
    </Screen>
  );
}

/**
 * What a paid account sees, whether it just paid or was restored.
 *
 * "Back to export" only when there is an export to go back to. Everywhere else
 * it says Home, because a button that returns somebody to Settings is a button
 * nobody wants after buying something.
 */
function Unlocked({
  from,
  id,
  onLeave,
}: {
  from?: string;
  id?: string;
  onLeave: () => void;
}) {
  const insets = useSafeAreaInsets();
  const toExport = from === 'export' && !!id;

  return (
    <Screen>
      <View style={[styles.done, { paddingTop: insets.top + space.huge }]}>
        <View style={styles.check}>
          <Label variant="display" style={styles.tick}>
            ✓
          </Label>
        </View>

        <Label variant="title">Unlocked</Label>
        <Label variant="body" tone="mute" style={styles.centre}>
          It stays unlocked on any phone signed in to this Play account.
        </Label>

        <View style={styles.doneActions}>
          {toExport ? (
            <PrimaryButton
              title="Back to export"
              accent={DEFAULT_ACCENT}
              onPress={() => router.replace({ pathname: '/export/[id]', params: { id: String(id) } })}
            />
          ) : (
            <PrimaryButton title="Home" accent={DEFAULT_ACCENT} onPress={() => router.replace('/')} />
          )}
          {toExport ? <QuietButton title="Home" onPress={() => router.replace('/')} /> : null}
          {!toExport && from === 'settings' ? <QuietButton title="Back" onPress={onLeave} /> : null}
        </View>
      </View>
    </Screen>
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
  body: { paddingHorizontal: space.lg, paddingTop: space.xl, gap: space.xl },
  promises: { gap: space.md },
  promise: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  promiseText: { flex: 1 },
  actions: { gap: space.md },
  centre: { textAlign: 'center' },
  done: { flex: 1, alignItems: 'center', paddingHorizontal: space.lg, gap: space.md },
  check: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: color.good,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  tick: { color: color.good },
  doneActions: { alignSelf: 'stretch', gap: space.sm, marginTop: space.xl, minHeight: MIN_TOUCH },
});

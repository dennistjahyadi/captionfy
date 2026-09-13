import {
  FREE_TIER,
  freeTierStatus,
  recordExport,
  recordUnlock,
  type Entitlement,
  type FreeTierPolicy,
} from '../free-tier';

const fresh = (partial: Partial<Entitlement> = {}): Entitlement => ({
  unlocked: false,
  exportsUsed: 0,
  firstRunAt: '2026-09-01T00:00:00.000Z',
  ...partial,
});

const exports: FreeTierPolicy = { kind: 'exports', freeExports: 2 };
const watermark: FreeTierPolicy = { kind: 'watermark' };
const trial: FreeTierPolicy = { kind: 'trial', trialDays: 7 };
const now = new Date('2026-09-05T00:00:00.000Z');

describe('invariant 5: the limit is stated before the work starts', () => {
  it('says how many free exports are left', () => {
    expect(freeTierStatus(fresh(), now, exports).line).toBe('2 free exports left');
    expect(freeTierStatus(fresh({ exportsUsed: 1 }), now, exports).line).toBe('1 free export left');
  });

  it('blocks only once they are gone, and says so on Home', () => {
    const spent = freeTierStatus(fresh({ exportsUsed: 2 }), now, exports);
    expect(spent).toMatchObject({ line: 'Free exports used', blocked: true });
  });

  it('says nothing to someone who has already paid', () => {
    expect(freeTierStatus(fresh({ unlocked: true }), now, exports)).toEqual({
      line: '',
      blocked: false,
      watermark: false,
    });
  });
});

describe('the other two policies are the same switch', () => {
  it('watermarks instead of blocking', () => {
    expect(freeTierStatus(fresh(), now, watermark)).toMatchObject({
      blocked: false,
      watermark: true,
    });
  });

  it('counts a trial down in days', () => {
    expect(freeTierStatus(fresh(), now, trial).line).toBe('3 days left in your trial');
  });

  it('names the last day rather than saying one day', () => {
    expect(freeTierStatus(fresh({ firstRunAt: '2026-08-30T00:00:00.000Z' }), now, trial).line).toBe(
      'Last day of your trial'
    );
  });

  it('ends the trial rather than going negative', () => {
    const over = freeTierStatus(fresh({ firstRunAt: '2026-08-01T00:00:00.000Z' }), now, trial);
    expect(over).toMatchObject({ line: 'Your trial has ended', blocked: true });
  });

  it('gives a full trial to an entitlement with no first run recorded', () => {
    expect(freeTierStatus(fresh({ firstRunAt: '' }), now, trial).line).toBe('7 days left in your trial');
  });
});

describe('recordExport', () => {
  it('counts an export against the free tier', () => {
    expect(recordExport(fresh()).exportsUsed).toBe(1);
  });

  it('never counts one against a paid user', () => {
    const paid = fresh({ unlocked: true });
    expect(recordExport(paid)).toBe(paid);
  });
});

describe('recordUnlock', () => {
  const at = new Date('2026-09-13T10:00:00.000Z');

  it('unlocks and dates it', () => {
    expect(recordUnlock(fresh(), at)).toMatchObject({
      unlocked: true,
      unlockedAt: '2026-09-13T10:00:00.000Z',
    });
  });

  it('leaves the free exports where they were', () => {
    // "Your free exports stay yours either way" is on the Unlock screen. A
    // refund must not hand somebody a fresh three.
    expect(recordUnlock(fresh({ exportsUsed: 2 }), at).exportsUsed).toBe(2);
  });

  it('keeps the first unlock date rather than moving it', () => {
    const already = fresh({ unlocked: true, unlockedAt: '2026-01-01T00:00:00.000Z' });
    expect(recordUnlock(already, at)).toBe(already);
  });
});

describe('the policy that actually ships', () => {
  // The build prompt's table, pinned. Every screen reads this one object, so a
  // stray edit here changes what four screens say without touching any of them.
  it('is three free exports, full quality', () => {
    expect(FREE_TIER).toEqual({ kind: 'exports', freeExports: 3 });
  });

  it('states the count before any work starts', () => {
    expect(freeTierStatus(fresh()).line).toBe('3 free exports left');
    expect(freeTierStatus(fresh({ exportsUsed: 3 }))).toMatchObject({ blocked: true });
  });
});

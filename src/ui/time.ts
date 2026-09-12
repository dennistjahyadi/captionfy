/**
 * Times, as the interface says them.
 *
 * Everything in the app is integer milliseconds (invariant 7). These are the
 * only place that turns one into something a person reads, so a timecode looks
 * the same on the scrubber, in the timing sheet and on a project row.
 */
import type { Ms } from '../domain';

/** `1:03`. Rounded down, so a readout never shows a second that has not started. */
export function formatClock(ms: Ms): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** `1:03.45`, for word timings, where a tenth of a second is a visible mistake. */
export function formatPrecise(ms: Ms): string {
  const hundredths = Math.max(0, Math.floor(ms / 10)) % 100;
  return `${formatClock(ms)}.${String(hundredths).padStart(2, '0')}`;
}

/**
 * `+150 ms`, `−150 ms`, `0 ms`, for a shift rather than a point in time.
 *
 * The sign is always there on a non-zero value, because the whole question the
 * user is answering is which way the captions moved. A true minus sign and not a
 * hyphen: at this size the hyphen reads as part of the number.
 */
export function formatOffset(ms: Ms): string {
  const rounded = Math.round(ms);
  if (rounded === 0) return '0 ms';
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded)} ms`;
}

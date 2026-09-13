/**
 * What an export will cost, and what to say when it fails.
 *
 * Split out of `run.ts` because both are arithmetic and words rather than
 * machinery, and because `run.ts` cannot be imported by a test: it reaches the
 * burn-in module and the foreground service on the way in. These two are the
 * parts worth pinning.
 */

/**
 * The encoder's own bitrate rule, mirrored.
 *
 * `VideoBurner.kt` decides the real one; these three numbers are copied from it
 * and the two files are commented at each other. They exist here only to answer
 * "will this fit" before the encoder is started, rather than by it failing forty
 * seconds in.
 */
export const BITS_PER_PIXEL = 0.13;
export const MIN_BITRATE = 2_000_000;
export const MAX_BITRATE = 20_000_000;

/**
 * Bytes an export of this shape will take on disk.
 *
 * Two copies, because there are two: the app keeps one so Share has a file to
 * hand over, and the gallery gets its own. A third is added on top, since audio
 * is copied across as well and an encoder is allowed to overshoot a bitrate it
 * was only ever handed as a target.
 */
export function estimateExportBytes(
  width: number,
  height: number,
  fps: number,
  durationMs: number
): number {
  const rate = Math.min(
    MAX_BITRATE,
    Math.max(MIN_BITRATE, Math.round(width * height * Math.max(1, fps) * BITS_PER_PIXEL))
  );
  const seconds = Math.max(1, durationMs / 1000);

  return Math.round((rate / 8) * seconds * 2 * 1.33);
}

/**
 * What went wrong, in words the user can act on.
 *
 * The burn-in reports honestly and in its own vocabulary — EGL configs, muxers,
 * codecs — and none of that is a sentence anybody can do anything with. Only the
 * two failures the spec names are translated. Anything else keeps its real
 * message, because a confident wrong guess about a rare failure is worse than a
 * technical sentence that can at least be searched for.
 */
export function describeExportFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes('enospc') || lower.includes('no space') || lower.includes('out of space')) {
    return 'This phone ran out of space while saving. Free some up and try again.';
  }
  if (
    lower.includes('codec') ||
    lower.includes('egl') ||
    lower.includes('encoder') ||
    lower.includes('could not be drawn')
  ) {
    return 'Couldn’t render this video on this phone. Try 720p.';
  }
  return message;
}

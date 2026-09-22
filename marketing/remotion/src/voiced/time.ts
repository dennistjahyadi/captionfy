/**
 * The clock every voiced ad runs on.
 *
 * A recording's times are in its own seconds; the composition puts `LEAD`
 * frames of black in front of it, so every number read off `words.json` goes
 * through `F` and nothing else adds the offset twice.
 */
export const FPS = 30;

/**
 * Seconds of black before the voice starts.
 *
 * The recordings open on their first word with no lead-in at all, and a title
 * word that springs in on frame zero is a word the viewer never sees arrive.
 * Six frames is enough for the spring and not enough to read as dead air.
 */
export const LEAD = 0.2;
/** Room after the last word so the file does not end on a consonant. */
export const TAIL = 0.7;

/** A time in the recording, as a frame of the composition. */
export const F = (sec: number): number => Math.round((sec + LEAD) * FPS);

/**
 * Video 03, the no-credits ad: the recording's words, grouped into the
 * eighteen phrases the subtitles show. See `../voiced/script.ts`.
 *
 * Two of the groups are not the voice's own pauses. "Most caption apps give
 * you / a few videos a month," is one breath split in two, because ten words
 * is a paragraph at subtitle size; and "so there's no credits, no quota, no
 * limit." is three breaths joined into one, because a two-word cue that
 * changes three times in two seconds flickers, and the pills above it are
 * already doing the counting.
 */
import words from '../../../video-03-pain-ads/words.nocredit.json';

import { buildScript } from '../voiced/script';

/** The voice, staged by `../../video-03-pain-ads/render.sh`. */
export const VOICE = 'payonce/no_credit_mark.mp3';

/**
 * Not the hook (phrases 0–1) and not the offer (14–15): on those the words
 * are the picture. Everything else is subtitled — the pain, the claim, every
 * step over the phone, the hundred, and both lines under the close.
 */
export const SCRIPT = buildScript(
  words,
  [7, 5, 5, 5, 6, 5, 8, 4, 3, 6, 1, 2, 5, 2, 2, 3, 6, 8],
  [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 16, 17],
  27.09
);

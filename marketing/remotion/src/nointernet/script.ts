/**
 * Video 03, the no-internet ad: the recording's words, grouped into the
 * seventeen phrases the voice says between pauses. See `../voiced/script.ts`.
 *
 * The transcript's "Wi" and "-Fi" were joined into one word in the file, so
 * the subtitle does not set them a space apart.
 */
import words from '../../../video-03-pain-ads/words.offline.json';

import { buildScript } from '../voiced/script';

/** The voice, staged by `../../video-03-pain-ads/render.sh`. */
export const VOICE = 'payonce/offline_mark.mp3';
/**
 * This recording peaks at −7.5 dB where the pay-once one peaks at −0.5, so
 * played as-is the finished file was 8 dB quieter than its sibling. Eight
 * decibels of gain lands its peak where the other ad's is, under the same
 * sound effects at the same volumes.
 */
export const VOICE_GAIN = 2.5;

/**
 * Not the hook (phrases 0–1) and not the offer (12–13): on those the words
 * are the picture. Every phrase over the phone and all three under the close.
 */
export const SCRIPT = buildScript(
  words,
  [4, 4, 3, 4, 4, 5, 7, 6, 3, 1, 2, 4, 2, 3, 6, 5, 3],
  [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 15, 16],
  22.36
);

/**
 * Video 03, the pay-once ad: the recording's words, grouped into the sixteen
 * phrases the voice says between pauses. See `../voiced/script.ts`.
 */
import words from '../../../video-03-pain-ads/words.payonce.json';

import { buildScript } from '../voiced/script';

/** The voice, staged by `../../video-03-pain-ads/render.sh`. */
export const VOICE = 'payonce/pay_once_mark.mp3';

/**
 * Not the hook (phrases 0–1) and not the offer (10–13): on those the words are
 * the picture. Every phrase over the phone and both under the close.
 */
export const SCRIPT = buildScript(
  words,
  [4, 5, 7, 4, 3, 6, 3, 1, 2, 4, 2, 3, 2, 2, 6, 6],
  [2, 3, 4, 5, 6, 7, 8, 9, 14, 15],
  22.6
);

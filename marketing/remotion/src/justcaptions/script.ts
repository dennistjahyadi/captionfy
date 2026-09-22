/**
 * Video 03, the just-captions ad: the recording's words, grouped into the
 * twenty-one phrases the voice says between pauses. See `../voiced/script.ts`.
 */
import words from '../../../video-03-pain-ads/words.justcaptions.json';

import { buildScript } from '../voiced/script';

/** The voice, staged by `../../video-03-pain-ads/render.sh`. */
export const VOICE = 'payonce/just_caption_mark.mp3';
/**
 * This recording peaks at −8.3 dB, the same as the no-internet one and 8 dB
 * under the pay-once one. The same gain lands it where its siblings are.
 */
export const VOICE_GAIN = 2.5;

/**
 * Not the hook (phrases 0–3), not the name and its tagline (4–5), not the
 * three struck words (12–14) and not the offer (17–18): on all of those the
 * words are the picture. Every step over the phone, the two claims after
 * them, and both phrases under the close.
 */
export const SCRIPT = buildScript(
  words,
  [5, 5, 3, 4, 2, 4, 2, 4, 3, 6, 3, 1, 2, 2, 3, 4, 5, 2, 3, 6, 6],
  [6, 7, 8, 9, 10, 11, 15, 16, 19, 20],
  23.48
);

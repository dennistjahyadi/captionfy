/**
 * The line the default-style screen animates.
 *
 * That screen picks the style a new project starts in, and it runs before there
 * is a project: no video, no transcript, nothing for four preset tiles to draw.
 * So it draws this instead.
 *
 * It is a whole `Project` rather than a special case inside the picker, because
 * the tiles and the preview above them go through `createFrameSource` and
 * `layoutCaptionFrame` exactly as they do for somebody's real words. A sample
 * the layout treated differently would be a picture of the wrong app.
 */
import type { Ms, Project, StyleOverrides } from '../domain';

/** How long each word is held. Ordinary speech, so the cadence is not a lie. */
export const SAMPLE_WORD_MS = 380;

const SAMPLE_TEXT = ['Your', 'next', 'video', 'starts', 'in', 'this', 'style'];

/** The word the automatic rule would have picked, so Editorial has something to raise. */
const SAMPLE_EMPHASIS_INDEX = 5;

/**
 * The loop, which is exactly the words' own length.
 *
 * No tail: a gap after the last word is a frame with no caption in it, and the
 * preview would blink every time round.
 */
export const SAMPLE_LOOP_MS: Ms = SAMPLE_TEXT.length * SAMPLE_WORD_MS;

export function sampleProject(styleId: string, styleOverrides: StyleOverrides): Project {
  return {
    id: 'sample',
    sourceUri: '',
    durationMs: SAMPLE_LOOP_MS,
    createdAt: '',
    status: 'ready',
    progress: { processedMs: SAMPLE_LOOP_MS, totalMs: SAMPLE_LOOP_MS },
    // Contiguous, so a karaoke fill runs from one word straight into the next.
    words: SAMPLE_TEXT.map((text, index) => ({
      id: `sw${index + 1}`,
      text,
      asrText: text,
      origin: 'asr' as const,
      start: index * SAMPLE_WORD_MS,
      end: (index + 1) * SAMPLE_WORD_MS,
    })),
    lineFlags: [],
    globalOffsetMs: 0,
    autoEmphasis: [`sw${SAMPLE_EMPHASIS_INDEX + 1}`],
    styleId,
    styleOverrides,
  };
}

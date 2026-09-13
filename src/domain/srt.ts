/**
 * The transcript as a subtitle file.
 *
 * Pure TypeScript. No react-native imports belong in this directory.
 *
 * One cue per display unit, which is what the viewer sees one at a time, so the
 * .srt says the same thing the burned-in captions say at the same moments. A cue
 * runs until the line leaves the screen rather than until its last word ends,
 * because a subtitle that disappears between words flickers.
 */
import type { CaptionLine } from './lines';
import type { Ms } from './types';

export interface SrtOptions {
  /** Applied here as well as in the layout, so the file matches the video. */
  uppercase?: boolean;
}

/**
 * `00:00:01,234`, which is the only timestamp format SRT has.
 *
 * Hours are always present and milliseconds are always three digits; players are
 * forgiving about a lot of things and unforgiving about this.
 */
export function srtTime(ms: Ms): string {
  const total = Math.max(0, Math.round(ms));
  const hours = Math.floor(total / 3_600_000);
  const minutes = Math.floor(total / 60_000) % 60;
  const seconds = Math.floor(total / 1000) % 60;

  return [
    String(hours).padStart(2, '0'),
    String(minutes).padStart(2, '0'),
    String(seconds).padStart(2, '0'),
  ].join(':') + `,${String(total % 1000).padStart(3, '0')}`;
}

/**
 * The lines as an SRT file.
 *
 * `globalOffsetMs` is applied here because it is applied at render time
 * everywhere else: the offset moves the captions, and a sidecar file that
 * ignored it would be out of step with the video it ships beside.
 */
export function toSrt(
  lines: CaptionLine[],
  globalOffsetMs: Ms = 0,
  opts: SrtOptions = {}
): string {
  const cues: string[] = [];

  for (const line of lines) {
    const text = line.words
      .map((word) => word.text)
      .join(' ')
      .trim();
    if (text === '') continue;

    const from = Math.max(0, line.startMs + globalOffsetMs);
    // A line held until the next one starts can be held a long way past its last
    // word; `visibleUntilMs` already carries that rule and the cap on it.
    const to = Math.max(from + 1, line.visibleUntilMs + globalOffsetMs);

    cues.push(
      `${cues.length + 1}\n${srtTime(from)} --> ${srtTime(to)}\n${
        opts.uppercase ? text.toUpperCase() : text
      }\n`
    );
  }

  return cues.join('\n');
}

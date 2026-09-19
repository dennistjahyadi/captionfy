/**
 * The timeline arithmetic, in one place, with no imports.
 *
 * Both sides need it and they must not disagree: the Remotion composition lays
 * the beats out, and the storyboard and the self-check sample the middle of
 * each one and assert what should be visible there. A second copy of this sum
 * would mean the report at the end of a phase was checking a different video
 * than the one that rendered — which is the same failure mode as
 * `scripts/build-aab.sh` printing back the version it asked for.
 *
 * Pure data in, pure data out, so the composition can pass JSON imported by
 * webpack and a node script can pass JSON it read off the disk.
 *
 * @typedef {{ y: number, h: number }} Crop
 * @typedef {{ id: string, durationSec: number, source: string, what: string,
 *   vo: string, voInAt: number, title: (string|null), crop?: Crop,
 *   startSec?: number, titlePos?: string }} BeatSpec
 * @typedef {{ format: { width: number, height: number, fps: number },
 *   safeBox: { x0: number, x1: number, y0: number, y1: number },
 *   beats: BeatSpec[], sources: Object, cta: string }} Config
 * @typedef {BeatSpec & { from: number, frames: number, index: number }} Beat
 */

/**
 * Every beat in order, with absolute start frames.
 *
 * Lengths come straight from `config.beats[].durationSec`, which is a plan until
 * the voice exists and is replaced by what the voice measured after that. The
 * rule the first cut established and this one keeps: **the voice drives the
 * timing and is never stretched.** A product film reads as a product film
 * partly because the picture waits for the sentence rather than the reverse.
 *
 * @param {Config} config
 * @param {{ lines: ({id: string, sec: number}[] | null) }} timings
 * @returns {Beat[]}
 */
export const buildBeats = (config, timings) => {
  const fps = config.format.fps;
  /** @param {number} sec */
  const f = (sec) => Math.round(sec * fps);

  const measured = timings.lines;
  /** @param {string} id @param {number} planned */
  const seconds = (id, planned) => {
    const hit = measured?.find((m) => m.id === id);
    // The beat is the line plus the room the picture needs around it. A cut
    // landing on the last syllable reads as a mistake, so the plan's slack over
    // its own `vo` is kept rather than thrown away when the real length lands.
    return hit ? hit.sec + 0.8 : planned;
  };

  /** @type {Beat[]} */
  const out = [];
  let at = 0;

  config.beats.forEach((spec, index) => {
    const frames = f(seconds(spec.id, spec.durationSec));
    out.push({ ...spec, index, from: at, frames });
    at += frames;
  });

  return out;
};

/** @param {Beat[]} beats */
export const totalFrames = (beats) => beats.reduce((n, b) => n + b.frames, 0);

/** @param {{lines: unknown}} timings */
export const timingSource = (timings) => (timings.lines ? 'measured' : 'planned');

/**
 * The middle of every beat, in seconds — what the storyboard tiles and what the
 * self-check pulls a frame at and looks at.
 *
 * @param {Beat[]} beats @param {number} fps
 */
export const beatMidpoints = (beats, fps) =>
  beats.map((b) => ({
    kind: b.source,
    name: `${b.id} · ${b.what}`,
    sec: (b.from + b.frames / 2) / fps,
    fromSec: b.from / fps,
    durSec: b.frames / fps,
  }));

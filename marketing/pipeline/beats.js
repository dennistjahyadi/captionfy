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
 * @typedef {{ id: string, durationSec?: number, source: string, what: string,
 *   vo: string, voInAt: number, title: (string|null), crop?: Crop, introSec?: number, brandAtSec?: number,
 *   startSec?: number, titlePos?: string, kicker?: string,
 *   pointer?: string, segments?: Object[] }} BeatSpec
 * @typedef {{ format: { width: number, height: number, fps: number },
 *   safeBox: { x0: number, x1: number, y0: number, y1: number },
 *   beats: BeatSpec[], sources: Object, cta: string }} Config
 * @typedef {BeatSpec & { from: number, frames: number, index: number }} Beat
 */

/**
 * One video, two voices — pick the pair of files that belong to one of them.
 *
 * A second read of the same script is not a second project: the framing, the
 * safe box, the segments, the pointers, the nine beats and their on-screen
 * labels are all the same video, and a folder-per-voice would copy three
 * hundred lines of config to change a filename and seven hooks. So a voice is
 * an *overlay*: `config.voices.<id>` replaces whatever it names — the body
 * recording, the hook set, where the render lands — and `timings.voices.<id>`
 * carries that voice's own measurements.
 *
 * The default voice is the bare top level, unchanged, so a project that has
 * never heard of this reads exactly as it did.
 *
 * @param {any} config
 * @param {any} timings
 * @param {(string|null|undefined)} voice
 * @returns {{cfg: any, t: any, voice: string}}
 */
export const resolveVoice = (config, timings, voice) => {
  if (!voice || voice === 'default') return { cfg: config, t: timings, voice: 'default' };
  const over = config.voices?.[voice];
  if (!over) {
    const have = Object.keys(config.voices ?? {}).join(', ') || 'none';
    throw new Error(`No voice '${voice}' in config.json → voices. Have: ${have}.`);
  }
  // `voices` is carried through so a resolved config can still be re-resolved,
  // and so an error message downstream can still list the alternatives.
  return {
    cfg: { ...config, ...over, voices: config.voices },
    t: { ...timings, ...(timings.voices?.[voice] ?? {}) },
    voice,
  };
};

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
 * @param {{ lines: ({id: string, sec: number}[] | null), pad?: number }} timings
 * @returns {Beat[]}
 */
export const buildBeats = (config, timings) => {
  const fps = config.format.fps;
  /** @param {number} sec */
  const f = (sec) => Math.round(sec * fps);

  const measured = timings.lines;
  // How much room a measured line gets around it. 0.8 is right when the lines
  // were recorded one per file: a cut landing on the last syllable reads as a
  // mistake. It is wrong when one recording was *divided* into the lines, which
  // is what `split-voice.mjs` does — there the measured lengths already tile
  // the whole file, and adding room to each would walk the picture away from
  // the voice by 0.8 s per beat. That case writes `pad: 0`.
  const pad = typeof timings.pad === 'number' ? timings.pad : 0.8;
  /** @param {string} id @param {(number|undefined)} planned */
  const seconds = (id, planned) => {
    const hit = measured?.find((m) => m.id === id);
    if (hit) return hit.sec + pad;
    if (typeof planned === 'number') return planned;
    // Once the voice exists the beat lengths live in `timings.json` and
    // `config.json` stops carrying them, so a beat with neither is a beat the
    // recording does not cover — a line added to the script and never read.
    throw new Error(
      `Beat '${id}' has no measured length in timings.json and no durationSec in config.json. ` +
        'Re-run split-voice.mjs, or give it a planned length for a silent cut.'
    );
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

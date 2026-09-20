/**
 * What the tutorial compositions need to know about video 02.
 *
 * The body's arithmetic is `../../../pipeline/beats.js`, the same file the
 * render, the storyboard and the self-check use, so none of the four can
 * disagree about where a cut lands. The data is imported across the folder
 * boundary rather than copied, for the reason `film/timeline.ts` gives.
 */
import {
  buildBeats,
  beatMidpoints,
  resolveVoice,
  timingSource,
  totalFrames,
} from '../../../pipeline/beats.js';
import config from '../../../video-02-tutorial/config.json';
import timings from '../../../video-02-tutorial/timings.json';
import captionData from '../../../video-02-tutorial/captions.json';

export const CONFIG = config;
export const FPS = config.format.fps;
export const DIR = config.publicDir;

/**
 * Which read of the script a composition is rendering.
 *
 * Both voices' data is in the two JSON files and both are imported here, so
 * picking one is a lookup rather than a second bundle. The compositions take it
 * as a prop and `calculateMetadata` turns it into a duration, because a body
 * that is 62 s in one voice and 51 s in another cannot be a module constant.
 */
export type VoiceId = string;

/* Both sides of the overlay are plain JSON of different shapes — the default
   voice has `hooks` at the top level and `hale` has its own — so this is the
   one place the types are deliberately loose. Everything downstream narrows. */
type Resolved = { cfg: any; t: any };
const forVoice = (voice?: VoiceId): Resolved =>
  resolveVoice(config, timings, voice ?? 'default') as Resolved;

export const beatsFor = (voice?: VoiceId) => {
  const { cfg, t } = forVoice(voice);
  return buildBeats(cfg, t);
};
export const bodyFramesFor = (voice?: VoiceId): number => totalFrames(beatsFor(voice));
export const midpointsFor = (voice?: VoiceId) => beatMidpoints(beatsFor(voice), FPS);

/** The body's own recording for this voice, played whole from frame zero. */
export const voiceFileFor = (voice?: VoiceId): string | null =>
  forVoice(voice).t.voice?.file ?? null;

/**
 * How long each hook runs: its own recording plus a short tail.
 *
 * One number for all of them was right while they were silent. With voice it is
 * wrong in both directions — in the first set the shortest read is 2.6 s and the
 * longest 4.4 s, and in `hale` they run 4.4 s to 12.0 s. A shared number would
 * leave silence under the short ones and clip the long ones. The finished videos
 * are therefore not the same length as each other, which is fine: the body they
 * share is, and that is the half the test controls.
 *
 * Falls back to `config.hookSec` for a silent cut, where there is nothing to
 * measure.
 */
export const hookSecondsFor = (voice: VoiceId | undefined, id: string): number => {
  const { cfg, t } = forVoice(voice);
  const hit = ((t.hooks ?? []) as { id: string; sec: number; tailSec: number }[]).find(
    (h) => h.id === id
  );
  return hit ? hit.sec + hit.tailSec : (cfg.hookSec ?? 3.5);
};
export const hookFramesFor = (voice: VoiceId | undefined, id: string): number =>
  Math.round(hookSecondsFor(voice, id) * FPS);

export const hooksFor = (voice?: VoiceId): Hook[] => forVoice(voice).cfg.hooks as Hook[];

export const hookByIdFor = (voice: VoiceId | undefined, id: string): Hook => {
  const all = hooksFor(voice);
  const hit = all.find((h) => h.id === id);
  if (!hit) throw new Error(`no hook '${id}' in voice '${voice ?? 'default'}' — have ${all.map((h) => h.id).join(', ')}`);
  return hit;
};

/** The default voice, for anything that does not take a prop — the studio, the storyboard. */
export const BEATS = beatsFor();
export const BODY_FRAMES = bodyFramesFor();
export const TIMING_SOURCE = timingSource(timings);
export const MIDPOINTS = midpointsFor();
export const VOICE = voiceFileFor();
export const hookSeconds = (id: string): number => hookSecondsFor(undefined, id);
export const hookFrames = (id: string): number => hookFramesFor(undefined, id);

/** What a composition registers before it knows which hook it is rendering. */
export const HOOK_FRAMES = hookFrames(config.hooks[0].id);

export type Beat = (typeof BEATS)[number];

/**
 * One window of one recording, shown whole inside the device.
 *
 * `crop`, `scale` and `top` are gone with `ScreenCard`: nothing picks a band
 * of the screen any more, so a segment is a file, where to start, how long,
 * and optionally something to point at.
 */
export type Segment = {
  file: string;
  startSec: number;
  /** Omitted on a hook segment, which fills whatever the recording asks for. */
  durationSec?: number;
  pointer?: string;
  /** Playback rate for this window. 1 is as captured; below 1 slows a scroll. */
  rate?: number;
  /** Where in the app to move in on, in the recording's own 1080 x 2400 pixels. */
  focus?: {
    deviceX: number;
    deviceY: number;
    deviceW: number;
    deviceH: number;
    inSec: number;
    outSec: number;
    fill?: number;
    box?: boolean;
  };
};

export type Hook = {
  id: string;
  type: string;
  kind: 'export' | 'phone' | 'graphic';
  audio?: string;
  tailSec?: number;
  waveform?: boolean;
  title: string;
  titleAt: number;
  titlePos?: string;
  vo: string;
  startSec?: number;
  hitsSec?: number[];
  segments?: Segment[];
};

export const HOOKS = config.hooks as Hook[];

export const hookById = (id: string): Hook => {
  const hit = HOOKS.find((h) => h.id === id);
  if (!hit) throw new Error(`no hook '${id}' in config.json — have ${HOOKS.map((h) => h.id).join(', ')}`);
  return hit;
};

export const SAFE = config.safeBox;

/** Where in `export.mp4` a body beat that plays the export starts. */
export const exportStartFrame = (beatId: string): number => {
  const table = config.sources.export.startSec as Record<string, number>;
  return Math.round((table[beatId] ?? 0) * FPS);
};

export const clipStart = (sec: number | undefined): number => Math.round((sec ?? 0) * FPS);

export const POINTERS = config.pointers as Record<string, { deviceX: number; deviceY: number; r: number }>;

/**
 * The marketing subtitles for a recording, or none.
 *
 * Keyed by the file the words were spoken in, so the body's cues are looked up
 * by `timings.voice.file` and a hook's by its own `audio`. Both play from frame
 * zero of their own composition, so the times need no offset anywhere.
 *
 * See `Captions` for why these exist and why they are not Wordburn's output.
 */
export const cuesFor = (file: string | null | undefined) =>
  (file ? ((captionData as { cues: Record<string, unknown> }).cues[file] as
    { fromSec: number; toSec: number; words: { w: string; s: number }[] }[] | undefined) : undefined) ?? [];

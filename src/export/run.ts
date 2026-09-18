/**
 * One export, from a project to a file in the phone's gallery.
 *
 * The only place the burn-in module is called from. A screen asks for an export
 * and gets progress and an outcome; everything about plans, foreground services,
 * temporary files and what counts against the free tier is decided here, once.
 *
 * The order matters at the end: the free export is spent only after the file is
 * in the gallery. A render that fails, or that the user cancels, costs nothing.
 */
import { Directory, File, Paths } from 'expo-file-system';
import { Album, Asset, getPermissionsAsync, requestPermissionsAsync, type GranularPermission, type PermissionResponse } from 'expo-media-library';

import BurnIn, { type SavedFile, type VideoInfo } from '../../modules/burn-in';
import ForegroundService from '../../modules/foreground-service';
import { projectStyle, projectUnits, toSrt, type MeasureText, type Ms, type Project } from '../domain';
import { loadEntitlement, saveEntitlement } from '../policy/entitlement-store';
import { freeTierStatus, recordExport } from '../policy/free-tier';
import { projectDirectory } from '../project/store';
import { buildBurnPlan, exportSize } from '../render/burn';
import { estimateExportBytes } from './limits';

export { describeExportFailure } from './limits';

/** What the Options row offers. `source` keeps whatever the clip already was. */
export type ResolutionChoice = '720p' | '1080p' | 'source';

const CAPS: Record<ResolutionChoice, number> = {
  '720p': 720,
  '1080p': 1080,
  source: Number.POSITIVE_INFINITY,
};

export interface ExportRequest {
  project: Project;
  measure: MeasureText;
  resolution: ResolutionChoice;
  alsoSrt: boolean;
  /** Whatever the preview used, so the rise animates the same way or not at all. */
  reducedMotion: boolean;
  onProgress(done: number): void;
}

export interface ExportOutcome {
  /** The gallery asset, named the way the file on disk is named. */
  video: { name: string; byteLength: number };
  srt: SavedFile | null;
  /**
   * The app's own copy, kept so Share has a file to hand over.
   *
   * The gallery copy is a `content://` URI the share sheet cannot always take,
   * and the next export of this project overwrites this one, so the cost is one
   * video per project rather than one per export.
   */
  localPath: string;
  width: number;
  height: number;
  fps: number;
  durationMs: Ms;
  /** Wall clock, for the report and for nothing else. */
  elapsedMs: Ms;
}

export async function probeSource(project: Project): Promise<VideoInfo> {
  return BurnIn.probe(project.sourceUri);
}

/**
 * Write access, and nothing else: this app never reads the user's library.
 *
 * Asked write-only and for video alone, which on Android 13 and up comes to no
 * permission at all — adding a file you own needs none. The alternative was the
 * default ask, which on a caption app opens with "allow access to music and
 * audio on this device" and then asks for every photo as well.
 */
const NEEDS: { writeOnly: true; granular: GranularPermission[] } = {
  writeOnly: true,
  granular: ['video'],
};

/**
 * Asks for the gallery, before anything is rendered.
 *
 * Before, because a permission sheet after a minute of encoding is the export
 * failing at the last step, and because a user who says no has lost nothing.
 */
export async function canSaveToGallery(): Promise<boolean> {
  const held = await getPermissionsAsync(NEEDS.writeOnly, NEEDS.granular);
  if (enough(held)) return true;
  if (!held.canAskAgain) return false;
  return enough(await requestPermissionsAsync(NEEDS.writeOnly, NEEDS.granular));
}

/**
 * Whether the app can put a file in the gallery.
 *
 * "Select photos" on Android 14 reports limited access rather than granted, and
 * limited access can still add a file — it only narrows what can be read back.
 * Refusing to export on it would be this app enforcing a rule the platform does
 * not have.
 */
function enough(permission: PermissionResponse): boolean {
  return permission.granted || permission.accessPrivileges === 'limited';
}

/** The size an export would come out at, for the line on the Export screen. */
export function plannedSize(info: VideoInfo, resolution: ResolutionChoice) {
  return exportSize(info.width, info.height, CAPS[resolution]);
}

export interface SpaceCheck {
  enough: boolean;
  /** What the export will take, both copies of it. */
  needed: number;
  free: number;
}

/** Whether there is room, asked before anything is encoded. */
export function checkSpace(
  info: VideoInfo,
  resolution: ResolutionChoice,
  durationMs: Ms
): SpaceCheck {
  const size = plannedSize(info, resolution);
  const needed = estimateExportBytes(
    size.width,
    size.height,
    Math.round(info.fps || 30),
    durationMs
  );

  return { enough: Paths.availableDiskSpace > needed, needed, free: Paths.availableDiskSpace };
}

export async function runExport(request: ExportRequest): Promise<ExportOutcome> {
  const { project, measure, resolution, alsoSrt, reducedMotion, onProgress } = request;
  const started = Date.now();

  const info = await BurnIn.probe(project.sourceUri);
  const size = plannedSize(info, resolution);
  // A frame rate is only ever used to tell the encoder what to aim for. Every
  // frame keeps the timestamp it arrived with, so the file comes out at whatever
  // rate it went in at.
  const fps = Math.max(1, Math.round(info.fps || 30));
  const durationMs = Math.round(info.durationMs > 0 ? info.durationMs : project.durationMs);

  const directory = projectDirectory(project.id);
  const planFile = new File(directory, 'plan.json');
  const outputFile = new File(directory, 'export.mp4');

  // Read here rather than passed in by the screen, for the same reason the free
  // export is spent here: this is the file's own record of what was paid for, and
  // a screen that decided it could be a screen that got it wrong.
  const watermark = freeTierStatus(loadEntitlement()).watermark;

  planFile.write(
    JSON.stringify(
      buildBurnPlan(project, { ...size, fps, durationMs, reducedMotion, watermark }, measure)
    )
  );

  const subscription = BurnIn.addListener('progress', (event) => {
    onProgress(event.done);
    ForegroundService.update(Math.round(event.done * 100)).catch(() => undefined);
  });
  // Not awaited, ever. A foreground-service call that does not settle would stop
  // an export between two frames with the whole render already done.
  ForegroundService.start('Rendering your captions', 0).catch(() => undefined);

  try {
    const rendered = await BurnIn.render(
      project.sourceUri,
      planFile.uri.replace('file://', ''),
      outputFile.uri.replace('file://', '')
    );

    // Renamed before it is published, because the gallery and the share sheet
    // both take their name from the file. One arriving in somebody's messages as
    // `export.mp4` is this app's name on their screen, and it is the wrong one.
    const name = fileName(project, started);
    const shareable = keepAs(directory, outputFile, `${name}.mp4`);
    const video = await publish(shareable, `${name}.mp4`);
    const srt = alsoSrt ? await saveSrt(project, directory, name) : null;

    // Invariant 5, the far end of it: a free export is spent when the user has
    // the file, and not a moment earlier.
    saveEntitlement(recordExport(loadEntitlement()));

    return {
      video,
      srt,
      localPath: shareable,
      width: rendered.width,
      height: rendered.height,
      fps,
      durationMs: Math.round(rendered.durationMs),
      elapsedMs: Date.now() - started,
    };
  } finally {
    subscription.remove();
    ForegroundService.stop().catch(() => undefined);
    // The plan is a couple of megabytes of JSON that means nothing once the file
    // exists. The rendered file itself stays: Share needs something to share.
    if (planFile.exists) planFile.delete();
  }
}

/** Stops a render in flight. The partial file never reaches the gallery. */
export function cancelExport(): void {
  BurnIn.cancel();
}

/**
 * Puts the finished file in the gallery, in this app's own album.
 *
 * The album is a courtesy and failing to make one is not worth losing an export
 * over: the asset is already in the gallery by then, and a video the user cannot
 * find in an album is better than a video they do not have.
 */
async function publish(path: string, name: string): Promise<{ name: string; byteLength: number }> {
  // A URI, not a bare path: the library parses what it is given, and a string
  // with no scheme is not a file to everything that touches it on the way.
  const uri = `file://${path}`;
  const album = await Album.get(ALBUM);

  if (album) await Asset.create(uri, album);
  // `false` copies rather than moves: the app's own copy is what Share hands on.
  else await Album.create(ALBUM, [uri], false);

  return { name, byteLength: new File(uri).size ?? 0 };
}

/**
 * Renames the render to what the user was told it is called.
 *
 * Any earlier export of this project goes with it: one video per project is a
 * cost worth paying for a working Share button, one per export is a leak. Only
 * this app's own exports are touched — the source video lives in the same
 * directory and is the one file here that cannot be replaced.
 */
function keepAs(directory: Directory, rendered: File, name: string): string {
  try {
    for (const entry of directory.list()) {
      if (entry instanceof File && entry.name.startsWith(EXPORT_PREFIX) && entry.name.endsWith('.mp4')) {
        entry.delete();
      }
    }

    rendered.move(new File(directory, name));
    return new File(directory, name).uri.replace('file://', '');
  } catch {
    // A rename is a courtesy. The file itself is already in the gallery.
    return rendered.uri.replace('file://', '');
  }
}

async function saveSrt(project: Project, directory: Directory, name: string): Promise<SavedFile> {
  const style = projectStyle(project);
  const file = new File(directory, 'captions.srt');
  file.write(toSrt(projectUnits(project, style), project.globalOffsetMs, { uppercase: style.uppercase }));

  try {
    return await BurnIn.saveToDownloads(
      file.uri.replace('file://', ''),
      `${name}.srt`,
      'application/x-subrip'
    );
  } finally {
    if (file.exists) file.delete();
  }
}

/** What every file this app writes into a shared place is called. */
const EXPORT_PREFIX = 'Wordburn ';
const ALBUM = 'Wordburn';

/**
 * `Wordburn 2026-09-13 1421`, which sorts and says where it came from.
 *
 * Not the source file's name: two exports of the same clip would collide, and a
 * gallery full of `VID_20260913.mp4` is exactly the mess this avoids.
 */
function fileName(project: Project, at: number): string {
  const when = new Date(at);
  const pad = (value: number) => String(value).padStart(2, '0');

  return [
    EXPORT_PREFIX.trim(),
    `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}`,
    `${pad(when.getHours())}${pad(when.getMinutes())}${pad(when.getSeconds())}`,
  ].join(' ');
}

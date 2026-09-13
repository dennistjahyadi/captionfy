/** What the module hands back. Mirrors the `Record` classes in `BurnInModule.kt`. */

export interface BurnResult {
  path: string;
  width: number;
  height: number;
  byteLength: number;
  /** Frames actually written, which is how a silent truncation shows up. */
  frameCount: number;
  durationMs: number;
  hasAudio: boolean;
}

export interface SavedFile {
  /** A `content://` URI in the phone's own gallery. */
  uri: string;
  name: string;
  byteLength: number;
}

export interface VideoInfo {
  /** Upright, with rotation metadata already applied. */
  width: number;
  height: number;
  rotation: number;
  fps: number;
  durationMs: number;
  hasAudio: boolean;
}

export interface BurnProgress {
  /** 0..1 of the clip rendered. */
  done: number;
}

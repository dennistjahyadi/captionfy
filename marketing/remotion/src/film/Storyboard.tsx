import React from 'react';
import { AbsoluteFill, OffthreadVideo, staticFile } from 'remotion';

import { ACCENT, color, font } from '../brand';
import { useFonts } from '../useFonts';
import { CONFIG, MIDPOINTS, TIMING_SOURCE, TOTAL_FRAMES } from './timeline';

/**
 * The contact sheet: one frame from the middle of every beat, three columns.
 *
 * Drawn here rather than by ffmpeg's `tile` and `drawtext`, because the ffmpeg
 * on this machine is built without libfreetype and has no `drawtext` filter at
 * all — a contact sheet of unlabelled stills is a puzzle, not a review. Doing
 * it in Remotion also means the labels are set in the same faces the ad is,
 * which is the rule the rest of this folder already follows.
 *
 * Nine `OffthreadVideo`s at nine `startFrom`s, rendered as a single still: each
 * one decodes the frame it was asked for, so the sheet is the real render and
 * not a re-layout of it.
 */

/**
 * The sheet is taller than a video frame and runs at the *video's* fps.
 *
 * The fps is not cosmetic on a one-frame composition. `OffthreadVideo` turns
 * `startFrom` into a seek time by dividing by the composition's fps, so at
 * 1 fps every tile asked for a time in the hundreds of seconds, ran off the end
 * of a 24-second file and clamped to the last frame — nine identical tiles of
 * the end card, which looks exactly like a layout bug and is not one.
 */
const PAD = 24;
const GAP = 16;
const COLS = 3;
// Rounded, both of them. A composition's width and height must be integers or
// Remotion refuses to register it — and it refuses to register *every*
// composition in the file, so a fractional tile height here took the film down
// with it and the failure read as "no compositions found".
const TILE_W = Math.round((1080 - PAD * 2 - GAP * (COLS - 1)) / COLS);
const TILE_H = Math.round((TILE_W * CONFIG.format.height) / CONFIG.format.width);
const LABEL_H = 62;

const ROWS = Math.ceil(MIDPOINTS.length / COLS);
export const SHEET = {
  width: 1080,
  // Tall enough for the beats there are, rather than for nine. A sheet with a
  // screen of black under the last row reads as a render that failed.
  height: Math.round(110 + PAD * 2 + ROWS * (TILE_H + LABEL_H + GAP)),
  fps: CONFIG.format.fps,
} as const;


const KIND_TONE: Record<string, string> = {
  airplane: color.mute,
  processing: color.mute,
  line: ACCENT,
  end: color.paper,
};

export const Storyboard: React.FC = () => {
  useFonts();

  const totalSec = TOTAL_FRAMES / CONFIG.format.fps;

  return (
    <AbsoluteFill style={{ background: '#0B0A0A', padding: PAD }}>
      <div style={{ height: 110, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div
          style={{
            fontFamily: font.bold,
            fontSize: 42,
            color: color.paper,
            letterSpacing: -1.2,
          }}
        >
          {CONFIG.title}
        </div>
        <div style={{ fontFamily: font.medium, fontSize: 26, color: color.mute, marginTop: 8 }}>
          {MIDPOINTS.length} beats · {totalSec.toFixed(2)} s · {TOTAL_FRAMES} frames ·{' '}
          {CONFIG.format.width}×{CONFIG.format.height} · {TIMING_SOURCE} line lengths · silent
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: GAP,
          marginTop: 12,
        }}
      >
        {MIDPOINTS.map((m, i) => {
          const frame = Math.round(m.sec * CONFIG.format.fps);
          return (
            <div key={m.name + i} style={{ width: TILE_W }}>
              <div
                style={{
                  width: TILE_W,
                  height: TILE_H,
                  overflow: 'hidden',
                  border: `2px solid ${color.line}`,
                  borderRadius: 10,
                  position: 'relative',
                  background: color.ink,
                }}
              >
                <OffthreadVideo
                  src={staticFile('film/preview.mp4')}
                  startFrom={frame}
                  muted
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    background: 'rgba(0,0,0,0.75)',
                    color: KIND_TONE[m.kind],
                    fontFamily: font.bold,
                    fontSize: 20,
                    padding: '4px 12px',
                    borderRadius: 999,
                  }}
                >
                  {i + 1}
                </div>
              </div>

              <div style={{ height: LABEL_H, paddingTop: 10 }}>
                <div
                  style={{
                    fontFamily: font.semibold,
                    fontSize: 19,
                    color: color.paper,
                    lineHeight: 1.2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {m.name}
                </div>
                <div style={{ fontFamily: font.medium, fontSize: 17, color: color.mute, marginTop: 4 }}>
                  {m.fromSec.toFixed(1)}–{(m.fromSec + m.durSec).toFixed(1)} s · {m.durSec.toFixed(1)} s
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

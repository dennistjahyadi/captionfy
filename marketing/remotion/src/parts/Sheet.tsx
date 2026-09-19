import React from 'react';
import { AbsoluteFill, OffthreadVideo, staticFile } from 'remotion';

import { ACCENT, color, font } from '../brand';
import { useFonts } from '../useFonts';

/**
 * A contact sheet: one frame per tile, three columns, labelled.
 *
 * Drawn here rather than by ffmpeg's `tile` and `drawtext`, because the ffmpeg
 * on this machine is built without libfreetype and has no `drawtext` filter at
 * all — a contact sheet of unlabelled stills is a puzzle, not a review. Doing
 * it in Remotion also means the labels are set in the same faces the video is.
 *
 * Every tile is an `OffthreadVideo` at its own `startFrom`, rendered as a
 * single still: each one decodes the frame it was asked for, so the sheet is
 * the real render and not a re-layout of it. Which file a tile reads is the
 * tile's business — video 01 sheets one preview, video 02 sheets six hooks and
 * a body — so the sheet is generic and each video's storyboard fills it.
 */
export type Tile = {
  /** Path under `public/`. */
  file: string;
  frame: number;
  label: string;
  sub: string;
  tone?: 'mute' | 'accent' | 'paper';
};

const PAD = 24;
const GAP = 16;
const COLS = 3;
const HEADER = 110;
// Rounded, both of them. A composition's width and height must be integers or
// Remotion refuses to register it — and it refuses to register *every*
// composition in the file, so a fractional tile height here took the film down
// with it and the failure read as "no compositions found".
const TILE_W = Math.round((1080 - PAD * 2 - GAP * (COLS - 1)) / COLS);
const TILE_H = Math.round((TILE_W * 1920) / 1080);
const LABEL_H = 62;

/** The composition size for a sheet of `count` tiles. */
export const sheetSize = (count: number, fps: number) => ({
  width: 1080,
  // Tall enough for the tiles there are, rather than for nine. A sheet with a
  // screen of black under the last row reads as a render that failed.
  height: Math.round(HEADER + PAD * 2 + Math.ceil(count / COLS) * (TILE_H + LABEL_H + GAP)),
  // The sheet is one frame and runs at the *video's* fps. `OffthreadVideo`
  // turns `startFrom` into a seek time by dividing by the composition's fps,
  // so at 1 fps every tile asked for a time in the hundreds of seconds, ran off
  // the end of the file and clamped to the last frame.
  fps,
});

const TONE = { mute: color.mute, accent: ACCENT, paper: color.paper } as const;

export const Sheet: React.FC<{ title: string; subtitle: string; tiles: Tile[] }> = ({
  title,
  subtitle,
  tiles,
}) => {
  useFonts();

  return (
    <AbsoluteFill style={{ background: '#0B0A0A', padding: PAD }}>
      <div style={{ height: HEADER, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontFamily: font.bold, fontSize: 42, color: color.paper, letterSpacing: -1.2 }}>
          {title}
        </div>
        <div style={{ fontFamily: font.medium, fontSize: 26, color: color.mute, marginTop: 8 }}>
          {subtitle}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: GAP, marginTop: 12 }}>
        {tiles.map((t, i) => (
          <div key={`${t.file}:${t.frame}:${i}`} style={{ width: TILE_W }}>
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
                src={staticFile(t.file)}
                startFrom={t.frame}
                muted
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: 8,
                  left: 8,
                  background: 'rgba(0,0,0,0.75)',
                  color: TONE[t.tone ?? 'mute'],
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
                {t.label}
              </div>
              <div style={{ fontFamily: font.medium, fontSize: 17, color: color.mute, marginTop: 4 }}>
                {t.sub}
              </div>
            </div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

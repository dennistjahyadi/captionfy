import React from 'react';

import { Sheet, Tile, sheetSize } from '../parts/Sheet';
import { BODY_FRAMES, CONFIG, DIR, FPS, HOOKS, MIDPOINTS, TIMING_SOURCE, hookSeconds } from './timeline';

/**
 * Video 02's contact sheet: the six hooks across the top, then the body.
 *
 * Each hook tile is its own render at 1.5 s — the moment the algorithm has
 * decided — off `public/tutorial/preview-hook-<id>.mp4`; each body tile is the
 * middle of a beat off `preview-body.mp4`. `storyboard.mjs` stages both. This
 * is the picture the pacing gets signed off on before a voice is recorded.
 */
const HOOK_TILE_SEC = 1.5;

const tiles: Tile[] = [
  ...HOOKS.map((h, i) => ({
    file: `${DIR}/preview-hook-${h.id}.mp4`,
    frame: Math.round(HOOK_TILE_SEC * FPS),
    label: `hook ${i + 1} · ${h.id} — ${h.title}`,
    sub: `${hookSeconds(h.id).toFixed(2)} s · ${h.type}`,
    tone: 'accent' as const,
  })),
  ...MIDPOINTS.map((m) => ({
    file: `${DIR}/preview-body.mp4`,
    frame: Math.round(m.sec * FPS),
    label: m.name,
    sub: `${m.fromSec.toFixed(1)}–${(m.fromSec + m.durSec).toFixed(1)} s · ${m.durSec.toFixed(1)} s`,
    tone: (m.kind === 'export' ? 'paper' : 'mute') as 'paper' | 'mute',
  })),
];

export const SHEET = sheetSize(tiles.length, FPS);

export const Storyboard: React.FC = () => (
  <Sheet
    title={CONFIG.title}
    subtitle={
      `${HOOKS.length} hooks (${Math.min(...HOOKS.map((h) => hookSeconds(h.id))).toFixed(1)}–${Math.max(...HOOKS.map((h) => hookSeconds(h.id))).toFixed(1)} s) + body ${(BODY_FRAMES / FPS).toFixed(2)} s · ` +
      `${MIDPOINTS.length} beats · ${CONFIG.format.width}×${CONFIG.format.height} · ${TIMING_SOURCE} line lengths`
    }
    tiles={tiles}
  />
);

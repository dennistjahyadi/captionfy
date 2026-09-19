import React from 'react';

import { Sheet, sheetSize } from '../parts/Sheet';
import { CONFIG, MIDPOINTS, TIMING_SOURCE, TOTAL_FRAMES } from './timeline';

/**
 * The film's contact sheet: one frame from the middle of every beat, off
 * whatever is staged at `public/film/preview.mp4`.
 *
 * The drawing is `parts/Sheet`, shared with video 02; this file only says which
 * frames. Taller than a video frame on purpose — it is a thing to look at on a
 * phone, not a thing to upload.
 */
export const SHEET = sheetSize(MIDPOINTS.length, CONFIG.format.fps);

const TONE: Record<string, 'mute' | 'accent' | 'paper'> = {
  export: 'accent',
  card: 'paper',
};

export const Storyboard: React.FC = () => {
  const totalSec = TOTAL_FRAMES / CONFIG.format.fps;

  return (
    <Sheet
      title={CONFIG.title}
      subtitle={
        `${MIDPOINTS.length} beats · ${totalSec.toFixed(2)} s · ${TOTAL_FRAMES} frames · ` +
        `${CONFIG.format.width}×${CONFIG.format.height} · ${TIMING_SOURCE} line lengths · silent`
      }
      tiles={MIDPOINTS.map((m) => ({
        file: 'film/preview.mp4',
        frame: Math.round(m.sec * CONFIG.format.fps),
        label: m.name,
        sub: `${m.fromSec.toFixed(1)}–${(m.fromSec + m.durSec).toFixed(1)} s · ${m.durSec.toFixed(1)} s`,
        tone: TONE[m.kind] ?? 'mute',
      }))}
    />
  );
};

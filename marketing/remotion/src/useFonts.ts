import { useEffect, useState } from 'react';
import { continueRender, delayRender, staticFile } from 'remotion';

import { font } from './brand';

const FACES: { family: string; file: string }[] = [
  { family: font.bold, file: 'fonts/BeVietnamPro-ExtraBold.ttf' },
  { family: font.semibold, file: 'fonts/BeVietnamPro-SemiBold.ttf' },
  { family: font.medium, file: 'fonts/BeVietnamPro-Medium.ttf' },
  { family: font.serif, file: 'fonts/Spectral-ExtraBold.ttf' },
];

/**
 * Block the render until the real TTFs are in the document.
 *
 * Without the delay the first frames rasterise in a fallback face and the whole
 * ad is a different width than the rest of it — the same class of mistake as
 * letting the burn-in set a word in a face the preview never saw.
 */
export const useFonts = () => {
  const [handle] = useState(() => delayRender('loading the app fonts'));

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      FACES.map(async ({ family, file }) => {
        const face = new FontFace(family, `url(${staticFile(file)})`);
        await face.load();
        document.fonts.add(face);
      })
    )
      .then(() => document.fonts.ready)
      .then(() => {
        if (!cancelled) continueRender(handle);
      })
      .catch(() => continueRender(handle));

    return () => {
      cancelled = true;
    };
  }, [handle]);
};

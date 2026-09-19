import React from 'react';
import { Composition } from 'remotion';

import { Emphasis, EMPHASIS_FRAMES } from './ads/Emphasis';
import { Offline, OFFLINE_FRAMES } from './ads/Offline';
import { PayOnce, PAY_ONCE_FRAMES } from './ads/PayOnce';
import { Film } from './film/Film';
import { SHEET, Storyboard } from './film/Storyboard';
import { CONFIG, TOTAL_FRAMES as FILM_FRAMES } from './film/timeline';
import { FORMAT } from './brand';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="offline"
      component={Offline}
      durationInFrames={OFFLINE_FRAMES}
      {...FORMAT}
    />
    <Composition
      id="pay-once"
      component={PayOnce}
      durationInFrames={PAY_ONCE_FRAMES}
      {...FORMAT}
    />
    <Composition
      id="emphasis"
      component={Emphasis}
      durationInFrames={EMPHASIS_FRAMES}
      {...FORMAT}
    />

    {/*
      Video 01 — the product film. A paid 9:16 unit, cut from the app's own
      exported file and from emulator recordings of the app, with no stock
      footage and no faces in it at all: free libraries do not collect model
      releases, and a paid advertisement is the exact use a release covers.
      STORE-ASSETS.md sets that out and this follows it.
    */}
    <Composition
      id="film"
      component={Film}
      durationInFrames={FILM_FRAMES}
      defaultProps={{ variant: CONFIG.defaultVariant }}
      {...FORMAT}
    />

    {/*
      The contact sheet for whatever is staged at public/film/preview.mp4.
      Rendered as a still, and taller than a video frame on purpose — it is a
      thing to look at on a phone, not a thing to upload.
    */}
    <Composition
      id="film-storyboard"
      component={Storyboard}
      durationInFrames={1}
      {...SHEET}
    />
  </>
);

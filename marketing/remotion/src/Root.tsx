import React from 'react';
import { Composition } from 'remotion';

import { Emphasis, EMPHASIS_FRAMES } from './ads/Emphasis';
import { Offline, OFFLINE_FRAMES } from './ads/Offline';
import { PayOnce, PAY_ONCE_FRAMES } from './ads/PayOnce';
import { Film } from './film/Film';
import { SHEET, Storyboard } from './film/Storyboard';
import { CONFIG, TOTAL_FRAMES as FILM_FRAMES } from './film/timeline';
import { Body } from './tutorial/Body';
import { Hook } from './tutorial/Hook';
import { SHEET as TUTORIAL_SHEET, Storyboard as TutorialStoryboard } from './tutorial/Storyboard';
import { Tutorial, TUTORIAL_FRAMES, tutorialFrames } from './tutorial/Tutorial';
import { BODY_FRAMES, HOOKS, HOOK_FRAMES, bodyFramesFor, hookFramesFor } from './tutorial/timeline';
import { JustCaptionsAd, TOTAL_FRAMES as JUSTCAPTIONS_FRAMES } from './justcaptions/Ad';
import { NoCreditsAd, TOTAL_FRAMES as NOCREDITS_FRAMES } from './nocredits/Ad';
import { NoInternetAd, TOTAL_FRAMES as NOINTERNET_FRAMES } from './nointernet/Ad';
import { PayOnceAd, TOTAL_FRAMES as PAYONCE_FRAMES } from './payonce/Ad';
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

    {/*
      Video 02 — six hooks, one tutorial. Organic 9:16. The render goes through
      `tutorial-hook` (six times, one per hook id) and `tutorial-body` (once),
      and ffmpeg joins them without re-encoding; `tutorial` is the whole thing
      for the studio, so a join can be watched before it is made.
    */}
    <Composition
      id="tutorial-body"
      component={Body}
      durationInFrames={BODY_FRAMES}
      defaultProps={{ voice: 'default' }}
      calculateMetadata={({ props }) => ({ durationInFrames: bodyFramesFor(props.voice as string) })}
      {...FORMAT}
    />
    {/*
      A hook's length is its own recording plus a tail, so it is computed from
      the prop rather than registered as a constant: the six reads run from
      2.6 s to 4.4 s, and one shared number would leave silence under the short
      ones and clip the long ones.
    */}
    <Composition
      id="tutorial-hook"
      component={Hook}
      durationInFrames={HOOK_FRAMES}
      defaultProps={{ hook: HOOKS[0].id, voice: 'default' }}
      calculateMetadata={({ props }) => ({ durationInFrames: hookFramesFor(props.voice as string, props.hook) })}
      {...FORMAT}
    />
    <Composition
      id="tutorial"
      component={Tutorial}
      durationInFrames={TUTORIAL_FRAMES}
      defaultProps={{ hook: HOOKS[0].id, voice: 'default' }}
      calculateMetadata={({ props }) => ({ durationInFrames: tutorialFrames(props.voice as string, props.hook) })}
      {...FORMAT}
    />
    <Composition
      id="tutorial-storyboard"
      component={TutorialStoryboard}
      durationInFrames={1}
      {...TUTORIAL_SHEET}
    />

    {/*
      Video 03 — three voiced 9:16 ads, about 23 s each, cut to the recordings
      in marketing/video-03-pain-ads/. `render.sh` there stages the voice and
      renders any of them. They share `src/voiced/`.
    */}
    <Composition
      id="payonce"
      component={PayOnceAd}
      durationInFrames={PAYONCE_FRAMES}
      {...FORMAT}
    />
    <Composition
      id="nointernet"
      component={NoInternetAd}
      durationInFrames={NOINTERNET_FRAMES}
      {...FORMAT}
    />
    <Composition
      id="nocredits"
      component={NoCreditsAd}
      durationInFrames={NOCREDITS_FRAMES}
      {...FORMAT}
    />
    <Composition
      id="justcaptions"
      component={JustCaptionsAd}
      durationInFrames={JUSTCAPTIONS_FRAMES}
      {...FORMAT}
    />
  </>
);

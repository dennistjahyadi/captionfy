import React from 'react';
import { Composition } from 'remotion';

import { Emphasis, EMPHASIS_FRAMES } from './ads/Emphasis';
import { Offline, OFFLINE_FRAMES } from './ads/Offline';
import { PayOnce, PAY_ONCE_FRAMES } from './ads/PayOnce';
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
  </>
);

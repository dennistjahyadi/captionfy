import React, { createContext, useContext } from 'react';

/**
 * What a composition has to tell the shared parts about the video it belongs
 * to, and nothing more.
 *
 * Two things differ between video 01 and video 02 and both used to be module
 * constants in the film's `timeline.ts`: the safe box (paid 1128 against
 * organic 1498) and the `public/` subfolder the media is staged in. A part that
 * imported the film's timeline would draw video 02's titles against video 01's
 * floor, which is the kind of quiet cross-wiring a second copy of `parts.tsx`
 * was going to be created to avoid. A context is the copy-free way: each
 * composition provides its own and the parts read whichever they are inside.
 */
export type SafeBox = { x0: number; x1: number; y0: number; y1: number };

export type Project = {
  safe: SafeBox;
  /** `public/<dir>/` — where this video's recordings and export are staged. */
  dir: string;
};

const ORGANIC: SafeBox = { x0: 60, x1: 960, y0: 211, y1: 1498 };

const ProjectContext = createContext<Project>({ safe: ORGANIC, dir: 'film' });

export const ProjectProvider: React.FC<{ value: Project; children: React.ReactNode }> = ({
  value,
  children,
}) => <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;

export const useProject = () => useContext(ProjectContext);
export const useSafeBox = () => useContext(ProjectContext).safe;

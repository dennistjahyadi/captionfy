/**
 * Reading a project the way every consumer must read it.
 *
 * Pure TypeScript. No react-native imports belong in this directory.
 *
 * The layout, the emphasis picker and the transcript all have to agree on where
 * the lines fall, or a word emphasised in one line would land in a different
 * line on screen. One function decides, and all three call it.
 */
import { displayUnits, type CaptionLine } from './lines';
import { resolveStyle, type StyleProps } from './style';
import type { Project } from './types';

export function projectStyle(project: Project): StyleProps {
  return resolveStyle(project.styleId, project.styleOverrides);
}

export function projectUnits(project: Project, style = projectStyle(project)): CaptionLine[] {
  return displayUnits(project.words, style);
}

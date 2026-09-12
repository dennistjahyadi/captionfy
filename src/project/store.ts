/**
 * Where a project lives on disk.
 *
 * Invariant 3, no lost work: a project file is written the moment a video is
 * picked, and every finished chunk is checkpointed. Killing the app at any point
 * and reopening lands the user back where they were with everything already
 * transcribed intact.
 *
 * Writes are synchronous. A checkpoint that is still in flight when the process
 * dies is not a checkpoint, and the files involved are small enough that the
 * cost is invisible next to an encoder pass.
 */
import { Directory, File, Paths } from 'expo-file-system';

import type { Ms, Project, ProjectStatus } from '../domain';
import { loadSettings } from './settings';

/** Bumped when the on-disk shape changes in a way an old file cannot satisfy. */
export const PROJECT_FORMAT = 1;

/**
 * Everything the transcription pass needs to pick up where it stopped.
 *
 * Kept beside the project rather than inside it, because the domain's `Project`
 * describes captions and knows nothing about encoder windows.
 */
export interface PipelineState {
  format: number;
  /** Chunks as the packer produced them. Stored so a resume segments identically. */
  chunks: { t0Ms: Ms; t1Ms: Ms }[];
  /** How many of those have been transcribed and checkpointed. */
  chunksDone: number;
  sampleRate: number;
  /** Set when a pass failed, so Home can say what went wrong. */
  error?: string;
}

function projectsDirectory(): Directory {
  const directory = new Directory(Paths.document, 'projects');
  if (!directory.exists) directory.create({ intermediates: true });
  return directory;
}

export function projectDirectory(id: string): Directory {
  const directory = new Directory(projectsDirectory(), id);
  if (!directory.exists) directory.create({ intermediates: true });
  return directory;
}

export function pcmPath(id: string): string {
  // The native extractor deals in filesystem paths; expo-file-system deals in URIs.
  return new File(projectDirectory(id), 'audio.pcm').uri.replace('file://', '');
}

export function envelopeFile(id: string): File {
  return new File(projectDirectory(id), 'envelope.f32');
}

export function thumbnailFile(id: string): File {
  return new File(projectDirectory(id), 'thumb.jpg');
}

export function newProjectId(): string {
  return `p${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

/**
 * Writes a project the moment a video is picked.
 *
 * Nothing has been decoded yet and that is the point: the row is on Home, and a
 * crash during extraction loses a few seconds rather than the user's place.
 */
export function createProject(sourceUri: string, durationMs: Ms): Project {
  // The look the user settled on last time. A creator has a style, not a style
  // per clip, so a new project starts where the last one ended up.
  const settings = loadSettings();

  const project: Project = {
    id: newProjectId(),
    sourceUri,
    durationMs,
    createdAt: new Date().toISOString(),
    status: 'extracting',
    progress: { processedMs: 0, totalMs: durationMs },
    words: [],
    lineFlags: [],
    autoEmphasis: [],
    globalOffsetMs: 0,
    styleId: settings.styleId,
    styleOverrides: settings.styleOverrides,
  };

  saveProject(project);
  return project;
}

export function saveProject(project: Project): void {
  new File(projectDirectory(project.id), 'project.json').write(
    JSON.stringify({ format: PROJECT_FORMAT, project })
  );
}

export function loadProject(id: string): Project | null {
  const file = new File(projectDirectory(id), 'project.json');
  if (!file.exists) return null;

  try {
    const parsed = JSON.parse(file.textSync()) as { format: number; project: Project };
    if (parsed.format !== PROJECT_FORMAT) return null;
    return parsed.project;
  } catch {
    // A half-written file is a project we cannot show. Saying so beats crashing
    // the list that every other project is also in.
    return null;
  }
}

/** Newest first, which is the order Home wants and the only order it wants. */
export function listProjects(): Project[] {
  return projectsDirectory()
    .list()
    .filter((entry): entry is Directory => entry instanceof Directory)
    .map((entry) => loadProject(entry.name))
    .filter((project): project is Project => project !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function deleteProject(id: string): void {
  const directory = new Directory(projectsDirectory(), id);
  if (directory.exists) directory.delete();
}

export function setStatus(project: Project, status: ProjectStatus): Project {
  const next: Project = { ...project, status };
  saveProject(next);
  return next;
}

export function savePipeline(id: string, state: PipelineState): void {
  new File(projectDirectory(id), 'pipeline.json').write(JSON.stringify(state));
}

export function loadPipeline(id: string): PipelineState | null {
  const file = new File(projectDirectory(id), 'pipeline.json');
  if (!file.exists) return null;

  try {
    const parsed = JSON.parse(file.textSync()) as PipelineState;
    return parsed.format === PROJECT_FORMAT ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * The energy envelope, as raw little-endian float32.
 *
 * JSON would triple the size and lose precision for a value that is read back
 * as a typed array either way.
 */
export function saveEnvelope(id: string, envelope: Float32Array): void {
  envelopeFile(id).write(new Uint8Array(envelope.buffer, envelope.byteOffset, envelope.byteLength));
}

export function loadEnvelope(id: string): Float32Array | null {
  const file = envelopeFile(id);
  if (!file.exists) return null;
  const bytes = file.bytesSync();
  // bytesSync may hand back a view into a larger buffer.
  return new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}

export function hasPcm(id: string): boolean {
  const file = new File(projectDirectory(id), 'audio.pcm');
  return file.exists && file.size > 0;
}

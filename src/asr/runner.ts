/**
 * Driving one clip from a picked file to a ready transcript.
 *
 * Extract, envelope, VAD, pack, transcribe chunk by chunk, then line the words
 * up. Every finished chunk is written to disk before the next one starts, so the
 * worst a kill can cost is the chunk in flight (invariant 3).
 *
 * One run at a time. A whisper context is most of a hundred megabytes and two of
 * them on a mid-range phone is an out-of-memory kill, not a slow app.
 */
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { File } from 'expo-file-system';
import type { WhisperContext } from 'whisper.rn';

import { extractPcm16 } from '../../modules/audio-extract';
import {
  appendWords,
  applyDictionary,
  computeAutoEmphasis,
  computeEnvelopeFromPcm16,
  createIdFactory,
  lineFlagsFor,
  packSpansIntoChunks,
  toWords,
  wordFeatures,
  type DictionaryEntry,
  type Ms,
  type Project,
  type Span,
} from '../domain';
import * as service from '../native/foreground-service';
import {
  createProject,
  envelopeFile,
  loadEnvelope,
  loadPipeline,
  loadProject,
  pcmPath,
  PROJECT_FORMAT,
  saveEnvelope,
  saveProject,
  savePipeline,
  type PipelineState,
} from '../project/store';
import { adoptSource } from '../project/source';
import { ensureAllModels } from './models';
import {
  detectSpeech,
  MAX_CHUNK_MS,
  MIN_SPAN_MS,
  openWhisper,
  pcmDurationMs,
  SAMPLE_RATE,
  transcribeChunk,
} from './whisper';

export type Stage =
  | 'queued'
  | 'downloading'
  | 'extracting'
  | 'transcribing'
  | 'aligning'
  | 'ready'
  | 'paused'
  | 'failed';

export interface RunState {
  projectId: string;
  stage: Stage;
  project: Project;
  /** 0..1 over the whole pass. */
  fraction: number;
  /** Only once the first chunk has landed; before that any estimate is a guess. */
  etaMs?: Ms;
  error?: string;
}

/** What the Processing screen shows as one short line. */
export const STAGE_LABEL: Record<Stage, string> = {
  queued: 'Getting ready',
  downloading: 'Getting the model',
  extracting: 'Getting audio',
  transcribing: 'Transcribing',
  aligning: 'Lining up words',
  ready: 'Done',
  paused: 'Paused — keep the app open to finish',
  failed: 'Something went wrong',
};

/**
 * How far the picker's duration may be out before the decoded audio replaces it.
 *
 * A quarter of a second covers the ordinary case of an audio track ending
 * slightly before the picture, and is far below the seven second error that made
 * this check necessary.
 */
const DURATION_TRUST_MS = 250;

type Listener = (state: RunState) => void;

const listeners = new Set<Listener>();
let current: RunState | null = null;
let cancelled = false;
/** Set when the app goes to the background on a platform that cannot keep working. */
let pauseRequested = false;
let running = false;

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  if (current) listener(current);
  return () => listeners.delete(listener);
}

export function currentRun(): RunState | null {
  return current;
}

function publish(next: Partial<RunState>): void {
  if (!current) return;
  current = { ...current, ...next };
  for (const listener of listeners) listener(current);
}

/** Picks up a project the user just chose, or resumes one that was interrupted. */
export function startRun(project: Project): void {
  if (running && current?.projectId === project.id) return;
  if (running) return;

  cancelled = false;
  pauseRequested = false;
  current = { projectId: project.id, stage: 'queued', project, fraction: 0 };
  running = true;
  void run(project).finally(() => {
    running = false;
  });
}

export function cancelRun(): void {
  cancelled = true;
}

/** Creates the project row first, so a crash during extraction loses nothing. */
export function beginProject(sourceUri: string, durationMs: Ms): Project {
  const created = createProject(sourceUri, durationMs);

  // Then the video itself, before any decoding: what the picker returned is a
  // copy in a cache the system may clear, and a project that outlives its video
  // has lost the user's work as surely as a crash would (invariant 3).
  const project = { ...created, sourceUri: adoptSource(created.id, sourceUri) };
  saveProject(project);

  startRun(project);
  return project;
}

/**
 * Android keeps working in the background behind a foreground service. iOS is
 * out of scope for v1 beyond stopping cleanly and picking up again, so it asks
 * for a pause and the screen says why.
 */
function watchAppState(): () => void {
  const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
    if (Platform.OS === 'ios' && status.match(/inactive|background/)) pauseRequested = true;
    if (status === 'active') pauseRequested = false;
  });
  return () => subscription.remove();
}

async function run(initial: Project): Promise<void> {
  const stopWatching = watchAppState();
  let context: WhisperContext | undefined;
  let project = initial;

  try {
    publish({ stage: 'downloading' });
    // The bar shows the download's own progress, not a sliver of the whole run.
    // Eighty-five megabytes on first launch is the longest wait in the product,
    // and a bar that creeps from nought to two percent looks broken.
    await ensureAllModels((fraction) => publish({ fraction }));
    publish({ fraction: 0 });

    // Everything up to the first transcribe call is "getting audio" as far as
    // the user is concerned: reading the PCM back, the envelope, and finding the
    // speech. Leaving the label on the model download through all of that made
    // the screen claim to be downloading a model it already had.
    publish({ stage: 'extracting' });
    const pcm = await loadOrExtract(project);
    project = save({
      ...withRealDuration(loadFresh(project), pcmDurationMs(pcm.byteLength)),
      status: 'transcribing',
    });

    const pipeline = await planChunks(project, pcm);
    if (pipeline.chunks.length === 0) {
      project = finish(project, []);
      publish({ stage: 'ready', project, fraction: 1 });
      return;
    }

    // Started, never awaited. The notification is a courtesy and the platform
    // has many opinions about foreground services; none of them may be allowed
    // to hold up a transcription. See `update` below.
    void service.start('Captioning your video', 0);

    context = await openWhisper();
    const pass = await transcribeAll(project, pcm, pipeline, context);
    project = pass.project;
    // Stopping part way through is not finishing. The checkpoint holds and the
    // next run picks up at the chunk after the last one written.
    if (!pass.complete) return;

    publish({ stage: 'aligning' });
    project = finish(project, []);
    publish({ stage: 'ready', project, fraction: 1 });
  } catch (error) {
    const message = describe(error);
    project = save({ ...loadFresh(project), status: 'failed' });
    savePipeline(project.id, { ...(loadPipeline(project.id) ?? emptyPipeline()), error: message });
    publish({ stage: 'failed', project, error: message });
  } finally {
    stopWatching();
    await context?.release();
    void service.stop();
  }
}

/**
 * Replaces the picker's idea of how long the video is with the audio's own.
 *
 * `asset.duration` from the picker has been seen to disagree with the file by
 * seven seconds on a sixty second clip. It is the best number available when the
 * project is created, one tap in, and it is the wrong one to keep: the progress
 * bar's total, the timing sheet's extent and the length shown next to a project
 * are all really the media's length. The decoded PCM is measured, not claimed.
 *
 * A small disagreement is left alone. A video whose audio track is a few
 * milliseconds shorter than its picture is normal and not worth a write.
 */
function withRealDuration(project: Project, audioMs: Ms): Project {
  if (audioMs <= 0 || Math.abs(audioMs - project.durationMs) < DURATION_TRUST_MS) return project;

  return {
    ...project,
    durationMs: audioMs,
    progress: { ...project.progress, totalMs: audioMs },
  };
}

/**
 * Decodes the audio once, or reuses what a previous run already decoded.
 *
 * The decoder streams into its destination, so a run killed part way through
 * leaves a short file behind. That file passes an existence check and then
 * transcribes as a clip that stops early, which is the worst kind of bug: it
 * looks like the model gave up rather than like something went wrong. Decoding
 * under a `.part` name and renaming on success means a file at the real name is
 * always a file that finished.
 */
async function loadOrExtract(project: Project): Promise<ArrayBuffer> {
  const file = new File(`file://${pcmPath(project.id)}`);

  if (!file.exists || file.size === 0) {
    const partial = new File(`file://${pcmPath(project.id)}.part`);
    if (partial.exists) partial.delete();

    await extractPcm16(project.sourceUri, `${pcmPath(project.id)}.part`);
    partial.rename(file.name);
  }

  const bytes = await file.bytes();
  // whisper.rn reads the whole ArrayBuffer, so it has to be exactly the PCM.
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

/**
 * VAD, packing, and the envelope, all of which survive a restart.
 *
 * The chunk list is stored rather than recomputed so a resume segments the audio
 * identically. Re-running VAD would be cheap; landing on different boundaries
 * halfway through a transcript would not.
 */
async function planChunks(project: Project, pcm: ArrayBuffer): Promise<PipelineState> {
  const existing = loadPipeline(project.id);
  if (existing && existing.chunks.length > 0) return existing;

  // One pass over the PCM buys both the emphasis signal and the timing sheet's
  // waveform. Ten milliseconds of arithmetic for a minute of audio.
  const envelope = computeEnvelopeFromPcm16(new Int16Array(pcm), SAMPLE_RATE);
  saveEnvelope(project.id, envelope);
  saveProject({ ...project, energyEnvelopeUri: envelopeFile(project.id).uri });

  let spans = await detectSpeech(pcm);
  if (spans.length === 0) spans = fixedWindows(pcmDurationMs(pcm.byteLength));
  spans = spans.filter((span) => span.t1Ms - span.t0Ms >= MIN_SPAN_MS);

  const pipeline: PipelineState = {
    format: PROJECT_FORMAT,
    chunks: packSpansIntoChunks(spans, MAX_CHUNK_MS),
    chunksDone: 0,
    sampleRate: SAMPLE_RATE,
  };
  savePipeline(project.id, pipeline);
  return pipeline;
}

async function transcribeAll(
  initial: Project,
  pcm: ArrayBuffer,
  pipeline: PipelineState,
  context: WhisperContext
): Promise<{ project: Project; complete: boolean }> {
  let project = initial;
  const total = pipeline.chunks[pipeline.chunks.length - 1].t1Ms;
  const startedAt = Date.now();
  let audioDone = pipeline.chunks
    .slice(0, pipeline.chunksDone)
    .reduce((sum, chunk) => sum + (chunk.t1Ms - chunk.t0Ms), 0);

  publish({ stage: 'transcribing', project });

  for (let index = pipeline.chunksDone; index < pipeline.chunks.length; index += 1) {
    if (cancelled) return { project, complete: false };
    if (pauseRequested) {
      publish({ stage: 'paused' });
      return { project, complete: false };
    }

    const chunk = pipeline.chunks[index];
    const handle = transcribeChunk(context, pcm, chunk, {
      onProgress: (percent) => {
        const within = chunk.t0Ms + ((chunk.t1Ms - chunk.t0Ms) * percent) / 100;
        publish({ fraction: 0.02 + 0.96 * (within / total) });
      },
    });

    const result = await handle.promise;
    if (result.aborted || cancelled) return { project, complete: false };

    // The project, then the pipeline cursor. In that order, so a kill between
    // the two writes can only ever redo a chunk, never skip one.
    const fresh = loadFresh(project);
    const nextId = createIdFactory(`c${index}w`);
    project = {
      ...fresh,
      words: appendWords(fresh.words, toWords(result.words, nextId)),
      progress: { processedMs: chunk.t1Ms, totalMs: fresh.durationMs },
      status: 'transcribing',
    };
    saveProject(project);
    savePipeline(project.id, { ...pipeline, chunksDone: index + 1 });

    audioDone += chunk.t1Ms - chunk.t0Ms;
    const audioLeft = pipeline.chunks
      .slice(index + 1)
      .reduce((sum, next) => sum + (next.t1Ms - next.t0Ms), 0);
    const rate = audioDone / Math.max(1, Date.now() - startedAt);

    publish({
      project,
      fraction: 0.02 + 0.96 * (chunk.t1Ms / total),
      etaMs: audioLeft > 0 ? Math.round(audioLeft / rate) : 0,
    });

    // Deliberately not awaited. A notification update that never settles would
    // stop the pipeline dead between two chunks, which is exactly what happened
    // once the system had timed the service out from under us: every chunk was
    // transcribed and checkpointed, and the run never reached the line after it.
    void service.update(Math.round((chunk.t1Ms / total) * 100));
  }

  return { project, complete: true };
}

/**
 * The pass that turns raw words into a transcript: the user's spellings, the
 * lines the engine was unsure of, and the words worth making big.
 */
function finish(project: Project, dictionary: DictionaryEntry[]): Project {
  const words = applyDictionary(project.words, dictionary);
  const envelope = loadEnvelope(project.id);

  let ready: Project = {
    ...project,
    words,
    lineFlags: lineFlagsFor(words),
    status: 'ready',
    progress: { processedMs: project.durationMs, totalMs: project.durationMs },
  };

  if (envelope) {
    ready = computeAutoEmphasis(ready, { features: wordFeatures(envelope, words), dictionary });
  }

  saveProject(ready);
  return ready;
}

/** Reads back what is on disk, so a checkpoint never writes over a later edit. */
function loadFresh(project: Project): Project {
  return loadProject(project.id) ?? project;
}

function save(project: Project): Project {
  saveProject(project);
  return project;
}

function fixedWindows(durationMs: Ms): Span[] {
  const windows: Span[] = [];
  for (let start = 0; start < durationMs; start += MAX_CHUNK_MS) {
    windows.push({ t0Ms: start, t1Ms: Math.min(durationMs, start + MAX_CHUNK_MS) });
  }
  return windows;
}

function emptyPipeline(): PipelineState {
  return { format: PROJECT_FORMAT, chunks: [], chunksDone: 0, sampleRate: SAMPLE_RATE };
}

/**
 * whisper.rn rejects from JSI with plain objects rather than Error instances, so
 * `String(error)` gives "[object Object]" and the user is told nothing.
 */
function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>;
    const message = record.message ?? record.reason ?? record.code;
    if (typeof message === 'string' && message !== '') return message;
  }
  return String(error);
}

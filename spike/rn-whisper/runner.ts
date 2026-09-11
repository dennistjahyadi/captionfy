/**
 * Stage 0 measurement harness. Throwaway.
 *
 * Answers one question: is on-device accuracy good enough on messy creator audio
 * on a mid-range phone? Everything here optimises for producing numbers that can
 * be trusted, not for being the shape of the shipped pipeline.
 */
import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import { initWhisper, initWhisperVad, type TranscribeOptions } from 'whisper.rn';

import { extractPcm16, type ExtractedAudio } from '../../modules/audio-extract';
import SpikeMetrics, { type DeviceProfile } from '../../modules/spike-metrics';
import { packSpansIntoChunks, totalSpanMs, type Span } from '../../src/domain/spans';
import { mergeTokensIntoWords, offsetWords, type Word } from '../../src/domain/words';
import { ensureDownloaded, modelFile, VAD_MODEL, type ModelSpec } from './models';

const SAMPLE_RATE = 16_000;
const BYTES_PER_SAMPLE = 2;

/**
 * whisper.cpp reports every timestamp in centiseconds, both for transcription
 * segments and for VAD spans. At 16 kHz one centisecond is exactly 160 samples,
 * so span boundaries land on sample boundaries with no rounding.
 */
const BYTES_PER_CENTISECOND = (SAMPLE_RATE / 100) * BYTES_PER_SAMPLE;

/**
 * whisper's encoder runs at a fixed 1500 mel frames, which is 30 s, whatever the
 * call actually contains. Chunks are packed up to just under that so no call pays
 * for an internal split and no call wastes a window.
 */
const MAX_SPAN_MS = 28_000;

/** Spans this short carry no word and only cost a model warm-up. */
const MIN_SPAN_MS = 120;

/**
 * How the clip sounds, chosen by the operator before a run.
 *
 * Analysis labels and nothing else. Nothing downstream of here reads the tag:
 * every clip takes the identical path through extraction, VAD and whisper, which
 * is the only way a music clip's word error rate compares with a clean one's.
 */
export const NOISE_TAGS = [
  'clean-native',
  'clean-accented',
  'music-under-voice',
  'street-noise',
  'multi-speaker',
  // v1 is English-only, so this tag does not reopen that decision. It is here to
  // show the shape of the damage: a wrong phonetic guess with intact timing is
  // something a user edits in one line, and a dropped span or a hallucination
  // that wrecks the timestamps after it is something the UI has to flag.
  'code-switch',
] as const;

export type NoiseTag = (typeof NOISE_TAGS)[number];

/** Fixed for every round 2 run. A run that varies these is not comparable. */
export const MAX_THREADS = 4;

export type SpeechSpan = Span;

export type ModelRun = {
  modelId: string;
  modelFileName: string;
  /** True when whisper.cpp reported a GPU backend. Recorded so a silent CPU fallback is visible. */
  gpu: boolean;
  reasonNoGpu: string;
  detectedLanguage: string;
  /** Words timed by whisper.cpp's heuristic token timestamps. What round 1 measured. */
  words: Word[];
  /**
   * The same words timed by DTW over the decoder's cross-attention. Same
   * segmentation as `words`, index for index, because both come from the same
   * token text. Empty when DTW was unavailable.
   */
  dtwWords: Word[];
  /** True when every token came back with a DTW timestamp. */
  dtw: boolean;
  transcript: string;
  transcribeMs: number;
  peakRssMb: number;
  /** False when the OS would not reset the watermark, so the peak covers earlier runs too. */
  peakIsPerRun: boolean;
  error?: string;
};

export type ClipRun = {
  startedAt: string;
  clipName: string;
  noiseTag: NoiseTag;
  device: DeviceProfile;
  /** `debug`, `release`, or the same prefixed with `emulator-`. Goes in the CSV. */
  buildLabel: BuildLabel;
  /** True when the run happened on an emulator, where timings mean nothing. */
  isEmulator: boolean;
  maxThreads: number;
  audio: ExtractedAudio;
  extractMs: number;
  vadEnabled: boolean;
  vadMs: number;
  spans: SpeechSpan[];
  /** Spans packed into encoder windows. One chunk is one transcribe call. */
  chunks: SpeechSpan[];
  /** True when VAD found no speech and the whole clip was transcribed in fixed windows. */
  vadFellBack: boolean;
  speechMs: number;
  detectLanguageOnce: boolean;
  models: ModelRun[];
};

export type RunOptions = {
  videoUri: string;
  clipName: string;
  noiseTag: NoiseTag;
  models: ModelSpec[];
  vadEnabled: boolean;
  /**
   * Detect the language on the first chunk and reuse it. whisper runs a whole
   * extra encoder pass per call to auto-detect, which doubles the cost of a
   * multilingual model. Turn it off to let every chunk detect on its own, which
   * is what a clip that switches language mid-sentence may need.
   */
  detectLanguageOnce: boolean;
  pcmDestinationPath: string;
  onLog: (message: string) => void;
};

export type BuildType = 'debug' | 'release';
export type BuildLabel = BuildType | `emulator-${BuildType}`;

export const buildType: BuildType = __DEV__ ? 'debug' : 'release';

/**
 * Names an emulator from what the device profile already reports, because
 * `modules/` is off limits for the spike.
 *
 * Round 1 lost its timing data to this: the Android Studio image transcribed
 * 5-10x faster than the Galaxy A54 and the rows looked no different afterwards.
 * The image reports itself as `sdk_gphone64_arm64`; the older `generic`,
 * `goldfish` and `ranchu` names and Genymotion's are here so a different image
 * cannot quietly pass as a phone.
 */
const EMULATOR_MARKERS = ['sdk_gphone', 'sdk_google', 'emulator', 'android sdk built for', 'generic', 'goldfish', 'ranchu', 'genymotion', 'vbox'];

export function isEmulator(device: DeviceProfile): boolean {
  const haystack = `${device.model} ${device.soc} ${device.label}`.toLowerCase();
  return EMULATOR_MARKERS.some((marker) => haystack.includes(marker));
}

/** What lands in the CSV `build` column, so emulator rows can be filtered out. */
export function buildLabelFor(device: DeviceProfile): BuildLabel {
  return isEmulator(device) ? `emulator-${buildType}` : buildType;
}

/**
 * whisper.rn only accelerates on Apple hardware. Asking for a GPU on Android
 * costs an init attempt and a fallback for nothing.
 */
const useGpu = Platform.OS === 'ios';

const VAD_OPTIONS = {
  threshold: 0.5,
  minSpeechDurationMs: 250,
  minSilenceDurationMs: 100,
  maxSpeechDurationS: MAX_SPAN_MS / 1000,
  // The default 30 ms clips plosives off the front of a word. 100 ms costs nothing
  // and stops the padding from becoming an accuracy variable.
  speechPadMs: 100,
  samplesOverlap: 0.1,
};

/** Runs every model over one clip and returns everything the CSV and WER count need. */
export async function runClip(options: RunOptions): Promise<ClipRun> {
  const { onLog } = options;
  const device = SpikeMetrics.getDeviceProfile();
  const emulator = isEmulator(device);
  const buildLabel = buildLabelFor(device);

  onLog(`device: ${device.label}, ${device.cpuCores} cores, ${device.totalRamMb} MB RAM`);
  onLog(`build: ${buildLabel}`);
  if (buildType === 'debug') {
    onLog('WARNING: debug build. Timings from this run are not reportable.');
  }
  if (emulator) {
    onLog('WARNING: emulator. Timings from this run are not reportable.');
  }

  const extractStart = Date.now();
  const audio = await extractPcm16(options.videoUri, options.pcmDestinationPath);
  const extractMs = Date.now() - extractStart;
  onLog(
    `extracted ${(audio.durationMs / 1000).toFixed(1)} s from ` +
      `${audio.sourceSampleRate} Hz x${audio.sourceChannelCount} in ${extractMs} ms`
  );

  const pcm = await readPcm(audio.path);

  let spans: SpeechSpan[] = [];
  let vadMs = 0;
  let vadFellBack = false;

  if (options.vadEnabled) {
    const vadStart = Date.now();
    spans = await detectSpeech(pcm, onLog);
    vadMs = Date.now() - vadStart;
    onLog(`vad: ${spans.length} speech spans in ${vadMs} ms`);
  }

  if (spans.length === 0) {
    vadFellBack = options.vadEnabled;
    if (vadFellBack) {
      onLog('vad found no speech; falling back to fixed windows over the whole clip');
    }
    spans = fixedWindows(audio.durationMs);
  }

  spans = spans.filter((span) => span.t1Ms - span.t0Ms >= MIN_SPAN_MS);
  const speechMs = totalSpanMs(spans);
  const chunks = packSpansIntoChunks(spans, MAX_SPAN_MS);
  onLog(`chunks: ${spans.length} spans packed into ${chunks.length} transcribe calls`);

  const models: ModelRun[] = [];
  for (const spec of options.models) {
    models.push(await runModel(spec, pcm, chunks, options.detectLanguageOnce, onLog));
  }

  return {
    startedAt: new Date().toISOString(),
    clipName: options.clipName,
    noiseTag: options.noiseTag,
    device,
    buildLabel,
    isEmulator: emulator,
    maxThreads: MAX_THREADS,
    audio,
    extractMs,
    vadEnabled: options.vadEnabled,
    vadMs,
    spans,
    chunks,
    vadFellBack,
    speechMs,
    detectLanguageOnce: options.detectLanguageOnce,
    models,
  };
}

async function readPcm(path: string): Promise<ArrayBuffer> {
  // The native module deals in filesystem paths because that is what MediaCodec and
  // AVAssetReader want. expo-file-system only accepts URIs.
  const bytes = await new File(`file://${path}`).bytes();
  // bytes() may hand back a view into a larger buffer; whisper.rn reads the whole
  // ArrayBuffer, so it has to be exactly the PCM and nothing else.
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

async function detectSpeech(pcm: ArrayBuffer, onLog: (message: string) => void): Promise<SpeechSpan[]> {
  const context = await initWhisperVad({
    filePath: modelFile(VAD_MODEL).uri,
    useGpu,
    nThreads: MAX_THREADS,
  });

  try {
    const segments = await context.detectSpeechData(pcm, VAD_OPTIONS);
    return segments.map((segment) => ({
      // Centiseconds, despite what the whisper.rn README example prints.
      t0Ms: Math.round(segment.t0 * 10),
      t1Ms: Math.round(segment.t1 * 10),
    }));
  } catch (error) {
    onLog(`vad failed: ${describeError(error)}`);
    return [];
  } finally {
    await context.release();
  }
}

async function runModel(
  spec: ModelSpec,
  pcm: ArrayBuffer,
  chunks: SpeechSpan[],
  detectLanguageOnce: boolean,
  onLog: (message: string) => void
): Promise<ModelRun> {
  const file = await ensureDownloaded(spec);
  const peakIsPerRun = SpikeMetrics.resetPeakRss();

  const run: ModelRun = {
    modelId: spec.id,
    modelFileName: spec.fileName,
    gpu: false,
    reasonNoGpu: '',
    detectedLanguage: '',
    words: [],
    dtwWords: [],
    dtw: false,
    transcript: '',
    transcribeMs: 0,
    peakRssMb: 0,
    peakIsPerRun,
  };

  const start = Date.now();
  let context: Awaited<ReturnType<typeof initWhisper>> | undefined;

  try {
    // dtwAheadsPreset is a local patch to whisper.rn (see patches/). It turns on
    // whisper.cpp's DTW token timestamps and returns them per token as tDtw.
    context = await initWhisper({ filePath: file.uri, useGpu, dtwAheadsPreset: spec.dtwPreset });
    run.gpu = context.gpu;
    run.reasonNoGpu = context.reasonNoGPU ?? '';
    onLog(`${spec.id}: loaded, gpu=${context.gpu}${context.gpu ? '' : ` (${run.reasonNoGpu})`}`);

    const transcribeOptions: TranscribeOptions = {
      language: spec.language,
      // whisper.rn defaults to 2 threads on a 4-core phone, which halves throughput
      // on every device we care about.
      maxThreads: MAX_THREADS,
      // maxLen 1 with tokenTimestamps makes whisper emit one segment per token,
      // which is the only way to get word-level timing out of this binding.
      maxLen: 1,
      tokenTimestamps: true,
      translate: false,
    };

    const words: Word[] = [];
    const dtwWords: Word[] = [];
    let dtwComplete = true;
    // Widened from the model's own 'en' | 'auto' because a detected language can
    // be any of whisper's ninety-nine.
    let language: string = spec.language;

    for (const chunk of chunks) {
      const slice = pcm.slice(
        msToByteOffset(chunk.t0Ms),
        Math.min(msToByteOffset(chunk.t1Ms), pcm.byteLength)
      );
      if (slice.byteLength < MIN_SPAN_MS * (SAMPLE_RATE / 1000) * BYTES_PER_SAMPLE) continue;

      const { promise } = context.transcribeData(slice, { ...transcribeOptions, language });
      const result = await promise;
      if (result.isAborted) continue;

      run.detectedLanguage ||= result.language ?? '';
      // Reusing the detected language spares every later chunk the extra encoder
      // pass that auto-detection costs.
      if (detectLanguageOnce && language === 'auto' && result.language) {
        language = result.language;
        onLog(`${spec.id}: language detected as ${language}, reused for the rest`);
      }

      // Heuristic timing, exactly as round 1 did it: with maxLen 1 each segment
      // is one token and its t0/t1 come from whisper_exp_compute_token_level_timestamps.
      const tokens = result.segments.map((segment) => ({
        text: segment.text,
        t0Ms: segment.t0 * 10,
        t1Ms: segment.t1 * 10,
      }));
      words.push(...offsetWords(mergeTokensIntoWords(tokens), chunk.t0Ms));

      // DTW timing. whisper.cpp gives one instant per token, the moment it was
      // emitted, so a token's end is the next token's start and the last token
      // keeps its heuristic end. Same token text as above, so both lists merge
      // into the same words and line up index for index.
      const flat = result.segments.flatMap((segment) => segment.tokens);
      if (flat.some((token) => token.tDtw < 0)) {
        dtwComplete = false;
      } else {
        const dtwTokens = flat.map((token, index) => {
          const next = flat[index + 1];
          const t0Ms = token.tDtw * 10;
          const t1Ms = next ? next.tDtw * 10 : Math.max(t0Ms, token.t1 * 10);
          return { text: token.text, t0Ms, t1Ms };
        });
        dtwWords.push(...offsetWords(mergeTokensIntoWords(dtwTokens), chunk.t0Ms));
      }
    }

    run.words = words;
    run.dtw = dtwComplete && dtwWords.length === words.length;
    run.dtwWords = run.dtw ? dtwWords : [];
    if (!run.dtw) onLog(`${spec.id}: DTW timestamps incomplete; words file carries heuristic timing only`);
    run.transcript = words.map((word) => word.text).join(' ');
  } catch (error) {
    run.error = describeError(error);
    onLog(`${spec.id}: FAILED ${run.error}`);
  } finally {
    run.transcribeMs = Date.now() - start;
    run.peakRssMb = Math.round(SpikeMetrics.getPeakRssBytes() / (1024 * 1024));
    await context?.release();
  }

  onLog(
    `${spec.id}: ${run.words.length} words in ${run.transcribeMs} ms, ` +
      `peak ${run.peakRssMb} MB, language=${run.detectedLanguage || 'n/a'}`
  );
  return run;
}

function msToByteOffset(ms: number): number {
  return Math.round(ms / 10) * BYTES_PER_CENTISECOND;
}

function fixedWindows(durationMs: number): SpeechSpan[] {
  const windows: SpeechSpan[] = [];
  for (let start = 0; start < durationMs; start += MAX_SPAN_MS) {
    windows.push({ t0Ms: start, t1Ms: Math.min(durationMs, start + MAX_SPAN_MS) });
  }
  return windows;
}

/**
 * whisper.rn rejects from JSI with plain objects, not Error instances, so
 * `String(error)` yields "[object Object]" and the CSV records a failure with no
 * cause. Anything that carries a message is worth more than its type name.
 */
function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>;
    const message = record.message ?? record.reason ?? record.code;
    if (typeof message === 'string' && message !== '') return message;
    try {
      return JSON.stringify(error);
    } catch {
      return Object.prototype.toString.call(error);
    }
  }
  return String(error);
}

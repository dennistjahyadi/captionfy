/**
 * Rig A. Throwaway.
 *
 * Pick a clip, decode it once, run both models over the same bytes, append a CSV
 * row per model and a per-word timing file. The screen is a control panel, not a
 * design.
 *
 * Round 2 takes options away rather than adding them. The settings that have to
 * be identical across runs are shown and not offered, and the noise tag is the
 * one thing the operator must supply, because a row that is not labelled cannot
 * be labelled afterwards.
 */
import { Directory, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SpikeMetrics from '../../modules/spike-metrics';
import {
  describeClip,
  forgetClip,
  formatSize,
  isClipReadable,
  loadRecentClips,
  pickClip,
  rememberClip,
  type Clip,
} from './clips';
import { appendRun, csvFile, writeWordFiles } from './csv';
import {
  ensureDownloaded,
  isDownloaded,
  MODELS,
  VAD_MODEL,
  type DownloadableFile,
  type ModelId,
} from './models';
import {
  buildLabelFor,
  buildType,
  isEmulator,
  MAX_THREADS,
  NOISE_TAGS,
  runClip,
  type BuildType,
  type ClipRun,
  type NoiseTag,
} from './runner';

/**
 * Round 2 holds these fixed so the only thing that varies between rows is the
 * clip and the model. A run with different settings does not compare with the
 * others, so they are shown rather than offered.
 */
const FIXED_SETTINGS = [
  ['threads', String(MAX_THREADS)],
  ['maxLen', '1'],
  ['tokenTimestamps', 'on'],
  ['VAD gate', 'on'],
  ['language', 'en, detected once'],
  ['DTW timestamps', 'on, heads per model'],
] as const;

type DownloadState = Record<string, number>;

export default function RigAScreen() {
  const insets = useSafeAreaInsets();
  const [log, setLog] = useState<string[]>([]);
  const [downloads, setDownloads] = useState<DownloadState>({});
  const [modelsReady, setModelsReady] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  // No default. An unlabelled row is worse than no row, so the run button stays
  // dead until the operator says how the clip sounds.
  const [noiseTag, setNoiseTag] = useState<NoiseTag | null>(null);
  const [selectedIds, setSelectedIds] = useState<ModelId[]>(() => MODELS.map((model) => model.id));
  const [lastRun, setLastRun] = useState<ClipRun | null>(null);
  const [lastWordFiles, setLastWordFiles] = useState<string[]>([]);
  const [clip, setClip] = useState<Clip | null>(null);
  const [clipName, setClipName] = useState('');
  const [recents, setRecents] = useState<Clip[]>([]);
  const logRef = useRef<ScrollView>(null);

  const device = useMemo(() => SpikeMetrics.getDeviceProfile(), []);
  const emulator = useMemo(() => isEmulator(device), [device]);
  const buildLabel = useMemo(() => buildLabelFor(device), [device]);
  const timingsValid = buildType === 'release' && !emulator;
  const selectedModels = useMemo(
    () => MODELS.filter((model) => model.alwaysRun || selectedIds.includes(model.id)),
    [selectedIds]
  );
  // VAD gates every run, so it is downloaded whatever the model selection is.
  const neededFiles = useMemo(() => [VAD_MODEL, ...selectedModels], [selectedModels]);

  const append = useCallback((message: string) => {
    SpikeMetrics.log(message);
    setLog((entries) => [...entries, message]);
  }, []);

  const refreshReady = useCallback(() => {
    setModelsReady(neededFiles.every(isDownloaded));
  }, [neededFiles]);

  useEffect(refreshReady, [refreshReady]);

  useEffect(() => {
    logRef.current?.scrollToEnd({ animated: false });
  }, [log]);

  useEffect(() => {
    setRecents(loadRecentClips());
  }, []);

  const download = useCallback(async () => {
    setBusy('Downloading models');
    try {
      for (const spec of neededFiles) {
        if (isDownloaded(spec)) {
          setDownloads((state) => ({ ...state, [spec.fileName]: 1 }));
          continue;
        }
        append(`downloading ${spec.fileName} (~${spec.approxMb} MB)`);
        await ensureDownloaded(spec, (fraction) =>
          setDownloads((state) => ({ ...state, [spec.fileName]: fraction }))
        );
        append(`downloaded ${spec.fileName}`);
      }
    } catch (error) {
      append(`download failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      refreshReady();
      setBusy(null);
    }
  }, [append, neededFiles, refreshReady]);

  const selectClip = useCallback((picked: Clip) => {
    setClip(picked);
    // A starting point for the operator, not the answer. It is the real filename
    // now, which is what makes a CSV of fifteen clips readable afterwards.
    setClipName(picked.name || 'clip');
    setRecents(rememberClip(picked));
  }, []);

  /** Both halves of the test set. Opens at Downloads, which is where clips land. */
  const pickFile = useCallback(async () => {
    try {
      const picked = await pickClip();
      if (picked) selectClip(picked);
    } catch (error) {
      append(`pick failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [append, selectClip]);

  /** The camera roll, for clips shot on the phone rather than copied onto it. */
  const pickFromGallery = useCallback(async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsMultipleSelection: false,
      // Hand back the original file. A transcode on the way in would put a second
      // audio path in front of the one being measured.
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
      videoExportPreset: ImagePicker.VideoExportPreset.Passthrough,
    });
    if (picked.canceled || picked.assets.length === 0) return;

    const asset = picked.assets[0];
    const described = await describeClip(asset.uri);
    // Which of the two names is the real one depends on the platform. Android's
    // picker reports the MediaStore id, a bare number, so the provider's display
    // name wins. iOS hands back a copy in the cache under a generated name, so
    // the asset's own filename does.
    const name = (Platform.OS === 'ios' ? asset.fileName : described.name) || described.name;
    selectClip({ ...described, name });
  }, [selectClip]);

  /** A remembered clip can outlive its file, so check before committing to it. */
  const reuseClip = useCallback(
    async (entry: Clip) => {
      if (await isClipReadable(entry.uri)) {
        selectClip(entry);
        return;
      }
      append(`${entry.name} can no longer be opened; dropping it from recents`);
      setRecents(forgetClip(entry.uri));
      setClip((current) => (current?.uri === entry.uri ? null : current));
    },
    [append, selectClip]
  );

  const run = useCallback(async () => {
    // Both guards are also enforced by the button's disabled state. They are
    // repeated because an untagged row cannot be recovered after the fact.
    if (!clip) return;
    if (!noiseTag) {
      append('pick a noise tag before running');
      return;
    }
    const label = clipName.trim() || 'clip';

    setBusy(`Running ${label}`);
    setLog([]);
    try {
      const workDirectory = new Directory(Paths.cache, 'spike-pcm');
      if (!workDirectory.exists) workDirectory.create({ intermediates: true });

      const result = await runClip({
        videoUri: clip.uri,
        clipName: label,
        noiseTag,
        models: selectedModels,
        vadEnabled: true,
        detectLanguageOnce: true,
        pcmDestinationPath: `${workDirectory.uri.replace('file://', '')}/clip.pcm`,
        onLog: append,
      });

      appendRun(result, append);
      const wordFiles = writeWordFiles(result);
      setLastRun(result);
      setLastWordFiles(wordFiles.map((file) => file.uri));
      append(`wrote ${result.models.length} rows to ${csvFile().uri}`);
      wordFiles.forEach((file) => append(`wrote ${file.name}`));
    } catch (error) {
      append(`run failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(null);
    }
  }, [append, clip, clipName, noiseTag, selectedModels]);

  const shareCsv = useCallback(async () => {
    const file = csvFile();
    if (!file.exists) {
      append('no CSV yet');
      return;
    }
    if (!(await Sharing.isAvailableAsync())) {
      append(`sharing unavailable; CSV is at ${file.uri}`);
      return;
    }
    await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
  }, [append]);

  /** One sheet per file. Sharing has no multi-file call, and there are only two. */
  const shareWords = useCallback(async () => {
    if (lastWordFiles.length === 0) {
      append('no words file yet');
      return;
    }
    if (!(await Sharing.isAvailableAsync())) {
      append(`sharing unavailable; words files are in ${lastWordFiles[0]}`);
      return;
    }
    for (const uri of lastWordFiles) {
      await Sharing.shareAsync(uri, { mimeType: 'application/json', UTI: 'public.json' });
    }
  }, [append, lastWordFiles]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
    >
      <Text style={styles.title}>Rig A — whisper.rn</Text>

      <BuildBanner buildType={buildType} emulator={emulator} />

      <Text style={styles.meta}>{device.label}</Text>
      <Text style={styles.meta}>
        {device.osVersion} · {device.cpuCores} cores · {device.totalRamMb} MB RAM
      </Text>

      <Text style={styles.meta}>CSV build column: {buildLabel}</Text>

      <Text style={styles.heading}>Models to run</Text>
      {MODELS.map((spec) => {
        const selected = spec.alwaysRun || selectedIds.includes(spec.id);
        return (
          <Pressable
            key={spec.fileName}
            onPress={() => setSelectedIds((ids) => toggle(ids, spec.id))}
            disabled={!!busy || spec.alwaysRun}
            style={styles.row}
          >
            <Text style={[styles.rowLabel, !selected && styles.rowLabelOff]}>
              {selected ? '\u2713 ' : '\u2007 '}
              {spec.id}
              {'\n'}
              <Text style={styles.rowHint}>{spec.note}</Text>
            </Text>
            <Text style={styles.rowValue}>{fileStatus(spec, downloads)}</Text>
          </Pressable>
        );
      })}
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{'\u2007 '}{VAD_MODEL.fileName}</Text>
        <Text style={styles.rowValue}>{fileStatus(VAD_MODEL, downloads)}</Text>
      </View>

      <Button label={modelsReady ? 'Re-check models' : 'Download models'} onPress={download} disabled={!!busy} />

      <Text style={styles.heading}>Noise tag (required)</Text>
      <Text style={styles.meta}>
        How the clip sounds. Goes in the CSV for your analysis only; the pipeline
        never sees it.
      </Text>
      <View style={styles.tagRow}>
        {NOISE_TAGS.map((tag) => (
          <Pressable
            key={tag}
            onPress={() => setNoiseTag(tag)}
            disabled={!!busy}
            style={[styles.tag, noiseTag === tag && styles.tagActive]}
          >
            <Text style={[styles.tagText, noiseTag === tag && styles.tagTextActive]}>{tag}</Text>
          </Pressable>
        ))}
      </View>
      {noiseTag ? null : <Text style={styles.warn}>Pick a tag to enable the run button.</Text>}

      <Text style={styles.heading}>Fixed settings</Text>
      <Text style={styles.meta}>
        Held constant across round 2. Rows only compare with each other while these
        match.
      </Text>
      {FIXED_SETTINGS.map(([label, value]) => (
        <View key={label} style={styles.row}>
          <Text style={styles.rowLabel}>{label}</Text>
          <Text style={styles.rowValue}>{value}</Text>
        </View>
      ))}

      <Text style={styles.heading}>Clip</Text>
      <Text style={styles.meta}>
        Audio or video, either one. Browse opens on Downloads, where a file dragged
        onto the emulator lands.
      </Text>
      <View style={styles.pickRow}>
        <Button label="Browse files" onPress={pickFile} disabled={!!busy} style={styles.pickButton} />
        <Button label="Gallery" onPress={pickFromGallery} disabled={!!busy} style={styles.pickButton} />
      </View>

      {recents.length > 0 ? (
        <>
          <Text style={styles.heading}>Recent clips</Text>
          {recents.map((entry) => (
            <View key={entry.uri} style={styles.recentRow}>
              <Pressable
                onPress={() => reuseClip(entry)}
                disabled={!!busy}
                style={styles.recent}
              >
                <Text
                  style={[styles.rowLabel, clip?.uri === entry.uri && styles.recentActive]}
                  numberOfLines={1}
                >
                  {clip?.uri === entry.uri ? '\u2713 ' : '\u2007 '}
                  {entry.name}
                </Text>
              </Pressable>
              <Text style={styles.rowHint}>{formatSize(entry.sizeBytes)}</Text>
              <Pressable onPress={() => setRecents(forgetClip(entry.uri))} disabled={!!busy} hitSlop={8}>
                <Text style={styles.recentDrop}>{'\u00d7'}</Text>
              </Pressable>
            </View>
          ))}
        </>
      ) : null}

      {clip ? (
        <>
          <Text style={styles.heading}>Clip label</Text>
          <Text style={styles.meta}>
            {clip.name} · {formatSize(clip.sizeBytes)}
          </Text>
          <Text style={styles.meta}>Goes in the CSV. Name it so you can score it later.</Text>
          <TextInput
            value={clipName}
            onChangeText={setClipName}
            editable={!busy}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="clip label"
            placeholderTextColor="#6B7280"
            style={styles.input}
          />
        </>
      ) : null}

      <Button
        label={
          noiseTag
            ? `Run ${selectedModels.length} model${selectedModels.length === 1 ? '' : 's'}`
            : 'Pick a noise tag first'
        }
        onPress={run}
        disabled={!!busy || !clip || !modelsReady || selectedModels.length === 0 || !noiseTag}
      />
      <Button label="Share CSV" onPress={shareCsv} disabled={!!busy} />
      <Button
        label="Share last words JSON"
        onPress={shareWords}
        disabled={!!busy || lastWordFiles.length === 0}
      />

      {busy ? (
        <View style={styles.busy}>
          <ActivityIndicator color="#7CE3B1" />
          <Text style={styles.busyText}>{busy}</Text>
        </View>
      ) : null}

      {lastRun ? <Results run={lastRun} timingsValid={timingsValid} /> : null}

      <Text style={styles.heading}>Log</Text>
      <ScrollView ref={logRef} style={styles.logBox} nestedScrollEnabled>
        {log.map((line, index) => (
          <Text key={`${index}-${line}`} style={styles.logLine}>
            {line}
          </Text>
        ))}
      </ScrollView>
    </ScrollView>
  );
}

function toggle(ids: ModelId[], id: ModelId): ModelId[] {
  return ids.includes(id) ? ids.filter((current) => current !== id) : [...ids, id];
}

function fileStatus(spec: DownloadableFile, downloads: DownloadState): string {
  const progress = downloads[spec.fileName] ?? (isDownloaded(spec) ? 1 : 0);
  if (progress >= 1) return 'ready';
  if (progress > 0) return `${Math.round(progress * 100)}% of ~${spec.approxMb} MB`;
  return `~${spec.approxMb} MB to fetch`;
}

/**
 * The one banner that decides whether a number on this screen is worth writing
 * down. Round 1's timings were thrown away because an emulator run and a phone
 * run looked identical after the fact.
 */
function BuildBanner({ buildType, emulator }: { buildType: BuildType; emulator: boolean }) {
  const bad = buildType === 'debug' || emulator;
  const message = emulator
    ? `EMULATOR (${buildType}) — TIMINGS INVALID, rows are tagged emulator-${buildType}`
    : buildType === 'debug'
      ? 'DEBUG BUILD — TIMINGS INVALID'
      : 'RELEASE BUILD ON HARDWARE — timings are reportable';

  return (
    <View style={[styles.banner, bad ? styles.bannerBad : styles.bannerGood]}>
      <Text style={styles.bannerText}>{message}</Text>
    </View>
  );
}

function Results({ run, timingsValid }: { run: ClipRun; timingsValid: boolean }) {
  return (
    <>
      <Text style={styles.heading}>Last run — {run.clipName}</Text>
      {timingsValid ? null : (
        <View style={[styles.banner, styles.bannerBad]}>
          <Text style={styles.bannerText}>
            {run.isEmulator ? 'EMULATOR — TIMINGS INVALID' : 'DEBUG BUILD — TIMINGS INVALID'}
          </Text>
        </View>
      )}
      <Text style={styles.meta}>{run.noiseTag} · build {run.buildLabel}</Text>
      <Text style={styles.meta}>
        {(run.audio.durationMs / 1000).toFixed(1)} s clip · {(run.speechMs / 1000).toFixed(1)} s speech ·{' '}
        {run.spans.length} spans · {run.chunks.length} calls
        {run.vadFellBack ? ' · VAD FOUND NOTHING, fixed windows used' : ''}
      </Text>
      {run.models.map((model) => (
        <View key={model.modelId} style={styles.result}>
          <Text style={styles.resultTitle}>
            {model.modelId} · {(model.transcribeMs / 1000).toFixed(1)} s · {model.peakRssMb} MB peak
            {model.gpu ? ' · gpu' : ''}
          </Text>
          <Text style={styles.resultBody}>
            {model.error ? `ERROR: ${model.error}` : model.transcript || '(no words)'}
          </Text>
        </View>
      ))}
    </>
  );
}

function Button({
  label,
  onPress,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, disabled && styles.buttonDisabled, style]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0B0B0F' },
  content: { paddingHorizontal: 16, gap: 8 },
  title: { color: '#FFFFFF', fontSize: 22, fontWeight: '700' },
  banner: { borderRadius: 8, padding: 10, marginVertical: 4 },
  bannerGood: { backgroundColor: '#123524' },
  bannerBad: { backgroundColor: '#4A1220' },
  bannerText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  meta: { color: '#9CA3AF', fontSize: 12 },
  heading: { color: '#FFFFFF', fontSize: 15, fontWeight: '600', marginTop: 16 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  rowLabel: { color: '#D1D5DB', fontSize: 12, flexShrink: 1 },
  rowLabelOff: { color: '#6B7280' },
  rowHint: { color: '#6B7280', fontSize: 11 },
  rowValue: { color: '#7CE3B1', fontSize: 12 },
  warn: { color: '#F0A6B4', fontSize: 12 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { borderColor: '#374151', borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  tagActive: { backgroundColor: '#7CE3B1', borderColor: '#7CE3B1' },
  tagText: { color: '#D1D5DB', fontSize: 12 },
  tagTextActive: { color: '#0B0B0F', fontWeight: '700' },
  button: {
    backgroundColor: '#1F2937',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.4 },
  pickRow: { flexDirection: 'row', gap: 8 },
  pickButton: { flex: 1 },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  recent: { flex: 1 },
  recentActive: { color: '#7CE3B1', fontWeight: '600' },
  recentDrop: { color: '#6B7280', fontSize: 16, paddingHorizontal: 4 },
  input: {
    backgroundColor: '#111827',
    borderRadius: 8,
    color: '#FFFFFF',
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 6,
  },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  busy: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  busyText: { color: '#7CE3B1', fontSize: 12 },
  result: { backgroundColor: '#111827', borderRadius: 8, padding: 10, marginTop: 8 },
  resultTitle: { color: '#7CE3B1', fontSize: 12, fontWeight: '600' },
  resultBody: { color: '#E5E7EB', fontSize: 12, marginTop: 6 },
  logBox: { backgroundColor: '#111827', borderRadius: 8, padding: 10, maxHeight: 260, marginTop: 8 },
  logLine: { color: '#9CA3AF', fontSize: 11, fontFamily: 'monospace' },
});

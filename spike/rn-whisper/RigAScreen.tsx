/**
 * Rig A. Throwaway.
 *
 * Pick a video, decode it once, run every candidate model over the same bytes,
 * append a CSV row per model. The screen is a control panel, not a design.
 */
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SpikeMetrics from '../../modules/spike-metrics';
import { appendRun, appendWords, csvFile } from './csv';
import {
  ensureDownloaded,
  isDownloaded,
  MODELS,
  VAD_MODEL,
  type DownloadableFile,
  type ModelId,
} from './models';
import { buildType, runClip, type ClipRun, type ClipTag } from './runner';

const CLIP_TAGS: ClipTag[] = ['clean-accented', 'music-under-voice'];

type DownloadState = Record<string, number>;

export default function RigAScreen() {
  const insets = useSafeAreaInsets();
  const [log, setLog] = useState<string[]>([]);
  const [downloads, setDownloads] = useState<DownloadState>({});
  const [modelsReady, setModelsReady] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [clipTag, setClipTag] = useState<ClipTag>('clean-accented');
  const [selectedIds, setSelectedIds] = useState<ModelId[]>(() => MODELS.map((model) => model.id));
  const [vadEnabled, setVadEnabled] = useState(true);
  const [detectLanguageOnce, setDetectLanguageOnce] = useState(true);
  const [lastRun, setLastRun] = useState<ClipRun | null>(null);
  const [clipUri, setClipUri] = useState<string | null>(null);
  const [clipName, setClipName] = useState('');
  const logRef = useRef<ScrollView>(null);

  const device = useMemo(() => SpikeMetrics.getDeviceProfile(), []);
  const selectedModels = useMemo(
    () => MODELS.filter((model) => selectedIds.includes(model.id)),
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

  const pickVideo = useCallback(async () => {
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
    setClipUri(asset.uri);
    // Android's photo picker reports a MediaStore id such as "19.mp4" rather than
    // the real filename, which would make a CSV of fifteen clips unreadable. The
    // label is a starting point for the operator, not the answer.
    setClipName(asset.fileName ?? asset.uri.split('/').pop() ?? 'clip');
  }, []);

  // Test-set audio arrives as bare wav or mp3, which the gallery picker will not
  // show. The pipeline never cared: audio-extract decodes whatever container the
  // platform can open and the ASR only ever sees the PCM that comes out.
  const pickAudio = useCallback(async () => {
    const picked = await File.pickFileAsync({ mimeTypes: ['audio/*'] });
    if (picked.canceled || !picked.result) return;

    setClipUri(picked.result.uri);
    setClipName(picked.result.name || picked.result.uri.split('/').pop() || 'clip');
  }, []);

  const run = useCallback(async () => {
    if (!clipUri) return;
    const label = clipName.trim() || 'clip';

    setBusy(`Running ${label}`);
    setLog([]);
    try {
      const workDirectory = new Directory(Paths.cache, 'spike-pcm');
      if (!workDirectory.exists) workDirectory.create({ intermediates: true });

      const result = await runClip({
        videoUri: clipUri,
        clipName: label,
        clipTag,
        models: selectedModels,
        vadEnabled,
        detectLanguageOnce,
        pcmDestinationPath: `${workDirectory.uri.replace('file://', '')}/clip.pcm`,
        onLog: append,
      });

      appendRun(result);
      appendWords(result);
      setLastRun(result);
      append(`wrote ${result.models.length} rows to ${csvFile().uri}`);
    } catch (error) {
      append(`run failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(null);
    }
  }, [append, clipUri, clipName, clipTag, detectLanguageOnce, selectedModels, vadEnabled]);

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

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
    >
      <Text style={styles.title}>Rig A — whisper.rn</Text>

      <View style={[styles.banner, buildType === 'debug' ? styles.bannerBad : styles.bannerGood]}>
        <Text style={styles.bannerText}>
          {buildType === 'debug'
            ? 'DEBUG BUILD — timings here are 10-20x slow and must not be reported'
            : 'RELEASE BUILD — timings are reportable'}
        </Text>
      </View>

      <Text style={styles.meta}>{device.label}</Text>
      <Text style={styles.meta}>
        {device.osVersion} · {device.cpuCores} cores · {device.totalRamMb} MB RAM
      </Text>

      <Text style={styles.heading}>Models to run</Text>
      {MODELS.map((spec) => {
        const selected = selectedIds.includes(spec.id);
        return (
          <Pressable
            key={spec.fileName}
            onPress={() => setSelectedIds((ids) => toggle(ids, spec.id))}
            disabled={!!busy}
            style={styles.row}
          >
            <Text style={[styles.rowLabel, !selected && styles.rowLabelOff]}>
              {selected ? '\u2713 ' : '\u2007 '}
              {spec.id}
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

      <Text style={styles.heading}>Clip tag</Text>
      <View style={styles.tagRow}>
        {CLIP_TAGS.map((tag) => (
          <Pressable
            key={tag}
            onPress={() => setClipTag(tag)}
            style={[styles.tag, clipTag === tag && styles.tagActive]}
          >
            <Text style={[styles.tagText, clipTag === tag && styles.tagTextActive]}>{tag}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>VAD gate before transcription</Text>
        <Switch value={vadEnabled} onValueChange={setVadEnabled} disabled={!!busy} />
      </View>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>
          Detect language once{'\n'}
          <Text style={styles.rowHint}>Off costs an extra encoder pass per chunk</Text>
        </Text>
        <Switch
          value={detectLanguageOnce}
          onValueChange={setDetectLanguageOnce}
          disabled={!!busy}
        />
      </View>

      <View style={styles.pickRow}>
        <Button label="Pick a video" onPress={pickVideo} disabled={!!busy} style={styles.pickButton} />
        <Button label="Pick audio" onPress={pickAudio} disabled={!!busy} style={styles.pickButton} />
      </View>

      {clipUri ? (
        <>
          <Text style={styles.heading}>Clip label</Text>
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
        label={`Run ${selectedModels.length} model${selectedModels.length === 1 ? '' : 's'}`}
        onPress={run}
        disabled={!!busy || !clipUri || !modelsReady || selectedModels.length === 0}
      />
      <Button label="Share CSV" onPress={shareCsv} disabled={!!busy} />

      {busy ? (
        <View style={styles.busy}>
          <ActivityIndicator color="#7CE3B1" />
          <Text style={styles.busyText}>{busy}</Text>
        </View>
      ) : null}

      {lastRun ? <Results run={lastRun} /> : null}

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

function Results({ run }: { run: ClipRun }) {
  return (
    <>
      <Text style={styles.heading}>Last run — {run.clipName}</Text>
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
  tagRow: { flexDirection: 'row', gap: 8 },
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

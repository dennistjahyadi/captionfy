/**
 * Rig A. Throwaway.
 *
 * Pick a video, decode it once, run every candidate model over the same bytes,
 * append a CSV row per model. The screen is a control panel, not a design.
 */
import { Directory, Paths } from 'expo-file-system';
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
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SpikeMetrics from '../../modules/spike-metrics';
import { appendRun, appendWords, csvFile } from './csv';
import { ensureDownloaded, isDownloaded, MODELS, VAD_MODEL } from './models';
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
  const [vadEnabled, setVadEnabled] = useState(true);
  const [lastRun, setLastRun] = useState<ClipRun | null>(null);
  const logRef = useRef<ScrollView>(null);

  const device = useMemo(() => SpikeMetrics.getDeviceProfile(), []);
  const allFiles = useMemo(() => [VAD_MODEL, ...MODELS], []);

  const append = useCallback((message: string) => {
    SpikeMetrics.log(message);
    setLog((entries) => [...entries, message]);
  }, []);

  const refreshReady = useCallback(() => {
    setModelsReady(allFiles.every(isDownloaded));
  }, [allFiles]);

  useEffect(refreshReady, [refreshReady]);

  useEffect(() => {
    logRef.current?.scrollToEnd({ animated: false });
  }, [log]);

  const download = useCallback(async () => {
    setBusy('Downloading models');
    try {
      for (const spec of allFiles) {
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
  }, [allFiles, append, refreshReady]);

  const pickAndRun = useCallback(async () => {
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
    const clipName = asset.fileName ?? asset.uri.split('/').pop() ?? 'clip';

    setBusy(`Running ${clipName}`);
    setLog([]);
    try {
      const workDirectory = new Directory(Paths.cache, 'spike-pcm');
      if (!workDirectory.exists) workDirectory.create({ intermediates: true });

      const run = await runClip({
        videoUri: asset.uri,
        clipName,
        clipTag,
        models: MODELS,
        vadEnabled,
        pcmDestinationPath: `${workDirectory.uri.replace('file://', '')}/clip.pcm`,
        onLog: append,
      });

      appendRun(run);
      appendWords(run);
      setLastRun(run);
      append(`wrote ${run.models.length} rows to ${csvFile().uri}`);
    } catch (error) {
      append(`run failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(null);
    }
  }, [append, clipTag, vadEnabled]);

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

      <Text style={styles.heading}>Models</Text>
      {allFiles.map((spec) => {
        const progress = downloads[spec.fileName] ?? (isDownloaded(spec) ? 1 : 0);
        return (
          <View key={spec.fileName} style={styles.row}>
            <Text style={styles.rowLabel}>{spec.fileName}</Text>
            <Text style={styles.rowValue}>
              {progress >= 1 ? 'ready' : `${Math.round(progress * 100)}% of ~${spec.approxMb} MB`}
            </Text>
          </View>
        );
      })}

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

      <Button
        label="Pick a video and run all models"
        onPress={pickAndRun}
        disabled={!!busy || !modelsReady}
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

function Results({ run }: { run: ClipRun }) {
  return (
    <>
      <Text style={styles.heading}>Last run — {run.clipName}</Text>
      <Text style={styles.meta}>
        {(run.audio.durationMs / 1000).toFixed(1)} s clip · {(run.speechMs / 1000).toFixed(1)} s speech ·{' '}
        {run.spans.length} spans{run.vadFellBack ? ' · VAD FOUND NOTHING, fixed windows used' : ''}
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
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, disabled && styles.buttonDisabled]}
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
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  busy: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  busyText: { color: '#7CE3B1', fontSize: 12 },
  result: { backgroundColor: '#111827', borderRadius: 8, padding: 10, marginTop: 8 },
  resultTitle: { color: '#7CE3B1', fontSize: 12, fontWeight: '600' },
  resultBody: { color: '#E5E7EB', fontSize: 12, marginTop: 6 },
  logBox: { backgroundColor: '#111827', borderRadius: 8, padding: 10, maxHeight: 260, marginTop: 8 },
  logLine: { color: '#9CA3AF', fontSize: 11, fontFamily: 'monospace' },
});

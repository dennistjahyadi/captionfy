/**
 * Home.
 *
 * One primary action that opens the system picker directly, the free-tier line
 * above the fold where it belongs, and the projects already on this phone.
 */
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { accentColor, projectStyle, type Project } from '../src/domain';
import { beginProject } from '../src/asr/runner';
import { requestNotifications } from '../src/native/foreground-service';
import { freeTierStatus } from '../src/policy/free-tier';
import { loadEntitlement } from '../src/policy/entitlement-store';
import { deleteProject, listProjects, loadPipeline, thumbnailFile } from '../src/project/store';
import { makeThumbnail } from '../src/project/thumbnail';
import { Label, PrimaryButton, Screen } from '../src/ui/atoms';
import { describeProject, plural } from '../src/ui/describe';
import { color, DEFAULT_ACCENT, MIN_TOUCH, radius, space } from '../src/ui/theme';

export default function Home() {
  const insets = useSafeAreaInsets();
  const [projects, setProjects] = useState<Project[]>([]);
  const [status, setStatus] = useState(() => freeTierStatus(loadEntitlement()));
  const [picking, setPicking] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setProjects(listProjects());
      setStatus(freeTierStatus(loadEntitlement()));
    }, [])
  );

  async function pickVideo() {
    setPicking(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsMultipleSelection: false,
        quality: 1,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      // The notification is what the foreground service needs to keep running
      // while the user is in another app. Asked for here, before any work, so a
      // denial is not a surprise halfway through a transcription.
      await requestNotifications();

      const project = beginProject(asset.uri, Math.round(asset.duration ?? 0));
      void makeThumbnail(project);
      router.push(`/processing/${project.id}`);
    } catch (error) {
      Alert.alert('That video could not be opened', describe(error));
    } finally {
      setPicking(false);
    }
  }

  function open(project: Project) {
    if (project.status === 'ready') {
      router.push(`/project/${project.id}`);
      return;
    }
    router.push(`/processing/${project.id}`);
  }

  function confirmDelete(project: Project) {
    // Named, because two clips of the same length with the same number of words
    // look identical in a dialog and only one of them is the one being deleted.
    Alert.alert(
      'Delete this project?',
      `${describeProject(project)}\n\nThe transcript goes with it. The video on your phone is not touched.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteProject(project.id);
            setProjects(listProjects());
          },
        },
      ]
    );
  }

  return (
    <Screen>
      <FlatList
        data={projects}
        keyExtractor={(project) => project.id}
        contentContainerStyle={{
          paddingTop: insets.top + space.xxl,
          paddingBottom: insets.bottom + space.xxl,
          paddingHorizontal: space.lg,
          gap: space.md,
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.title}>
              <Label variant="display">Captionfy</Label>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Settings"
                onPress={() => router.push('/settings')}
                style={({ pressed }) => [styles.settings, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Label variant="heading" tone="mute">
                  ⚙
                </Label>
              </Pressable>
            </View>
            <Label variant="body" tone="mute" style={styles.blurb}>
              Captions for your video, made on this phone. Nothing is uploaded.
            </Label>

            <View style={styles.action}>
              <PrimaryButton
                title="New video"
                onPress={pickVideo}
                accent={DEFAULT_ACCENT}
                busy={picking}
              />
              {status.line !== '' ? (
                <Label variant="label" tone="mute" style={styles.tier}>
                  {status.line}
                </Label>
              ) : null}
            </View>

            {projects.length > 0 ? (
              <Label variant="label" tone="mute" style={styles.listHead}>
                On this phone
              </Label>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <ProjectRow project={item} onPress={() => open(item)} onLongPress={() => confirmDelete(item)} />
        )}
      />
    </Screen>
  );
}

function ProjectRow({
  project,
  onPress,
  onLongPress,
}: {
  project: Project;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const accent = accentColor(projectStyle(project));
  const thumb = thumbnailFile(project.id);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={styles.thumb}>
        {thumb.exists ? <Image source={{ uri: thumb.uri }} style={styles.thumbImage} /> : null}
      </View>

      <View style={styles.rowBody}>
        <Label variant="heading" numberOfLines={1}>
          {formatDuration(project.durationMs)}
        </Label>
        <StatusLine project={project} accent={accent} />
      </View>
    </Pressable>
  );
}

function StatusLine({ project, accent }: { project: Project; accent: string }) {
  if (project.status === 'failed') {
    const pipeline = loadPipeline(project.id);
    return (
      <Label variant="label" tone="signal" numberOfLines={2}>
        {pipeline?.error ?? 'Transcription stopped'} · tap to try again
      </Label>
    );
  }

  if (project.status === 'ready') {
    return (
      <Label variant="label" tone="mute">
        {plural(project.words.length, 'word')} · ready
      </Label>
    );
  }

  const done = project.progress.totalMs > 0 ? project.progress.processedMs / project.progress.totalMs : 0;
  return (
    <View style={styles.rowProgress}>
      <View style={styles.rowTrack}>
        <View style={[styles.rowFill, { width: `${Math.round(done * 100)}%`, backgroundColor: accent }]} />
      </View>
      <Label variant="micro" tone="mute">
        {Math.round(done * 100)}%
      </Label>
    </View>
  );
}

function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const styles = StyleSheet.create({
  title: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settings: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  header: { gap: space.md, marginBottom: space.lg },
  blurb: { maxWidth: 320 },
  action: { gap: space.sm, marginTop: space.lg },
  tier: { textAlign: 'center' },
  listHead: { marginTop: space.xxl },
  row: {
    flexDirection: 'row',
    gap: space.lg,
    alignItems: 'center',
    backgroundColor: color.surface,
    borderRadius: radius.sheet,
    borderWidth: 1,
    borderColor: color.line,
    padding: space.md,
  },
  thumb: {
    width: 48,
    height: 84,
    backgroundColor: color.ink,
    overflow: 'hidden',
    borderRadius: radius.control,
  },
  thumbImage: { width: '100%', height: '100%' },
  rowBody: { flex: 1, gap: space.xs },
  rowProgress: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rowTrack: { flex: 1, height: 4, borderRadius: radius.pill, backgroundColor: color.line, overflow: 'hidden' },
  rowFill: { height: '100%' },
});

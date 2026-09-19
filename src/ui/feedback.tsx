/**
 * The one feedback card, and the two ways out of it.
 *
 * Shown on Saved after the second finished export and never again. Not a popup
 * and not on a timer: Saved is the end of the only path that produces a file, so
 * it is the one screen where the user has just been given what they came for and
 * there is no work to interrupt. A modal over the editor would be the same
 * question asked at the moment it is least welcome.
 *
 * Both routes leave the app, because an offline app with no server has nowhere to
 * put a form. That is a high-friction ask, which is the second reason to make it
 * once and make it late.
 */
import Constants from 'expo-constants';
import { useCallback, useState } from 'react';
import { Alert, Linking, Platform, StyleSheet, View } from 'react-native';

import { markFeedbackAsked } from '../project/settings';
import { Label, QuietButton } from './atoms';
import {
  FEEDBACK_EMAIL,
  SUBJECT_TAG,
  TIKTOK_HANDLE,
  TIKTOK_URL,
  feedbackMailto,
  feedbackSubject,
  type BuildInfo,
} from './support';
import { color, radius, space } from './theme';

/**
 * What this build is, for the footer of the mail.
 *
 * `Platform.constants` rather than `expo-device`, which would be a dependency
 * and 82 MB of models already leave this APK five megabytes under the line. The
 * Android fields are not in React Native's own types for the union, hence the
 * cast; both are optional in the mail, so a platform without them loses a line
 * and nothing else.
 */
function buildInfo(): BuildInfo {
  const constants = Platform.constants as { Release?: string; Model?: string };
  return {
    version: Constants.expoConfig?.version ?? '',
    androidRelease: Platform.OS === 'android' ? constants.Release : undefined,
    model: constants.Model,
  };
}

/**
 * Opens a URL, and says something useful when nothing can.
 *
 * Deliberately not guarded by `canOpenURL`: on Android 11 and up that answers
 * for `mailto:` only if the manifest declares a matching `<queries>` intent, so
 * the guard would report "no mail app" on phones that have one. Trying and
 * catching is the check.
 *
 * The fallback hands over the address itself, because a dead button on the one
 * screen that asks for help is worse than no button.
 */
async function open(url: string, whenNothingHandlesIt: () => void): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    whenNothingHandlesIt();
  }
}

export function FeedbackCard({ accent, onAnswered }: { accent: string; onAnswered?: () => void }) {
  const [show, setShow] = useState(true);

  // Marked on every route out, including the dismiss: one ask, and the Settings
  // row for anybody who thinks of something afterwards.
  const answer = useCallback(() => {
    setShow(false);
    markFeedbackAsked();
    onAnswered?.();
  }, [onAnswered]);

  const email = useCallback(() => {
    const build = buildInfo();
    answer();
    void open(feedbackMailto(build), () =>
      Alert.alert(
        'No mail app set up',
        `Send it to ${FEEDBACK_EMAIL} instead, with “${feedbackSubject(build)}” as the subject.`
      )
    );
  }, [answer]);

  const tiktok = useCallback(() => {
    answer();
    void open(TIKTOK_URL, () =>
      Alert.alert('TikTok would not open', `The account is @${TIKTOK_HANDLE}.`)
    );
  }, [answer]);

  if (!show) return null;

  return (
    <View style={styles.card}>
      <Label variant="heading">What’s missing?</Label>
      <Label variant="body" tone="mute">
        Wordburn can’t see anything you do — no account, no upload, nothing sent anywhere. So the
        only way I find out what’s wrong with it is if you tell me.
      </Label>
      <Label variant="body">What were you trying to do that this couldn’t?</Label>

      <View style={styles.actions}>
        <QuietButton title="Email me" accent={accent} onPress={email} />
        <QuietButton title="DM on TikTok" accent={accent} onPress={tiktok} />
        <QuietButton title="Not now" onPress={answer} />
      </View>

      {/* The subject is already prefilled; this is for the mail app that drops it
          and for the person who writes from their laptop later. */}
      <Label variant="micro" tone="mute">
        Keep “{SUBJECT_TAG}” in the subject and I’ll spot it.
      </Label>
    </View>
  );
}

/**
 * The Settings route in, which is the one that matters in the long run.
 *
 * The card is a single nudge at a good moment; this is the channel. An alert
 * rather than a screen because there is nothing to lay out: two addresses and a
 * way back. The work is in each button's own callback and nothing awaits the
 * alert — React Native's Android dialog calls `onDismiss` when a button closes
 * it too, so a promise wrapped around one cannot tell a choice from a cancel.
 */
export function askHowToSendFeedback(): void {
  const build = buildInfo();

  Alert.alert(
    'Tell me what’s missing',
    `There’s no analytics in this app, so mail is the only way I hear anything. Keep “${SUBJECT_TAG}” in the subject and I’ll spot it.`,
    [
      {
        text: 'Email',
        onPress: () =>
          void open(feedbackMailto(build), () =>
            Alert.alert('No mail app set up', `Send it to ${FEEDBACK_EMAIL} instead.`)
          ),
      },
      { text: 'TikTok', onPress: () => void open(TIKTOK_URL, () => undefined) },
      { text: 'Cancel', style: 'cancel' },
    ]
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.sheet,
    padding: space.lg,
    gap: space.sm,
  },
  // Wrapped rather than a row: three labels at 130% system font scale do not fit
  // across a phone, and the app holds at that scale everywhere else.
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: space.xs,
  },
});

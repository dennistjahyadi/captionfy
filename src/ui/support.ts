/**
 * How to reach the person who made this, and when to ask.
 *
 * There is no account, no server and no analytics, so there is no telemetry to
 * read and no crash report waiting anywhere: a bug that is never mailed in is a
 * bug nobody here will ever hear about. That is the whole argument for asking at
 * all, and it is also the honest reason to give — which is why the card says it.
 *
 * Pure on purpose. The copy and both URLs are the part that can be wrong in a
 * way a screenshot will not show (a subject nobody can search for, a body that
 * arrives percent-encoded), so they are composed here and tested, and `Linking`
 * lives in `feedback.tsx` with the button that calls it.
 */
import type { Settings } from '../project/settings';

/**
 * A personal address rather than a role one.
 *
 * `hello@` reads like a company with a support rota, and this is one person who
 * will actually reply. The cost is that it cannot be handed to anybody else
 * later, which is a real cost and an accepted one.
 */
export const FEEDBACK_EMAIL = 'leandrosdennis@gmail.com';

export const TIKTOK_HANDLE = 'dennisleandros';
export const TIKTOK_URL = `https://www.tiktok.com/@${TIKTOK_HANDLE}`;

/** The word the subject leads with, said in the card as well as prefilled. */
export const SUBJECT_TAG = 'Wordburn';

/** Enough to triage a report without a single follow-up question. */
export interface BuildInfo {
  /** `Constants.expoConfig.version`. */
  version: string;
  /** Android's own release number, `Platform.constants.Release`. */
  androidRelease?: string;
  /** `Platform.constants.Model`, which is how a user names their phone. */
  model?: string;
}

/**
 * `Wordburn 1.0.2 — feedback`.
 *
 * The brand leads so the mail can be found in an inbox that gets everything
 * else, and the version is in it because the first question about any report is
 * which build it came from. Both are prefilled and the card still asks the user
 * to keep the word in the subject: a mail app is free to drop a `mailto` body
 * and subject, and a report titled "Hi" is one that will not be found twice.
 */
export function feedbackSubject({ version }: BuildInfo): string {
  return `${SUBJECT_TAG} ${version} — feedback`.trim();
}

/**
 * A prompt and a signature, and nothing that pretends to be a form.
 *
 * Three openings rather than one, and deliberately wide: an earlier draft asked
 * only what the user had just failed to do, which is the sharper question and
 * the one a bug report wants, but it also tells somebody with a compliment or a
 * feature in mind that they have written to the wrong address. A blank mail is
 * worth more than a well-aimed silence, so the prompt invites all three and the
 * triage happens on the way in rather than at the door.
 *
 * The footer is the build, so the answer to "which version" is already in the
 * mail rather than in a reply.
 */
export function feedbackBody(build: BuildInfo): string {
  const facts = [`${SUBJECT_TAG} ${build.version}`];
  if (build.androidRelease) facts.push(`Android ${build.androidRelease}`);
  if (build.model) facts.push(build.model);

  return [
    'What’s working well? What could be better? Any features you’d love to see?',
    '',
    '',
    '—',
    facts.join(' · '),
    '',
  ].join('\n');
}

/**
 * The whole `mailto:`, encoded once.
 *
 * `encodeURIComponent` rather than `encodeURI`, because the body is full of
 * newlines and `&` would otherwise start a third parameter halfway through
 * somebody's sentence.
 */
export function feedbackMailto(build: BuildInfo): string {
  const subject = encodeURIComponent(feedbackSubject(build));
  const body = encodeURIComponent(feedbackBody(build));
  return `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`;
}

/**
 * How many finished exports before the card is offered.
 *
 * Not the first. Somebody who has just watched their first export land has no
 * opinion yet worth the interruption, and the answer they would give is about
 * the thirty seconds they have seen. Two means the card lands on a person who
 * came back, which is the only kind of answer worth reading.
 */
export const FEEDBACK_AFTER_EXPORTS = 2;

/**
 * Whether Saved should ask this time.
 *
 * Once ever, on either answer: tapping Email and dismissing both set
 * `feedbackAsked`, because a card that returns until it is obeyed is a nag, and
 * the Settings row is there forever for anybody who changes their mind.
 *
 * The count is `settings.exportsMade` and not `entitlement.exportsUsed`, which
 * is the trap this rule exists to avoid: `recordExport` deliberately leaves an
 * unlocked user's count alone, so gating on it would ask everybody except the
 * people who paid.
 */
export function shouldAskForFeedback(
  settings: Pick<Settings, 'exportsMade' | 'feedbackAsked'>
): boolean {
  return !settings.feedbackAsked && settings.exportsMade >= FEEDBACK_AFTER_EXPORTS;
}

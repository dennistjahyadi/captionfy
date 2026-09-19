import { NEW_SETTINGS } from '../../project/settings';
import {
  FEEDBACK_AFTER_EXPORTS,
  FEEDBACK_EMAIL,
  SUBJECT_TAG,
  feedbackBody,
  feedbackMailto,
  feedbackSubject,
  shouldAskForFeedback,
  TIKTOK_URL,
} from '../support';

const build = { version: '1.0.2', androidRelease: '14', model: 'SM-A546E' };

describe('feedbackSubject', () => {
  it('leads with the brand, so it can be found in an inbox', () => {
    expect(feedbackSubject(build).startsWith(SUBJECT_TAG)).toBe(true);
  });

  it('carries the version, which is the first question about any report', () => {
    expect(feedbackSubject(build)).toContain('1.0.2');
  });
});

describe('feedbackBody', () => {
  it('asks one question, about something that already happened', () => {
    expect(feedbackBody(build)).toContain('What were you trying to do');
  });

  it('signs off with the build, so nobody has to ask', () => {
    const body = feedbackBody(build);
    expect(body).toContain('Wordburn 1.0.2');
    expect(body).toContain('Android 14');
    expect(body).toContain('SM-A546E');
  });

  it('leaves out what the platform did not report', () => {
    const body = feedbackBody({ version: '1.0.2' });
    expect(body).toContain('Wordburn 1.0.2');
    expect(body).not.toContain('Android');
    expect(body).not.toContain('undefined');
  });
});

describe('feedbackMailto', () => {
  const url = feedbackMailto(build);

  it('goes to the one address', () => {
    expect(url.startsWith(`mailto:${FEEDBACK_EMAIL}?`)).toBe(true);
  });

  /**
   * The bug this test exists for: the body is full of newlines and an unencoded
   * `&` or `#` in it would end the parameter halfway through somebody's sentence.
   */
  it('encodes the body rather than pasting it in raw', () => {
    expect(url).not.toContain('\n');
    expect(url.split('&body=')).toHaveLength(2);
  });

  it('survives a round trip through the URL parser intact', () => {
    const body = new URL(url.replace('mailto:', 'mailto://')).searchParams.get('body');
    expect(body).toBe(feedbackBody(build));
  });
});

it('points at one TikTok account', () => {
  expect(TIKTOK_URL).toBe('https://www.tiktok.com/@dennisleandros');
});

describe('shouldAskForFeedback', () => {
  it('says nothing on a fresh install', () => {
    expect(shouldAskForFeedback(NEW_SETTINGS)).toBe(false);
  });

  it('waits past the first export, which nobody has an opinion after', () => {
    expect(shouldAskForFeedback({ exportsMade: 1, feedbackAsked: false })).toBe(false);
  });

  it('asks the person who came back', () => {
    expect(
      shouldAskForFeedback({ exportsMade: FEEDBACK_AFTER_EXPORTS, feedbackAsked: false })
    ).toBe(true);
  });

  /** Once ever, whichever way it was answered. A card that returns is a nag. */
  it('never asks twice, however many exports follow', () => {
    expect(shouldAskForFeedback({ exportsMade: 99, feedbackAsked: true })).toBe(false);
  });
});

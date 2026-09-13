import { describeExportFailure, estimateExportBytes } from '../limits';

describe('estimateExportBytes', () => {
  it('sizes a minute of 1080p at something a phone can check against', () => {
    // 1080 × 1920 × 30 × 0.13 is 8.1 Mbps, two copies of sixty seconds of it,
    // plus a third for audio and an encoder that overshoots.
    const bytes = estimateExportBytes(1080, 1920, 30, 60_000);
    expect(bytes).toBeGreaterThan(140 * 1024 * 1024);
    expect(bytes).toBeLessThan(180 * 1024 * 1024);
  });

  it('asks for less at 720p than at 1080p', () => {
    expect(estimateExportBytes(720, 1280, 30, 60_000)).toBeLessThan(
      estimateExportBytes(1080, 1920, 30, 60_000)
    );
  });

  it('holds the encoder floor on a tiny frame', () => {
    // A 2 Mbps floor over one second, doubled and padded: the estimate can never
    // reach zero and tell a full phone it has room.
    expect(estimateExportBytes(64, 64, 30, 1000)).toBeGreaterThan(600_000);
  });

  it('never returns less than a second of video for a zero-length clip', () => {
    expect(estimateExportBytes(1080, 1920, 30, 0)).toBe(
      estimateExportBytes(1080, 1920, 30, 1000)
    );
  });
});

describe('describeExportFailure', () => {
  it('turns a codec failure into the sentence with a way out', () => {
    expect(describeExportFailure(new Error('The video could not be drawn: no GL context'))).toBe(
      'Couldn’t render this video on this phone. Try 720p.'
    );
    expect(describeExportFailure(new Error('MediaCodec configure failed'))).toContain('Try 720p');
  });

  it('names a full disk as a full disk', () => {
    expect(describeExportFailure(new Error('write failed: ENOSPC (No space left on device)'))).toContain(
      'ran out of space'
    );
  });

  it('keeps a message it does not recognise rather than guessing', () => {
    // A confident wrong sentence about a rare failure is worse than a technical
    // one somebody can search for.
    expect(describeExportFailure(new Error('The caption plan could not be read'))).toBe(
      'The caption plan could not be read'
    );
  });
});

import { measureMono, project, word } from '../__fixtures__/project';
import { layoutCaptionFrame, type Canvas } from '../layout';
import {
  CAPTION_BAND,
  CAPTION_INSET,
  NO_SHADOW,
  OWN_COLOR,
  POSITION_RANGE,
  resolveStyle,
  safeZoneUnion,
  TEXT_SIZE_RATIO,
  type StyleOverrides,
} from '../style';

const canvas: Canvas = { width: 1080, height: 1920 };

const words = [
  word({ id: 'w1', text: 'so', start: 0, end: 400, conf: 0.1 }),
  word({ id: 'w2', text: 'today', start: 400, end: 1000 }),
  word({ id: 'w3', text: 'I', start: 1000, end: 1200 }),
];

const style = (overrides: StyleOverrides = {}) => resolveStyle('box', overrides);

const frameAt = (tMs: number, overrides: StyleOverrides = {}, p = project({ words })) =>
  layoutCaptionFrame(p, style(overrides), tMs, canvas, measureMono);

describe('invariant 2: one deterministic layout', () => {
  it('gives the identical draw list for the identical input', () => {
    expect(frameAt(500)).toEqual(frameAt(500));
  });

  it('scales with the canvas rather than assuming one', () => {
    const big = layoutCaptionFrame(project({ words }), style(), 500, canvas, measureMono);
    const small = layoutCaptionFrame(
      project({ words }),
      style(),
      500,
      { width: 270, height: 480 },
      measureMono
    );
    expect(big.fontSize / small.fontSize).toBeCloseTo(4);
    expect(big.words[0].x / small.words[0].x).toBeCloseTo(4);
  });

  it('sizes the type from the canvas height', () => {
    expect(frameAt(500).fontSize).toBe(1920 * TEXT_SIZE_RATIO.M);
  });
});

describe('invariant 6: confidence never reaches the video', () => {
  it('says nothing about a low-confidence word', () => {
    const drawn = frameAt(200).words[0];
    expect(drawn.wordId).toBe('w1');
    expect(JSON.stringify(drawn)).not.toMatch(/conf|lowConfidence|flag/i);
  });
});

describe('what is on screen', () => {
  it('draws the whole line, not just the active word', () => {
    expect(frameAt(500).words.map((w) => w.text)).toEqual(['so', 'today', 'I']);
  });

  it('marks past, active and future', () => {
    expect(frameAt(500).words.map((w) => w.state)).toEqual(['past', 'active', 'future']);
  });

  it('draws nothing before the first word', () => {
    expect(frameAt(-1).words).toEqual([]);
  });

  it('applies the global offset', () => {
    const shifted = project({ words, globalOffsetMs: 300 });
    expect(frameAt(500, {}, shifted).words.map((w) => w.state)).toEqual([
      'active',
      'future',
      'future',
    ]);
  });

  it('uppercases when the preset asks for it', () => {
    expect(frameAt(500, { uppercase: true }).words[0].text).toBe('SO');
  });
});

describe('placement', () => {
  it('centres each row horizontally', () => {
    const frame = frameAt(500);
    const first = frame.words[0];
    const last = frame.words[frame.words.length - 1];
    expect(first.x + last.x + last.width).toBeCloseTo(canvas.width);
  });

  it('centres the block on the fraction the style names', () => {
    for (const position of [CAPTION_BAND.top, CAPTION_BAND.middle, CAPTION_BAND.lower, 0.62]) {
      const drawn = frameAt(500, { position }).words[0];
      expect(drawn.y + drawn.height / 2).toBeCloseTo(canvas.height * position);
    }
  });

  it('clears the platform chrome in the lower band', () => {
    const frame = frameAt(500, { position: CAPTION_BAND.lower });
    const bottom = frame.words[0].y + frame.words[0].height;
    expect(bottom).toBeLessThan(canvas.height * (1 - safeZoneUnion().bottom));
  });

  it('keeps the block on the canvas at either end of the range', () => {
    for (const position of [POSITION_RANGE.min, POSITION_RANGE.max]) {
      const drawn = frameAt(500, { position }).words[0];
      expect(drawn.y).toBeGreaterThanOrEqual(0);
      expect(drawn.y + drawn.height).toBeLessThanOrEqual(canvas.height);
    }
  });

  it('reads a position written before positions were numbers', () => {
    // Every project on a phone today carries one of the four old names.
    const named = frameAt(500, { position: 'lowerThird' as never }).words[0];
    const numbered = frameAt(500, { position: CAPTION_BAND.lower }).words[0];
    expect(named.y).toBeCloseTo(numbered.y);
  });

  it('puts the baseline inside the row', () => {
    const drawn = frameAt(500).words[0];
    expect(drawn.baseline).toBeGreaterThan(drawn.y);
    expect(drawn.baseline).toBeLessThan(drawn.y + drawn.height);
  });
});

describe('wrapping', () => {
  const long = [
    word({ id: 'w1', text: 'extraordinarily', start: 0, end: 400 }),
    word({ id: 'w2', text: 'complicated', start: 400, end: 800 }),
    word({ id: 'w3', text: 'sentences', start: 800, end: 1200 }),
    word({ id: 'w4', text: 'everywhere', start: 1200, end: 1600 }),
  ];

  it('wraps onto a second row rather than running off the frame', () => {
    const frame = frameAt(500, { maxRows: 2 }, project({ words: long }));
    const rows = new Set(frame.words.map((w) => w.y));
    expect(rows.size).toBe(2);
  });

  it('keeps every word inside the horizontal inset', () => {
    const frame = frameAt(500, { maxRows: 2 }, project({ words: long }));
    const left = canvas.width * CAPTION_INSET.x;
    frame.words.forEach((w) => {
      expect(w.x).toBeGreaterThanOrEqual(left - 0.5);
      expect(w.x + w.width).toBeLessThanOrEqual(canvas.width - left + 0.5);
    });
  });

  const pair = project({ words: long.slice(0, 2) });

  it('shrinks the type to hold a line to one row', () => {
    const wrapped = frameAt(500, { maxRows: 2 }, pair);
    expect(new Set(wrapped.words.map((w) => w.y)).size).toBe(2);

    const frame = frameAt(500, { maxRows: 1 }, pair);
    expect(new Set(frame.words.map((w) => w.y)).size).toBe(1);
    expect(frame.fontSize).toBeLessThan(1920 * TEXT_SIZE_RATIO.M);
  });

  it('scales the outline with the type it shrank', () => {
    const frame = frameAt(500, { maxRows: 1 }, pair);
    expect(frame.words[0].outline.width).toBeCloseTo(frame.fontSize * style().outlineRatio);
  });

  it('stops shrinking at the readable floor rather than vanishing', () => {
    const frame = frameAt(500, { maxRows: 1 }, project({ words: long }));
    expect(frame.fontSize).toBeGreaterThan(1920 * 0.02);
  });
});

describe('highlight modes', () => {
  it('box: fills a rounded box behind the active word only', () => {
    const frame = frameAt(500, { highlightMode: 'box' });
    expect(frame.words.map((w) => w.box !== undefined)).toEqual([false, true, false]);
    const box = frame.words[1].box!;
    expect(box.x).toBeLessThan(frame.words[1].x);
    expect(box.width).toBeGreaterThan(frame.words[1].width);
  });

  it('box: never lets the box touch the word either side of it', () => {
    // The box is padded past its own word, and a space is narrower than that
    // padding, so the words are spaced to hold it.
    for (const at of [200, 500, 1100]) {
      const frame = frameAt(at, { highlightMode: 'box' });
      const active = frame.words.findIndex((entry) => entry.box !== undefined);
      const box = frame.words[active].box!;
      const before = frame.words[active - 1];
      const after = frame.words[active + 1];

      if (before && before.y === frame.words[active].y) {
        expect(box.x).toBeGreaterThanOrEqual(before.x + before.width);
      }
      if (after && after.y === frame.words[active].y) {
        expect(box.x + box.width).toBeLessThanOrEqual(after.x);
      }
    }
  });

  it('box: spaces every word the same, so none of them move as the box travels', () => {
    const positions = [200, 500, 1100].map((at) =>
      frameAt(at, { highlightMode: 'box' }).words.map((entry) => entry.x)
    );

    expect(positions[1]).toEqual(positions[0]);
    expect(positions[2]).toEqual(positions[0]);
  });

  it('box: widens the line rather than the gap around one word', () => {
    const boxed = frameAt(500, { highlightMode: 'box' });
    const clean = frameAt(500, { highlightMode: 'none' });

    const gapOf = (frame: typeof boxed) => frame.words[1].x - (frame.words[0].x + frame.words[0].width);
    expect(gapOf(boxed)).toBeGreaterThan(gapOf(clean));
  });

  it('karaoke: fills the active word as it is spoken', () => {
    const frame = frameAt(700, { highlightMode: 'karaoke' });
    expect(frame.words.map((w) => w.fill)).toEqual([1, 0.5, 0]);
  });

  it('karaoke: a word is fully filled the moment it ends', () => {
    expect(frameAt(1000, { highlightMode: 'karaoke' }).words[1].fill).toBe(1);
  });

  it('snap: a word crosses between the two colours whole, at its own start', () => {
    const snapped = {
      highlightMode: 'snap' as const,
      textColor: '#FFFFFF8C',
      spokenColor: '#FFFFFF',
    };

    // 700 ms is the middle of the second word: the first has been said, the
    // second is being said, the third has not. A karaoke fill would have the
    // middle one half a colour; this one is already the whole of it.
    const frame = frameAt(700, snapped);
    expect(frame.words.map((w) => w.color)).toEqual(['#FFFFFF', '#FFFFFF', '#FFFFFF8C']);
    expect(frame.words.every((w) => w.fillColor === w.color)).toBe(true);

    // And the word that has not been reached is the quiet colour right up to
    // the instant it is.
    expect(frameAt(999, snapped).words[2].color).toBe('#FFFFFF8C');
    expect(frameAt(1000, snapped).words[2].color).toBe('#FFFFFF');
  });

  it('snap: leaves the big word quiet until it has been said', () => {
    // A word wearing the accent before the voice reaches it is the one word on
    // the line the viewer has already read.
    const snapped = {
      highlightMode: 'snap' as const,
      textColor: '#FFFFFF8C',
      spokenColor: '#FFFFFF',
      emphasis: { color: '#FFE03D' },
    };
    const big = (tMs: number) =>
      layoutCaptionFrame(project({ words }), style(snapped), tMs, canvas, measureMono, {
        emphasisIds: new Set(['w3']),
      }).words[2];

    expect(big(500).color).toBe('#FFFFFF8C');
    expect(big(1100).color).toBe('#FFE03D');
  });

  it('active: lights the word being said and leaves nothing behind it', () => {
    const marked = {
      highlightMode: 'active' as const,
      highlightColor: '#FFD60A',
      textColor: '#FFFFFF',
    };

    // The difference from snap, which is the whole reason this mode exists: the
    // word that has already been said is white again, not yellow.
    expect(frameAt(700, marked).words.map((w) => w.color)).toEqual([
      '#FFFFFF',
      '#FFD60A',
      '#FFFFFF',
    ]);

    // And the mark moves on the instant the next word starts.
    expect(frameAt(999, marked).words.map((w) => w.color)).toEqual([
      '#FFFFFF',
      '#FFD60A',
      '#FFFFFF',
    ]);
    expect(frameAt(1000, marked).words.map((w) => w.color)).toEqual([
      '#FFFFFF',
      '#FFFFFF',
      '#FFD60A',
    ]);
  });

  it('active: keeps the big word the accent throughout', () => {
    // Its size has already said it is different. A word that lost its colour the
    // moment it was said would read as the emphasis switching off.
    const marked = {
      highlightMode: 'active' as const,
      highlightColor: '#FFD60A',
      textColor: '#FFFFFF',
      emphasis: { color: '#FF5A5F' },
    };
    const big = (tMs: number) =>
      layoutCaptionFrame(project({ words }), style(marked), tMs, canvas, measureMono, {
        emphasisIds: new Set(['w2']),
      }).words[1];

    expect(big(200).color).toBe('#FF5A5F');
    expect(big(700).color).toBe('#FF5A5F');
    expect(big(1100).color).toBe('#FF5A5F');
  });

  it('fade: dims the words still to come', () => {
    const frame = frameAt(500, { highlightMode: 'fade', upcomingOpacity: 0.45 });
    expect(frame.words.map((w) => w.opacity)).toEqual([1, 1, 0.45]);
  });

  it('clean: marks nothing', () => {
    const frame = frameAt(500, { highlightMode: 'none' });
    expect(frame.words.every((w) => w.scale === 1 && w.box === undefined)).toBe(true);
    expect(new Set(frame.words.map((w) => w.color)).size).toBe(1);
  });
});

describe('reveal: a line that builds as it is spoken', () => {
  const revealing = { reveal: 'word' as const };

  it('draws only the words already started', () => {
    expect(frameAt(200, revealing).words.map((w) => w.text)).toEqual(['so']);
    expect(frameAt(500, revealing).words.map((w) => w.text)).toEqual(['so', 'today']);
    expect(frameAt(1100, revealing).words.map((w) => w.text)).toEqual(['so', 'today', 'I']);
  });

  it('keeps one type size from the first word to the last', () => {
    // The fit is decided against the whole line, so a line does not shrink under
    // the reader as it fills up.
    const sizes = [200, 500, 1100].map((at) => frameAt(at, revealing).fontSize);
    expect(new Set(sizes).size).toBe(1);
  });

  it('re-centres what is on screen rather than holding a space', () => {
    const one = frameAt(200, revealing);
    const two = frameAt(500, revealing);
    expect(centre(one)).toBeCloseTo(canvas.width / 2);
    expect(centre(two)).toBeCloseTo(canvas.width / 2);
    expect(two.words[0].x).not.toBeCloseTo(one.words[0].x);
  });

  it('draws the whole line when the style does not ask for a reveal', () => {
    expect(frameAt(200).words).toHaveLength(3);
  });

  it('never blinks out: a line on screen always has a word on it', () => {
    for (let at = -50; at < 1600; at += 10) {
      const whole = frameAt(at).words.length;
      const building = frameAt(at, revealing).words.length;

      if (whole > 0) expect(building).toBeGreaterThan(0);
      else expect(building).toBe(0);
    }
  });
});

describe('entrance', () => {
  const arriving = {
    reveal: 'word' as const,
    entrance: { scaleFrom: 0.5, dyRatio: 0.5, opacityFrom: 0, ms: 200 },
  };

  it('brings every word in, not only the emphasised one', () => {
    const word = frameAt(480, arriving).words[1];
    expect(word.scale).toBeGreaterThan(0.5);
    expect(word.scale).toBeLessThan(1);
    expect(word.opacity).toBeGreaterThan(0);
    expect(word.opacity).toBeLessThan(1);
  });

  it('settles: a word past its entrance is where the layout put it', () => {
    const settled = frameAt(900, arriving).words[1];
    const still = frameAt(900, { reveal: 'word' }).words[1];

    expect(settled.scale).toBe(1);
    expect(settled.opacity).toBe(1);
    expect(settled.y).toBeCloseTo(still.y);
    expect(settled.baseline).toBeCloseTo(still.baseline);
  });

  it('starts a word below where it lands', () => {
    expect(frameAt(400, arriving).words[1].y).toBeGreaterThan(frameAt(900, arriving).words[1].y);
  });

  it('moves the word box with the word', () => {
    const arrivingBox = { ...arriving, highlightMode: 'box' as const };
    const mid = frameAt(450, arrivingBox).words[1];
    expect(mid.box!.y).toBeCloseTo(mid.y - mid.fontSize * 0.12);
  });

  it('is off under reduced motion, in the preview and the export alike', () => {
    const frame = layoutCaptionFrame(project({ words }), style(arriving), 400, canvas, measureMono, {
      reducedMotion: true,
    });
    expect(frame.words.every((w) => w.scale === 1 && w.opacity === 1)).toBe(true);
    expect(frame.words[1].y).toBeCloseTo(frameAt(900, arriving).words[1].y);
  });
});

describe('shadow', () => {
  const shadowed = { shadow: { color: '#000000AA', blurRatio: 0.2, dxRatio: 0, dyRatio: 0.05 } };

  it('scales with the font, so preview and export cast the same one', () => {
    const big = frameAt(500, shadowed).words[0];
    const small = layoutCaptionFrame(
      project({ words }),
      style(shadowed),
      500,
      { width: 270, height: 480 },
      measureMono
    ).words[0];

    expect(big.shadow!.blur / small.shadow!.blur).toBeCloseTo(4);
    expect(big.shadow!.blur).toBeCloseTo(big.fontSize * 0.2);
  });

  it('is absent when it would put no pixels down', () => {
    expect(frameAt(500).words[0].shadow).toBeUndefined();
    expect(
      frameAt(500, { shadow: { color: '#000000', blurRatio: 0, dxRatio: 0, dyRatio: 0 } }).words[0]
        .shadow
    ).toBeUndefined();
  });

  it('resolves a glow to the colour of the word casting it', () => {
    const glow = {
      emphasis: { shadow: { color: OWN_COLOR, blurRatio: 0.3, dxRatio: 0, dyRatio: 0 } },
    };
    const frame = layoutCaptionFrame(project({ words }), style(glow), 500, canvas, measureMono, {
      emphasisIds: new Set(['w2']),
    });
    const big = frame.words[1];

    // Never the sentinel: the export reads a colour, not an instruction.
    expect(big.shadow!.color).toBe(big.color);
    expect(big.shadow!.color).not.toBe(OWN_COLOR);
  });

  it('gives the big word its own where the preset asked, and the line theirs', () => {
    const frame = layoutCaptionFrame(
      project({ words }),
      style({
        ...shadowed,
        emphasis: { shadow: { color: '#FF0000', blurRatio: 0, dxRatio: 0.04, dyRatio: 0.04 } },
      }),
      500,
      canvas,
      measureMono,
      { emphasisIds: new Set(['w2']) }
    );

    expect(frame.words[1].shadow!.color).toBe('#FF0000');
    expect(frame.words[0].shadow!.color).toBe('#000000AA');
  });
});

describe('plate', () => {
  const plated = {
    plate: {
      color: '#FFFFFF',
      padXRatio: 0.3,
      padYRatio: 0.2,
      radiusRatio: 0.1,
      shadow: { color: '#00000040', blurRatio: 0.2, dxRatio: 0, dyRatio: 0.1 },
    },
  };

  it('covers every word on the block', () => {
    const frame = frameAt(500, plated);
    const plate = frame.plate!;

    for (const word of frame.words) {
      expect(plate.x).toBeLessThan(word.x);
      expect(plate.x + plate.width).toBeGreaterThan(word.x + word.width);
      expect(plate.y).toBeLessThan(word.y);
      expect(plate.y + plate.height).toBeGreaterThan(word.y + word.height);
    }
  });

  it('holds still while the highlight walks the line', () => {
    // It has to be sized against the box every word could wear, not the one
    // wearing it: a card that stepped in and out at the ends of the line would
    // be the only thing on screen the eye follows.
    const boxed = { ...plated, highlightMode: 'box' as const };
    const plates = [200, 500, 1100].map((at) => frameAt(at, boxed).plate);

    expect(plates[1]).toEqual(plates[0]);
    expect(plates[2]).toEqual(plates[0]);
  });

  it('contains the box wherever it is', () => {
    const boxed = { ...plated, highlightMode: 'box' as const };
    for (const at of [200, 500, 1100]) {
      const frame = frameAt(at, boxed);
      const box = frame.words.find((entry) => entry.box)!.box!;
      expect(frame.plate!.x).toBeLessThanOrEqual(box.x);
      expect(frame.plate!.x + frame.plate!.width).toBeGreaterThanOrEqual(box.x + box.width);
    }
  });

  it('is absent when the style asks for none', () => {
    expect(frameAt(500).plate).toBeUndefined();
    expect(frameAt(-1, plated).plate).toBeUndefined();
  });
});

describe('a big word in a band of its own', () => {
  const detached = {
    position: CAPTION_BAND.lower,
    emphasis: { ownRow: true, scale: 2, band: CAPTION_BAND.top },
  };

  const banded = (overrides = {}) =>
    layoutCaptionFrame(project({ words }), style({ ...detached, ...overrides }), 1100, canvas, measureMono, {
      emphasisIds: new Set(['w2']),
    });

  it('puts it at its own band and leaves the rest where the style says', () => {
    const frame = banded();
    const big = frame.words.find((w) => w.emphasised)!;
    const rest = frame.words.filter((w) => !w.emphasised);

    expect(big.y + big.height / 2).toBeCloseTo(canvas.height * CAPTION_BAND.top);
    for (const word of rest) expect(word.y).toBeGreaterThan(canvas.height * 0.6);
  });

  it('does not let the banded row push the block around', () => {
    // The block is the rows that are in it. A word pinned to a band of its own
    // is somewhere else on the screen and takes no part in deciding where the
    // rest of the line sits, so what is left is centred on the style's own
    // position exactly as if the big word had never been in it.
    const rest = banded().words.filter((w) => !w.emphasised);
    const top = Math.min(...rest.map((w) => w.y));
    const bottom = Math.max(...rest.map((w) => w.y + w.height));

    expect((top + bottom) / 2).toBeCloseTo(canvas.height * CAPTION_BAND.lower);
    expect(rest.length).toBe(2);
  });

  it('leaves a banded word outside the card', () => {
    const frame = banded({
      plate: { color: '#FFFFFF', padXRatio: 0.2, padYRatio: 0.2, radiusRatio: 0, shadow: NO_SHADOW },
    });
    const big = frame.words.find((w) => w.emphasised)!;
    expect(frame.plate!.y).toBeGreaterThan(big.y + big.height);
  });
});

function centre(frame: { words: { x: number; width: number }[] }): number {
  const left = Math.min(...frame.words.map((w) => w.x));
  const right = Math.max(...frame.words.map((w) => w.x + w.width));
  return (left + right) / 2;
}

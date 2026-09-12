import {
  accentColor,
  highlightColorOverrides,
  presetById,
  PLATFORM_SAFE_ZONES,
  resolveStyle,
  safeZoneUnion,
  styleChoices,
  styleOverridesFor,
  STYLE_PRESETS,
} from '../style';

const RED = '#FF5A5F';

describe('accentColor', () => {
  it('names the colour each preset actually paints', () => {
    // The box fill, the karaoke fill, and the big word where nothing is marked
    // as it is spoken.
    expect(accentColor(presetById('box'))).toBe(presetById('box').boxColor);
    expect(accentColor(presetById('karaoke'))).toBe(presetById('karaoke').highlightColor);
    expect(accentColor(presetById('editorial'))).toBe(presetById('editorial').emphasis.color);
    expect(accentColor(presetById('clean'))).toBe(presetById('clean').emphasis.color);
  });

  it('never reports the box preset\'s dark text as its colour', () => {
    // `highlightColor` is what a word sitting on the box is drawn in, and an
    // accent taken from there would light the whole interface near-black.
    expect(accentColor(presetById('box'))).not.toBe(presetById('box').highlightColor);
  });
});

describe('highlightColorOverrides', () => {
  it('paints the box in box highlight and leaves the text on it readable', () => {
    const style = resolveStyle('box', highlightColorOverrides(presetById('box'), RED));

    expect(style.boxColor).toBe(RED);
    expect(style.highlightColor).toBe(presetById('box').highlightColor);
    expect(accentColor(style)).toBe(RED);
  });

  it('paints the fill and what has already been said in karaoke', () => {
    const style = resolveStyle('karaoke', highlightColorOverrides(presetById('karaoke'), RED));

    expect(style.highlightColor).toBe(RED);
    expect(style.spokenColor).toBe(RED);
  });

  it('paints the big word in the presets that mark nothing as it is spoken', () => {
    for (const id of ['editorial', 'clean']) {
      const style = resolveStyle(id, highlightColorOverrides(presetById(id), RED));

      expect(style.emphasis.color).toBe(RED);
      expect(style.textColor).toBe(presetById(id).textColor);
    }
  });

  it('puts the colour on the big word in every preset, so a switch keeps it', () => {
    for (const preset of STYLE_PRESETS) {
      expect(resolveStyle(preset.id, highlightColorOverrides(preset.props, RED)).emphasis.color).toBe(
        RED
      );
    }
  });

  it('leaves the rest of the emphasis style alone', () => {
    const style = resolveStyle('editorial', highlightColorOverrides(presetById('editorial'), RED));
    const preset = presetById('editorial');

    expect(style.emphasis.scale).toBe(preset.emphasis.scale);
    expect(style.emphasis.ownRow).toBe(true);
    expect(style.emphasis.fontFamily).toBe(preset.emphasis.fontFamily);
  });
});

describe('styleChoices and styleOverridesFor', () => {
  it('report nothing chosen on an untouched preset', () => {
    for (const preset of STYLE_PRESETS) {
      expect(styleChoices(preset.id, {})).toEqual({
        color: undefined,
        textSize: undefined,
        position: undefined,
        maxWordsPerLine: undefined,
      });
    }
  });

  it('round trip a choice through the overrides a project stores', () => {
    const choices = { color: RED, textSize: 'L' as const, position: 'middle' as const, maxWordsPerLine: 2 };
    const overrides = styleOverridesFor('box', choices);

    expect(styleChoices('box', overrides)).toEqual(choices);
  });

  it('write nothing for a choice that is already the preset\'s own', () => {
    const preset = presetById('box');

    expect(
      styleOverridesFor('box', {
        color: accentColor(preset),
        textSize: preset.textSize,
        position: preset.position,
        maxWordsPerLine: preset.maxWordsPerLine,
      })
    ).toEqual({});
  });

  it('carry a chosen colour onto the next preset, on whatever it paints', () => {
    const chosen = styleChoices('box', styleOverridesFor('box', { color: RED }));
    const style = resolveStyle('karaoke', styleOverridesFor('karaoke', chosen));

    expect(style.highlightColor).toBe(RED);
    expect(style.spokenColor).toBe(RED);
  });

  it('give a preset its own look back when nothing was chosen', () => {
    // Switching to Clean subtitle after using Box highlight has to produce
    // Clean: small, white, five words. A preset is defaults, not a coat of
    // paint over the last one.
    const chosen = styleChoices('box', {});
    const style = resolveStyle('clean', styleOverridesFor('clean', chosen));
    const clean = presetById('clean');

    expect(style.textSize).toBe(clean.textSize);
    expect(style.maxWordsPerLine).toBe(clean.maxWordsPerLine);
    expect(style.emphasis.color).toBe(clean.emphasis.color);
  });

  it('keep a size the user chose across a preset switch', () => {
    const chosen = styleChoices('clean', styleOverridesFor('clean', { textSize: 'L' }));

    expect(resolveStyle('box', styleOverridesFor('box', chosen)).textSize).toBe('L');
  });

  it('hold words per line inside what the layout accepts', () => {
    expect(resolveStyle('box', styleOverridesFor('box', { maxWordsPerLine: 9 })).maxWordsPerLine).toBe(5);
    expect(resolveStyle('box', styleOverridesFor('box', { maxWordsPerLine: 0 })).maxWordsPerLine).toBe(1);
  });
});

describe('safeZoneUnion', () => {
  it('takes the widest inset on every side', () => {
    const union = safeZoneUnion();
    const zones = Object.values(PLATFORM_SAFE_ZONES);

    for (const zone of zones) {
      expect(union.top).toBeGreaterThanOrEqual(zone.top);
      expect(union.bottom).toBeGreaterThanOrEqual(zone.bottom);
      expect(union.left).toBeGreaterThanOrEqual(zone.left);
      expect(union.right).toBeGreaterThanOrEqual(zone.right);
    }
  });

  it('leaves a rectangle worth putting a caption in', () => {
    const union = safeZoneUnion();

    expect(union.top + union.bottom).toBeLessThan(0.6);
    expect(union.left + union.right).toBeLessThan(0.6);
  });

  it('agrees with where the layout puts a lower third', () => {
    // The overlay would be a liar if the default position sat outside it.
    expect(presetById('box').position).toBe('lowerThird');
    expect(safeZoneUnion().bottom).toBeLessThanOrEqual(0.22);
  });
});

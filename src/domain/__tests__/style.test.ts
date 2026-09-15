import {
  accentColor,
  DEFAULT_STYLE_ID,
  highlightColorOverrides,
  isPaintable,
  OWN_COLOR,
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

describe('the preset roster', () => {
  it('holds nine, each with its own id and name', () => {
    expect(STYLE_PRESETS).toHaveLength(9);
    expect(new Set(STYLE_PRESETS.map((preset) => preset.id)).size).toBe(9);
    expect(new Set(STYLE_PRESETS.map((preset) => preset.name)).size).toBe(9);
  });

  it('starts new projects on one that exists', () => {
    expect(STYLE_PRESETS.some((preset) => preset.id === DEFAULT_STYLE_ID)).toBe(true);
  });

  it('only bands a big word that has a row of its own', () => {
    // A word sitting inline in a row cannot also be somewhere else on screen.
    for (const preset of STYLE_PRESETS) {
      if (preset.props.emphasis.band) expect(preset.props.emphasis.ownRow).toBe(true);
    }
  });

  it('paints every word in something, whether a stroke or a shadow', () => {
    // Type on a photograph needs an edge. A preset with neither is one that
    // disappears over a white wall.
    for (const preset of STYLE_PRESETS) {
      const { props } = preset;
      const stroked = props.outlineRatio > 0 && isPaintable(props.outlineColor);
      const shadowed = isPaintable(props.shadow.color) && props.shadow.blurRatio > 0;
      const plated = isPaintable(props.plate.color);

      expect(stroked || shadowed || plated).toBe(true);
    }
  });

  it('answers the colour swatch with something visible in every one of them', () => {
    for (const preset of STYLE_PRESETS) {
      const style = resolveStyle(preset.id, highlightColorOverrides(preset.props, RED));
      const painted = [style.boxColor, style.highlightColor, style.spokenColor, style.emphasis.color];
      expect(painted).toContain(RED);
    }
  });

  it('keeps a glow following the colour the user picked', () => {
    const glowing = STYLE_PRESETS.filter((preset) => preset.props.emphasis.shadow?.color === OWN_COLOR);
    expect(glowing.length).toBeGreaterThan(0);

    for (const preset of glowing) {
      const style = resolveStyle(preset.id, highlightColorOverrides(preset.props, RED));
      expect(style.emphasis.shadow!.color).toBe(OWN_COLOR);
      expect(style.emphasis.color).toBe(RED);
    }
  });
});

describe('a highlight that survives the colour it is given', () => {
  it('keeps the box a shape on the one preset that prints on paper', () => {
    // White is a swatch and the card is white, so the fill alone cannot be the
    // whole signal.
    const style = resolveStyle('newsprint', highlightColorOverrides(presetById('newsprint'), '#FFFFFF'));

    expect(style.boxColor).toBe('#FFFFFF');
    expect(isPaintable(style.boxShadow.color)).toBe(true);
    expect(style.boxShadow.dxRatio).toBeGreaterThan(0);
  });
});

describe('isPaintable', () => {
  it('is false only for a colour with nothing in it', () => {
    expect(isPaintable('#00000000')).toBe(false);
    expect(isPaintable('#FFFFFF00')).toBe(false);
    expect(isPaintable('#000000')).toBe(true);
    expect(isPaintable('#00000001')).toBe(true);
  });
});

describe('resolveStyle', () => {
  it('merges a nested override without dropping the rest of it', () => {
    const style = resolveStyle('stack', { shadow: { color: RED }, entrance: { ms: 400 } });
    const preset = presetById('stack');

    expect(style.shadow.color).toBe(RED);
    expect(style.shadow.blurRatio).toBe(preset.shadow.blurRatio);
    expect(style.entrance.ms).toBe(400);
    expect(style.entrance.dyRatio).toBe(preset.entrance.dyRatio);
  });

  it('will not take an entrance that runs backwards', () => {
    const style = resolveStyle('stack', { entrance: { ms: -100, opacityFrom: 4 } });

    expect(style.entrance.ms).toBe(0);
    expect(style.entrance.opacityFrom).toBe(1);
  });
});

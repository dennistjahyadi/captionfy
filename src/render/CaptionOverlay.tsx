/**
 * The draw list, drawn.
 *
 * Every number here comes from `layoutCaptionFrame`. Nothing in this file
 * decides where a word goes, how big it is or what colour it takes, because the
 * export draws the same list and anything decided here would be a second layout
 * (invariant 2). It is a renderer for a frame, not a caption renderer.
 *
 * `CaptionElements` is the drawing without a canvas around it, so that the style
 * sheet can put nine of them in one canvas instead of nine. The overlay itself
 * is that plus the canvas and the view it sits in.
 */
import { BlurMask, Canvas, Group, rect, RoundedRect, Text } from '@shopify/react-native-skia';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { CaptionBoxDraw, CaptionFrame, CaptionWordDraw } from '../domain';
import { faceKey } from './faces';
import type { FontLookup } from './typefaces';

/**
 * Stroke width is doubled because Skia centres a stroke on the glyph outline, so
 * half of it lands inside the letter. The draw list means the width that shows.
 */
const STROKE_CENTRING = 2;

export const CaptionOverlay = memo(function CaptionOverlay({
  frame,
  width,
  height,
  fonts,
}: {
  frame: CaptionFrame;
  width: number;
  height: number;
  fonts: FontLookup;
}) {
  return (
    // The overlay never takes a touch: taps on the video belong to the video.
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { width, height }]}>
      <Canvas style={{ width, height }}>
        <CaptionElements frame={frame} fonts={fonts} />
      </Canvas>
    </View>
  );
});

/**
 * One frame's captions as Skia nodes, for whatever canvas the caller has.
 *
 * The order is the painter's order the burn-in also uses: the card under
 * everything, then every box as one pass, then every word. A box is padded past
 * its own word, so drawing each one immediately before its word would paint over
 * the neighbour.
 */
export const CaptionElements = memo(function CaptionElements({
  frame,
  fonts,
}: {
  frame: CaptionFrame;
  fonts: FontLookup;
}) {
  return (
    <>
      {frame.plate ? <Box box={frame.plate} /> : null}

      {frame.words.map((word) =>
        word.box ? (
          <Group
            key={`box-${word.wordId}`}
            opacity={word.opacity}
            transform={[{ scale: word.scale }]}
            origin={centreOf(word)}
          >
            <Box box={word.box} />
          </Group>
        ) : null
      )}

      {frame.words.map((word) => (
        <WordText key={word.wordId} word={word} fonts={fonts} />
      ))}
    </>
  );
});

function WordText({ word, fonts }: { word: CaptionWordDraw; fonts: FontLookup }) {
  const font = fonts(faceKey(word.face), word.fontSize);
  const filling = word.fill > 0 && word.fillColor !== word.color;
  const shadow = word.shadow;

  return (
    <Group opacity={word.opacity} transform={[{ scale: word.scale }]} origin={centreOf(word)}>
      {shadow ? (
        // A drop shadow is the word again, offset, blurred and in one colour. A
        // blur mask rather than an image filter because that is what the
        // burn-in's `BlurMaskFilter` is, and because a filter would push every
        // shadowed word onto a layer of its own.
        <Text
          x={word.x + shadow.dx}
          y={word.baseline + shadow.dy}
          text={word.text}
          font={font}
          color={shadow.color}
        >
          {shadow.blur > 0 ? <BlurMask blur={shadow.blur} style="normal" /> : null}
        </Text>
      ) : null}

      {word.outline.width > 0 ? (
        <Text
          x={word.x}
          y={word.baseline}
          text={word.text}
          font={font}
          color={word.outline.color}
          style="stroke"
          strokeWidth={word.outline.width * STROKE_CENTRING}
          strokeJoin="round"
        />
      ) : null}

      <Text x={word.x} y={word.baseline} text={word.text} font={font} color={word.color} />

      {filling ? (
        // Karaoke: the spoken part of the word, clipped to how much of it has been
        // said. Clipped wide vertically so a descender is never cut off.
        <Group clip={rect(word.x, word.y - word.height, word.width * word.fill, word.height * 3)}>
          <Text x={word.x} y={word.baseline} text={word.text} font={font} color={word.fillColor} />
        </Group>
      ) : null}
    </Group>
  );
}

/** A rounded rectangle and, where the style asked for one, the shadow under it. */
function Box({ box }: { box: CaptionBoxDraw }) {
  return (
    <>
      {box.shadow ? (
        <RoundedRect
          x={box.x + box.shadow.dx}
          y={box.y + box.shadow.dy}
          width={box.width}
          height={box.height}
          r={box.radius}
          color={box.shadow.color}
        >
          {box.shadow.blur > 0 ? <BlurMask blur={box.shadow.blur} style="normal" /> : null}
        </RoundedRect>
      ) : null}

      <RoundedRect
        x={box.x}
        y={box.y}
        width={box.width}
        height={box.height}
        r={box.radius}
        color={box.color}
      />
    </>
  );
}

function centreOf(word: CaptionWordDraw) {
  return { x: word.x + word.width / 2, y: word.y + word.height / 2 };
}

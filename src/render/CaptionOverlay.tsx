/**
 * The draw list, drawn.
 *
 * Every number here comes from `layoutCaptionFrame`. Nothing in this file
 * decides where a word goes, how big it is or what colour it takes, because the
 * export draws the same list and anything decided here would be a second layout
 * (invariant 2). It is a renderer for a frame, not a caption renderer.
 *
 * `CaptionElements` is the drawing without a canvas around it, so that the style
 * sheet can put every preset's tile in one canvas rather than one canvas each.
 * The overlay itself is that plus the canvas and the view it sits in.
 */
import { BlurMask, Canvas, Group, rect, RoundedRect, Text } from '@shopify/react-native-skia';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import type {
  BoxDraw,
  CaptionFrame,
  CaptionWordDraw,
  WatermarkDraw,
  WatermarkTextDraw,
} from '../domain';
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
  watermark,
}: {
  frame: CaptionFrame;
  width: number;
  height: number;
  fonts: FontLookup;
  /**
   * The free tier's mark, when the entitlement calls for one.
   *
   * On the overlay rather than inside `CaptionElements` on purpose: the style
   * sheet draws every preset's tile through those elements, and a mark a hundred
   * points tall would be noise about a question the tiles are not asking.
   */
  watermark?: WatermarkDraw;
}) {
  return (
    // The overlay never takes a touch: taps on the video belong to the video.
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { width, height }]}>
      <Canvas style={{ width, height }}>
        <CaptionElements frame={frame} fonts={fonts} />
        {watermark ? <Watermark mark={watermark} fonts={fonts} /> : null}
      </Canvas>
    </View>
  );
});

/**
 * The mark, over the captions: the icon's pills, then the credit, then the brand.
 *
 * Every piece of it is a shape one of the components below already draws — a
 * pill is the same rounded rectangle a box highlight is, and a line is the same
 * shadow-then-glyphs pair `WordText` makes and `CaptionPainter` makes on the
 * other side of the bridge. Nothing here decides where anything goes;
 * `layoutWatermark` did, against this same canvas.
 */
function Watermark({ mark, fonts }: { mark: WatermarkDraw; fonts: FontLookup }) {
  return (
    <>
      {mark.pills.map((pill, index) => (
        <Box key={`pill-${index}`} box={pill} />
      ))}

      {mark.lines.map((line) => (
        <WatermarkLine key={line.text} line={line} fonts={fonts} />
      ))}
    </>
  );
}

function WatermarkLine({ line, fonts }: { line: WatermarkTextDraw; fonts: FontLookup }) {
  const font = fonts(faceKey(line.face), line.fontSize);

  return (
    <>
      <Text
        x={line.x + line.shadow.dx}
        y={line.baseline + line.shadow.dy}
        text={line.text}
        font={font}
        color={line.shadow.color}
      >
        {line.shadow.blur > 0 ? <BlurMask blur={line.shadow.blur} style="normal" /> : null}
      </Text>

      <Text x={line.x} y={line.baseline} text={line.text} font={font} color={line.color} />
    </>
  );
}

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
function Box({ box }: { box: BoxDraw }) {
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

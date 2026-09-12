/**
 * The draw list, drawn.
 *
 * Every number here comes from `layoutCaptionFrame`. Nothing in this file
 * decides where a word goes, how big it is or what colour it takes, because the
 * export draws the same list and anything decided here would be a second layout
 * (invariant 2). It is a renderer for a frame, not a caption renderer.
 */
import { Canvas, Group, rect, RoundedRect, Text } from '@shopify/react-native-skia';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { CaptionFrame, CaptionWordDraw } from '../domain';
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
        {/* Boxes first, as one pass. A box is padded past its own word, so drawing
            each one immediately before its word would paint over the neighbour. */}
        {frame.words.map((word) =>
          word.box ? (
            <Group
              key={`box-${word.wordId}`}
              opacity={word.opacity}
              transform={[{ scale: word.scale }]}
              origin={centreOf(word)}
            >
              <RoundedRect
                x={word.box.x}
                y={word.box.y}
                width={word.box.width}
                height={word.box.height}
                r={word.box.radius}
                color={word.box.color}
              />
            </Group>
          ) : null
        )}

        {frame.words.map((word) => (
          <WordText key={word.wordId} word={word} fonts={fonts} />
        ))}
      </Canvas>
    </View>
  );
});

function WordText({ word, fonts }: { word: CaptionWordDraw; fonts: FontLookup }) {
  const font = fonts(faceKey(word.face), word.fontSize);
  const filling = word.fill > 0 && word.fillColor !== word.color;

  return (
    <Group opacity={word.opacity} transform={[{ scale: word.scale }]} origin={centreOf(word)}>
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

function centreOf(word: CaptionWordDraw) {
  return { x: word.x + word.width / 2, y: word.y + word.height / 2 };
}

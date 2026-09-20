import React from 'react';
import { OffthreadVideo, staticFile } from 'remotion';

import { color } from '../brand';
import { useProject } from './project';

/**
 * A recording of the app, whole, inside a device.
 *
 * This replaced `ScreenCard`, which showed a *band* of the screen at close to
 * native scale — the reasoning being that an advertisement for a typography
 * feature must not shrink the typography. That reasoning was right about type
 * and wrong about tutorials. A viewer who has never seen the app cannot tell a
 * cropped band of it from a full screen, so every cut looked like a different
 * app, and the one thing a tutorial owes its viewer is knowing where they are.
 * A phone with a bezel round it says "this is a screen, and this is all of it"
 * before a word is read.
 *
 * The cost is real and is paid on purpose: the whole 1080 × 2400 at 0.6 puts
 * the app's own type at 60% of the size the app draws it. What buys it back is
 * time — the beats in this video are twice the length the cropped cut used,
 * because a viewer reading a small screen needs longer than one reading a
 * headline.
 *
 * Nothing is cropped and nothing is scaled unevenly: `SCALE` is the only
 * number, the screen is the recording's own 1080 × 2400 times it, and
 * `devicePoint` maps a coordinate measured on the device into the finished
 * frame so a ring drawn round the aeroplane lands on the aeroplane.
 */

/** The recordings' own pixel size. Every emulator shot in this project is this. */
export const DEVICE = { width: 1080, height: 2400 } as const;

/**
 * How much of its real size the phone is drawn at, and where it stands.
 *
 * A 1080 × 2400 screen is 20:9 and the frame is 16:9, so showing all of it is
 * expensive in height before anything else is drawn. 0.6 was the first answer
 * and it was wrong for one reason: the device's foot landed at 1898, and
 * TikTok's own caption and username sit over everything below 1498. The three
 * beats that matter most — the word sheet, the timing sheet, the dictionary —
 * are *sheets*, docked to the bottom of the phone, so at 0.6 the half of each
 * sheet that does the work was behind somebody's post text.
 *
 * At 0.5 the screen is 540 × 1200, the body 568 × 1228, the top is 375 and the
 * foot is 1603. What crosses the safe line is the last 105 px — the phone's
 * bottom bezel and Android's own gesture bar, which are chrome rather than the
 * app. Everything the tutorial is about is above it. The price is a device
 * 53% of the frame wide instead of 60%, and that is the right way round: a
 * viewer who cannot see a sheet at all learns nothing from it being larger.
 */
export const SCALE = 0.5;
export const BEZEL = 14;
/**
 * The hairline round the body, in CSS pixels.
 *
 * It is named because `devicePoint` has to know about it. The body is a
 * content-box with `padding: BEZEL` and this as its border, so the screen's
 * top-left corner is `BORDER + BEZEL` in from where the body is placed — not
 * `BEZEL`. Leaving the border out put every pointer two pixels up and to the
 * left of the glyph it was meant to be round, which is invisible on a ring of
 * seventy and obvious on a ring of thirty-two.
 */
export const BORDER = 2;

export const SCREEN = {
  width: Math.round(DEVICE.width * SCALE),
  height: Math.round(DEVICE.height * SCALE),
};
/**
 * The device's outer size — screen, bezel and hairline.
 *
 * This used to be `SCREEN + BEZEL * 2`, and the body div was then given that as
 * its `width` **on top of** `padding: BEZEL` and a border, with
 * `boxSizing: 'content-box'`. So the bezel was counted twice on the right and
 * bottom and once on the left and top: a 540 px screen sat in a 600 px body with
 * 16 px of bezel on one side and 44 on the other, pushed into the top-left
 * corner with a fat black band down the right. It reads as a screen that has
 * been cropped, because a screen that does not reach its own bezel is the shape
 * of a cropped screen — and it was in every beat and every hook of every cut.
 *
 * Now the div is given the screen's size and the padding and border grow the
 * body around it, so this is the real outer measurement and `PHONE_LEFT`
 * centres the thing that is actually drawn.
 */
export const BODY = {
  width: SCREEN.width + (BEZEL + BORDER) * 2,
  height: SCREEN.height + (BEZEL + BORDER) * 2,
};
/** Where the device body's top-left corner sits in the 1080 × 1920 frame. */
export const PHONE_TOP = 375;
export const PHONE_LEFT = Math.round((1080 - BODY.width) / 2);

/**
 * A point measured on the device, in the finished frame.
 *
 * The aeroplane in the status bar was measured off a capture's own start frame
 * in the recording's 1080 × 2400 space and lives in `config.json`. Mapping it
 * here rather than typing a frame coordinate is what keeps the ring on the
 * glyph when the framing changes — and the framing has now changed twice.
 */
export const devicePoint = (deviceX: number, deviceY: number) => ({
  x: PHONE_LEFT + BORDER + BEZEL + deviceX * SCALE,
  y: PHONE_TOP + BORDER + BEZEL + deviceY * SCALE,
});

export const PhoneFrame: React.FC<{
  /** A file under this video's `public/` directory. */
  file: string;
  startFrom?: number;
  /**
   * How fast the recording plays. 1 is as captured.
   *
   * Used for one thing: a scroll. The style sheet's eighteen presets are
   * revealed by a swipe that takes about a second on the device, which at 1:1
   * is a flick — the tiles are gone before they can be read, and the beat that
   * promises eighteen looks shows about four. Slowing the clip turns the swipe
   * into a reveal. Nothing is lost by it: these recordings carry no audio, the
   * voice is a separate track, and a beat is cut to the voice rather than to
   * the footage.
   */
  rate?: number;
}> = ({ file, startFrom = 0, rate = 1 }) => {
  const { dir } = useProject();

  return (
    <div
      style={{
        position: 'absolute',
        left: PHONE_LEFT,
        top: PHONE_TOP,
        // The SCREEN's size, not the BODY's. `padding` and `border` below add
        // the bezel and the hairline around it, which is what makes the body
        // `BODY` — giving this `BODY.width` as well added the bezel a second
        // time and pushed the screen into the corner.
        width: SCREEN.width,
        height: SCREEN.height,
        borderRadius: 46,
        background: '#000',
        // Two rings rather than one: a dark body, and a hairline of light on
        // top of it. A single flat border reads as a rectangle drawn round a
        // screenshot; the pair reads as an edge catching the light, which is
        // what makes the shape a phone rather than a box.
        border: `${BORDER}px solid ${color.line}`,
        boxShadow:
          '0 40px 120px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.06), inset 0 0 0 1px rgba(255,255,255,0.04)',
        padding: BEZEL,
        boxSizing: 'content-box',
      }}
    >
      <div
        style={{
          width: SCREEN.width,
          height: SCREEN.height,
          borderRadius: 34,
          overflow: 'hidden',
          background: color.ink,
        }}
      >
        <OffthreadVideo
          src={staticFile(`${dir}/${file}`)}
          startFrom={startFrom}
          playbackRate={rate}
          muted
          // Exact size, no `objectFit`. The recording is 1080 × 2400 and the
          // screen is that times `SCALE`, so there is nothing to fit and
          // nothing to crop — which is the whole point of this component.
          style={{ width: SCREEN.width, height: SCREEN.height, display: 'block' }}
        />
      </div>
    </div>
  );
};

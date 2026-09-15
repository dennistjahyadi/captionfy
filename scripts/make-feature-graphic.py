#!/usr/bin/env python3
"""
The Play feature graphic, 1024 x 500, cut from real screenshots.

Not a mockup. The two panels are `store/shots/*.png`, taken off a device with
`adb exec-out screencap`, cropped below the status bar — and, on a debug build,
below the dev-launcher bubble, which must never reach a store listing. Nothing
here redraws the app: a feature graphic that promises a screen the app does not
have is the one thing a screenshot cannot accidentally do.

The type is the app's own. Spectral for the promise, which is the one thing
Welcome is allowed to set in the caption serif, and Be Vietnam Pro for
everything that is chrome. The words are ASO.md's words, so the graphic and the
listing cannot drift apart.

Play wants 1024 x 500, PNG or JPEG, no alpha, under 15 MB. The output is RGB
for that reason. Play also crops and masks this image differently across its
surfaces, so nothing that has to be read sits within 48 px of an edge.

    python3 scripts/make-feature-graphic.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / "assets" / "fonts"
SHOTS = ROOT / "store" / "shots"
OUT = ROOT / "store" / "play-feature-graphic-1024x500.png"

W, H = 1024, 500

# The app's palette, from src/ui/theme.ts. The ground is the warm near-black the
# app is actually built on, not Expo's cooler leftover.
INK = (15, 14, 13)
PAPER = (242, 239, 236)
MUTE = (154, 146, 138)
LINE = (44, 41, 38)
ACCENT = (255, 224, 61)

# Rendered at 3x and downsampled once: rounded corners and hairlines drawn
# straight at final size come out ragged, the same reason make-icons.py does it.
SS = 3


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTS / name), size * SS)


def rounded(card: Image.Image, radius: int) -> Image.Image:
    """A screenshot with the corners a phone actually has, and a hairline edge."""
    mask = Image.new("L", card.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, card.size[0] - 1, card.size[1] - 1],
                                           radius=radius, fill=255)
    out = Image.new("RGBA", card.size, (0, 0, 0, 0))
    out.paste(card, (0, 0), mask)
    ImageDraw.Draw(out).rounded_rectangle([0, 0, card.size[0] - 1, card.size[1] - 1],
                                          radius=radius, outline=LINE + (255,), width=2 * SS)
    return out


def shot(name: str, height: int) -> Image.Image:
    src = Image.open(SHOTS / name).convert("RGB")
    width = round(src.size[0] * height / src.size[1])
    return rounded(src.resize((width, height), Image.LANCZOS), radius=14 * SS)


def tracked(draw: ImageDraw.ImageDraw, xy, text: str, f, fill, tracking: int) -> None:
    """Letter-spaced text. Pillow has no tracking, and a wordmark needs it."""
    x, y = xy
    for char in text:
        draw.text((x, y), char, font=f, fill=fill)
        x += draw.textlength(char, font=f) + tracking


def main() -> None:
    canvas = Image.new("RGB", (W * SS, H * SS), INK)

    # A wash of the caption yellow behind the panels, so the two dark screenshots
    # sit on something rather than dissolving into the ground. Drawn as ellipses
    # and blurred, because Pillow has no radial gradient.
    glow = Image.new("RGB", canvas.size, INK)
    gd = ImageDraw.Draw(glow)
    cx, cy = int(W * 0.74) * SS, int(H * 0.50) * SS
    for step in range(28, 0, -1):
        r = step * 9 * SS
        k = (29 - step) / 29 * 0.10
        gd.ellipse([cx - r, cy - int(r * 0.8), cx + r, cy + int(r * 0.8)],
                   fill=tuple(round(INK[i] + (ACCENT[i] - INK[i]) * k) for i in range(3)))
    canvas = Image.blend(canvas, glow.filter(ImageFilter.GaussianBlur(60 * SS)), 0.9)

    draw = ImageDraw.Draw(canvas)

    # Panels. In front, the video's own rectangle with the caption burned into
    # it — the thing the user gets, at a size that survives Play scaling the
    # graphic down. Behind it, a screen of the app, for what it is that did it.
    app = shot("style.png", 396 * SS)
    burned = shot("burned.png", 442 * SS)
    canvas.paste(app, (528 * SS, 58 * SS), app)
    canvas.paste(burned, (712 * SS, 29 * SS), burned)

    # Type. Left column, clear of the panels and 60 px off the edge.
    x = 60 * SS
    tracked(draw, (x, 150 * SS), "WORDBURN", font("BeVietnamPro-ExtraBold.ttf", 15),
            ACCENT, tracking=4 * SS)

    serif = font("Spectral-ExtraBold.ttf", 44)
    draw.text((x, 192 * SS), "Captions that", font=serif, fill=PAPER)
    draw.text((x, 244 * SS), "look edited.", font=serif, fill=PAPER)

    # The accent rule, clear of the descenders above it rather than reading as an
    # underline of the word it happens to sit beneath.
    draw.rounded_rectangle([x, 312 * SS, (x + 54 * SS), 315 * SS], radius=2 * SS, fill=ACCENT)

    body = font("BeVietnamPro-Medium.ttf", 17)
    draw.text((x, 334 * SS), "Auto captions & subtitles for your video.", font=body, fill=MUTE)
    draw.text((x, 360 * SS), "Offline, on-device, pay once.", font=body, fill=MUTE)

    canvas.resize((W, H), Image.LANCZOS).save(OUT, optimize=True)
    print(f"{OUT.relative_to(ROOT)}  {W} x {H}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
The Play phone screenshots, 1080 x 1920, composed from real device captures.

Play's Store Listing and Promotion policy wants screenshots that show the app,
so nothing here draws a screen: the pixels inside the frame come from
`store/shots/listing/*.png`, taken with `adb exec-out screencap`. This script
only puts a headline above them and a plate behind them, which is the part Play
shows in the carousel and the part people actually read.

The video inside those captures is `test-clips/demo/demo-1080x1920.mp4`, which
this repo generates for itself — see `scripts/make-demo-clip.py` for why no
stock clip can go here.

Two things the captures had to survive, both handled on the device rather than
here: the dev-launcher bubble sits exactly over Export and is turned off in the
dev menu under Tools button, and the status bar is put into SystemUI demo mode
so it reads 9:30 with a full battery instead of a developer's afternoon.

    python3 scripts/make-screenshots.py

Output: store/play-screenshots/NN-name.png
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / "assets" / "fonts"
SHOTS = ROOT / "store" / "shots" / "listing"
OUT = ROOT / "store" / "play-screenshots"

W, H = 1080, 1920

INK = (15, 14, 13)
SURFACE = (26, 24, 23)
PAPER = (242, 239, 236)
LINE = (44, 41, 38)
ACCENT = (255, 224, 61)

# The device captures are 1440 x 3120. The status bar is cropped off, as is the
# gesture pill: both are the phone talking about itself, and the carousel is a
# hundred points wide where they read as dirt on the lens.
CROP_TOP, CROP_BOTTOM = 150, 3060

# The headline is copy, not decoration — it is read far more often than the full
# description. These are STORE-ASSETS.md's, with the style count corrected to
# what `STYLE_PRESETS` actually holds.
SHEET = [
    ("01-editor", "Captions, burned in"),
    ("02-processing", "Transcribed on your phone"),
    ("03-style", "Nine styles, word by word"),
    ("04-word", "Fix a word without moving its timing"),
    ("05-timing", "Drag the timing on the waveform"),
    ("06-dictionary", "Teach it how you spell your name"),
    ("07-export", "Full quality, straight to your gallery"),
    ("08-home", "Pay once. No subscription."),
]

SS = 2  # drawn at 2x and downsampled once, so hairlines do not come out ragged

HEAD_TOP = 96      # where the accent rule sits
HEAD_BASE = 168    # where the first headline line starts
SHOT_TOP = 392     # top of the capture
SHOT_BOTTOM = 1856  # and the floor it may not cross


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTS / name), size * SS)


def wrap(draw: ImageDraw.ImageDraw, text: str, f, limit: int) -> list[str]:
    lines, line = [], ""
    for word in text.split():
        trial = f"{line} {word}".strip()
        if line and draw.textlength(trial, font=f) > limit:
            lines.append(line)
            line = word
        else:
            line = trial
    if line:
        lines.append(line)
    return lines


def plate() -> Image.Image:
    """The backdrop: near-black with one barely-there warm form in the lower half.

    Drawn as a blurred ellipse rather than a gradient, which Pillow has no notion
    of, and kept low enough in contrast that it reads as depth rather than as a
    shape somebody put there.
    """
    canvas = Image.new("RGB", (W * SS, H * SS), INK)
    glow = Image.new("RGB", canvas.size, INK)
    gd = ImageDraw.Draw(glow)
    cx, cy = int(W * 0.5) * SS, int(H * 0.78) * SS
    for step in range(30, 0, -1):
        r = step * 24 * SS
        k = (31 - step) / 31
        gd.ellipse([cx - r, cy - int(r * 0.62), cx + r, cy + int(r * 0.62)],
                   fill=tuple(round(INK[i] + (SURFACE[i] - INK[i]) * k) for i in range(3)))
    return Image.blend(canvas, glow.filter(ImageFilter.GaussianBlur(90 * SS)), 0.9)


def compose(name: str, headline: str) -> Path:
    canvas = plate()
    draw = ImageDraw.Draw(canvas)

    # Headline. Fitted rather than fixed: "Fix a word without moving its timing"
    # is twice the length of "Captions, burned in", and one type size for both
    # either wraps to three lines or wastes the whole band.
    limit = (W - 2 * 72) * SS
    for size in (72, 66, 60, 54, 48):
        f = font("BeVietnamPro-ExtraBold.ttf", size)
        lines = wrap(draw, headline, f, limit)
        if len(lines) <= 2:
            break

    draw.rounded_rectangle([72 * SS, HEAD_TOP * SS, (72 + 52) * SS, (HEAD_TOP + 6) * SS],
                           radius=3 * SS, fill=ACCENT)

    y = HEAD_BASE * SS
    for line in lines:
        draw.text((72 * SS, y), line, font=f, fill=PAPER)
        y += round(size * 1.18) * SS

    # The capture, scaled to the band that is left. Square corners: the app draws
    # video at `radius.video: 0`, and a rounded corner in a screenshot is a
    # promise the exported file does not keep.
    shot = Image.open(SHOTS / f"{name}.png").convert("RGB")
    shot = shot.crop((0, CROP_TOP, shot.width, CROP_BOTTOM))

    band = (SHOT_BOTTOM - SHOT_TOP) * SS
    height = band
    width = round(shot.width * height / shot.height)
    if width > (W - 2 * 64) * SS:
        width = (W - 2 * 64) * SS
        height = round(shot.height * width / shot.width)

    shot = shot.resize((width, height), Image.LANCZOS)
    x = (W * SS - width) // 2
    canvas.paste(shot, (x, SHOT_TOP * SS))
    draw.rectangle([x, SHOT_TOP * SS, x + width - 1, SHOT_TOP * SS + height - 1],
                   outline=LINE, width=2 * SS)

    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"{name}.png"
    canvas.resize((W, H), Image.LANCZOS).save(path, optimize=True)
    return path


def main() -> None:
    for name, headline in SHEET:
        if not (SHOTS / f"{name}.png").exists():
            print(f"  missing {name}.png — skipped")
            continue
        path = compose(name, headline)
        print(f"{path.relative_to(ROOT)}  {W} x {H}  {path.stat().st_size / 1e6:.2f} MB")


if __name__ == "__main__":
    main()

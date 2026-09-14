#!/usr/bin/env python3
"""
The Wordburn mark, and every size cut from it.

Three caption lines, ragged right like text, with the active one highlighted in
the caption yellow. It is the box highlight preset read at a distance: the
highlight is a solid pill, and the word inside it is not drawn at all.

That last part is the whole design. The preset paints dark text on the yellow
box, and a dark word on a near-black ground is not a word — it is a hole, and
the box stops reading as a highlight and starts reading as an empty outline.
Six proportions of the literal version were rendered at 48 px and every one of
them was a yellow rounded rectangle with a slot in it. So the word is implied by
the block being word-shaped, which is what the highlight looks like on screen
anyway, and the yellow stays solid.

The three lines share a left edge. Centred lines of unequal width read as a
symbol; left-aligned ones read as a paragraph, which is what a caption is.

Geometry is fractions of the canvas, so one set of numbers cuts 48 px and
1024 px alike. Shapes are rasterised as masks at 4x and downsampled once with
LANCZOS: drawing straight at 48 px gives ragged corners, and downsampling a
colour image that has transparency in it drags black into the edges.

    python3 scripts/make-icons.py
"""

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
STORE = ROOT / "store"

# src/ui/theme.ts. The ground is the warm near-black the whole app is built on,
# not the cool #0B0B0F that app.json inherited from the Expo template.
GROUND = (0x0F, 0x0E, 0x0D)
ACCENT = (0xFF, 0xE0, 0x3D)
MUTE = (0x9A, 0x92, 0x8A)

# Fractions of the canvas. Every line starts at LEFT; the highlight is the
# widest and the whole mark is centred on the canvas by it.
LEFT = 0.210
LINE_H = 0.062
HIGHLIGHT_H = 0.106
GAP = 0.040

# (width, height) per line, top to bottom. Widths taper so the block reads as
# a sentence and not as a glyph.
LINE_TOP = (0.334, LINE_H)
HIGHLIGHT = (0.580, HIGHLIGHT_H)
LINE_BOT = (0.274, LINE_H)

MARK_W = HIGHLIGHT[0]
MARK_H = LINE_H + GAP + HIGHLIGHT_H + GAP + LINE_H

# Android crops an adaptive icon to the centre 66.7% and masks that to a circle,
# so it is the mark's corners, not its edges, that have to fit. 0.92 leaves a
# little air between the highlight and the mask.
_CORNER = (MARK_W**2 + MARK_H**2) ** 0.5 / 2
ADAPTIVE = round(0.667 / 2 * 0.92 / _CORNER, 3)

SS = 4  # supersample factor


def _shapes():
    """Every pill in the mark, as (centre y, width, height). Radius is height/2."""
    top = 0.5 - MARK_H / 2
    cy_top = top + LINE_H / 2
    cy_hi = cy_top + LINE_H / 2 + GAP + HIGHLIGHT_H / 2
    cy_bot = cy_hi + HIGHLIGHT_H / 2 + GAP + LINE_H / 2
    return {
        "highlight": [(cy_hi, *HIGHLIGHT)],
        "lines": [(cy_top, *LINE_TOP), (cy_bot, *LINE_BOT)],
    }


def masks(size, scale):
    """The highlight and the two lines, as separate antialiased L masks."""
    big = size * SS
    out = {}
    for key, shapes in _shapes().items():
        m = Image.new("L", (big, big), 0)
        d = ImageDraw.Draw(m)
        for cy, w, h in shapes:
            cy = 0.5 + (cy - 0.5) * scale
            x0 = 0.5 + (LEFT - 0.5) * scale
            w, h = w * scale, h * scale
            d.rounded_rectangle(
                [x0 * big, (cy - h / 2) * big, (x0 + w) * big, (cy + h / 2) * big],
                radius=h / 2 * big, fill=255)
        out[key] = m
    return out


def icon(size, scale=1.0, ground=GROUND):
    """The mark in colour. Opaque when given a ground, cut out when not."""
    m = masks(size, scale)
    big = size * SS
    img = Image.new("RGBA", (big, big), (*ground, 255) if ground else (0, 0, 0, 0))
    img.paste(Image.new("RGBA", img.size, (*MUTE, 255)), (0, 0), m["lines"])
    img.paste(Image.new("RGBA", img.size, (*ACCENT, 255)), (0, 0), m["highlight"])
    img = img.resize((size, size), Image.LANCZOS)
    return img.convert("RGB") if ground else img


def monochrome(size, scale):
    """
    One flat white silhouette on transparency, for Android's themed icons.

    The colour is thrown away and the alpha is tinted, so the yellow can do no
    work here. What keeps the hierarchy is the highlight at full opacity and the
    two lines at a little over half — the same value relationship the colour
    version has, said in the only channel that survives.
    """
    m = masks(size, scale)
    alpha = ImageChops.lighter(m["highlight"], m["lines"].point(lambda v: int(v * 0.58)))
    alpha = alpha.resize((size, size), Image.LANCZOS)
    out = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    out.paste((255, 255, 255), (0, 0), alpha)
    out.putalpha(alpha)
    return out


def svg(path, ground=GROUND):
    """The vector master, for the feature graphic and anything print."""
    def hx(c):
        return "#%02X%02X%02X" % c

    def rect(cy, w, h, fill):
        return (f'  <rect x="{LEFT * 1024:.2f}" y="{(cy - h / 2) * 1024:.2f}" '
                f'width="{w * 1024:.2f}" height="{h * 1024:.2f}" '
                f'rx="{h / 2 * 1024:.2f}" fill="{hx(fill)}"/>')

    body = [f'  <rect width="1024" height="1024" fill="{hx(GROUND)}"/>' if ground else ""]
    body += [rect(*s, MUTE) for s in _shapes()["lines"]]
    body += [rect(*s, ACCENT) for s in _shapes()["highlight"]]
    path.write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" '
        'viewBox="0 0 1024 1024">\n'
        + "\n".join(x for x in body if x) + "\n</svg>\n")


def main():
    STORE.mkdir(exist_ok=True)
    written = [
        (ASSETS / "icon.png", icon(1024)),
        (ASSETS / "splash-icon.png", icon(1024, ground=None)),
        (ASSETS / "favicon.png", icon(48)),
        (ASSETS / "android-icon-foreground.png", icon(512, ADAPTIVE, ground=None)),
        (ASSETS / "android-icon-background.png", Image.new("RGB", (512, 512), GROUND)),
        (ASSETS / "android-icon-monochrome.png", monochrome(432, ADAPTIVE)),
        (STORE / "play-icon-512.png", icon(512)),
    ]
    for path, img in written:
        img.save(path, "PNG", optimize=True)

    svg(STORE / "wordburn-mark.svg")
    svg(STORE / "wordburn-mark-bare.svg", ground=None)

    print(f"mark {MARK_W:.3f} x {MARK_H:.3f} of the canvas, adaptive scale {ADAPTIVE}")
    for path, img in written:
        print(f"  {str(path.relative_to(ROOT)):38s} {img.size[0]:>5}  "
              f"{path.stat().st_size / 1024:.0f} KB")
    for name in ("wordburn-mark.svg", "wordburn-mark-bare.svg"):
        print(f"  {'store/' + name:38s}   vec")


if __name__ == "__main__":
    main()

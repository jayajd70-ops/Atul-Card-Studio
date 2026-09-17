#!/usr/bin/env python3
"""Generate luxury monogram icons for Atul Card Studio.

Produces a deep-obsidian background with a radial gold sheen, a thin
gold ring, and a serif "A" monogram rendered in a metallic gradient.
Outputs standard + maskable PWA icon sizes plus a favicon.
"""
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT_DIR = "/home/claude/atul-card-studio/icons"

BG_TOP = (10, 9, 14)
BG_BOTTOM = (22, 18, 14)
GOLD_STOPS = [
    (0.00, (255, 245, 214)),
    (0.22, (247, 214, 140)),
    (0.48, (196, 154, 84)),
    (0.72, (137, 98, 44)),
    (1.00, (222, 186, 120)),
]

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def gold_gradient_color(t):
    t = max(0.0, min(1.0, t))
    for i in range(len(GOLD_STOPS) - 1):
        t0, c0 = GOLD_STOPS[i]
        t1, c1 = GOLD_STOPS[i + 1]
        if t0 <= t <= t1:
            local = 0 if t1 == t0 else (t - t0) / (t1 - t0)
            return lerp(c0, c1, local)
    return GOLD_STOPS[-1][1]

def find_serif_font(size):
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSerifBold.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            continue
    return ImageFont.load_default()

def make_icon(size, maskable=False, path=None):
    scale = 4
    S = size * scale
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))

    # Background: vertical gradient obsidian, rounded square (or full bleed for maskable)
    bg = Image.new("RGBA", (S, S), (0, 0, 0, 255))
    px = bg.load()
    for y in range(S):
        t = y / S
        c = lerp(BG_TOP, BG_BOTTOM, t)
        for x in range(0, S, 1):
            pass
    # faster: draw gradient via rows
    draw_bg = ImageDraw.Draw(bg)
    for y in range(S):
        t = y / S
        c = lerp(BG_TOP, BG_BOTTOM, t)
        draw_bg.line([(0, y), (S, y)], fill=c + (255,))

    radius = int(S * (0.0 if maskable else 0.22))
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=radius, fill=255)
    img.paste(bg, (0, 0), mask)

    # Radial gold sheen behind monogram
    sheen = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    sheen_px = sheen.load()
    cx, cy = S * 0.5, S * 0.42
    max_r = S * 0.55
    for y in range(S):
        for x in range(0, S, 2):
            d = math.hypot(x - cx, y - cy) / max_r
            if d < 1.0:
                a = int(70 * (1 - d) ** 2)
                sheen_px[x, y] = (247, 214, 140, a)
                if x + 1 < S:
                    sheen_px[x + 1, y] = (247, 214, 140, a)
    img.alpha_composite(sheen)

    # Thin gold ring
    ring_pad = S * (0.14 if not maskable else 0.20)
    ring_box = [ring_pad, ring_pad, S - ring_pad, S - ring_pad]
    ring_layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    rd = ImageDraw.Draw(ring_layer)
    ring_w = max(2, int(S * 0.012))
    for i in range(ring_w):
        t = i / max(1, ring_w - 1)
        col = gold_gradient_color(0.15 + 0.5 * t)
        rd.ellipse([ring_box[0] + i, ring_box[1] + i, ring_box[2] - i, ring_box[3] - i],
                    outline=col + (235,), width=1)
    img.alpha_composite(ring_layer)

    # Monogram "A" with metallic vertical gradient + soft bevel
    content_size = S - 2 * ring_pad
    font_size = int(content_size * 0.62)
    font = find_serif_font(font_size)

    glyph_layer = Image.new("L", (S, S), 0)
    gd = ImageDraw.Draw(glyph_layer)
    bbox = gd.textbbox((0, 0), "A", font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    tx = (S - tw) / 2 - bbox[0]
    ty = (S - th) / 2 - bbox[1] - S * 0.015
    gd.text((tx, ty), "A", font=font, fill=255)

    # Drop shadow (depth)
    shadow = glyph_layer.filter(ImageFilter.GaussianBlur(S * 0.012))
    shadow_layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    shadow_layer.paste((0, 0, 0, 160), (0, 0), shadow)
    offset_shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    offset_shadow.paste(shadow_layer, (int(S * 0.004), int(S * 0.006)))
    img.alpha_composite(offset_shadow)

    # Metallic fill gradient (vertical) masked by glyph
    metal = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    md = ImageDraw.Draw(metal)
    gy0, gy1 = ty, ty + th
    for y in range(S):
        if gy1 - gy0 <= 0:
            t = 0
        else:
            t = (y - gy0) / (gy1 - gy0)
        c = gold_gradient_color(t)
        md.line([(0, y), (S, y)], fill=c + (255,))
    metal.putalpha(glyph_layer)
    img.alpha_composite(metal)

    # Soft highlight rim on glyph top edge
    highlight = glyph_layer.filter(ImageFilter.GaussianBlur(S * 0.006))
    hi_layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    hi_layer.paste((255, 250, 230, 90), (0, -int(S * 0.004)), highlight)
    hi_mask = Image.eval(glyph_layer, lambda p: 255 - p)
    img.alpha_composite(Image.composite(hi_layer, Image.new("RGBA", (S, S), (0,0,0,0)), glyph_layer))

    final = img.resize((size, size), Image.LANCZOS)
    if path:
        final.save(path, "PNG")
    return final

def make_favicon():
    im = make_icon(64, maskable=False)
    im.save(f"{OUT_DIR}/favicon.png")
    im32 = im.resize((32, 32), Image.LANCZOS)
    im16 = im.resize((16, 16), Image.LANCZOS)
    im32.save(f"{OUT_DIR}/favicon-32.png")
    im16.save(f"{OUT_DIR}/favicon-16.png")

if __name__ == "__main__":
    import os
    os.makedirs(OUT_DIR, exist_ok=True)
    make_icon(192, maskable=False, path=f"{OUT_DIR}/icon-192.png")
    make_icon(512, maskable=False, path=f"{OUT_DIR}/icon-512.png")
    make_icon(192, maskable=True, path=f"{OUT_DIR}/icon-192-maskable.png")
    make_icon(512, maskable=True, path=f"{OUT_DIR}/icon-512-maskable.png")
    make_icon(180, maskable=False, path=f"{OUT_DIR}/apple-touch-icon.png")
    make_favicon()
    print("Icons generated.")

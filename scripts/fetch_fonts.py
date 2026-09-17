#!/usr/bin/env python3
"""Vendor the studio's Google Fonts locally so the PWA is offline on first load.

Why this exists
---------------
index.html used to pull the whole type library from fonts.googleapis.com. The
service worker runtime-cached those files, which made the app offline-capable
only *after* one successful online visit; a cold first load with no network
fell back to system fonts and the canvas rendered with the wrong metrics.

This script downloads only the woff2 files the renderer actually asks for
(latin + latin-ext subsets, normal style, and just the weights used by
FontPairings / the UI stylesheet), writes them into fonts/, and generates
css/fonts.css with matching @font-face rules.

Run it again only when the font set in FontPairings changes:

    python scripts/fetch_fonts.py

The downloaded files are redistributable open-licensed font binaries (see
fonts/LICENSE.md), not application data.
"""

import hashlib
import os
import re
import sys
import urllib.request

# Weights kept deliberately tight: every entry below is referenced either by a
# FontPairings pairing (recipient/greeting/support/signature) or by the app
# chrome in css/styles.css. No italics — nothing in the project requests one.
FAMILIES = [
    ("Inter", [400, 500, 600]),                 # UI chrome + greeting/support
    ("Cormorant Garamond", [500, 600]),         # classic pairing + dialog headings
    ("Playfair Display", [500, 700]),           # editorial pairing
    ("Montserrat", [500]),                      # editorial support voice
    ("Cinzel", [500, 600]),                     # regal pairing
    ("Source Sans 3", [400, 500]),              # regal support voice
    ("Libre Baskerville", [400, 700]),          # romantic pairing
    ("Manrope", [400, 500]),                    # romantic support voice
    ("DM Serif Display", [400]),                # modern-luxury pairing
    ("Work Sans", [400, 500]),                  # modern-luxury support voice
]

KEEP_SUBSETS = {"latin", "latin-ext"}

# A modern desktop UA is required or the API serves ttf instead of woff2.
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT_DIR = os.path.join(ROOT, "fonts")
CSS_PATH = os.path.join(ROOT, "css", "fonts.css")


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read()


def css_url(family, weights):
    fam = family.replace(" ", "+")
    if len(weights) == 1 and weights[0] == 400:
        spec = fam
    else:
        spec = fam + ":wght@" + ";".join(str(w) for w in weights)
    return "https://fonts.googleapis.com/css2?family=" + spec + "&display=swap"


FACE_RE = re.compile(
    r"/\*\s*(?P<subset>[a-z0-9-]+)\s*\*/\s*@font-face\s*\{(?P<body>[^}]*)\}",
    re.IGNORECASE,
)


def parse_faces(css_text):
    """Yield (subset, family, weight, src_url, unicode_range) per @font-face."""
    for m in FACE_RE.finditer(css_text):
        body = m.group("body")

        def field(name):
            f = re.search(name + r"\s*:\s*([^;]+);", body)
            return f.group(1).strip() if f else None

        src = field("src")
        if not src:
            continue
        u = re.search(r"url\(([^)]+)\)", src)
        if not u:
            continue
        yield {
            "subset": m.group("subset").lower(),
            "family": (field("font-family") or "").strip("'\""),
            "weight": field("font-weight") or "400",
            "style": field("font-style") or "normal",
            "url": u.group(1).strip("'\""),
            "unicode_range": field("unicode-range"),
        }


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def main():
    os.makedirs(FONT_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(CSS_PATH), exist_ok=True)

    blocks = []
    downloaded = []
    skipped = 0
    # Several of these families are variable fonts: the API hands back the
    # same bytes for every weight we ask for. Hash the payload so identical
    # files are stored once and shared by several @font-face rules, which
    # matters because every one of them is precached by the service worker.
    by_hash = {}

    for family, weights in FAMILIES:
        url = css_url(family, weights)
        try:
            css_text = get(url).decode("utf-8")
        except Exception as exc:  # noqa: BLE001 - report and keep going
            print("FAIL  %-22s %s" % (family, exc), file=sys.stderr)
            return 1

        for face in parse_faces(css_text):
            if face["subset"] not in KEEP_SUBSETS or face["style"] != "normal":
                skipped += 1
                continue
            data = get(face["url"])
            digest = hashlib.sha1(data).hexdigest()
            if digest in by_hash:
                filename = by_hash[digest]
            else:
                filename = "%s-%s-%s.woff2" % (slug(face["family"]), face["weight"], face["subset"])
                with open(os.path.join(FONT_DIR, filename), "wb") as fh:
                    fh.write(data)
                by_hash[digest] = filename
                downloaded.append((filename, len(data)))

            blocks.append(
                "@font-face {\n"
                "  font-family: '%s';\n"
                "  font-style: normal;\n"
                "  font-weight: %s;\n"
                "  font-display: swap;\n"
                "  src: url('../fonts/%s') format('woff2');\n"
                "  unicode-range: %s;\n"
                "}\n" % (face["family"], face["weight"], filename, face["unicode_range"])
            )

    header = (
        "/* =========================================================================\n"
        "   Atul Card Studio - self-hosted web fonts\n"
        "   GENERATED by scripts/fetch_fonts.py - do not edit by hand.\n"
        "   Only the latin / latin-ext subsets and the weights the renderer asks\n"
        "   for are vendored, so the whole type library is part of the offline\n"
        "   app shell (see SHELL_ASSETS in sw.js) instead of a network request.\n"
        "   ========================================================================= */\n\n"
    )
    with open(CSS_PATH, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(header + "\n".join(blocks))

    total = sum(size for _, size in downloaded)
    print("wrote %s" % os.path.relpath(CSS_PATH, ROOT))
    print("%d @font-face rules over %d unique files, %.1f KB total "
          "(%d non-latin/italic faces skipped)"
          % (len(blocks), len(downloaded), total / 1024.0, skipped))
    for name, size in sorted(downloaded):
        print("  %-42s %6.1f KB" % (name, size / 1024.0))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

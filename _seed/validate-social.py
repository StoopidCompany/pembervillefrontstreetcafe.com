#!/usr/bin/env python3
"""
Validate the Open Graph and Twitter card tags on every built page.

Checks what actually breaks a link preview in practice: a missing tag, an invented og:type,
an og:url that disagrees with the canonical, a card image that is the wrong shape, missing
from dist/, or described by width and height that do not match the real file.

Usage: python3 -I validate-social.py /path/to/dist

Exits non-zero on any failure, so it can gate a deploy.
"""
import os
import re
import struct
import sys

DIST = sys.argv[1]
SITE = "https://pembervillefrontstreetcafe.com"

CARD_WIDTH, CARD_HEIGHT = 1200, 630
MAX_BYTES = 1_000_000

REQUIRED = [
    "og:type", "og:title", "og:description", "og:url", "og:site_name",
    "og:image", "og:image:width", "og:image:height", "og:image:alt", "og:image:type",
    "twitter:card", "twitter:title", "twitter:image", "twitter:image:alt",
]

# The whole of the Open Graph type vocabulary, from ogp.me. Anything else leaves the page
# effectively untyped, which is how og:type="restaurant" used to behave.
VALID_TYPES = {
    "article", "book", "payment.link", "profile", "website",
    "music.song", "music.album", "music.playlist", "music.radio_station",
    "video.movie", "video.episode", "video.tv_show", "video.other",
}


def jpeg_size(path):
    """Read a JPEG's real dimensions from its SOF marker, without a library."""
    with open(path, "rb") as handle:
        if handle.read(2) != b"\xff\xd8":
            return None
        while True:
            byte = handle.read(1)
            while byte == b"\xff":
                byte = handle.read(1)
            if not byte:
                return None
            marker = byte[0]
            (length,) = struct.unpack(">H", handle.read(2))
            if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
                _, height, width = struct.unpack(">BHH", handle.read(5))
                return width, height
            handle.seek(length - 2, os.SEEK_CUR)
            while True:
                byte = handle.read(1)
                if not byte:
                    return None
                if byte == b"\xff":
                    break
            handle.seek(-1, os.SEEK_CUR)


def tags(html):
    found = {}
    for match in re.finditer(r"<meta\s+[^>]*>", html):
        tag = match.group(0)
        key = re.search(r'(?:property|name)="([^"]+)"', tag)
        value = re.search(r'content="([^"]*)"', tag)
        if key and value:
            found[key.group(1)] = value.group(1)
    return found


pages = []
for root, dirs, files in os.walk(DIST):
    # The Tina admin is a single-page app nobody shares a link to, and it is not ours to
    # add tags to.
    dirs[:] = [d for d in dirs if d != "admin"]
    for name in files:
        if name.endswith(".html"):
            pages.append(os.path.join(root, name))
pages.sort()

failures = []
titles, descriptions = {}, {}


def fail(page, message):
    failures.append(f"{os.path.relpath(page, DIST)}: {message}")


for page in pages:
    html = open(page, encoding="utf-8").read()
    meta = tags(html)

    for key in REQUIRED:
        if not meta.get(key, "").strip():
            fail(page, f"missing or empty {key}")

    kind = meta.get("og:type")
    if kind and kind not in VALID_TYPES:
        fail(page, f'og:type "{kind}" is not an Open Graph type')

    if meta.get("twitter:card") not in (None, "summary_large_image"):
        fail(page, f'twitter:card is "{meta["twitter:card"]}", expected summary_large_image')

    # An empty twitter:site is worse than none — it renders as a broken attribution.
    if "twitter:site" in meta and not meta["twitter:site"].strip():
        fail(page, "twitter:site is present but empty")

    canonical = re.search(r'<link rel="canonical" href="([^"]+)"', html)
    if not canonical:
        fail(page, "no canonical link")
    elif meta.get("og:url") != canonical.group(1):
        fail(page, f"og:url {meta.get('og:url')} != canonical {canonical.group(1)}")

    url = meta.get("og:image", "")
    if meta.get("twitter:image") != url:
        fail(page, "twitter:image does not match og:image")
    if not url.startswith(f"{SITE}/"):
        fail(page, f"og:image is not an absolute {SITE} URL: {url!r}")
    else:
        asset = os.path.join(DIST, url[len(SITE) + 1 :])
        if not os.path.exists(asset):
            fail(page, f"og:image not found in dist: {url}")
        else:
            size = os.path.getsize(asset)
            if size > MAX_BYTES:
                fail(page, f"og:image is {size / 1024:.0f}KB, over the {MAX_BYTES // 1024}KB cap")
            real = jpeg_size(asset)
            if real is None:
                fail(page, f"og:image is not a readable JPEG: {url}")
            elif real != (CARD_WIDTH, CARD_HEIGHT):
                fail(page, f"og:image is {real[0]}x{real[1]}, expected {CARD_WIDTH}x{CARD_HEIGHT}")
            elif (meta.get("og:image:width"), meta.get("og:image:height")) != (
                str(real[0]),
                str(real[1]),
            ):
                fail(
                    page,
                    "og:image:width/height "
                    f"{meta.get('og:image:width')}x{meta.get('og:image:height')} "
                    f"does not match the file's {real[0]}x{real[1]}",
                )

    if meta.get("og:title"):
        titles.setdefault(meta["og:title"], []).append(page)
    if meta.get("og:description"):
        descriptions.setdefault(meta["og:description"], []).append(page)

# Two pages sharing a title or description means one of them is miscredited in a feed.
for label, groups in (("og:title", titles), ("og:description", descriptions)):
    for value, owners in groups.items():
        if len(owners) > 1:
            names = ", ".join(os.path.relpath(p, DIST) for p in owners)
            failures.append(f"duplicate {label} {value!r} on: {names}")

print(f"checked {len(pages)} page(s) in {DIST}")
if failures:
    print(f"\n{len(failures)} problem(s):")
    for line in failures:
        print(f"  - {line}")
    sys.exit(1)
print("all social tags valid")

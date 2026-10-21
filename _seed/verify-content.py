#!/usr/bin/env python3
"""
Independent item-by-item check of content/ against the scraped live menu.

Re-parses _seed/text/menu.txt and compares every name, price and description against
what is actually in content/menu-items/*.md. Reports anything missing, extra, or
different — with the deliberate copy edits listed as expected exceptions.

Usage: python3 -I /tmp/pfsc-tools/verify-content.py /path/to/repo
"""
import os
import re
import sys

REPO = sys.argv[1]

EXPECTED_EDITS = {
    "We have are own Blend sugar cane soda’s": "We have our own blended sugar-cane sodas",
}
NO_PRICE_PLACEHOLDER = "Ask your server"


def read_front_matter(path):
    text = open(path, encoding="utf-8").read()
    m = re.match(r"^---\n(.*?)\n---\n?(.*)$", text, re.S)
    fm, body = {}, ""
    if m:
        body = m.group(2).strip()
        for line in m.group(1).split("\n"):
            if ": " not in line:
                continue
            key, value = line.split(": ", 1)
            value = value.strip()
            if value.startswith('"') and value.endswith('"'):
                value = value[1:-1]
            fm[key.strip()] = value
    return fm, body


# ---- what the live site says -------------------------------------------------------
lines = [l.strip() for l in open(os.path.join(REPO, "_seed/text/menu.txt"), encoding="utf-8")]
start = next(i for i, l in enumerate(lines) if l.startswith("Chef’s Weekly Special"))
end = next(i for i, l in enumerate(lines) if l == "Powered by")

# the bar categories are transcribed into the section body, not as items
bar_start = next(i for i, l in enumerate(lines) if l == "Bar Menu")

live = {}  # name -> list of (price_display, description)
for line in lines[start:bar_start]:
    if not line.startswith("• "):
        continue
    raw = line[2:].strip()
    if raw.startswith("Add-ons:"):
        continue
    fields = [f.strip() for f in raw.split(" — ")]
    name = fields[0]
    price, desc = None, None
    if len(fields) > 1:
        if re.match(r"^(?:[A-Za-z]+\s+)?\$[\d.,]+(?:\s*/\s*(?:[A-Za-z]+\s+)?\$[\d.,]+)?$", fields[1]):
            price = fields[1]
            desc = " — ".join(fields[2:]) or None
        else:
            desc = " — ".join(fields[1:]) or None
    live.setdefault(name, []).append((price, desc))

# ---- what content/ says ------------------------------------------------------------
item_dir = os.path.join(REPO, "content/menu-items")
content = {}
for fname in sorted(os.listdir(item_dir)):
    fm, _ = read_front_matter(os.path.join(item_dir, fname))
    display = fm.get("price", "")
    if fm.get("priceNote"):
        display = f"{fm['priceNote']} {display}"
    if fm.get("altPrice"):
        alt = fm["altPrice"]
        if fm.get("altPriceNote"):
            alt = f"{fm['altPriceNote']} {alt}"
        display = f"{display} / {alt}"
    content.setdefault(fm.get("name", fname), []).append(
        (display, fm.get("description"), fname)
    )

# ---- compare -----------------------------------------------------------------------
PORTION = {"Half": "H", "Full": "F"}


def normalise(display):
    """Content renders 'Half $9 / Full $12.99'; the live site writes 'H $9 / F $12.99'."""
    out = display
    for long, short in PORTION.items():
        out = re.sub(rf"\b{long} ", f"{short} ", out)
    return out


problems = []
for name, entries in live.items():
    if name not in content:
        problems.append(f"MISSING  {name!r} is on the live menu but not in content/")
        continue
    if len(entries) != len(content[name]):
        problems.append(
            f"COUNT    {name!r}: live site has {len(entries)}, content/ has {len(content[name])}"
        )
    for (live_price, live_desc), (got_price, got_desc, fname) in zip(
        sorted(entries, key=lambda e: str(e[0])),
        sorted(content[name], key=lambda e: str(e[0])),
    ):
        want_price = live_price if live_price else NO_PRICE_PLACEHOLDER
        if normalise(got_price) != want_price:
            problems.append(f"PRICE    {name!r} ({fname}): live {want_price!r} != content {got_price!r}")
        want_desc = live_desc
        if want_desc:
            for before, after in EXPECTED_EDITS.items():
                want_desc = want_desc.replace(before, after)
        if (want_desc or None) != (got_desc or None):
            problems.append(f"DESC     {name!r} ({fname}):\n  live    {want_desc!r}\n  content {got_desc!r}")

for name in content:
    if name not in live:
        problems.append(f"EXTRA    {name!r} is in content/ but not on the live menu")

live_rows = sum(len(v) for v in live.values())
content_rows = sum(len(v) for v in content.values())
print(f"live menu items: {live_rows}   content/ items: {content_rows}")
missing_price = [n for n, v in content.items() for p, _, _ in v if p == NO_PRICE_PLACEHOLDER]
if missing_price:
    print(f"no price on the live site (needs Gavin): {missing_price}")

if problems:
    print(f"\n{len(problems)} problem(s):")
    for p in problems:
        print(f"  {p}")
    sys.exit(1)
print("\nOK — every item, price and description matches the live menu.")

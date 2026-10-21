#!/usr/bin/env python3
"""
Transcribe the scraped live menu into content/menu-sections and content/menu-items.

Reads _seed/text/menu.txt (extracted from _seed/raw/menu.html) and writes one markdown
file per section and per item. Parsing rather than retyping, so prices and descriptions
cannot drift from the source. Copy edits are applied explicitly in COPY_EDITS below and
nowhere else.

Usage: python3 -I /tmp/pfsc-tools/build-content.py /path/to/repo
"""
import os
import re
import shutil
import sys

REPO = sys.argv[1]
SRC = os.path.join(REPO, "_seed/text/menu.txt")

# Section heading as it appears on the live site -> (title, slug, order, published)
SECTIONS = [
    ("Chef’s Weekly Special", "Chef’s Weekly Special", "chefs-weekly-special", 5, True),
    ("Breakfast — Chef Features", "Breakfast — Chef Features", "breakfast-chef-features", 10, True),
    ("Breakfast — Lighter Fare", "Breakfast — Lighter Fare", "breakfast-lighter-fare", 20, True),
    # copy edit: "Ala Carte" -> "À la Carte"
    ("Breakfast — Ala Carte", "Breakfast — À la Carte", "breakfast-a-la-carte", 30, True),
    ("From the Garden (Salads)", "From the Garden (Salads)", "from-the-garden", 40, True),
    ("Pastas", "Pastas", "pastas", 50, True),
    ("Chef Plates", "Chef Plates", "chef-plates", 60, True),
    ("From the Farm (Burgers)", "From the Farm (Burgers)", "from-the-farm", 70, True),
    ("Handhelds", "Handhelds", "handhelds", 80, True),
    ("Liquid Gold (Soups)", "Liquid Gold (Soups)", "liquid-gold", 90, True),
    ("Sides", "Sides", "sides", 100, True),
    # Bar: the live site lists categories only — no items, no prices. Transcribed into the
    # section body verbatim and left unpublished until Gavin supplies the real list.
    ("Bar Menu", "Bar Menu", "bar", 110, False),
]

# Lines that are headings/legends inside a section, not items or section descriptions.
DROP_LINES = {
    # Redundant once prices render as "Half $8.99 / Full $11.99".
    "H = Half, F = Full",
}

# Applied to any transcribed string. Keep this list short and mechanical.
COPY_EDITS = [
    ("We have are own Blend sugar cane soda’s", "We have our own blended sugar-cane sodas"),
]

# Items the live site leaves without a price.
NO_PRICE_PLACEHOLDER = "Ask your server"

PORTION_WORDS = {"H": "Half", "F": "Full", "Cup": "Cup", "Bowl": "Bowl",
                 "Single": "Single", "Double": "Double"}


def copy_edit(text):
    for before, after in COPY_EDITS:
        text = text.replace(before, after)
    return text


def slugify(name):
    s = name.lower()
    s = s.replace("&", "and").replace("’", "")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def parse_price(field):
    """'H $8.99 / F $11.99' -> ($8.99, Half, $11.99, Full); '$17' -> ($17, None, None, None)."""
    parts = [p.strip() for p in field.split("/")]
    out = []
    for part in parts:
        m = re.match(r"^(?:([A-Za-z]+)\s+)?(\$[\d.,]+)$", part)
        if not m:
            return None
        label, price = m.groups()
        out.append((price, PORTION_WORDS.get(label, label)))
    if len(out) == 1:
        return out[0][0], out[0][1], None, None
    if len(out) == 2:
        return out[0][0], out[0][1], out[1][0], out[1][1]
    return None


def front_matter(pairs, body=""):
    lines = ["---"]
    for key, value in pairs:
        if value is None:
            continue
        if isinstance(value, bool):
            lines.append(f"{key}: {'true' if value else 'false'}")
        elif isinstance(value, int):
            lines.append(f"{key}: {value}")
        else:
            text = str(value)
            # Quote anything YAML would misread; prices start with $, titles contain colons.
            needs_quotes = text.startswith(("$", "—", "'", '"')) or ": " in text or text.endswith(":")
            lines.append(f'{key}: "{text}"' if needs_quotes else f"{key}: {text}")
    lines.append("---")
    if body:
        lines.append("")
        lines.append(body.rstrip())
    return "\n".join(lines) + "\n"


# ---- read the scrape, slice out the menu -------------------------------------------
lines = [l.strip() for l in open(SRC, encoding="utf-8")]
start = next(i for i, l in enumerate(lines) if l.startswith("Chef’s Weekly Special"))
end = next(i for i, l in enumerate(lines) if l == "Powered by")
body_lines = [l for l in lines[start:end] if l]

heading_to_section = {live: s for live, *s in SECTIONS}
order_of = {live: i for i, (live, *_rest) in enumerate(SECTIONS)}

# group lines under their section heading
groups = {}
current = None
for line in body_lines:
    if line in heading_to_section:
        current = line
        groups[current] = []
    elif current:
        groups[current].append(line)

missing = [live for live, *_ in SECTIONS if live not in groups]
if missing:
    sys.exit(f"section headings not found in scrape: {missing}")

# ---- write ------------------------------------------------------------------------
sec_dir = os.path.join(REPO, "content/menu-sections")
item_dir = os.path.join(REPO, "content/menu-items")
for d in (sec_dir, item_dir):
    shutil.rmtree(d, ignore_errors=True)
    os.makedirs(d)

item_count = 0
report = []

for live_heading, title, slug, order, published in SECTIONS:
    raw = groups[live_heading]
    desc_lines, item_lines, extra_lines = [], [], []
    for line in raw:
        if line in DROP_LINES:
            continue
        if line.startswith("• "):
            item_lines.append(line[2:].strip())
        elif item_lines:
            # a non-bullet line after items started: a sub-heading (bar menu only)
            extra_lines.append(line)
        else:
            desc_lines.append(line)

    body = ""
    if slug == "bar":
        # Verbatim transcription of the bar categories, nothing invented. Sub-headings are
        # listed explicitly; any other non-bullet line is prose, not a heading.
        bar_headings = {"Wine", "Whiskey / Bourbon", "Cocktails", "Mocktails", "Non-Alcoholic"}
        blocks = []
        for line in raw:
            if line.startswith("• "):
                text = line[2:].strip()
                if blocks and blocks[-1].startswith("- "):
                    blocks[-1] += f"\n- {text}"
                else:
                    blocks.append(f"- {text}")
            elif line in bar_headings:
                blocks.append(f"**{line}**")
            else:
                blocks.append(line)
        body = copy_edit("\n\n".join(blocks))
        item_lines = []
    else:
        parts = [copy_edit(l) for l in desc_lines]
        # "Add-ons:" lines are notes about the section, not dishes with their own price.
        parts += [copy_edit(l) for l in item_lines if l.startswith("Add-ons:")]
        item_lines = [l for l in item_lines if not l.startswith("Add-ons:")]
        body = "\n\n".join(parts)

    open(os.path.join(sec_dir, f"{slug}.md"), "w", encoding="utf-8").write(
        front_matter(
            [("title", title), ("slug", slug), ("order", order), ("published", published)],
            body,
        )
    )

    for i, raw_item in enumerate(item_lines, start=1):
        fields = [f.strip() for f in raw_item.split(" — ")]
        name = copy_edit(fields[0])
        price = price_note = alt = alt_note = None
        description = None

        if len(fields) == 1:
            price = NO_PRICE_PLACEHOLDER
        else:
            parsed = parse_price(fields[1])
            if parsed:
                price, price_note, alt, alt_note = parsed
                if len(fields) > 2:
                    description = copy_edit(" — ".join(fields[2:]))
            else:
                # no price on the live site; field 1 is the description
                price = NO_PRICE_PLACEHOLDER
                description = copy_edit(" — ".join(fields[1:]))

        fname = f"{slug}-{slugify(name)}.md"
        open(os.path.join(item_dir, fname), "w", encoding="utf-8").write(
            front_matter([
                ("name", name),
                ("section", f"content/menu-sections/{slug}.md"),
                ("description", description),
                ("price", price),
                ("priceNote", price_note),
                ("altPrice", alt),
                ("altPriceNote", alt_note),
                ("order", i * 10),
                ("available", True),
            ])
        )
        item_count += 1
        report.append((slug, name, price, price_note, alt, alt_note, bool(description)))

print(f"{len(SECTIONS)} sections, {item_count} items")
for slug, name, price, note, alt, alt_note, has_desc in report:
    shown = f"{note + ' ' if note else ''}{price}" + (f" / {alt_note + ' ' if alt_note else ''}{alt}" if alt else "")
    print(f"  {slug:28} {name:30} {shown:28} {'desc' if has_desc else '-'}")

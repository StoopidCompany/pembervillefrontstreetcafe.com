"""Strip a scraped HTML page to readable text. Usage: extract.py IN.html OUT.txt"""
import sys
from html.parser import HTMLParser

BLOCK = {
    "p", "div", "br", "li", "tr", "section", "header", "footer", "article",
    "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "table", "nav", "span",
}
SKIP = {"script", "style", "noscript", "svg", "head"}


class Extract(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out = []
        self.skip_depth = 0

    def handle_starttag(self, tag, attrs):
        if tag in SKIP:
            self.skip_depth += 1
        if tag in BLOCK:
            self.out.append("\n")
        if tag == "img":
            d = dict(attrs)
            src = d.get("src") or d.get("data-src") or ""
            if src:
                self.out.append(f"\n[IMG alt={d.get('alt', '')!r} src={src}]\n")

    def handle_endtag(self, tag):
        if tag in SKIP and self.skip_depth:
            self.skip_depth -= 1
        if tag in BLOCK:
            self.out.append("\n")

    def handle_data(self, data):
        if self.skip_depth:
            return
        text = " ".join(data.split())
        if text:
            self.out.append(text + " ")


src, dest = sys.argv[1], sys.argv[2]
parser = Extract()
parser.feed(open(src, encoding="utf-8", errors="replace").read())
lines = ["".join(parser.out).replace(" ", " ")]
text = lines[0]
clean = []
for line in text.split("\n"):
    line = line.strip()
    if line:
        clean.append(line)
open(dest, "w", encoding="utf-8").write("\n".join(clean) + "\n")
print(f"{dest}: {len(clean)} lines")

#!/usr/bin/env python3
"""
Validate the site's JSON-LD against the real schema.org vocabulary.

For each built page: parse the JSON-LD, then check every property is defined for the
type it is used on (walking up the type hierarchy), and report the fields Google's
Local Business documentation treats as required or recommended.

Usage: python3 -I validate-jsonld.py /path/to/dist /path/to/schemaorg-current-https.jsonld
"""
import json
import os
import re
import sys

DIST, VOCAB = sys.argv[1], sys.argv[2]

GOOGLE_REQUIRED = ["name", "address"]
GOOGLE_RECOMMENDED = [
    "telephone", "openingHoursSpecification", "url", "image", "geo",
    "priceRange", "servesCuisine", "hasMenu", "acceptsReservations",
]

graph = json.load(open(VOCAB, encoding="utf-8"))["@graph"]


def ids(value):
    if value is None:
        return []
    if isinstance(value, dict):
        return [value["@id"]]
    if isinstance(value, list):
        return [v["@id"] for v in value if isinstance(v, dict) and "@id" in v]
    return []


parents, properties = {}, {}
for node in graph:
    node_id = node.get("@id", "")
    types = node.get("@type")
    types = types if isinstance(types, list) else [types]
    if "rdfs:Class" in types:
        parents[node_id] = ids(node.get("rdfs:subClassOf"))
    if "rdf:Property" in types:
        properties[node_id] = ids(node.get("schema:domainIncludes"))


def ancestry(type_name):
    """Every class a type inherits from, including itself."""
    seen, stack = [], [f"schema:{type_name}"]
    while stack:
        current = stack.pop()
        if current in seen:
            continue
        seen.append(current)
        stack.extend(parents.get(current, []))
    return seen


def check(obj, type_name, path, problems):
    allowed = set(ancestry(type_name))
    for key, value in obj.items():
        if key.startswith("@"):
            continue
        prop = f"schema:{key}"
        if prop not in properties:
            problems.append(f"{path}.{key}: not a schema.org property")
            continue
        if not (set(properties[prop]) & allowed):
            problems.append(
                f"{path}.{key}: not valid on {type_name} "
                f"(defined for {', '.join(p.replace('schema:', '') for p in properties[prop][:4])})"
            )
        # recurse into nested typed objects
        for item in value if isinstance(value, list) else [value]:
            if isinstance(item, dict) and "@type" in item:
                check(item, item["@type"], f"{path}.{key}", problems)


pages = []
for root, _dirs, files in os.walk(DIST):
    for name in files:
        if name.endswith(".html"):
            pages.append(os.path.join(root, name))

problems, found = [], 0
first_blob = None
for page in sorted(pages):
    html = open(page, encoding="utf-8").read()
    for match in re.finditer(
        r'<script type="application/ld\+json">(.*?)</script>', html, re.S
    ):
        found += 1
        label = page.replace(DIST, "") or "/"
        try:
            data = json.loads(match.group(1))
        except json.JSONDecodeError as exc:
            problems.append(f"{label}: JSON does not parse — {exc}")
            continue
        if first_blob is None:
            # Google's field expectations are about the business node.
            graph = data.get("@graph", [data])
            first_blob = next((n for n in graph if n.get("@type") == "Restaurant"), data)
        if "@context" not in data:
            problems.append(f"{label}: missing @context")
        # A page may carry one node or a linked @graph of them.
        nodes = data.get("@graph", [data])
        for node in nodes:
            check(node, node.get("@type", "Thing"), f"{label}:{node.get('@type', '?')}", problems)

print(f"{found} JSON-LD block(s) across {len(pages)} built pages")
print(f"business node: {first_blob.get('@type')}   @id: {first_blob.get('@id')}")

missing_required = [f for f in GOOGLE_REQUIRED if f not in first_blob]
missing_recommended = [f for f in GOOGLE_RECOMMENDED if f not in first_blob]
print(f"\nGoogle required fields:    {'all present' if not missing_required else 'MISSING ' + ', '.join(missing_required)}")
print(f"Google recommended fields: {'all present' if not missing_recommended else 'missing ' + ', '.join(missing_recommended)}")

if problems:
    print(f"\n{len(problems)} problem(s):")
    for p in problems:
        print(f"  {p}")
    sys.exit(1)
print("\nOK — every property is valid schema.org for its type.")

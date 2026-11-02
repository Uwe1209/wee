#!/usr/bin/env python3
"""Vendor Google Fonts into site/assets/fonts so the site never calls a font CDN.

    python3 tools/fetch_fonts.py

Downloads the latin subset of each family below as woff2 and writes
site/assets/fonts/fonts.css with matching @font-face rules.
"""
import os
import re
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "site", "assets", "fonts")
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)

FAMILIES = [
    "Archivo:ital,wdth,wght@0,62..125,100..900;1,62..125,100..900",
    "Instrument Serif:ital@0;1",
    "Bricolage Grotesque:opsz,wdth,wght@12..96,75..100,200..800",
    "JetBrains Mono:wght@400;500;700",
    "Inter Tight:ital,wght@0,300..800;1,300..800",
    "Caveat:wght@400..700",
    "Gochi Hand",
]


def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def main():
    os.makedirs(OUT, exist_ok=True)
    query = "&".join("family=" + urllib.parse.quote(f, safe=":;@,.") for f in FAMILIES)
    css = fetch(f"https://fonts.googleapis.com/css2?{query}&display=swap").decode()

    rules = []
    for comment, block in re.findall(r"/\* ([\w-]+) \*/\s*(@font-face \{.*?\})", css, re.S):
        if comment != "latin":
            continue
        family = re.search(r"font-family: '([^']+)'", block).group(1)
        style = re.search(r"font-style: (\w+)", block).group(1)
        url = re.search(r"url\((https://[^)]+\.woff2)\)", block).group(1)
        name = f"{slug(family)}-{style}.woff2"
        path = os.path.join(OUT, name)
        if not os.path.exists(path):
            with open(path, "wb") as handle:
                handle.write(fetch(url))
        rules.append(block.replace(url, name))
        print(f"{name:48s} {os.path.getsize(path) // 1024:5d} KB")

    with open(os.path.join(OUT, "fonts.css"), "w") as handle:
        handle.write("/* Vendored from Google Fonts (SIL Open Font License). */\n")
        handle.write("\n".join(rules) + "\n")


if __name__ == "__main__":
    main()

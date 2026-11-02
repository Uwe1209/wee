#!/usr/bin/env python3
"""Contact sheet: tiles images into one JPEG with a label under each.

    python3 tools/sheet.py out.jpg a.jpg b.jpg c.jpg --cols 3 --width 640
    python3 tools/sheet.py out.jpg a.jpg b.jpg --labels "bar,hello"
"""
import argparse
import os

from PIL import Image, ImageDraw, ImageFont


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("out")
    parser.add_argument("images", nargs="+")
    parser.add_argument("--cols", type=int, default=3)
    parser.add_argument("--width", type=int, default=640)
    parser.add_argument("--labels", default="")
    args = parser.parse_args()

    labels = args.labels.split(",") if args.labels else [os.path.splitext(os.path.basename(p))[0] for p in args.images]
    tiles = []
    for path in args.images:
        image = Image.open(path).convert("RGB")
        height = round(image.height * args.width / image.width)
        tiles.append(image.resize((args.width, height), Image.LANCZOS))
    cell_h = max(t.height for t in tiles) + 26
    cols = min(args.cols, len(tiles))
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (args.width + 8) + 8, rows * (cell_h + 8) + 8), (24, 20, 18))
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("DejaVuSansMono.ttf", 15)
    except OSError:
        font = ImageFont.load_default()
    for index, (tile, label) in enumerate(zip(tiles, labels)):
        x = 8 + (index % cols) * (args.width + 8)
        y = 8 + (index // cols) * (cell_h + 8)
        sheet.paste(tile, (x, y))
        draw.text((x + 2, y + tile.height + 5), label, fill=(240, 228, 210), font=font)
    sheet.save(args.out, quality=86)
    print(args.out, sheet.size)


if __name__ == "__main__":
    main()

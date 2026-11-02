#!/usr/bin/env python3
"""Optical-flow jump scan of a film.

    python3 tools/flow.py workbench/film/fast.mp4

For each frame, dense optical flow (Farneback) against the previous frame gives
a motion magnitude. A frame is flagged when its motion, or the change in motion,
is more than 3x the local median (a 31-frame window), or when its brightness
jumps away from both neighbours (a one-frame blank). Writes <film>.flow.json and
<film>.flags.jpg (each flagged frame between its neighbours) for inspection.
"""
import json
import os
import sys

import cv2
import numpy as np

WINDOW = 31
RATIO = 3.0
FLOOR = 0.15  # px/frame: below this, motion is "still" and ratios are meaningless


def main():
    path = sys.argv[1]
    capture = cv2.VideoCapture(path)
    fps = capture.get(cv2.CAP_PROP_FPS) or 60
    meta_path = path.replace(".mp4", ".json")
    meta = json.load(open(meta_path)) if os.path.exists(meta_path) else {"frames": []}
    scroll = {row["f"]: row for row in meta.get("frames", [])}

    previous = None
    small_frames = []
    magnitude = []
    brightness = []
    while True:
        ok, frame = capture.read()
        if not ok:
            break
        scale = 480 / frame.shape[1]
        small = cv2.resize(frame, (480, int(frame.shape[0] * scale)), interpolation=cv2.INTER_AREA)
        gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
        brightness.append(float(gray.mean()))
        if previous is None:
            magnitude.append(0.0)
        else:
            flow = cv2.calcOpticalFlowFarneback(previous, gray, None, 0.5, 3, 21, 3, 5, 1.1, 0)
            magnitude.append(float(np.linalg.norm(flow, axis=2).mean()))
        previous = gray
        small_frames.append(small)

    m = np.array(magnitude)
    b = np.array(brightness)
    delta = np.abs(np.diff(m, prepend=m[0]))
    half = WINDOW // 2
    flags = []
    for i in range(2, len(m)):
        lo, hi = max(0, i - half), min(len(m), i + half + 1)
        med = max(float(np.median(m[lo:hi])), FLOOR)
        med_delta = max(float(np.median(delta[lo:hi])), FLOOR / 3)
        spike = m[i] / med
        jerk = delta[i] / med_delta
        blank = 0.0
        if 0 < i < len(b) - 1:
            blank = min(abs(b[i] - b[i - 1]), abs(b[i] - b[i + 1])) / max(abs(b[i - 1] - b[i + 1]) + 1.0, 1.0)
        reasons = []
        if m[i] > FLOOR and spike > RATIO:
            reasons.append(f"motion {spike:.1f}x local median")
        if delta[i] > FLOOR and jerk > RATIO:
            reasons.append(f"motion change {jerk:.1f}x local median")
        if blank > 6:
            reasons.append(f"brightness blank {blank:.1f}")
        if reasons:
            row = scroll.get(i, {})
            flags.append({"frame": i, "time": round(i / fps, 3), "v": row.get("v"), "motion": round(float(m[i]), 3), "reasons": reasons})

    report = {
        "film": path,
        "frames": len(m),
        "fps": fps,
        "median_motion": round(float(np.median(m)), 3),
        "max_motion": round(float(m.max()), 3),
        "flags": flags,
        "motion": [round(float(x), 3) for x in m],
    }
    out = path.replace(".mp4", ".flow.json")
    json.dump(report, open(out, "w"))
    print(f"{len(m)} frames, median motion {report['median_motion']} px/frame, {len(flags)} flagged -> {out}")
    for row in flags[:40]:
        print(f"  frame {row['frame']:5d}  t {row['time']:6.2f}s  v {row['v']}  {'; '.join(row['reasons'])}")

    if flags:
        tiles = []
        for row in flags[:24]:
            i = row["frame"]
            strip = np.hstack([small_frames[j] for j in (i - 1, i, min(i + 1, len(small_frames) - 1))])
            cv2.putText(strip, f"f{i} v{row['v']}", (8, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (60, 220, 255), 2)
            tiles.append(strip)
        cv2.imwrite(path.replace(".mp4", ".flags.jpg"), np.vstack(tiles), [cv2.IMWRITE_JPEG_QUALITY, 84])


if __name__ == "__main__":
    main()

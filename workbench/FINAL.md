# Final note

Everything below was measured unless it says "estimate". All rendering here was software WebGL (SwiftShader, no GPU), so none of the timings say anything about real frame rate on a real machine. That was never measured.

## What's here

- **The site:** `python3 tools/serve.py site 8080`, then open http://localhost:8080. Checked by serving `site/` on its own and capturing hello and contact: both rendered, no failed chapters.
- **Art bible:** `workbench/art-bible/` (style frame B mixed with C, golden-hour scrapbook).
- **Workbench:** `workbench/rounds/` has every critic round: frames, compare sheet, verdict. `workbench/index.html` is the progress page.
- **Film:** `workbench/film/full-web.mp4`, 1920x1080, 60 fps, 2073 frames, 34.55 s, 86.7 MB (two-pass, 20 Mbit/s). The crf 13 master (283 MB) was too big for GitHub and isn't committed. `full.json` is the frame log, `full.flow.json` the jump scan.

## Scores

Twelve elements, 67 critic rounds. A critic with fresh context scored each round from a frozen snapshot, 1 to 10 against the art bible, where 8 meets the bar.

| Element | Rounds | Scores | Ended |
|---|---|---|---|
| Captions | 2 | 7, 8 | met the bar |
| Flash | 9 | 6, 6.5, 6.5, 7.5, 7, 7.5, 7, 7.5, 8 | met the bar |
| Contact | 5 | 5.5, 6.5, 7, 7, 8 | met the bar |
| Projects fly-through | 10 | 5.5, 6, 6.5, 7, 7, 7.5, 7, 7.5, 7.5, 8 | met the bar |
| Opening | 3 | 7.5, 7.5, 7.5 | two-rounds rule |
| About | 7 | 5, 6, 6.5, 6.5, 7, 7, 7 | two-rounds rule |
| Scrapbook | 5 | 6, 7, 7, 7, 7 | two-rounds rule, after a fresh builder on a new layout |
| Light leak (wall to room) | 6 | 6.5, 6.5, 7, 7.5, 7.5, 6.5 | two-rounds rule; the over-burn in the last round was retuned in smoothing, not re-scored |
| Colour look | 4 | 6, 7, 7, 7 | two-rounds rule |
| Reduced motion | 3 | 7.5, 7, 7 | two-rounds rule |
| Phone | 9 | 5, 6, 6.5, 7, 7, 7.5, 7, 7.5, 7.5 | stopped on budget (the rule hadn't fired) |
| Typography | 4 | 6.5, 7, 7.5, 7 | stopped on budget; the round-4 fix wasn't re-scored |

Four met the bar. Eight stopped short at 7 to 7.5.

## Motion QA

- **Timings:** a 960x540 film took 21.4 min (619 ms per frame). The final 1920x1080 film took 73.0 min (2113 ms per frame).
- **Scan:** optical flow on every frame, flagging motion above 3x the local median.
- **Fixed:** memories popped into the scrapbook fully opaque in one frame (brightness steps of 1.8 to 2.6 luma). They now fade in over the first 30% of each drop. After the fix, the largest step in that range is 1.07.
- **Intended, left alone:** the flash at v 1.8 (46x, but that's flow noise on a frame going white), the end of the light leak, the cards being filed away between projects, and the contact note landing.
- **Still over 3x:** one room frame, f1406 (v 9.405), at 3.4x: a card swinging out of frame as the camera leaves a dwell. A longer swing made other cards worse, so it was reverted. Fixing it properly means redesigning the dwell or the filing.

## Bugs found and fixed along the way

- **Beige flash on downscale:** when the renderer lowered its resolution mid-session, the canvas cleared and the page flashed beige for a frame. It happened on 3 of 3 downscales, and 0 of about 1,350 frames after the fix.
- **Scroll pulled back:** each quality change also reset a scroll that was still easing, pulling the page back a few pixels. Quality-only resizes now leave layout and scroll alone.
- **Unreachable toolbox:** on short screens (960x540), the last two scrapbook toolbox rows were never on screen. They now fit; the toolbox bottom sits at 454 of 540 px.
- **Orange photos:** the warm sun was turning photos orange (skin #b25e2f). Photo areas now keep their own colour under the light (skin #b47d5a).

## Known leftovers

- At 960x540, "hi:" sits alone on its own line in the contact text, and the about paragraph clears the degree line by only 9 px.
- The projects room's caption pops in near the end of the light leak (6.64 to 6.74).
- The countdown "1" fades to pastel pink early.
- A thin vertical seam in the plaster shows beside the contact heading.
- The phone scrapbook copy card still covers about 70% of the screen, and the riso team print is dark on phones.

## Cut on phones (decisions made in rounds, yours to reverse)

- The phone scrapbook shows two memories (the team riso and the certificate) instead of five.
- The phone about screen drops the Swinburne degree card, the coursework card and the "looking for" note. They repeated the copy and were too small to read.

## What didn't happen

- **References not recorded or measured:** mittalparth.dev and pukha.world stayed blocked by this environment's network policy for the whole session. You OK'd recording them; it just never became possible. Critics judged against the art bible frame instead.
- **Not published or deployed:** nothing beyond the commits on branch `claude/zen-hawking-cdbvc2`. No pull request.
- **No images generated:** $0 image spend. Everything is procedural plus your own photos and project screenshots, so no image credit was used.

## Spend

These are tokens, read from the session and subagent transcripts on disk (2,143 model responses across 57 transcript files). A few early or very short agent runs may be missing from what's on disk, so treat this as a floor.

| | Tokens |
|---|---|
| Output | 1,764,051 |
| Input, uncached | 4,854 |
| Cache writes | 19,882,135 |
| Cache reads | 461,596,142 |
| Total processed | 483,247,182 |

About 53% was subagents (builders, critics, smoothing, motion QA) and 47% this orchestrating session. The session hit the 5-hour usage limit five times and resumed each time. A dollar figure wasn't measured: this ran on a subscription plan, not metered API billing.

## Privacy

The repo is public, and `Liew You Wee_resume.pdf` on `main` shows your phone number and home address. The site itself shows only your email and GitHub.

# Handbook for builders and critics

You are working on You Wee Liew's portfolio: a scroll-driven site in raw three.js,
themed as a golden-hour scrapbook of memories. Read this whole file before you start.

## The bar

- `workbench/art-bible/art-bible-frame.png` and `workbench/art-bible/README.md` are the bar.
  Every element is judged against them and against its own criteria in `workbench/elements.json`.
- The reference sites the owner admires (mittalparth.dev, pukha.world) are blocked by this
  sandbox's network, so they cannot be used. Don't try to fetch them.
- Scores are 1 to 10 against the bar: 8 meets it, 9-10 beats it, 6-7 close with visible flaws,
  4-5 clearly below, 1-3 broken.

## Running things

A static server is already running at http://localhost:8080 serving the repo root.
If it isn't: `python3 tools/serve.py . 8080 &`.

- The site: http://localhost:8080/site/index.html?capture&dpr=1
- Jump to a state in the page: `await window.__app.goto('spex')` or `goto(4.45)` (scroll value in viewport heights)
- Named states: see `STATES` in `site/js/motion/timeline.js`
- Still frames: `node tools/stills.mjs --url "http://localhost:8080/site/index.html?capture&dpr=1" --states hello,taped --out-dir /tmp/x`
- A critic round: `node tools/round.mjs <element>` (snapshot + capture + compare sheet)
- Record a verdict: `node tools/verdict.mjs <element> <round> --score 6.5 --gap "..." --notes "..."`
- Re-bake textures after editing `tools/bake/manifest.js`: `node tools/bake.mjs --only name1,name2`

Rendering is software (SwiftShader, no GPU): loading the site takes about 50 s and each
state about 5-10 s. Be patient; don't kill captures early. Never run more than one capture
at a time yourself.

## Architecture (where things live)

- `site/index.html`: all copy. `site/css/*.css`: one file per chapter, plus base and phone.
- `site/js/motion/timeline.js`: **every scroll-driven number**, in viewport heights. Tune pacing here only.
- `site/js/motion/scroll.js`: native scroll sets a target, a damped value follows.
- `site/js/app.js`: one rAF loop, one clock, one scroll value; picks the chapter(s) for the
  current scroll, renders each into its own half-float MSAA target, blends transitions, presents.
- `site/js/post/pipeline.js`: bloom pyramid, filmic curve, grade, grain, vignette, dither, transitions.
- `site/js/chapters/wall.js` (opening, flash, about, contact), `room.js` (projects), `desk.js` (scrapbook).
- `site/js/engine/`: baked texture streaming (one upload per frame), paper meshes with the
  develop shader, camera rails with a numeric report.
- `tools/bake/manifest.js`: every texture, drawn with `site/js/lib/paper.js` and `prints.js`,
  baked to `site/assets/tex/*.webp`.

## Rules

- three.js only (vendored r170, importmap). No frameworks, no build step, no new libraries, no CDNs.
- One motion clock. No CSS animations or transitions for motion; DOM motion is set from the frame loop.
- Pins ease in and out over at least 0.1 vh (`softPin`). No hard clamps.
- Camera keys far enough apart that acceleration stays gentle. Check with `window.__app.rails()`.
- GLSL: never call smoothstep with edges that can cross; never divide by something that can be zero.
- Don't build heavy things inside a frame. Textures are baked; uploads are queued one per frame.
- Every photo is real (the owner's own photos and project screenshots). Never generate or fake a screenshot.
  No third-party brand logos as decoration.
- Copy must stay true to the facts in `workbench/brief.md`. Don't invent achievements, numbers or quotes.
- Respect `prefers-reduced-motion` (`?reduced`).
- Only edit the files your element owns (`owns` in `workbench/elements.json`). Other agents may be editing other files
  at the same time. If you must touch a shared file (`timeline.js`, `index.html`), re-read it immediately before
  each edit and change only your element's lines.

## If you are the critic

1. Don't read any builder notes or summaries; judge only what is on screen.
2. Run `node tools/round.mjs <element>` once. It freezes a snapshot and captures it.
3. Look at `compare.jpg` (the bar first, then your frames), `strip.jpg` if there is one, and the full-size frames
   for detail. Check `capture.json` for console errors and failed chapters.
4. Score 1-10 against the bar and the element's criteria. Name the **single biggest remaining gap**: one sentence,
   concrete and visual, something a builder can fix (for example: "The flash reads as flat grey: no bloom and the
   frame never reaches white"). Add short notes on secondary issues.
5. Record it: `node tools/verdict.mjs <element> <round> --score N --gap "..." --notes "..."`.
6. Reply with the score, the gap and the notes. Nothing else.

## If you are the builder

1. Read the gap you were given and the element's criteria. Fix **that gap and nothing else**.
2. The previous round's code is already backed up in `workbench/rounds/<element>/r<N>/snapshot/`.
3. Edit only the files your element owns. Keep changes minimal and in the existing style.
4. Verify with your own capture (`tools/stills.mjs` to `/tmp`, not into workbench), and look at the frames.
5. If the fix needs new textures, edit `tools/bake/manifest.js` and re-bake only those names.
6. Reply with what you changed (files, a sentence each) and what you saw in your verification frames.

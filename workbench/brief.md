# Brief

Read this first if you are picking the project up from disk.

## Who and what

- **Site:** portfolio of You Wee Liew (Liew You Wee), final-year Computer Science student at Swinburne University of Technology Sarawak, seeking a full-stack developer role.
- **Story:** "Step into the booth. Each flash develops a memory: who I am, what I've built, who I've led. The last strip prints with how to reach me."
- **Theme:** memories photobooth and photo cards. The user picked all four looks, so each gets a chapter:
  1. Booth (opening): dark booth, name, 3-2-1 countdown keyed to scroll
  2. Flash (signature moment): HDR flash, then a black-and-white four-frame strip prints and develops
  3. Wall (about): colour instant snapshots taped to a wall
  4. Darkroom (projects): photo cards floating in 3D, developing as the camera flies past
  5. Scrapbook (leadership and skills): tape, stickers, riso print
  6. Last strip (contact): email, GitHub, CV
- **Motion:** cinematic.
- **References to beat:** mittalparth.dev and pukha.world. The user OK'd recording them, but the environment's network policy still blocks both (checked 2026-11-02). Until they are reachable, critics judge against the chosen style frame.
- **Images:** $0. No Replicate; the user doesn't need it. Everything procedural, plus the user's real photo and real project images from their repos.
- **Contact shown publicly:** email and GitHub. No phone number, no home address.

## Projects (all of them, user's choice)

| Card | Source | Notes |
|---|---|---|
| SPEX | Uwe1209/spex002, Uwe1209/SPEX_Disease | FYP, led a team of five. 38 animal diseases, 245 countries, calibrated 12-month risk. FastAPI on Railway, frontend on Vercel, Supabase Postgres, weekly refresh. Stack also includes React, TypeScript, three.js (scroll story) and LightGBM models (spex002 package.json and README). Live: spex-disease.vercel.app |
| BuildUp | resume | URIIS Student Biz Innov Challenge 2026, Top 5. National AI talent platform concept: skills matching, AI career coach on the Anthropic API, Skills Passport, workforce dashboards |
| kacha | Uwe1209/kacha | Photobooth web app: choose strip, camera, filters editor, album/memories. React 19, Vite, Supabase, Express. Live: kacha-smoky.vercel.app |
| HaoJia HR | Uwe1209/HaoJiaHRSystem | HR system for a multi-outlet F&B operator: org + worker directory, work-pass expiry. In progress: code is React, TypeScript, Vite, Supabase client, React Hook Form, Zod; Tailwind and RLS policies are in the design spec but not in the repo yet, so don't claim them as built. (fnb-hr-portal repo is empty, folded in here) |
| PetAid | Uwe1209/pet-aids | Pet first-aid web app with owner, vet and admin roles. React, Vite, Express |
| Herbarium / Plant Biodiversity | Uwe1209/PlantBiodiversityProject | COS30020. PHP site for participants to upload plant photos and data for researchers |
| Bar | Uwe1209/Bar | COS30043 IDD. Online drinks shop with cart and accounts. Product shots show real beer brands: keep logos off the card |
| AWS architecture | Uwe1209/CloudComputingArchitectureProject | COS20019. Architecture diagrams and design rationale |
| Little Lemon | Uwe1209/Little-Lemon-project | Meta Front-End course, HTML and CSS restaurant site |
| Dodgeball club | resume | Programme Coordinator, Swinburne Sarawak Dodgeball Club ECA at Borneo International School |

## Memories (user's photos, 2026-11-02)

Stored in `site/assets/img/memories/`, resized, metadata stripped. The two school-hall photos are cropped to You Wee so the school students behind him stay off the public site.

| File | What it shows (only what the photo itself establishes) |
|---|---|
| `spex-poster.jpg` | You Wee beside the SPEX poster: "AI-Driven Global Wildlife Zoonotic Disease Risk Prediction and Visualization System", Swinburne Sarawak, team of five plus supervisor |
| `certificate.jpg` | You Wee with a Certificate of Appreciation: facilitator, SSDC Dodgeball Outreach Programme, 11 April 2026, Tunku Putra-HELP School |
| `coaching.jpg` | You Wee leading a warm-up at an outreach session |
| `uriis-stage.jpg` | URIIS 2026 (University Research & Innovation Investment Summit, World Trade Centre Kuala Lumpur, 21-23 Sep 2026), Student Biz Innov Challenge, consolation prize line-up |
| `uriis-pitch.jpg` | A pitch at URIIS 2026. Don't caption who is speaking; the user hasn't said |
| `gators.jpg` | Gators DC dodgeball team photo |
| `game.jpg` | Gators DC match, mid-dive |
| `outreach-team.jpg` | Outreach dodgeball facilitators team photo |

## Process (from the user's brief)

Raw three.js, vendored, importmap, no build. One smooth scroll value drives DOM and WebGL. Chapters render to their own HDR targets; one composite pass. Builder and critic are separate agents; the critic captures from a frozen snapshot and names the single biggest gap. Progress lives in `workbench/`.

## Status

- [x] Interview
- [x] Tooling: `tools/serve.py` (threaded, byte ranges), `tools/stills.mjs`, `tools/fetch_fonts.py`
- [x] Three style frames: `workbench/style-frames/frame-{a,b,c}.png`
- [ ] User picks a style frame (becomes the art bible)
- [ ] Build, element by element
- [ ] Motion QA and film

## Smoothing-pass notes (seams between elements)

- The light leak (6.15-6.75) burns the 3D scene to white, but the about copy is page text and stays crisp over the burn. Drive the flash's page veil from the leak's glare too (lower peak), so page text washes with the scene.
- Phone, scrapbook: phone text boxes cover most of the screen so memories sit behind them; the paper stops short of top and bottom, leaving dark bands (for the phone element).
- Develop shader: undeveloped prints in the scrapbook drops are flat grey-beige boxes. paper3d.js now has `material.userData.tone = { latent: 1 }` (flash r8); turn it on for the desk prints.
- Scrapbook: heavy vertical window-bar shadow cuts the riso print and "outreach crew"; at 11.79 the ticket overlaps a still-grey photo.
- Flash tape: at 3.0 the tape comes in steeply across the heart sticker before it flattens (reads as a collision); bring it in from straight above the strip's top edge. Countdown "1" fades to pastel pink too early.
- About: CGPA shows three times (degree line, index card, badge) — cut to one or two in the type pass. "Looking for" note overlaps the coursework card corner. At 6.25 a warm patch blows out behind the copy (leak glare; see the page-veil note above).
- Hello to about: at 3.75-3.9 the hello chips cross the top of the SPEX polaroid while the wall glides (hello copy timing).
- Phone contact (14.4): the wall's top and bottom edges show as beige bands against the dark background (phone element). "Say hi" note on phone falls in dusk shade.
- Contact: "next memory." italic is flat pink, no riso-blue offset like "Liew" (type pass). Thin vertical wall seam runs through the headline/links column (also seen in about at x≈1090; check the wall texture tiling). Strip drop shadow offset far right at dusk, strip looks floating. Star sticker muddy in shade.
- Contact strip: at 14.0 the strip's bottom frame is blank then pops in; strip shadow detaches as a grey slab offset right. Desk-to-wall wipe (13.0-13.5) shows a hard horizontal seam across the wall partway. Right ~40% of the final frame is bare wall.
- Type: riso-blue offset only on "Liew"; "You Wee.", "mostly.", "next memory." are flat pink. Kicker height/colour inconsistent across chapters. Scrapbook Facilitator meta orphans "SCHOOL"; pink toolbox labels low-contrast and above baseline. Hello chrome ("SCRAPBOOK N°", "KUCHING, SARAWAK") nearly unreadable in shadow.
- Flight: kacha card's photo area reads as washed-out beige with only a logo (check the kacha bake: crop a real screen from the repo). HaoJia and PetAid cards are type only. Caption still dim at 8.58 while the card is centred.
- Contact at 1440x900: "say hi!" note's bottom edge touches the footer line. At 1280x720 the footer orphans "LIEW".
- Type: display headlines use straight apostrophes ("Hi, I'm", "Let's"); use curly ones. Big gap in about between intro paragraph and degree meta.
- Phone spex: the SPEX project card overlaps the polaroid caption "SPEX: catch it…" (phone element).
- Projects copy: SPEX title and body look grey/low-contrast against the dark room (type/look).
- To-room burn (priority): r5 over-burns the peak (6.314) into a flat orange-white gradient. Tune `sink` to ~0.7 and the room `shine` key to ~(0.6, 0.85) so wall shapes or the room window read at 30-40% contrast; keep no double exposure. Ghost ring sits alone in the lower right; put it on the flare line. Room text block pops in at 6.64-6.74.
- Scrapbook toolbox: the pink swipe under the labels reads like a link underline; make it a highlighter block (full-height, offset, slightly rotated) or a label-maker chip instead. Facilitator meta line ends with a dangling "·".
- Look: shadow colour inconsistent across chapters (hello/taped #43322a darker than the bible's #6b4a3a; contact violet #483a47). Kacha room floor sun patches very saturated orange (#df8a51); glow bleeds off the kacha polaroid's right edge.
- Flight: beam haze and card gloss wash out the lower-left of the herbarium and lemon screenshots. Far cards read as a pale clump with no light falloff.
- Look: scrapbook hazy/low-contrast, grey-brown shadow band; contact shadows lean too violet; room dust motes a bit large and bright.
- Look: milky halation over the right third of the kacha card near the window (halation spreading onto mid-tones).
- Room window (priority): panes are dull cream-grey (~196,181,162), never clip or bloom, while the near card photo is the brightest thing and looks milky. Raise window emissive/exposure so it clips into bloom; keep PHOTO_NEUTRAL photo gain from making the card brighter than the window.
- Flight: SPEX card swings past near-whip at 6.995 (foreshortened, cut at top); empty frame between captions 8.6-9.0 while the next card is small; card borders flat with no curl shading vs the bar.
- Phone r1 (5/10): hello/taped SPEX polaroid cut at the left edge; ADMIT ONE ticket cut and tagline runs into it; photos ~200px (small). About/scrapbook/contact: solid text cards cover the photos (portrait half hidden, dodgeball photos behind the toolbox card, strip under the contact card); cards look like flat UI panels, not paper.
- Desktop wall coverage: at 1920x1080, v≈4.9, the view's bottom edge reaches 0.06 units below the plaster plane; check for a background sliver and, if present, use the taller plane on desktop too.
- Phone r2: hello SPEX polaroid cut at left, URIIS at right; taped ticket cut and runs into tagline; empty corner brackets mid-hello look like debris; spex polaroid caption runs under the card label; about 3.49 sticker and star cut at right; contact bottom shadow heavy.
- Reduced: flash state looks identical to hello (the strip moment is missing); a static pink "1" sits over the strip at 1.45; next chapter's copy fades in over the old scene during crossfades (SPEX over the about wall at 6.2, Lemon over the desk at 11.2); hard cuts inside chapters (taped→about at 3.4-4.3); no about copy at 4.3; "SCROLL TO TAKE A PHOTO" promises a photo reduced mode never takes.
- Reduced r2: hello copy sits over the about cluster 3.3-3.6; no copy at 4.2, 6.1, 13.1-13.6 (dead scroll); SPEX copy appears over the wall at 6.25 before the room; countdown "2" never visible; hello still shows the taped strip while the cue says "scroll to take a photo".
- Phone r4: hello/taped are flat beige with no window light (the big pane removed the gobo); heavy edge darkening hides "MEMORIES 2024-2026"; ~100px dead space between photos and note; empty "photo lands here" marks take the middle of hello. About coursework handwriting ~7px. Scrapbook text card ~70% of the screen.
- Phone r5: top vignette hides "MEMORIES · 2024 — 2026" and the top-right label; about has an empty shadowed strip above the cards and the portrait/notes sit in window shadow; contact has a hard dark band over the top 40%.
- Phone r6: hello photos small (~110pt wide); scrapbook riso group photo too contrasty on phone (faces hard to read).

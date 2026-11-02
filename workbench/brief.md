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
| SPEX | Uwe1209/spex002, Uwe1209/SPEX_Disease | FYP, led a team of five. 38 animal diseases, 245 countries, calibrated 12-month risk. FastAPI on Railway, frontend on Vercel, Supabase Postgres, weekly refresh. Live: spex-disease.vercel.app |
| BuildUp | resume | URIIS Student Biz Innov Challenge 2026, Top 5. National AI talent platform concept: skills matching, AI career coach on the Anthropic API, Skills Passport, workforce dashboards |
| kacha | Uwe1209/kacha | Photobooth web app: choose strip, camera, filters editor, album/memories. React 19, Vite, Supabase, Express. Live: kacha-smoky.vercel.app |
| HaoJia HR | Uwe1209/HaoJiaHRSystem | HR system for a multi-outlet F&B operator: org + worker directory, RLS roles, work-pass expiry. React, TS, Supabase. (fnb-hr-portal repo is empty, folded in here) |
| PetAid | Uwe1209/pet-aids | Pet first-aid web app with owner, vet and admin roles. React, Vite, Express |
| Herbarium / Plant Biodiversity | Uwe1209/PlantBiodiversityProject | COS30020. PHP site for participants to upload plant photos and data for researchers |
| Bar | Uwe1209/Bar | COS30043 IDD. Online drinks shop with cart and accounts. Product shots show real beer brands: keep logos off the card |
| AWS architecture | Uwe1209/CloudComputingArchitectureProject | COS20019. Architecture diagrams and design rationale |
| Little Lemon | Uwe1209/Little-Lemon-project | Meta Front-End course, HTML and CSS restaurant site |
| Dodgeball club | resume | Programme Coordinator, Swinburne Sarawak Dodgeball Club ECA at Borneo International School |

## Process (from the user's brief)

Raw three.js, vendored, importmap, no build. One smooth scroll value drives DOM and WebGL. Chapters render to their own HDR targets; one composite pass. Builder and critic are separate agents; the critic captures from a frozen snapshot and names the single biggest gap. Progress lives in `workbench/`.

## Status

- [x] Interview
- [x] Tooling: `tools/serve.py` (threaded, byte ranges), `tools/stills.mjs`, `tools/fetch_fonts.py`
- [x] Three style frames: `workbench/style-frames/frame-{a,b,c}.png`
- [ ] User picks a style frame (becomes the art bible)
- [ ] Build, element by element
- [ ] Motion QA and film

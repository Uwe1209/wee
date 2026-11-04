# Project Portfolio: You Wee Liew

Final-year Bachelor of Computer Science student, Swinburne University of Technology Sarawak (CGPA 3.49). Looking for a full-stack developer role.

- Email: liewyouwee123@gmail.com
- GitHub: https://github.com/Uwe1209

---

## 1. SPEX: Animal Disease Forecasting
**Final year project · 2026**

- **Live site:** https://spex002-production.up.railway.app
- **Code:** https://github.com/Uwe1209/spex002
- **Role:** Team lead (team of 5) and main developer
- **What I did:**
  - Led the five-person team and wrote most of the code (1,061 of the repository's 1,075 commits)
  - Built the data pipeline that loads outbreak records from WOAH WAHIS, FAO EMPRES-i and WHO, plus climate, land, livestock, population and trade data, into Supabase Postgres
  - Trained a LightGBM model per disease that gives each country a calibrated chance of having the disease, 12 months ahead and month by month, plus province-level models; every model is tested on years it never saw (2023 and 2024 to 2025)
  - Built the Express API, a Python FastAPI service that runs an outbreak spread simulation (SEIR model), and the React app: an interactive globe, a nine-layer map, disease and country pages, and a three.js scroll story
  - Added an AI helper on the Anthropic API that explains, from SPEX's own data, why a place's risk is high
  - Deployed two services on Railway with Docker; set up a weekly job that refreshes the data, rescores every model and emails watch alerts, and GitHub Actions CI that runs about 1,600 automated tests
- **Key technologies:** React 19, TypeScript, Vite, Tailwind CSS, three.js, Leaflet, Node.js, Express, Python, FastAPI, LightGBM, scikit-learn, pandas, Supabase (PostgreSQL), Anthropic API, Docker, Railway, GitHub Actions
- **Description:** Forecasts where 38 animal diseases are likely to appear over the next 12 months across 245 countries, and for 29 of them by province, so outbreaks can be caught in herds and flocks before they reach people. 24 of the 38 diseases can pass to humans.

## 2. BuildUp: National AI Talent Platform
**URIIS Student Business Innovation Challenge 2026 · Top 5, consolation prize**

- **Showcase site:** https://buildup-showcase.vercel.app
- **Role:** Team lead
- **What I did:**
  - Led the team through the competition to a Top 5 finish and a consolation prize
  - Built the prototype: web and mobile apps with skills-based job matching, an AI career coach on the Anthropic API, a digital Skills Passport and workforce planning dashboards
- **Key technologies:** Anthropic API (Claude), web and mobile prototypes *[add the framework you built them with]*
- **Description:** A platform concept tackling Malaysia's graduate skills mismatch, with skills-based job matching, an AI career coach, a digital Skills Passport and workforce planning dashboards.

## 3. kacha: Browser Photobooth
**Personal project · 2026**

- **Live site:** https://kacha-smoky.vercel.app
- **Code:** https://github.com/Uwe1209/kacha
- **Role:** Solo developer (design, frontend, backend, deployment)
- **What I did:** Built the camera capture, photo strip layouts, filter editor and the album; added sign-in with Supabase Auth and an Express backend; deployed on Vercel
- **Key technologies:** React 19, Vite, Supabase Auth, Express, Vercel
- **Description:** A photobooth that runs in the browser. Pick a strip, take your shots, edit them with filters, and keep every strip in an album of memories.

## 4. HaoJia HR System
**Full-stack · 2026 · in progress**

- **Code:** https://github.com/Uwe1209/HaoJiaHRSystem
- **Role:** Full-stack developer *[confirm: solo, or for a real client?]*
- **What I did:** Designed the database and role-based access; built the team, outlet and worker profile modules with validated forms and work-pass expiry warnings
- **Key technologies:** React, TypeScript, Vite, Supabase (PostgreSQL), React Hook Form, Zod
- **Description:** An HR system for a food and beverage group with several outlets, replacing the staff spreadsheet with one source of truth.

## 5. PetAid: Pet First-Aid Platform
**Full-stack · 2026**

- **Code:** https://github.com/Uwe1209/pet-aids
- **Role:** Full-stack developer *[confirm: solo or team]*
- **What I did:** Built the owner, vet and admin roles, the guide, video and quiz pages, and the review workflow where vets approve, reject or send back guidance before it is published
- **Key technologies:** React, Vite, Express (Node.js)
- **Description:** First-aid help for pet emergencies, with guides, vet-approved videos and quizzes for dogs, cats, rabbits and more.

## 6. Herbarium for Plant Biodiversity
**COS30020 Web Application Development · 2025**

- **Code:** https://github.com/Uwe1209/PlantBiodiversityProject
- **Role:** Developer *[confirm: individual or group assignment]*
- **What I did:** Built user accounts, plant photo and record uploads, identification and classification pages, and PDF downloads
- **Key technologies:** PHP, MySQL, HTML, CSS
- **Description:** A website where participants upload plant photos and records for researchers to use.

## 7. Cloud Architecture on AWS
**COS20019 Cloud Computing Architecture · 2025**

- **Report:** https://github.com/Uwe1209/CloudComputingArchitectureProject
- **Role:** Architect and report author *[confirm: individual or group]*
- **What I did:** Designed the architecture, drew the AWS service diagrams, mapped the workflow for each key process and wrote the reasoning for every design decision
- **Key technologies:** AWS, cloud architecture design
- **Description:** An architecture report for a cloud-hosted system, covering the services used, how key processes flow through them, and why.

## 8. Bar: Online Drinks Shop
**COS30043 Interface Design and Development · 2025**

- **Code:** https://github.com/Uwe1209/Bar
- **Role:** Frontend developer *[confirm: individual or group]*
- **What I did:** Built the product pages, shopping cart, purchase history and account pages
- **Key technologies:** Vue 3, Bootstrap, JavaScript
- **Description:** An online drinks shop with product pages, a cart, purchase history and user accounts.

## 9. Little Lemon: Restaurant Website
**Meta Front-End Developer course · 2024**

- **Code:** https://github.com/Uwe1209/Little-Lemon-project
- **Role:** Solo developer
- **What I did:** Designed and built the full site layout and pages
- **Key technologies:** HTML, CSS
- **Description:** A restaurant website built with only HTML and CSS, one of my first projects.

## 10. wee: Interactive Portfolio Site
**Personal project · 2026**

- **Code:** https://github.com/Uwe1209/wee *[not hosted yet; deploy to Vercel or GitHub Pages and add the live link]*
- **Role:** Solo developer
- **What I did:** Built a scroll-driven 3D photobooth in raw three.js with custom post-processing (bloom, film grain, transitions), procedurally generated textures, a reduced-motion mode and a phone layout
- **Key technologies:** JavaScript, three.js, WebGL, HTML, CSS, Node.js (build and screenshot tools)
- **Description:** My personal portfolio as an interactive photobooth: you step in, a flash prints a strip, and my story, projects and contact details develop on the wall as you scroll.

---

## Skills summary

| Area | Tools |
|---|---|
| Frontend | React, TypeScript, JavaScript, Vue 3, HTML, CSS, Tailwind CSS, three.js, Leaflet |
| Backend | Node.js, Express, Python, FastAPI, PHP, REST APIs, Anthropic API |
| Data and ML | PostgreSQL, Supabase, MySQL, SQL, Firebase, LightGBM, scikit-learn, pandas |
| Cloud and shipping | AWS, Vercel, Railway, Docker, Git, GitHub, GitHub Actions |
| Design | Figma, Photoshop |
| Also | Java, C, C++, C# |

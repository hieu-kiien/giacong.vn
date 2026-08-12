# Task Checklist

## Section 1: Project Initialization and Setup
- [x] Initialize Node.js project (`package.json`)
- [x] Install dependencies (`express`, `ejs`, `body-parser`, `dotenv`) and devDependencies (`nodemon`)
- [x] Create `task.md` to track progress
- [x] Initialize Laravel project in `backend/` folder using Composer
- [x] Configure SQLite database, run migrations and seeders
- [x] Install API routes and configure CORS for Next.js
- [x] Implement ContactController and SearchController APIs

## Section 2: Server Construction
- [x] Configure Express server in `src/server.js`
- [x] Set up view engine to EJS pointing to `views/` directory
- [x] Serve static files from `assets/`
- [x] Integrate `body-parser` (JSON & URL-encoded)

## Section 3: EJS Views Creation
- [x] Create `views/pages/` directory
- [x] Convert and copy HTML files from `html/` to `views/pages/` as `.ejs` files
- [x] Setup base layout or partials if necessary (or keep them intact with dynamic variables)

## Section 4: Routing and Custom Endpoints
- [x] Load and parse `metadata.json` for page list
- [x] Set up dynamic GET routes mapping slugs to `views/pages/` with metadata context
- [x] Implement GET `/search` or GET `/?s=query` matching products and services
- [x] Implement POST endpoints to handle form submissions (writing to `data/submissions.json`)

## Section 5: Verification & Run
- [x] Validate server startup on port 3000
- [x] Test search functionality with sample queries
- [x] Test form submission functionality

## Section 6: Next.js Frontend Development
- [x] Initialize Next.js TypeScript project in `frontend/`
- [x] Configure RootLayout with global stylesheets, custom fonts and core scripts

## Section 7: Frontend Asset & EJS Integration
- [x] Copy workspace assets to `frontend/public/assets/`
- [x] Copy converted EJS files to `frontend/src/data/pages/`
- [x] Create page parser utility for EJS body extraction & link cleaning
- [x] Create dynamic catch-all slug route `frontend/src/app/[...slug]/page.tsx` and HomePage route
- [x] Create custom Header and Footer components using EJS partials

## Section 8: Laravel API Integration
- [x] Create search page `frontend/src/app/search/page.tsx` integrating with Laravel API and local fallback
- [x] Implement contact form submission interception posting to `http://localhost:8000/api/contact`


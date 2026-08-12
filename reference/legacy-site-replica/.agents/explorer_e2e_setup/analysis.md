# E2E Test Setup Investigation Report

## 1. Project Structure
The Giacong Replica project is divided into three main components: a legacy Express server (root), a modern Next.js frontend, and a Laravel backend.

### A. Root Express Server (Legacy / Replica Prototype)
- **Directory**: Project Root (`c:\Users\hieuk\Desktop\Tham khảo giacong.vn`)
- **Key Files**:
  - `src/server.js`: Express server script implementing EJS rendering and basic in-memory data structures.
  - `views/pages/` & `views/partials/`: EJS templates converted from scraped HTML files.
  - `data/`: JSON files containing product data (`products.json`), service data (`services.json`), and stored submissions (`submissions.json`).
  - `.env`: Port definition (`PORT=3001`).

### B. Frontend Next.js Application
- **Directory**: `frontend/`
- **Architecture**: Next.js App Router (React + TypeScript).
- **Key Components**:
  - `src/app/page.tsx`: Homepage routing that fetches data from backend or local fallback files.
  - `src/app/[...slug]/page.tsx`: Catch-all routing for dynamic subpages.
  - `src/app/search/page.tsx`: Search results layout.
  - `src/components/Header.tsx` & `src/components/Footer.tsx`: Converted layout components (previously reading EJS, in transition to native React components).
  - `src/components/ClientPage.tsx`: Handles DOM hydration, script re-execution, mega menu behaviors, and intercepting form submissions.
  - `src/utils/pageParser.ts`: Parses dynamic page structures and rewrites absolute WordPress/giacong.vn links to relative paths.
  - `src/data/`: local JSON fallbacks and cached page templates.
- **Environment**: `.env.local` pointing to the Laravel API URL.

### C. Backend Laravel Application
- **Directory**: `backend/`
- **Architecture**: Laravel Framework (PHP) with SQLite database storage.
- **Key Components**:
  - `routes/api.php`: Declares REST API routes (`/api/contact`, `/api/search`, `/api/pages/{slug}`, `/api/posts`, `/api/configurations`).
  - `app/Http/Controllers/`: Controllers handling API business logic (e.g. `ContactController`, `SearchController`, `PageController`, `PostController`).
  - `app/Models/`: Eloquent ORM models (`Page`, `Post`, `Product`, `Service`, `Submission`, `User`, `Configuration`).
  - `database/database.sqlite`: SQLite database file storing persistent configurations and records.
  - `tests/`: Automated backend tests (Feature and Unit) covering APIs, rate limiting, and database indexing.

---

## 2. Existing Dependencies for E2E Testing
Testing configurations vary across workspace boundaries:

- **Root Workspace (`package.json`)**:
  - Contains `@playwright/test` (`^1.61.1`) inside `devDependencies`.
  - Nodemon is available for file changes monitoring.
  - Playwright test runner packages are installed but lack a central E2E testing layout and execution configuration.
- **Frontend Workspace (`frontend/package.json`)**:
  - Contains no testing packages (Jest, Testing Library, or Playwright) in dependencies or devDependencies.
- **Backend Workspace (`backend/composer.json`)**:
  - Contains PHP testing framework dependencies in `require-dev`:
    - `phpunit/phpunit`: `^12.5.12`
    - `mockery/mockery`: `^1.6`
    - `nunomaduro/collision`: `^8.6`
  - Automated tests are run via `composer test` or `php artisan test`.

---

## 3. How to Start Frontend and Backend Servers

### A. Next.js Frontend
- **Startup Command**: `npm run dev` (development mode) or `npm run build && npm run start` (production mode) inside the `frontend/` directory.
- **Port Number**: Default is `3000` (can be overridden via `-p 3002`).
- **Environment Variables** (`frontend/.env.local`):
  - `NEXT_PUBLIC_API_URL=http://127.0.0.1:8002` (Base URL for API calls in the browser)
  - `LARAVEL_API_URL=http://127.0.0.1:8002` (Base URL for API calls in Server-Side Rendering)

### B. Laravel Backend
- **Startup Command**: `php artisan serve --port=8002` or `composer dev` inside the `backend/` directory.
- **Port Number**: Must be run on port `8002` (to match the frontend's API URL configuration) or port `8000` (default, which would require adjusting `.env.local`).
- **Environment Variables** (`backend/.env`):
  - `DB_CONNECTION=sqlite`
  - `APP_URL=http://localhost`
  - `MAIL_MAILER=log` (Sends emails to Laravel logs during local development)

### C. Root Express Server (Fallback)
- **Startup Command**: `npm run dev` or `npm run start` inside the root directory.
- **Port Number**: `3001` (from root `.env`).

---

## 4. Feature Inventory & Test Coverage Requirements

The E2E test suite must verify the following six core features across various pages, endpoints, and components:

### 1. Page Rendering
Verify visual parity, layout structure, and SSR stability across the application.
- **Pages to Test**:
  - Homepage (`/`)
  - Dynamic catch-all slug pages (e.g. `/gioi-thieu-ve-gia-cong`, `/san-pham`, `/tin-tuc`, `/lien-he`)
  - Converted category pages (e.g. `/bot-gia-vi`, `/dich-vu-dong-goi`, `/gia-cong-ca-phe-hoa-tan`)
  - Custom 404 page (must render within Flatsome layout context containing Header & Footer)
- **Testing Criteria**: Verify correct layout structure, status codes (200 for valid pages, 404 for missing pages), and check that no console errors or hydration crashes occur.

### 2. Header/Footer Menus
Ensure the main navigation layout functions as native React components with clean link structure.
- **Components to Test**:
  - `Header.tsx` (navigation bar, mega menus, desktop hover menus, and mobile drawer hamburger button)
  - `Footer.tsx` (links list, copyright info, and branding)
- **Testing Criteria**:
  - **Desktop View**: Hovering/Focusing on Product (`#menu-item-1742`) and Service (`#menu-item-5166`) dropdowns displays mega menus, sets `aria-expanded="true"`, and pressing `Escape` closes them.
  - **Mobile View**: Clicking hamburger drawer toggle (`a[data-open="#main-menu"]`) displays the off-canvas drawer (`#main-menu`), sets body class `off-canvas-active`, supports toggling submenus with sibling auto-close, and overlay click closes the drawer.
  - **Link Audit**: Scan all navigation links; ensure no links are dead (`#` or `javascript:void(0)`) or lead back to the live site absolute domain (`https://giacong.vn`).

### 3. Search
Verify search bar queries return consistent results from both the backend API and local fallbacks.
- **Pages & Endpoints to Test**:
  - Header search input element submission
  - `/search?s=<query>` page routing
  - `/api/search?s=<query>` backend endpoint
- **Testing Criteria**:
  - Submitting search from Header redirects to `/search?s=...`.
  - Verify results layout renders both products and services matching query.
  - Test edge queries: empty searches, Vietnamese accents/tones support, wildcard characters (`%`), and special strings.
  - Verify that relative paths are correctly rewritten (e.g. converting live domain assets to relative paths).

### 4. Form Submissions
Verify contact and quotation forms successfully capture inputs and handle validation.
- **Pages & Endpoints to Test**:
  - Forms on `/lien-he` and subpages containing forms (`wpcf7-form`, `devvn_cusstom_info`)
  - `/api/contact` backend submission route
- **Testing Criteria**:
  - Client-side validation: Blocking submit and alerting user if required fields are missing (Form 1: name, tel, message; Form 2: name, tel).
  - Anti-spam: Submit button is disabled and text changes to "Đang gửi..." during requests.
  - Success behavior: Alert is displayed, form is cleared, and button resets.
  - Payload integrity: Sends form inputs alongside client-side path to API.

### 5. CORS/SMTP
Verify server configurations are secure and submissions are stored and logged/mailed properly.
- **Endpoints & Configurations to Test**:
  - `backend/config/cors.php` allowed origins
  - `submissions` table inside SQLite database
  - SMTP mail configurations in `backend/.env`
- **Testing Criteria**:
  - CORS request: Verify CORS headers only allow origins `localhost:3000`, `localhost:3001`, and `localhost:3002`. Requests from arbitrary domains (e.g., `localhost:4000`) should be rejected.
  - Database persistence: Submissions are correctly stored in `submissions` table with IP address, user agent, referrer, path, and form data.
  - Mail verification: Server triggers mail sending (verified through logs in local dev).

### 6. SEO/Brand
Verify SEO compliance and strict constraints on trademark logo usage.
- **Pages & Assets to Test**:
  - Page head tags (Homepage, slug pages)
  - `/robots.txt`
  - `/sitemap.xml`
- **Testing Criteria**:
  - Each page has a unique page title, meta description, and exactly one H1 tag.
  - `robots.txt` is served correctly.
  - `sitemap.xml` generates links dynamically.
  - Trademark Compliance: Check pages do not violate official logo guidelines where restricted in production environments.

---

## 5. Recommendation for the E2E Test Setup

### A. E2E Runner: Playwright
We recommend **Playwright** as the E2E test runner for the following reasons:
1. **Pre-installed**: `@playwright/test` is already defined in the root `package.json` devDependencies.
2. **Native Hover/Focus support**: Ideal for verifying mega menu hovers, keyboard focus behaviors, and Escape key listeners.
3. **Multi-device Emulation**: Allows running desktop and mobile drawer tests concurrently with isolated contexts.
4. **Network Interception**: Useful for mocking or checking CORS behaviors and testing backend API connectivity fallbacks.
5. **Console Monitor**: Simplifies detecting hydration errors or browser console logs on page navigation.

### B. Setup Directory
We recommend organizing the E2E tests inside a root-level `tests/` directory:
```
c:\Users\hieuk\Desktop\Tham khảo giacong.vn\
├── tests/
│   ├── e2e/
│   │   ├── page-rendering.spec.ts
│   │   ├── menu-interactivity.spec.ts
│   │   ├── search.spec.ts
│   │   ├── form-submission.spec.ts
│   │   ├── cors-smtp.spec.ts
│   │   └── seo-brand.spec.ts
│   └── playwright.config.ts
```
Organizing it at the root keeps tests framework-agnostic (as they verify both Next.js and Laravel servers working in tandem) and avoids polluting individual `frontend` or `backend` workspaces.

### C. Playwright Configuration (`tests/playwright.config.ts`)
The Playwright configuration should include:
- **Base URL**: `http://localhost:3000` (Next.js server).
- **Projects**:
  - **Desktop Chrome**: `1280x800` viewport.
  - **Mobile Safari**: `375x667` viewport, mimicking iPhone profiles.
- **Web Server Setup**: Concurrently launch the Next.js server and Laravel server before running tests:
  ```typescript
  import { defineConfig } from '@playwright/test';
  export default defineConfig({
    testDir: './e2e',
    use: {
      baseURL: 'http://localhost:3000',
      trace: 'on-first-retry',
      screenshot: 'only-on-failure',
    },
    webServer: [
      {
        command: 'npm run start',
        cwd: '../frontend',
        port: 3000,
        reuseExistingServer: !process.env.CI,
      },
      {
        command: 'php artisan serve --port=8002',
        cwd: '../backend',
        port: 8002,
        reuseExistingServer: !process.env.CI,
      }
    ],
  });
  ```

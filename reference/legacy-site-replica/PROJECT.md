# Project: Giacong Replica Enhancement

## Architecture
The project is a replica of the giacong.vn website using a Next.js frontend and a Laravel backend.
- **Frontend**: Next.js (App Router, TypeScript). Currently renders layouts by reading legacy EJS files (`header.ejs`, `footer.ejs`) and injecting them. Pages are catch-all routes rendering converted EJS content wrappers.
- **Backend**: Laravel (PHP) with a SQLite database. Exposes REST APIs for page retrieval, searching, contact form submissions, and configuration management.
- **Shared Interfaces**:
  - `GET /api/pages/{slug}` -> Retrieves page metadata and HTML content.
  - `GET /api/posts` -> Retrieves paginated posts.
  - `GET /api/search` -> Query search results.
  - `POST /api/contact` -> Submits contact forms.

## Code Layout
- `frontend/` -> Next.js application
  - `src/app/` -> App Router pages & layouts
  - `src/components/` -> React layout and interaction components
  - `src/data/` -> Page contents and metadata fallback
  - `src/utils/` -> Utilities (page parser, etc.)
- `backend/` -> Laravel application
  - `app/Http/Controllers/` -> API Endpoints
  - `app/Models/` -> SQLite Database Models
  - `database/migrations/` -> Schema definition and indexes
  - `tests/` -> Feature/Unit tests

## Milestones
| # | Name | Scope | Dependencies | Status | Conversation ID |
|---|------|-------|-------------|--------|-----------------|
| 1 | Baseline Verification & Assessment | Dry run frontend build, run backend tests, assess crawl completeness. | None | DONE | b9fb6422-95ed-4f3d-9439-89992094039a |
| 2 | Visual Parity & E2E Validation Tests | Build lightweight E2E tests focusing on Visual Parity & styling compliance, de-prioritizing heavy mock test suites. | None | DONE | ac293fb4-1ecd-40a1-b9be-6bf19ebbc8d3 |
| 3 | React Header & Footer Conversion | Rewrite Header & Footer into native JSX with exact styling fidelity (Flatsome theme classes, colors, SF Pro Display, animations). | M1, M2 | DONE | 8efead4e-1eb9-475e-8cb5-3126055138d1 |
| 4 | Link Audit & Correction | Repair navigation and sidebar links, mapping dead/absolute links to Next.js routes. | M3 | DONE | e8a28c40-d18a-42f1-8175-538ec431171b |
| 5 | Production CORS & Form Mail Setup | Tighten CORS origins, implement SQLite submission storage and SMTP template. | M1 | DONE | e8a28c40-d18a-42f1-8175-538ec431171b |
| 6 | SEO, Robots, Sitemap & Brand Guide | Generate sitemap.xml, robots.txt, and write Trademark/Brand Usage Guide. | M4, M5 | DONE | e8a28c40-d18a-42f1-8175-538ec431171b |
| 7 | Visual Parity Verification & Audit | Validate styling, breakpoints, layout alignment, responsive behavior, and run final Forensic Audit. | M3, M4, M5, M6 | DONE | e8a28c40-d18a-42f1-8175-538ec431171b |

## Interface Contracts
- **Laravel Page API**: `GET /api/pages/{slug}`
  - Request: `slug` (string, URL encoded)
  - Response: `{ id: number, slug: string, title: string, content: string, description: string, body_class: string, is_active: boolean }`
- **Laravel Posts API**: `GET /api/posts?page={page}`
  - Response: JSON object representing LengthAwarePaginator (data: Post[], current_page, per_page, total, etc.)
- **Laravel Contact API**: `POST /api/contact`
  - Request: `{ name: string, email: string, phone: string, message: string }`
  - Response: `{ success: boolean, message: string, data?: any }`

## R5. Visual Parity & Layout Alignment
- CSS styles, margins, padding, image aspect ratios, and responsiveness on breakpoints (320px, 768px, 1280px) must match the live `https://giacong.vn` site.
- Converted layout components (Header, Footer, Mobile Drawer, dropdowns) must use native Flatsome-themed CSS classes and visual colors (`#5aa400` / `#eb892d`) to ensure brand identity.


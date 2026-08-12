# Context - Giacong Replica Enhancement

## Current System State
- **Local Time**: 2026-07-16T23:33:00+07:00
- **User OS**: Windows
- **Workspace Dir**: `c:\Users\hieuk\Desktop\Tham khảo giacong.vn`
- **Network Mode**: CODE_ONLY
- **Pivot Focus**: Visual Parity and Layout Alignment (R5) has been prioritized. E2E mock testing setup is de-prioritized.

## Codebase Status
- **Next.js Frontend**:
  - Located in `frontend/`
  - React Header & Footer converted to native JSX.
  - Page content wrappers are parsed EJS pages under `src/data/pages` (styled).
- **Laravel Backend**:
  - Located in `backend/`
  - Contains API routes for pages, paginated posts, search, and contact form submissions.

## Environment Config
- Frontend environment file: `frontend/.env` (and `.env.production`)
- Backend environment file: `backend/.env` (and `.env.production`)

## Active Servers
- Laravel API Port: TBD (usually 8000 or 8002)
- Next.js Frontend Port: TBD (usually 3000 or 3002)

# Orchestration Plan - Giacong Replica Enhancement

This document outlines the detailed execution plan for the Giacong Replica project. We use the **Project Pattern** to coordinate multiple specialized subagents.

## Execution Topology
We will run a dual-track process:
1. **E2E Testing Track**: Spawns an E2E testing agent (`self` as a sub-orchestrator) to build visual validation tests, class checks, and verification tools, de-prioritizing heavy mock test architectures.
2. **Implementation Track**: Runs sequential milestones to implement components with exact styling fidelity (Flatsome styles, colors, layouts), correct links, and complete SEO/SMTP, ending with E2E visual checks.

## Milestones Detailed Plan

### Milestone 1: Baseline Verification & Assessment
- **Objective**: Run backend tests, frontend builds, check SQLite schemas and metadata, and identify any pre-existing errors.
- **Worker**: Explorer + Worker
- **Verification**: Output log of `php artisan test` and `npm run build` showing initial state.

### Milestone 2: Visual Parity & E2E Validation Tests
- **Objective**: Build a lightweight E2E validation suite focusing on checking styling compliance (class names, font-faces, colors, and responsive layouts) across key pages and forms.
- **Output**: `TEST_INFRA.md` and `TEST_READY.md` showing verification commands and checklist.
- **Worker**: E2E Testing Orchestrator (`self`)

### Milestone 3: React Header & Footer Conversion
- **Objective**: Convert `Header.tsx` and `Footer.tsx` into native React JSX components (replacing dangerouslySetInnerHTML and file reads) with exact visual match to the original site.
- **Worker**: Explorer -> Worker -> Reviewer -> Challenger -> Forensic Auditor
- **Verification**: Zero dangerouslySetInnerHTML in layout, hover/mobile menus work, matching Flatsome style classes, SF Pro Display, and brand colors (`#5aa400` / `#eb892d`).

### Milestone 4: Link Audit & Correction
- **Objective**: Verify and fix all placeholders (`#`, `javascript:void(0)`) or absolute `giacong.vn` URLs in Header, Footer, and Sidebars to client-side relative Next.js routing.
- **Worker**: Explorer -> Worker -> Reviewer -> Challenger -> Forensic Auditor
- **Verification**: Opaque link check, zero broken references.

### Milestone 5: Production CORS & Form Mail Setup
- **Objective**: Restrict CORS configuration in Laravel (`backend/config/cors.php`) to specific origins, and set up SMTP configurations + SQLite submissions.
- **Worker**: Explorer -> Worker -> Reviewer -> Challenger -> Forensic Auditor
- **Verification**: Backend tests pass (`php artisan test`), CORS headers validated, SMTP logic mock-tested.

### Milestone 6: SEO, Robots, Sitemap & Brand Guide
- **Objective**: Setup unique meta details, dynamic `sitemap.xml`, robots.txt, and write Trademark & Brand Usage Guide.
- **Worker**: Explorer -> Worker -> Reviewer -> Challenger -> Forensic Auditor
- **Verification**: robots.txt and sitemap.xml generated in build output, guide written.

### Milestone 7: Visual Parity Verification & Audit
- **Objective**: Run visual alignment verification tests, check responsive breakpoints (320px, 768px, 1280px), check branding colors and font compliance, and run final Forensic Audit.
- **Worker**: Worker + Challenger + Reviewer + Auditor
- **Verification**: All visual parity criteria pass, Forensic Audit verdict is CLEAN.

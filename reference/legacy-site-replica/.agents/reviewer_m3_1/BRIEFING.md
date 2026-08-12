# BRIEFING — 2026-07-16T20:25:13+07:00

## Mission
Review JSX conversion of the header components and associated drawer/parser utils for correctness, safety, and mobile toggle behavior.

## 🔒 My Identity
- Archetype: reviewer_and_adversarial_critic
- Roles: reviewer, critic
- Working directory: c:\Users\hieuk\Desktop\Tham khảo giacong.vn\.agents\reviewer_m3_1
- Original parent: 8efead4e-1eb9-475e-8cb5-3126055138d1
- Milestone: Milestone 3
- Instance: 1 of 1

## 🔒 Key Constraints
- Review-only — do NOT modify implementation code

## Current Parent
- Conversation ID: 8efead4e-1eb9-475e-8cb5-3126055138d1
- Updated: 2026-07-16T13:26:00Z

## Review Scope
- **Files to review**:
  - frontend/src/components/Header.tsx
  - frontend/src/components/HeaderClient.tsx
  - frontend/src/components/SearchForm.tsx
  - frontend/src/components/SanPhamDropdown.tsx
  - frontend/src/components/DichVuDropdown.tsx
  - frontend/src/components/MobileDrawer.tsx
  - frontend/src/utils/pageParser.ts (getLayoutShell / getPageDataRaw)
- **Interface contracts**: PROJECT.md
- **Review criteria**: correctness, style, conformance, Next.js Link, React hook safety, safety from dangerouslySetInnerHTML / fs, mobile drawer behavior.

## Key Decisions Made
- Confirmed regex parsing bug in `pageParser.ts` causes HTML validation failure on all parsed pages.
- Set verdict to REQUEST_CHANGES.

## Artifact Index
- c:\Users\hieuk\Desktop\Tham khảo giacong.vn\.agents\reviewer_m3_1\review.md — Review Report

## Review Checklist
- **Items reviewed**:
  - frontend/src/components/Header.tsx
  - frontend/src/components/HeaderClient.tsx
  - frontend/src/components/SearchForm.tsx
  - frontend/src/components/SanPhamDropdown.tsx
  - frontend/src/components/DichVuDropdown.tsx
  - frontend/src/components/MobileDrawer.tsx
  - frontend/src/utils/pageParser.ts
- **Verdict**: request_changes
- **Unverified claims**: Mobile touch events & UI behavior in responsive viewport (static code reviewed, but real device behavior is unverified).

## Attack Surface
- **Hypotheses tested**:
  - EJS mobile sidebar regex stripping matches inner tags -> Confirmed (matches at search form closing divs).
  - Unmount callback of dropdown timer leads to warnings -> Confirmed (no cleanup function exists in code).
- **Vulnerabilities found**:
  - Critical regex mismatch in page parser causing HTML structure corruption.
  - Missing unmount cleanup on NodeJS timeout ref.
  - Unicode/spaces in `<Link href="/Hoa quả sấy">`.
  - Placeholder data copypasta in services dropdown.
- **Untested angles**: Mobile touch events, styling/layout compatibility on older mobile browsers.

# BRIEFING — 2026-07-16T20:18:00+07:00

## Mission
Ensure complete transition of legacy giacong.vn replica to React/Next.js native components, sync missing crawled pages and assets, verify all links are clean, configure production settings (CORS, SMTP, SEO, robots, sitemap, brand usage guide), and pass all frontend builds and backend tests cleanly.

## 🔒 My Identity
- Archetype: teamwork_preview_orchestrator
- Roles: orchestrator, user_liaison, human_reporter, successor
- Working directory: c:\Users\hieuk\Desktop\Tham khảo giacong.vn\.agents\orchestrator
- Original parent: Sentinel
- Original parent conversation ID: 6bf5a7d7-fd7e-4dee-813e-ffd88f0cfbfb

## 🔒 My Workflow
- **Pattern**: Project
- **Scope document**: c:\Users\hieuk\Desktop\Tham khảo giacong.vn\PROJECT.md
1. **Decompose**: Split into distinct modules: Crawler/Data Sync, Frontend React Component Conversion, Link Audit & Repair, Production Backend configuration, SEO & Forms configuration.
2. **Dispatch & Execute**:
   - **Direct (iteration loop)**: Use Explorer -> Worker -> Reviewer -> Challenger -> Forensic Auditor cycle for components.
3. **On failure** (in this order):
   - Retry: nudge stuck agent or re-send task
   - Replace: spawn fresh agent with partial progress
   - Skip: proceed without (only if non-critical)
   - Redistribute: split stuck agent's remaining work
   - Redesign: re-partition decomposition
   - Escalate: report to parent (sub-orchestrators only, last resort)
4. **Succession**: Self-succeed at 16 spawns, write handoff.md, spawn successor.
- **Work items**:
  1. Assessment and Planning [in-progress]
  2. Data sync and crawler [pending]
  3. Header & Footer React conversion [pending]
  4. Link audit & correction [pending]
  5. Backend production CORS & SMTP [pending]
  6. SEO, sitemap, robots, brand usage guide [pending]
  7. Final integration, E2E test validation, and deployment setup [pending]
- **Current phase**: 1
- **Current focus**: Planning and Initial Assessment

## 🔒 Key Constraints
- CODE_ONLY network mode: No HTTP/HTTPS external requests from run_command or custom scripts (use only code search or local tools). Any crawl needs to be simulated or run locally using existing resources/mocks/cached data.
- Never reuse a subagent after it has delivered its handoff — always spawn fresh.
- Binary veto on Forensic Audit failures.

## Current Parent
- Conversation ID: 6bf5a7d7-fd7e-4dee-813e-ffd88f0cfbfb
- Updated: not yet

## Key Decisions Made
- Decompose the project into sequential milestones to guarantee frontend builds, backend tests, and no visual/link bugs.

## Team Roster
| Agent | Type | Work Item | Status | Conv ID |
|-------|------|-----------|--------|---------|
| explorer_1 | teamwork_preview_explorer | Baseline assessment and code/DB audit | completed | b9fb6422-95ed-4f3d-9439-89992094039a |
| e2e_testing_orch | teamwork_preview_orchestrator | E2E Testing Track | in-progress | ac293fb4-1ecd-40a1-b9be-6bf19ebbc8d3 |
| implementation_orch | teamwork_preview_orchestrator | Implementation Track (succeeded by 15f25511-5266-4da4-b862-71b9c3863836) | completed | 8efead4e-1eb9-475e-8cb5-3126055138d1 |
| implementation_orch_gen2 | teamwork_preview_orchestrator | Implementation Track (Gen 2) | failed | 15f25511-5266-4da4-b862-71b9c3863836 |
| implementation_orch_gen3 | teamwork_preview_orchestrator | Implementation Track (Gen 3 - Replacement) | in-progress | aa37c91c-85ba-4046-972d-07e4e47d711f |

## Succession Status
- Succession required: no
- Spawn count: 4 / 16
- Pending subagents: ac293fb4-1ecd-40a1-b9be-6bf19ebbc8d3, aa37c91c-85ba-4046-972d-07e4e47d711f
- Predecessor: none
- Successor: not yet spawned

## Active Timers
- Heartbeat cron: task-533
- Safety timer: none

## Artifact Index
- c:\Users\hieuk\Desktop\Tham khảo giacong.vn\.agents\orchestrator\plan.md — Project plan and decomposition
- c:\Users\hieuk\Desktop\Tham khảo giacong.vn\.agents\orchestrator\context.md — Context and current system state
- c:\Users\hieuk\Desktop\Tham khảo giacong.vn\.agents\orchestrator\progress.md — Liveness and status heartbeat

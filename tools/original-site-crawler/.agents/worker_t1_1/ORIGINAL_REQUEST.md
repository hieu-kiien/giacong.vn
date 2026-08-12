## 2026-07-16T16:51:50Z

You are the teamwork_preview_worker for Milestone T1: E2E Testing Track.
Your working directory is: c:\Users\hieuk\Desktop\cào giacong.vn\.agents\worker_t1_1\
Workspace Root: c:\Users\hieuk\Desktop\cào giacong.vn\

Your tasks are:
1. Create `TEST_INFRA.md` at the project root defining the test philosophy, feature inventory, test case design, and runner instructions.
2. Design and implement a comprehensive opaque-box E2E test suite in Python under `tests/test_e2e.py` (and `tests/conftest.py` if needed) following the 4-tier approach based on ORIGINAL_REQUEST.md:
   - Tier 1: Feature Coverage (>=5 tests per feature)
   - Tier 2: Boundary & Corner Cases (>=5 tests per feature)
   - Tier 3: Cross-Feature Combinations (pairwise coverage)
   - Tier 4: Real-World Application Scenarios
3. Use a mock HTTP server / fixture (e.g., using Python's built-in `http.server` running in a pytest fixture thread, or standard library mocking) to run these E2E tests offline and deterministically, simulating various responses (HTTP 200 with normal HTML, lazy-loaded images, contacts, HTTP 429, 503, etc.).
4. Verify the E2E tests run. (Since the scraper code is not yet written, the tests might fail to find `run.py` or the scraper module. You can verify that pytest successfully collects all tests, e.g. using `pytest --collect-only`, and that running pytest fails with the expected FileNotFoundError/import errors rather than test syntax errors).
5. Document your verification commands and outputs.
6. Write a handoff report at `c:\Users\hieuk\Desktop\cào giacong.vn\.agents\worker_t1_1\handoff.md` detailing what was created, test design, and pytest collection/run outputs.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

When complete, write your handoff and send a message back.

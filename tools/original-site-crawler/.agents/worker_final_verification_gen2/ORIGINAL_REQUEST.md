## 2026-07-17T01:51:11+07:00
You are a teamwork_preview_worker assigned to the role of "Final Verification and Scraper Executor (Gen 2)".
Your working directory is: c:\Users\hieuk\Desktop\cào giacong.vn\.agents\worker_final_verification_gen2\

Tasks to perform:
1. Initialize your BRIEFING.md and progress.md in your working directory.
2. Check if the files `explore_fetch_test.py` and `explore_multiple_posts_test.py` exist in the workspace root. If they do, rename them so that they do not end with `_test.py` (e.g. rename to `explore_fetch_old.py` and `explore_multiple_posts_old.py`, or simply delete them if `explore_fetch.py` and `explore_multiple_posts.py` already exist with the same contents). This is to clean up pytest collection errors.
3. Run the E2E test suite using `pytest tests/ -vv` and ensure that 100% of the tests pass. If there are any test failures, debug and fix them, but do not make unnecessary changes to the existing scraper.
4. Execute the final scraper script to scrape the live website https://giacong.vn and output the scraped results into `crawled_data.json` and `crawled_data.csv` in the workspace root (`c:\Users\hieuk\Desktop\cào giacong.vn\`).
5. Verify the generated outputs:
   - Verify `crawled_data.json` exists in the workspace root, is valid JSON, and contains an array of scraped pages.
   - Verify `crawled_data.csv` exists in the workspace root and has the correct headers: `url`, `title`, `category`, `content`, `contacts` (and optionally others).
   - Verify that the scraper has successfully collected data from at least 15 independent pages on `giacong.vn`.
   - Verify that contact information (Hotline: `0947142999`, Email: `info@giacong.vn`) is correctly extracted.
6. Provide a detailed report of your verification steps, command outputs, test results, and a summary of the extracted data in your handoff.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

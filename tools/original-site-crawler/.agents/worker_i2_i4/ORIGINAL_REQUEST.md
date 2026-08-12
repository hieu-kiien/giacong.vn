## 2026-07-16T16:56:00Z
You are the Core Implementation Worker.
Your working directory is: c:\Users\hieuk\Desktop\cào giacong.vn\.agents\worker_i2_i4\
Workspace Root: c:\Users\hieuk\Desktop\cào giacong.vn\

Your mission is to implement Milestones I2 (Core Crawler), I3 (Core Parser), and I4 (Storage & CLI).

1. Read the global layout and contracts in `c:\Users\hieuk\Desktop\cào giacong.vn\PROJECT.md`.
2. Read the crawler, parser, classification, and selector specs in `c:\Users\hieuk\Desktop\cào giacong.vn\.agents\explorer_i1\analysis.md`.
3. Create the directories and implement:
   - `scraper/__init__.py`
   - `scraper/crawler.py`: Implement queue, URL normalization, delay/polite scraping, connection timeout, and retry logic with exponential backoff on HTTP 429/503.
   - `scraper/parser.py`: Parse HTML using BeautifulSoup. Extract title, H1, categories (trang chủ, liên hệ, sản phẩm, dịch vụ, tin tức, khác) based on body classes and paths, content text, contacts (regexes for phone 0947142999 and email info@giacong.vn, selectors for address), and images (handling lazy-loaded attributes: data-src, data-lazy-src, falling back to src, resolving to absolute urls, filtering small sizes/icons).
   - `scraper/storage.py`: Save collected data list to JSON (crawled_data.json) and CSV (crawled_data.csv) format.
   - `scraper/cli.py`: Implement argument parsing and run logic.
   - `run.py`: Entrypoint script calling `scraper.cli.main()`.
   - `requirements.txt`: List dependencies (like beautifulsoup4, requests, urllib3, etc.).
4. Run python builds and the E2E test suite using `pytest tests/` to verify that your implementation satisfies all 60 test cases. Correct any errors or mismatches.
5. Create standard placeholder output files or run a short test crawl if needed.
6. Provide a detailed handoff report when complete, including test execution outputs and confirmation of code layout compliance.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

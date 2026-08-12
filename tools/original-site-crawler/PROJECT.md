# Project: giacong.vn Crawler and Scraper

## Architecture
We will build a modular Python-based crawler and scraper.
- `scraper/crawler.py`: Handles HTTP requests, URL normalization, link extraction, queue management, retry logic (exponential backoff), and delay.
- `scraper/parser.py`: Analyzes HTML to extract structured data (H1, title, category, main content, contacts, image links).
- `scraper/storage.py`: Formats parsed data and saves it to JSON and CSV formats.
- `scraper/cli.py`: Command-line interface to coordinate the crawling, parsing, and storing process.

## Code Layout
```
cào giacong.vn/
├── crawled_data.json         # JSON output
├── crawled_data.csv          # CSV output
├── scraper/                  # Scraper source code
│   ├── __init__.py
│   ├── cli.py                # Command-line entrypoint
│   ├── crawler.py            # Crawler class (network & queue)
│   ├── parser.py             # HTML parser & extractor
│   └── storage.py            # JSON/CSV storage manager
├── tests/                    # Test suite (Unit & E2E)
│   ├── __init__.py
│   ├── conftest.py           # Pytest fixtures and mocks
│   ├── test_crawler.py       # Crawler unit tests
│   ├── test_parser.py        # Parser unit tests
│   └── test_e2e.py           # Opaque-box E2E tests (Tiers 1-4)
├── requirements.txt          # Python dependencies
├── run.py                    # Scraper runner entry script
├── README.md                 # Usage documentation
└── PROJECT.md                # Global project description & milestones
```

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| T1 | E2E Testing Track | Create full opaque-box E2E test suite (Tiers 1-4) & `TEST_INFRA.md`. Publishes `TEST_READY.md`. | None | DONE |
| I1 | Exploration & Architecture | Explore site structure of giacong.vn and write detailed scraper architecture and regex/CSS paths. | None | DONE |
| I2 | Core Crawler | Implement crawling queue, URL normalization, rate limiting, and backoff retry. | I1 | DONE |
| I3 | Core Parser | Implement HTML parser for H1, category, main content, contacts (phone, email), and images. | I1 | DONE |
| I4 | Storage & CLI | Implement CLI coordination and JSON/CSV storage output. | I2, I3 | DONE |
| I5 | E2E Integration & Verification | Pass 100% E2E tests, run Challenger Tier 5 adversarial tests, and perform Forensic Audit. | T1, I4 | DONE |

## Interface Contracts

### Crawler ↔ Parser
- Crawler fetches HTML and passes the raw HTML and URL to Parser:
  `parse_page(url: str, html: str) -> Dict[str, Any]`
- Parser returns a dictionary representing page data:
  ```json
  {
    "url": "https://giacong.vn/...",
    "title": "Page Title",
    "h1": "H1 Text",
    "category": "sản phẩm | dịch vụ | tin tức | liên hệ | trang chủ | khác",
    "content": "Main text content",
    "contacts": {
      "phone": ["0947142999", ...],
      "email": ["info@giacong.vn", ...],
      "address": ["Address text", ...]
    },
    "images": ["image_url_1", "image_url_2", ...]
  }
  ```

### Scraper ↔ Storage
- Storage accepts a list of parsed pages and writes to target files:
  `save_json(data: List[Dict[str, Any]], filepath: str) -> None`
  `save_csv(data: List[Dict[str, Any]], filepath: str) -> None`

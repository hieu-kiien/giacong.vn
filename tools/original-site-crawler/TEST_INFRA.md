# Test Infrastructure & Strategy

This document defines the test philosophy, feature inventory, test case design, and runner instructions for the `giacong.vn` crawler and scraper project.

---

## 1. Test Philosophy

The testing strategy is designed around **opaque-box End-to-End (E2E) testing**.
- **Opaque-Box**: The test runner interacts with the system solely through public entry points (the command line interface and output files). No internal states, private classes, or hidden methods are inspected directly.
- **Offline & Deterministic**: The crawler is tested against a local mock HTTP server rather than the live `https://giacong.vn` site. This prevents network flakiness, avoids hitting real servers, and guarantees consistent, reproducible test environments.
- **Subprocess Isolation**: Tests invoke the scraper as a subprocess via the entry script `run.py`, verifying the complete lifecycle: CLI argument parsing, link discovery, queue management, HTTP request handling, retry policies, HTML parsing, and file storage.

---

## 2. Feature Inventory

The test suite validates the following system features:
1. **F1: URL Crawling & Queue Management**: Link discovery, URL normalization (stripping query parameters like `?replytocom`, `/feed/`), external domain filtering, duplicate URL avoidance, depth control.
2. **F2: Rate Limiting & Backoff Retry**: Polite request delays, exponential backoff handling of HTTP status codes `429` (Too Many Requests) and `503` (Service Unavailable), and retry exhaustion.
3. **F3: HTML Structured Parsing**: Title and H1 extraction, category classification (WordPress/WooCommerce layouts), main text extraction, and detection of lazy-loaded images (`data-src`, `data-lazy-src`).
4. **F4: Contact Information Extraction**: Phone number discovery (various formats), email detection, and physical address parsing from structured or raw text.
5. **F5: Data Storage & Output Management**: Validating schema and columns of JSON (`crawled_data.json`) and CSV (`crawled_data.csv`) outputs, handling overwrite/directory constraints.

---

## 3. Test Case Design (4-Tier Approach)

The E2E test suite under `tests/test_e2e.py` is divided into four distinct testing tiers:

### Tier 1: Feature Coverage (>=5 tests per feature)
- **F1: URL Crawling & Queue**
  1. `test_crawl_internal_links`: Scrapes multiple internal links and collects pages.
  2. `test_url_normalization_query_params`: Verifies query parameters like `?replytocom` are ignored and normal URLs are crawled.
  3. `test_url_normalization_feed`: Verifies paths containing `/feed/` are excluded or normalized.
  4. `test_filter_external_domains`: Verifies links targeting external websites are ignored.
  5. `test_prevent_duplicate_crawling`: Verifies duplicate links do not cause infinite loops or duplicate data records.
- **F2: Rate Limiting & Backoff**
  6. `test_rate_limit_delay`: Verifies there is a configured delay between requests.
  7. `test_retry_http_429_success`: Verifies HTTP 429 triggers backoff and succeeds on subsequent try.
  8. `test_retry_http_503_success`: Verifies HTTP 503 triggers backoff and succeeds on subsequent try.
  9. `test_retry_max_exhausted`: Verifies crawler aborts or handles gracefully when maximum retries are exhausted.
  10. `test_network_timeout_retry`: Verifies timeouts lead to retries.
- **F3: HTML Structured Parsing**
  11. `test_extract_title_and_h1`: Verifies correct title and H1 elements are parsed.
  12. `test_category_classification_tin_tuc`: Verifies tin-tuc URLs or classes parse as "tin tức".
  13. `test_category_classification_san_pham`: Verifies san-pham URLs or classes parse as "sản phẩm".
  14. `test_extract_main_content`: Extracts text from paragraph blocks, discarding noise.
  15. `test_extract_lazy_loaded_images`: Finds image URLs from `data-src` and `data-lazy-src`.
- **F4: Contact Info Extraction**
  16. `test_extract_phone_standard`: Extracts phone numbers in plain string format.
  17. `test_extract_phone_with_spaces_dots`: Extracts formatted phone numbers (e.g. `0947.142.999` or `0947 142 999`).
  18. `test_extract_email_standard`: Finds email addresses (e.g. `info@giacong.vn`).
  19. `test_extract_address`: Parses physical address patterns.
  20. `test_no_contacts_graceful`: Returns empty structure when no contacts are found.
- **F5: Storage & Output**
  21. `test_output_files_created`: Verifies JSON and CSV files exist after crawl.
  22. `test_json_schema_validation`: Checks JSON structure conforms to schema.
  23. `test_csv_headers_validation`: Checks CSV columns (`url`, `title`, `category`, `content`, `contacts`).
  24. `test_unicode_handling`: Verifies Vietnamese characters (utf-8) are correctly written.
  25. `test_empty_crawl_output_handling`: Verifies behavior when zero pages are successfully crawled.

### Tier 2: Boundary & Corner Cases (>=5 tests per feature)
- **F1: URL Crawling & Queue**
  26. `test_boundary_empty_pages`: Pages with no internal links.
  27. `test_boundary_extremely_long_url`: Handling URLs exceeding 1000 characters.
  28. `test_boundary_malformed_html_links`: Links embedded in broken HTML elements.
  29. `test_boundary_circular_redirects`: Server redirect loops (A -> B -> A).
  30. `test_boundary_infinite_depth_limit`: Max depth stops deep hierarchical crawling.
- **F2: Rate Limiting & Backoff**
  31. `test_boundary_all_requests_rate_limited`: Persistent 429 response throughout crawl.
  32. `test_boundary_zero_delay_config`: Running with zero delay.
  33. `test_boundary_slow_server_response`: Handling long response delays (simulated read timeouts).
  34. `test_boundary_empty_http_body`: Handling HTTP 200 with 0 bytes.
  35. `test_boundary_http_500_internal_error`: Handling non-retryable 500 errors.
- **F3: HTML Structured Parsing**
  36. `test_boundary_missing_title_h1`: HTML with no head, title, or H1 elements.
  37. `test_boundary_non_utf8_encoding`: HTML response encoded in ISO-8859-1.
  38. `test_boundary_huge_html_size`: Parsing large pages (>5MB) without crashing.
  39. `test_boundary_embedded_styles_scripts`: Verifies css/javascript code content is not parsed as text.
  40. `test_boundary_broken_lazy_images`: Images with data-src attributes but empty values.
- **F4: Contact Info Extraction**
  41. `test_boundary_contacts_in_comments`: Phone numbers inside HTML comment blocks.
  42. `test_boundary_fake_phone_numbers`: Strings resembling phone numbers but invalid.
  43. `test_boundary_multiple_emails`: Page with many emails.
  44. `test_boundary_contacts_with_html_tags`: Phone number wrapped in nested span tags.
  45. `test_boundary_address_edge_cases`: Multi-line Vietnamese addresses with special characters.
- **F5: Storage & Output**
  46. `test_boundary_readonly_directory`: Attempting to write outputs to directory with restricted permissions.
  47. `test_boundary_existing_output_overwrite`: Verifying output overwrites pre-existing files cleanly.
  48. `test_boundary_very_large_dataset`: Writing thousands of scraped records to JSON/CSV.
  49. `test_boundary_csv_special_characters`: CSV fields containing commas, quotes, or newlines.
  50. `test_boundary_interrupt_write`: Verifying partial writes are handled cleanly.

### Tier 3: Cross-Feature Combinations (Pairwise integration)
- 51. `test_combo_backoff_on_lazy_loaded_contacts`: Verifies that a page requiring backoff retry (F2) contains lazily loaded images (F3) and contact information (F4) which are parsed correctly after retrieval.
- 52. `test_combo_normalized_url_429`: Verifies query parameters are normalized (F1) and the request is successfully retried (F2) when the normalized URL is visited.
- 53. `test_combo_redirect_to_contacts_page`: Verifies redirect (F1) resolving to a page with contacts (F4) parses the contact data successfully.
- 54. `test_combo_malformed_html_with_contacts_to_csv`: Checks parsing malformed HTML (F3) containing phone numbers (F4) outputted into CSV (F5).
- 55. `test_combo_slow_depth_crawl`: Verifies high-latency crawl (F2) at max depth (F1) saves valid partial output (F5).

### Tier 4: Real-World Application Scenarios
- 56. `test_scenario_full_giacong_vn_site_structure`: Simulates the complete WordPress/WooCommerce site structure of `giacong.vn` including home, products, services, tin-tuc, and contact page. Checks that all 15+ pages are crawled, categorized, parsed, and successfully saved.
- 57. `test_scenario_adversarial_network`: Simulates a chaotic network environment with intermittent 429/503 statuses, timeouts, external redirection, and lazy-loading DOMs. Asserts that the scraper completes without failure and dumps data.
- 58. `test_scenario_wordpress_woocommerce_dom`: Simulates standard WooCommerce templates with tags, templates, specific class hierarchies and ensures precise category detection.
- 59. `test_scenario_lazy_load_heavy_gallery`: Simulates a portfolio/gallery page where images are loaded asynchronously and contacts are hidden in footers.
- 60. `test_scenario_crawl_scale_limit`: Crawls a larger mock site of 30 pages and verifies target file output sizes and structures.

---

## 4. Test Runner Instructions

### Prerequisites
1. Python 3.8+
2. Dependencies installed:
   ```bash
   pip install -r requirements.txt
   ```

### Running the Test Suite
Tests are run using `pytest`. The test files are located under the `tests/` directory.

- **To run all E2E tests**:
  ```bash
  pytest tests/test_e2e.py -v
  ```
- **To perform test collection without executing**:
  ```bash
  pytest --collect-only tests/test_e2e.py
  ```
- **To run a specific test**:
  ```bash
  pytest tests/test_e2e.py -k test_crawl_internal_links -v
  ```

---

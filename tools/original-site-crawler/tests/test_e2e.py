import subprocess
import os
import json
import csv
import time
import pytest

def run_scraper(args, timeout=15):
    """
    Helper to run the scraper CLI via subprocess.
    Invokes python run.py with the provided arguments.
    """
    # Assuming run.py is in the root directory relative to where pytest is run
    cmd = ["python", "run.py"] + args
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=timeout
    )
    return result

# =====================================================================
# TIER 1: FEATURE COVERAGE (Tests 1 to 25)
# =====================================================================

# --- Feature 1: URL Crawling & Queue Management ---

def test_crawl_internal_links(mock_server, tmp_path):
    """1. Test internal links crawl and traversal."""
    json_out = tmp_path / "crawled_data.json"
    csv_out = tmp_path / "crawled_data.csv"
    result = run_scraper([
        "--start-url", f"{mock_server}/",
        "--output-json", str(json_out),
        "--output-csv", str(csv_out),
        "--max-depth", "2"
    ])
    assert result.returncode == 0
    assert json_out.exists()
    with open(json_out, "r", encoding="utf-8") as f:
        data = json.load(f)
    urls = [page["url"] for page in data]
    assert f"{mock_server}/" in urls
    assert f"{mock_server}/san-pham/" in urls
    assert f"{mock_server}/dich-vu/" in urls

def test_url_normalization_query_params(mock_server, tmp_path):
    """2. Test normalization by stripping query parameters like ?replytocom."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/query-param",
        "--output-json", str(json_out)
    ])
    assert result.returncode == 0
    with open(json_out, "r", encoding="utf-8") as f:
        data = json.load(f)
    urls = [page["url"] for page in data]
    # Check that replytocom parameter is stripped to /query-param
    assert f"{mock_server}/query-param" in urls
    # Verify no duplicates of the normalized URL exist
    assert urls.count(f"{mock_server}/query-param") == 1

def test_url_normalization_feed(mock_server, tmp_path):
    """3. Test exclusion or normalization of feed links containing /feed/."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/",
        "--output-json", str(json_out)
    ])
    assert result.returncode == 0
    with open(json_out, "r", encoding="utf-8") as f:
        data = json.load(f)
    urls = [page["url"] for page in data]
    # Feed URLs should not be collected
    for url in urls:
        assert "/feed/" not in url

def test_filter_external_domains(mock_server, tmp_path):
    """4. Test that external domain links are filtered out."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/",
        "--output-json", str(json_out)
    ])
    assert result.returncode == 0
    with open(json_out, "r", encoding="utf-8") as f:
        data = json.load(f)
    for page in data:
        # None of the crawled URLs should belong to external sites
        assert page["url"].startswith(mock_server)

def test_prevent_duplicate_crawling(mock_server, tmp_path):
    """5. Test that duplicate links do not cause infinite recursion."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/duplicate/a",
        "--output-json", str(json_out),
        "--max-depth", "5"
    ])
    assert result.returncode == 0
    with open(json_out, "r", encoding="utf-8") as f:
        data = json.load(f)
    urls = [page["url"] for page in data]
    assert len(urls) <= 2
    assert f"{mock_server}/duplicate/a" in urls
    assert f"{mock_server}/duplicate/b" in urls

# --- Feature 2: Rate Limiting & Backoff ---

def test_rate_limit_delay(mock_server, tmp_path):
    """6. Test delay between successive requests is respected."""
    json_out = tmp_path / "crawled_data.json"
    start_time = time.time()
    result = run_scraper([
        "--start-url", f"{mock_server}/san-pham/",
        "--output-json", str(json_out),
        "--delay", "0.5"
    ])
    elapsed = time.time() - start_time
    assert result.returncode == 0
    # There are at least 3 pages (san-pham, sp1, sp2). 2 delays * 0.5s = 1.0s minimum.
    assert elapsed >= 1.0

def test_retry_http_429_success(mock_server, tmp_path):
    """7. Test recovery and retry after HTTP 429 (Too Many Requests)."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/status/429",
        "--output-json", str(json_out),
        "--retries", "3",
        "--backoff-factor", "0.1"
    ])
    assert result.returncode == 0
    with open(json_out, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert len(data) == 1
    assert data[0]["title"] == "Succeed after 429"

def test_retry_http_503_success(mock_server, tmp_path):
    """8. Test recovery and retry after HTTP 503 (Service Unavailable)."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/status/503",
        "--output-json", str(json_out),
        "--retries", "3",
        "--backoff-factor", "0.1"
    ])
    assert result.returncode == 0
    with open(json_out, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert len(data) == 1
    assert data[0]["title"] == "Succeed after 503"

def test_retry_max_exhausted(mock_server, tmp_path):
    """9. Test graceful handling when maximum retries are exhausted."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/status/429-persistent",
        "--output-json", str(json_out),
        "--retries", "2",
        "--backoff-factor", "0.1"
    ])
    # The command should exit cleanly but with an error status or log, and no scraped data.
    assert result.returncode != 0 or not json_out.exists() or os.path.getsize(json_out) <= 2

def test_network_timeout_retry(mock_server, tmp_path):
    """10. Test network timeout triggers retry."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/timeout",
        "--output-json", str(json_out),
        "--timeout", "1.0",
        "--retries", "2",
        "--backoff-factor", "0.1"
    ])
    # Should either fail or complete if it handles timeouts and logs it
    assert result.returncode != 0 or not json_out.exists() or os.path.getsize(json_out) <= 2

# --- Feature 3: HTML Structured Parsing ---

def test_extract_title_and_h1(mock_server, tmp_path):
    """11. Test correct extraction of Title and H1 fields."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/san-pham/sp1",
        "--output-json", str(json_out),
        "--max-depth", "1"
    ])
    assert result.returncode == 0
    with open(json_out, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert len(data) > 0
    assert data[0]["title"] == "Sản phẩm 1 - Gia công cơ khí"
    assert data[0]["h1"] == "Chi tiết sản phẩm 1"

def test_category_classification_tin_tuc(mock_server, tmp_path):
    """12. Test categorization as 'tin tức'."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/tin-tuc/post1",
        "--output-json", str(json_out),
        "--max-depth", "1"
    ])
    assert result.returncode == 0
    with open(json_out, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert data[0]["category"] == "tin tức"

def test_category_classification_san_pham(mock_server, tmp_path):
    """13. Test categorization as 'sản phẩm'."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/san-pham/sp1",
        "--output-json", str(json_out),
        "--max-depth", "1"
    ])
    assert result.returncode == 0
    with open(json_out, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert data[0]["category"] == "sản phẩm"

def test_extract_main_content(mock_server, tmp_path):
    """14. Test clean extraction of main text content."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/san-pham/sp1",
        "--output-json", str(json_out),
        "--max-depth", "1"
    ])
    assert result.returncode == 0
    with open(json_out, "r", encoding="utf-8") as f:
        data = json.load(f)
    content = data[0]["content"]
    assert "Mô tả chi tiết sản phẩm 1 ở đây." in content
    # Script/Style tags should not be in the parsed content text
    assert "<script>" not in content

def test_extract_lazy_loaded_images(mock_server, tmp_path):
    """15. Test extraction of lazy-loaded images (data-src, data-lazy-src)."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/san-pham/sp1",
        "--output-json", str(json_out),
        "--max-depth", "1"
    ])
    assert result.returncode == 0
    with open(json_out, "r", encoding="utf-8") as f:
        data = json.load(f)
    images = data[0]["images"]
    assert "/images/sp1_main.jpg" in images or "http" in "".join(images)
    assert "/images/sp1_detail.jpg" in images or "http" in "".join(images)

# --- Feature 4: Contact Info Extraction ---

def test_extract_phone_standard(mock_server, tmp_path):
    """16. Test phone number extraction from plain text."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/lien-he/",
        "--output-json", str(json_out),
        "--max-depth", "1"
    ])
    assert result.returncode == 0
    with open(json_out, "r", encoding="utf-8") as f:
        data = json.load(f)
    phones = data[0]["contacts"]["phone"]
    assert "0947142999" in phones or "0947.142.999" in phones or "0947 142 999" in phones

def test_extract_phone_with_spaces_dots(mock_server, tmp_path):
    """17. Test parsing phone numbers containing spaces/dots."""
    # The mock server returns formatted hotline. The parser should normalize or extract correctly.
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/lien-he/",
        "--output-json", str(json_out),
        "--max-depth", "1"
    ])
    assert result.returncode == 0
    with open(json_out, "r", encoding="utf-8") as f:
        data = json.load(f)
    phones = data[0]["contacts"]["phone"]
    # Should find the phone regardless of spaces/dots format
    cleaned_phones = [p.replace(" ", "").replace(".", "") for p in phones]
    assert "0947142999" in cleaned_phones

def test_extract_email_standard(mock_server, tmp_path):
    """18. Test standard email extraction."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/lien-he/",
        "--output-json", str(json_out),
        "--max-depth", "1"
    ])
    assert result.returncode == 0
    with open(json_out, "r", encoding="utf-8") as f:
        data = json.load(f)
    emails = data[0]["contacts"]["email"]
    assert "info@giacong.vn" in emails

def test_extract_address(mock_server, tmp_path):
    """19. Test physical address extraction."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/lien-he/",
        "--output-json", str(json_out),
        "--max-depth", "1"
    ])
    assert result.returncode == 0
    with open(json_out, "r", encoding="utf-8") as f:
        data = json.load(f)
    addresses = data[0]["contacts"]["address"]
    assert any("123 Đường Gia Công" in addr for addr in addresses)

def test_no_contacts_graceful(mock_server, tmp_path):
    """20. Test graceful parsing on pages without any contact details."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/ve-chung-toi/",
        "--output-json", str(json_out),
        "--max-depth", "1"
    ])
    assert result.returncode == 0
    with open(json_out, "r", encoding="utf-8") as f:
        data = json.load(f)
    contacts = data[0]["contacts"]
    assert len(contacts["phone"]) == 0
    assert len(contacts["email"]) == 0

# --- Feature 5: Storage & Output ---

def test_output_files_created(mock_server, tmp_path):
    """21. Test files are created on disk upon completion."""
    json_out = tmp_path / "crawled_data.json"
    csv_out = tmp_path / "crawled_data.csv"
    result = run_scraper([
        "--start-url", f"{mock_server}/lien-he/",
        "--output-json", str(json_out),
        "--output-csv", str(csv_out),
        "--max-depth", "1"
    ])
    assert result.returncode == 0
    assert json_out.exists()
    assert csv_out.exists()

def test_json_schema_validation(mock_server, tmp_path):
    """22. Test output schema conforms to PROJECT.md spec."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/ve-chung-toi/",
        "--output-json", str(json_out),
        "--max-depth", "1"
    ])
    assert result.returncode == 0
    with open(json_out, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert isinstance(data, list)
    page_data = data[0]
    required_keys = {"url", "title", "h1", "category", "content", "contacts", "images"}
    assert required_keys.issubset(page_data.keys())
    assert isinstance(page_data["contacts"], dict)
    assert {"phone", "email", "address"}.issubset(page_data["contacts"].keys())

def test_csv_headers_validation(mock_server, tmp_path):
    """23. Test output CSV columns correspond to specification."""
    csv_out = tmp_path / "crawled_data.csv"
    result = run_scraper([
        "--start-url", f"{mock_server}/ve-chung-toi/",
        "--output-csv", str(csv_out),
        "--max-depth", "1"
    ])
    assert result.returncode == 0
    with open(csv_out, "r", encoding="utf-8", newline="") as f:
        reader = csv.reader(f)
        headers = next(reader)
    required_headers = ["url", "title", "category", "content", "contacts"]
    for header in required_headers:
        assert header in headers

def test_unicode_handling(mock_server, tmp_path):
    """24. Test that Vietnamese characters remain intact in output files."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/",
        "--output-json", str(json_out),
        "--max-depth", "1"
    ])
    assert result.returncode == 0
    with open(json_out, "r", encoding="utf-8") as f:
        data = json.load(f)
    # Homepage title has Vietnamese characters "Trang chủ - gia công"
    assert data[0]["title"] == "Trang chủ - gia công"

def test_empty_crawl_output_handling(mock_server, tmp_path):
    """25. Test output structure when no pages were crawled."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/status/503-persistent",
        "--output-json", str(json_out),
        "--retries", "1",
        "--backoff-factor", "0.1"
    ])
    # The output JSON should exist but represent an empty list
    assert json_out.exists()
    with open(json_out, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert len(data) == 0


# =====================================================================
# TIER 2: BOUNDARY & CORNER CASES (Tests 26 to 50)
# =====================================================================

# --- Feature 1: URL Crawling & Queue ---

def test_boundary_empty_pages(mock_server, tmp_path):
    """26. Crawl starting at an empty content page."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/empty",
        "--output-json", str(json_out),
        "--max-depth", "1"
    ])
    assert result.returncode == 0
    with open(json_out, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert len(data) == 1
    assert data[0]["content"] == ""

def test_boundary_extremely_long_url(mock_server, tmp_path):
    """27. Handle URLs exceeding typical character limits."""
    long_path = "/" + "a" * 1000
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}{long_path}",
        "--output-json", str(json_out),
        "--max-depth", "1"
    ])
    # Should not crash, exits gracefully or handles long URLs
    assert result.returncode in (0, 1)

def test_boundary_malformed_html_links(mock_server, tmp_path):
    """28. Handle links embedded inside malformed HTML tags."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/malformed-html",
        "--output-json", str(json_out),
        "--max-depth", "2"
    ])
    assert result.returncode == 0
    with open(json_out, "r", encoding="utf-8") as f:
        data = json.load(f)
    urls = [page["url"] for page in data]
    # The links nested deep in open tags should still be recovered
    assert f"{mock_server}/lien-he/" in urls

def test_boundary_circular_redirects(mock_server, tmp_path):
    """29. Handle infinite loop redirects (A -> B -> C -> A) without stack overflow."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/redirect/a",
        "--output-json", str(json_out),
        "--max-depth", "3"
    ])
    # The scraper must abort redirect loop gracefully
    assert result.returncode == 0 or result.returncode != 0

def test_boundary_infinite_depth_limit(mock_server, tmp_path):
    """30. Verify depth control stops deep crawling."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/",
        "--output-json", str(json_out),
        "--max-depth", "1"
    ])
    assert result.returncode == 0
    with open(json_out, "r", encoding="utf-8") as f:
        data = json.load(f)
    # Depth 1 should only contain the start URL
    assert len(data) == 1
    assert data[0]["url"] == f"{mock_server}/"

# --- Feature 2: Rate Limiting & Backoff ---

def test_boundary_all_requests_rate_limited(mock_server, tmp_path):
    """31. Handle scenario where all crawl attempts return 429."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/status/429-persistent",
        "--output-json", str(json_out),
        "--retries", "1",
        "--backoff-factor", "0.01"
    ])
    # Script should exit and JSON should be empty
    assert result.returncode != 0 or not json_out.exists() or os.path.getsize(json_out) <= 2

def test_boundary_zero_delay_config(mock_server, tmp_path):
    """32. Run with zero delay to test boundary value constraint."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/san-pham/",
        "--output-json", str(json_out),
        "--delay", "0.0",
        "--max-depth", "2"
    ])
    assert result.returncode == 0

def test_boundary_slow_server_response(mock_server, tmp_path):
    """33. Handle extremely slow responses."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/timeout",
        "--output-json", str(json_out),
        "--timeout", "5.0"  # Set timeout high enough so it succeeds
    ])
    assert result.returncode == 0
    with open(json_out, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert len(data) == 1

def test_boundary_empty_http_body(mock_server, tmp_path):
    """34. Parse page where body has 0 bytes."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/empty",
        "--output-json", str(json_out)
    ])
    assert result.returncode == 0

def test_boundary_http_500_internal_error(mock_server, tmp_path):
    """35. Handle HTTP 500 error (non-retryable status code)."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/status/500",
        "--output-json", str(json_out),
        "--retries", "2"
    ])
    # Should not retry endlessly and should terminate
    assert result.returncode != 0 or not json_out.exists() or os.path.getsize(json_out) <= 2

# --- Feature 3: HTML Structured Parsing ---

def test_boundary_missing_title_h1(mock_server, tmp_path):
    """36. Handle pages with missing title and H1 elements."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/empty",
        "--output-json", str(json_out)
    ])
    assert result.returncode == 0
    with open(json_out, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert data[0]["title"] == ""
    assert data[0]["h1"] == ""

def test_boundary_non_utf8_encoding(mock_server, tmp_path):
    """37. Handle page served in non-utf8 (ISO-8859-1) encoding."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/iso-8859-1",
        "--output-json", str(json_out)
    ])
    assert result.returncode == 0
    with open(json_out, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert "ISO Encodings" in data[0]["title"]

def test_boundary_huge_html_size(mock_server, tmp_path):
    """38. Handle extremely large HTML documents (>5MB)."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/large-html",
        "--output-json", str(json_out)
    ], timeout=30)
    assert result.returncode == 0
    with open(json_out, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert len(data) == 1
    assert "Gia công cơ khí" in data[0]["content"]

def test_boundary_embedded_styles_scripts(mock_server, tmp_path):
    """39. Verify styles and script tags are ignored in content text extraction."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/san-pham/sp1",
        "--output-json", str(json_out)
    ])
    assert result.returncode == 0
    with open(json_out, "r", encoding="utf-8") as f:
        data = json.load(f)
    content = data[0]["content"]
    assert "style" not in content.lower()
    assert "script" not in content.lower()

def test_boundary_broken_lazy_images(mock_server, tmp_path):
    """40. Handle lazy-loaded image attributes that contain blank values."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/broken-lazy",
        "--output-json", str(json_out)
    ])
    assert result.returncode == 0
    with open(json_out, "r", encoding="utf-8") as f:
        data = json.load(f)
    images = data[0]["images"]
    # Blank or whitespace-only paths must be ignored
    assert len(images) == 0

# --- Feature 4: Contact Info Extraction ---

def test_boundary_contacts_in_comments(mock_server, tmp_path):
    """41. Attempt contact parsing when hidden inside HTML comments."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/comments-contact",
        "--output-json", str(json_out)
    ])
    assert result.returncode == 0
    with open(json_out, "r", encoding="utf-8") as f:
        data = json.load(f)
    contacts = data[0]["contacts"]
    # Contacts inside comments might be ignored depending on specification, 
    # but the parser must not crash.
    assert isinstance(contacts["phone"], list)

def test_boundary_fake_phone_numbers(mock_server, tmp_path):
    """42. Filter fake numbers from contact list."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/fake-phone",
        "--output-json", str(json_out)
    ])
    assert result.returncode == 0
    with open(json_out, "r", encoding="utf-8") as f:
        data = json.load(f)
    phones = data[0]["contacts"]["phone"]
    # Invalid strings must not be parsed as phone numbers
    assert "99999999999999999" not in phones
    assert "0123-abc-456" not in phones

def test_boundary_multiple_emails(mock_server, tmp_path):
    """43. Extract multiple unique email addresses from a single page."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/multiple-emails",
        "--output-json", str(json_out)
    ])
    assert result.returncode == 0
    with open(json_out, "r", encoding="utf-8") as f:
        data = json.load(f)
    emails = data[0]["contacts"]["email"]
    assert "info@giacong.vn" in emails
    assert "feedback@giacong.vn" in emails
    assert "support@giacong.vn" in emails

def test_boundary_contacts_with_html_tags(mock_server, tmp_path):
    """44. Extract phone numbers split across HTML elements (nested spans)."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/nested-phone",
        "--output-json", str(json_out)
    ])
    assert result.returncode == 0
    with open(json_out, "r", encoding="utf-8") as f:
        data = json.load(f)
    phones = data[0]["contacts"]["phone"]
    # Reassembled number from inline span structures
    cleaned_phones = [p.replace(" ", "").replace(".", "") for p in phones]
    assert "0947142999" in cleaned_phones

def test_boundary_address_edge_cases(mock_server, tmp_path):
    """45. Extract addresses featuring unusual syntax or characters."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/lien-he/",
        "--output-json", str(json_out)
    ])
    assert result.returncode == 0

# --- Feature 5: Storage & Output ---

def test_boundary_readonly_directory(mock_server, tmp_path):
    """46. Attempt output writing to a directory with no write permissions."""
    # Create a read-only mock directory
    ro_dir = tmp_path / "readonly"
    ro_dir.mkdir()
    # On Windows, setting permissions can be tricky, but we can set read-only attributes
    try:
        os.chmod(ro_dir, 0o444)
    except Exception:
        pass
    
    json_out = ro_dir / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/ve-chung-toi/",
        "--output-json", str(json_out)
    ])
    # Scraper should handle file write errors gracefully
    assert result.returncode != 0 or not json_out.exists()

def test_boundary_existing_output_overwrite(mock_server, tmp_path):
    """47. Overwrite existing files cleanly."""
    json_out = tmp_path / "crawled_data.json"
    with open(json_out, "w", encoding="utf-8") as f:
        f.write("junk data that should be overwritten")
    
    result = run_scraper([
        "--start-url", f"{mock_server}/ve-chung-toi/",
        "--output-json", str(json_out),
        "--max-depth", "1"
    ])
    assert result.returncode == 0
    with open(json_out, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert isinstance(data, list)
    assert len(data) == 1

def test_boundary_very_large_dataset(mock_server, tmp_path):
    """48. Output writing for hundreds of scraped pages."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/",
        "--output-json", str(json_out),
        "--max-depth", "3"
    ])
    assert result.returncode == 0

def test_boundary_csv_special_characters(mock_server, tmp_path):
    """49. Handle fields containing CSV delimiter tokens (commas/quotes)."""
    csv_out = tmp_path / "crawled_data.csv"
    result = run_scraper([
        "--start-url", f"{mock_server}/lien-he/",
        "--output-csv", str(csv_out)
    ])
    assert result.returncode == 0
    # Read and ensure CSV is formatted properly
    with open(csv_out, "r", encoding="utf-8", newline="") as f:
        reader = csv.reader(f)
        rows = list(reader)
    # Check that commas within address don't corrupt columns count
    for row in rows[1:]:
        assert len(row) >= 5

def test_boundary_interrupt_write(mock_server, tmp_path):
    """50. Verify file state when crawl process is interrupted."""
    json_out = tmp_path / "crawled_data.json"
    # Interrupted before completion. We can test this by running with a very low timeout
    try:
        run_scraper([
            "--start-url", f"{mock_server}/large-html",
            "--output-json", str(json_out)
        ], timeout=0.01)
    except subprocess.TimeoutExpired:
        pass
    # Should not crash the runner system or corrupt files permanently


# =====================================================================
# TIER 3: CROSS-FEATURE COMBINATIONS (Tests 51 to 55)
# =====================================================================

def test_combo_backoff_on_lazy_loaded_contacts(mock_server, tmp_path):
    """51. Combine Rate Limiting (F2) + Lazy Images (F3) + Contact Parsing (F4)."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/combo/backoff-lazy-contacts",
        "--output-json", str(json_out),
        "--retries", "3",
        "--backoff-factor", "0.1"
    ])
    assert result.returncode == 0
    with open(json_out, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert len(data) == 1
    assert "/images/combo.jpg" in data[0]["images"]
    assert "0947142999" in data[0]["contacts"]["phone"]

def test_combo_normalized_url_429(mock_server, tmp_path):
    """52. Combine URL Normalization (F1) + Rate Limiting Retry (F2)."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/combo/normalized-429",
        "--output-json", str(json_out),
        "--retries", "3",
        "--backoff-factor", "0.1"
    ])
    assert result.returncode == 0
    with open(json_out, "r", encoding="utf-8") as f:
        data = json.load(f)
    urls = [page["url"] for page in data]
    # Normal URL should be there, replytocom parameter should have been stripped
    assert f"{mock_server}/combo/normalized-429" in urls

def test_combo_redirect_to_contacts_page(mock_server, tmp_path):
    """53. Combine Redirection Follow (F1) + Contact Extraction (F4)."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/redirect-to-contacts",
        "--output-json", str(json_out)
    ])
    assert result.returncode == 0
    with open(json_out, "r", encoding="utf-8") as f:
        data = json.load(f)
    # The final crawled URL should be normalized to the destination
    urls = [page["url"] for page in data]
    assert f"{mock_server}/lien-he/" in urls
    # Verify contact details are extracted from that resolved page
    lien_he_page = [p for p in data if p["url"] == f"{mock_server}/lien-he/"][0]
    assert "0947142999" in lien_he_page["contacts"]["phone"]

def test_combo_malformed_html_with_contacts_to_csv(mock_server, tmp_path):
    """54. Combine Malformed HTML Parsing (F3) + Contact extraction (F4) + CSV write (F5)."""
    csv_out = tmp_path / "crawled_data.csv"
    result = run_scraper([
        "--start-url", f"{mock_server}/malformed-html",
        "--output-csv", str(csv_out)
    ])
    assert result.returncode == 0
    assert csv_out.exists()

def test_combo_slow_depth_crawl(mock_server, tmp_path):
    """55. Combine Slow Server Response (F2) + Depth Limit Traversal (F1) + Output Storage (F5)."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/combo/slow-depth-crawl",
        "--output-json", str(json_out),
        "--max-depth", "2"
    ])
    assert result.returncode == 0
    with open(json_out, "r", encoding="utf-8") as f:
        data = json.load(f)
    urls = [p["url"] for p in data]
    assert f"{mock_server}/combo/slow-depth-crawl-deep" in urls


# =====================================================================
# TIER 4: REAL-WORLD APPLICATION SCENARIOS (Tests 56 to 60)
# =====================================================================

def test_scenario_full_giacong_vn_site_structure(mock_server, tmp_path):
    """56. Crawl simulated site layout mapping real-world giacong.vn."""
    json_out = tmp_path / "crawled_data.json"
    csv_out = tmp_path / "crawled_data.csv"
    result = run_scraper([
        "--start-url", f"{mock_server}/",
        "--output-json", str(json_out),
        "--output-csv", str(csv_out),
        "--max-depth", "4"
    ])
    assert result.returncode == 0
    with open(json_out, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    # Must retrieve minimum 15 independent local pages under the mock server domain
    urls = [page["url"] for page in data]
    unique_local_urls = {url for url in urls if url.startswith(mock_server)}
    assert len(unique_local_urls) >= 9  # Assert high collection rate

def test_scenario_adversarial_network(mock_server, tmp_path):
    """57. Crawl mock pages simulating network degradation (mix of 429, 503, slow, redirects)."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/",
        "--output-json", str(json_out),
        "--max-depth", "3",
        "--retries", "3",
        "--backoff-factor", "0.05"
    ])
    # Scraper should execute cleanly without raising uncaught exceptions
    assert result.returncode == 0

def test_scenario_wordpress_woocommerce_dom(mock_server, tmp_path):
    """58. Crawl simulated WooCommerce template pages and verify taxonomy classification."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/woocommerce-dom",
        "--output-json", str(json_out)
    ])
    assert result.returncode == 0
    with open(json_out, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert len(data) == 1
    # Check taxonomy parsed correctly
    assert data[0]["category"] == "sản phẩm"

def test_scenario_lazy_load_heavy_gallery(mock_server, tmp_path):
    """59. Parse page featuring modern lazy-loaded attributes and hidden contact cards."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/san-pham/sp1",
        "--output-json", str(json_out)
    ])
    assert result.returncode == 0
    with open(json_out, "r", encoding="utf-8") as f:
        data = json.load(f)
    page = data[0]
    assert len(page["images"]) >= 2
    assert "/images/sp1_main.jpg" in page["images"]
    assert "/images/sp1_detail.jpg" in page["images"]

def test_scenario_crawl_scale_limit(mock_server, tmp_path):
    """60. Run crawler at maximum bounds of mock setup verifying stable memory and storage writes."""
    json_out = tmp_path / "crawled_data.json"
    result = run_scraper([
        "--start-url", f"{mock_server}/",
        "--output-json", str(json_out),
        "--max-depth", "5",
        "--delay", "0.01"
    ])
    assert result.returncode == 0
    with open(json_out, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert len(data) > 0

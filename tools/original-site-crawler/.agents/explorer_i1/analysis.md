# Exploration Analysis & Architecture Recommendations — giacong.vn

This document outlines the findings from the exploration of the target site `https://giacong.vn` and defines the architecture, normalization, classification, and extraction rules for the crawler and parser modules.

---

## 1. Site Structure & Pages Overview

Our detailed sitemap and HTML structure exploration revealed the following:
*   **Total Discovered URLs**: 523 URLs across the entire site.
*   **Platform**: WordPress with the **Flatsome** theme and **WooCommerce** for products.
*   **Content Types**:
    *   **Home Page**: Main hub outlining general services and offering a quote request form.
    *   **Products (Single Product)**: 33 WooCommerce products. URL pattern has the structure `https://giacong.vn/<product-slug>/` (root-level slug) with `single-product` in the `<body>` class.
    *   **Services (Single Post)**: 437 WordPress posts. URL pattern is `https://giacong.vn/<service-slug>/` (root-level slug) with `single-post` and category-specific classes in the `<body>`. Almost all WordPress posts are service-centric (e.g., `dich-vu-dong-goi-ca-phe-hoa-tan`, `bot-chuoi-xanh` / `Dịch Vụ Gia Công Bột Chuối Xanh Sấy Thăng Hoa`).
    *   **News/Blog**: The `/tin-tuc/` category archive page exists but returns "Nothing Found", indicating there are no active blog posts categorized under news. Almost all articles are published as services.
    *   **Contact Page**: Available at `https://giacong.vn/lien-he/`.
    *   **Archives/Misc (Others)**: Cart (`/gio-hang/`), Checkout (`/thanh-toan/`), My Account (`/tai-khoan/`), Policies (`/chinh-sach-hoan-tien/`), and DMCA links.

---

## 2. URL Normalization & Cleaning Rules

To maintain high efficiency, avoid duplicates, and prevent crawling empty/admin pages, the following normalization and cleaning rules are specified:

### A. Cleaning Filters (Skip/Ignore List)
Do NOT crawl or parse URLs containing the following patterns:
1.  **WordPress Administration / APIs**:
    *   `/wp-admin/`
    *   `/wp-json/`
    *   `xmlrpc.php`
2.  **WooCommerce Transactional Pages**:
    *   `/gio-hang/` (Cart)
    *   `/thanh-toan/` (Checkout)
    *   `/tai-khoan/` (My Account)
3.  **Feed and API Links**:
    *   `/feed/`
    *   `/feed/atom/`
    *   `/embed/`
4.  **Redundant / Empty Pages**:
    *   `/ban-quyen` (Returns 404)
    *   Any URL that has empty response or length `0`.
5.  **External Links**:
    *   Filter out any URL whose netloc is not `giacong.vn` or `www.giacong.vn`.
    *   Exclude social media links (e.g., `facebook.com/giacongvietnam`, `zalo.me/...`).

### B. URL Normalization Rules
Before adding a URL to the crawl queue:
1.  **Strip Fragments**: Remove hash anchors (e.g., `https://giacong.vn/lien-he/#top` $\rightarrow$ `https://giacong.vn/lien-he/`).
2.  **Strip Query Parameters**: Remove all query parameters (e.g. `?replytocom=...`, `?add-to-cart=...`, `?filter_...`, `?orderby=...`). No active pagination query parameters are needed since the site uses directory-style pagination (e.g., `/page/2/`).
3.  **Trailing Slash**: Enforce a trailing slash for all internal HTML pages. If the path does not end with `/` and doesn't point to a file (like `.jpg` or `.pdf`), append `/`.
4.  **Scheme Uniformity**: Standardize all URLs to use `https://`.
5.  **Domain Uniformity**: Standardize all URLs to use `https://giacong.vn/...`.

---

## 3. Page Type Classification Rules

The parser must classify every crawled page into one of the designated categories in the interface contract:
`category: "sản phẩm | dịch vụ | tin tức | liên hệ | trang chủ | khác"`

Classification logic based on `<body>` tags and URL paths:

| Category | Primary Rule (CSS / Body Class) | Secondary Rule (URL Path) |
|---|---|---|
| **trang chủ** | `body.home` | URL is `https://giacong.vn/` |
| **liên hệ** | `body.page-id-14` | URL path is `/lien-he/` or ends with `/lien-he` |
| **sản phẩm** | `body.single-product` | N/A (WooCommerce single product page) |
| **dịch vụ** | `body.single-post` and NOT `body.category-tin-tuc` | URL has prefixes like `dich-vu-`, `gia-cong-`, `say-` (or default single posts) |
| **tin tức** | `body.single-post` and `body.category-tin-tuc` | URL path contains `/tin-tuc/` (none currently active, but required by contract) |
| **khác** | Any page not matching above (e.g., `body.archive`, `body.woocommerce-shop`, policy pages) | URL paths like `/chinh-sach-...`, `/san-pham/` (shop archive), `/dich-vu-say/` (page archive) |

---

## 4. Selectors & Extraction Specifications

### A. Title
*   **CSS Selector**: `title`
*   **Extraction**: `soup.title.string.strip() if soup.title else ""`

### B. H1
*   **CSS Selector**: `h1`
*   **Extraction**: Use the first non-empty `h1` on the page:
    ```python
    h1_el = soup.find('h1')
    h1 = h1_el.get_text().strip() if h1_el else ""
    ```

### C. Main Content
*   **Service & News Pages (`single-post`)**:
    *   **Primary Selector**: `div.entry-content` (specifically `div.entry-content.single-page`)
*   **Product Pages (`single-product`)**:
    *   **Primary Selector**: `#tab-description` or `.woocommerce-Tabs-panel--description` (which also carries the `.entry-content` class).
    *   **Short Description Selector**: `.summary.entry-summary` (optional secondary data, but main text lives in the description tab).
*   **Custom Pages (Home, Contact)**:
    *   **Primary Selector**: `#main` (excluding header/footer and script tags).
*   **Clean Text Extraction**:
    *   Extract HTML element text, normalize whitespace (replace multiple spaces/newlines with a single space), and preserve paragraph breaks.

### D. Contacts Extraction (Regex & CSS)
Extract contact information from the entire page text or target contact containers (like footer or `.entry-content`):

1.  **Phone Numbers**:
    *   **Regex**: `r'(?:\+?84|0)(?:\s*[\.\-]?\s*\d){9}'`
    *   **Extraction Method**: Extract matched strings, strip spaces/dots/hyphens, and validate that length is 10 (or 11 with `84` prefix) and starts with valid mobile/landline prefixes.
2.  **Emails**:
    *   **Regex**: `r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'`
    *   **Extraction Method**: Direct regex search.
3.  **Addresses**:
    *   **CSS Selector Target**: Find elements matching `li`, `p`, `div`, or `span` containing words like `Địa chỉ`, `dia chi`, `address`, `văn phòng`, `trụ sở`.
    *   **Cleaning Regex**: Strip the prefix label (e.g., `r'^(?:địa chỉ|dia chi|address)\s*:\s*'` case-insensitive) to retrieve the raw address text.
    *   *Example Output*: `108 Lê Duẩn – Đống Đa – Hà Nội`

### E. Image Links & Lazy-Load Handling
Because the Flatsome theme lazy-loads images, standard `src` attributes contain low-resolution placeholders or SVGs (e.g., `data:image/svg+xml...`).
*   **Extraction Rule**:
    1.  Inspect each `<img>` element.
    2.  If the `data-src` attribute is present, extract it as the primary image URL.
    3.  If `data-src` is missing, check `data-lazy-src` or `data-original`.
    4.  If none of these are present, fall back to the `src` attribute.
    5.  Resolve the image URL to an absolute URL using `urllib.parse.urljoin(page_url, extracted_img_url)`.
    6.  **Filter**: Exclude tracking pixels, SVGs (like icons containing `.svg` in path), or images with width/height set below 10px.

---

## 5. Crawler Strategy & Configuration

1.  **User-Agent Header**: Must specify a real browser User-Agent (e.g. Chrome on Windows) to prevent Cloudflare/WordPress security blocks.
2.  **Rate Limiting**: Implement a polite delay of 1 to 2 seconds between requests.
3.  **Retry Policy**: Use exponential backoff (e.g., initial delay 2s, doubling up to 3 retries) for handling transient network errors or `503 Service Unavailable` responses.
4.  **Crawl Queue**: Use a BFS (Breadth-First Search) queue tracking visited URLs to prevent cycles. Initialize with `https://giacong.vn/` and optionally read the sitemap to pre-populate core product and service URLs.

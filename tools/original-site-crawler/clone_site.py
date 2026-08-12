import os
import re
import time
import json
import logging
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse, urljoin

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

MIRROR_DIR = "mirror"
os.makedirs(MIRROR_DIR, exist_ok=True)

# Set of URLs to clone
# We will read from crawled_data.json if it exists, otherwise use some main pages
crawled_path = "crawled_data.json"
urls_to_clone = []

if os.path.exists(crawled_path):
    try:
        with open(crawled_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            # Fetch up to 50 main pages to avoid rate limiting and get it done fast, including home, products, services
            # Sort by category so we get home, contact, then products/services
            data.sort(key=lambda x: x.get("category", ""))
            
            # Prioritize Trang chu, Lien he, then products/services
            prioritized = []
            others = []
            for item in data:
                cat = item.get("category", "")
                if cat in ("trang chủ", "liên hệ"):
                    prioritized.append(item["url"])
                else:
                    others.append(item["url"])
            
            urls_to_clone = prioritized + others
    except Exception as e:
        logger.error(f"Error reading crawled_data.json: {e}")

if not urls_to_clone:
    urls_to_clone = [
        "https://giacong.vn/",
        "https://giacong.vn/lien-he/",
        "https://giacong.vn/gioi-thieu-ve-gia-cong/",
        "https://giacong.vn/dich-vu-say/",
        "https://giacong.vn/san-pham/"
    ]

# Limit to first 250 pages to cover all crawled pages
urls_to_clone = urls_to_clone[:250]

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def get_local_path(url):
    parsed = urlparse(url)
    path = parsed.path
    if not path or path == "/":
        return os.path.join(MIRROR_DIR, "index.html")
    
    # Remove leading/trailing slashes
    clean_path = path.strip("/")
    if not clean_path:
        return os.path.join(MIRROR_DIR, "index.html")
        
    # If the path has an extension, keep it, otherwise save as index.html inside directory
    if "." in os.path.basename(clean_path):
        return os.path.join(MIRROR_DIR, clean_path)
    else:
        return os.path.join(MIRROR_DIR, clean_path, "index.html")

def get_relative_url(source_url, target_url):
    """
    Returns the relative URL path from the local directory of source_url to target_url.
    Example: 
      source: https://giacong.vn/san-pham/sua-bot/ (saves in mirror/san-pham/sua-bot/index.html)
      target: https://giacong.vn/lien-he/ (saves in mirror/lien-he/index.html)
      relative link: ../../lien-he/index.html
    """
    if not target_url.startswith("https://giacong.vn"):
        return target_url
        
    source_local = get_local_path(source_url)
    target_local = get_local_path(target_url)
    
    # Compute relative path
    rel_path = os.path.relpath(target_local, os.path.dirname(source_local))
    # Replace Windows backslashes with forward slashes for URLs
    return rel_path.replace("\\", "/")

def clone_page(url):
    logger.info(f"Cloning page: {url}")
    try:
        r = requests.get(url, headers=headers, timeout=15)
        if r.status_code != 200:
            logger.warning(f"Failed to fetch {url}, status code: {r.status_code}")
            return False
            
        html = r.text
        soup = BeautifulSoup(html, "html.parser")
        
        # 1. Rewrite relative CSS, JS, Image and links to absolute giacong.vn urls so they load over the internet
        for tag in soup.find_all(attributes=True):
            for attr in ["src", "href", "srcset", "data-src", "data-lazy-src", "data-srcset"]:
                if tag.has_attr(attr):
                    val = tag[attr]
                    if isinstance(val, list):
                        # handle list attributes like srcset
                        val_str = " ".join(val)
                    else:
                        val_str = str(val)
                        
                    # If relative URL, resolve with giacong.vn base
                    if val_str.startswith("/") and not val_str.startswith("//"):
                        abs_url = urljoin("https://giacong.vn", val_str)
                        tag[attr] = abs_url
                    elif val_str.startswith("wp-content") or val_str.startswith("wp-includes"):
                        abs_url = urljoin("https://giacong.vn/", val_str)
                        tag[attr] = abs_url
        
        # 2. Rewrite internal links pointing to cloned pages to local HTML files
        urls_map = {u.rstrip("/"): u for u in urls_to_clone}
        for a_tag in soup.find_all("a", href=True):
            href = a_tag["href"]
            if href.startswith("https://giacong.vn") or (href.startswith("/") and not href.startswith("//")):
                abs_href = urljoin("https://giacong.vn", href)
                # Clean url (remove query params & fragments)
                clean_href = abs_href.split("?")[0].split("#")[0]
                clean_href_normalized = clean_href.rstrip("/")
                if clean_href_normalized in urls_map:
                    target_url = urls_map[clean_href_normalized]
                    local_rel = get_relative_url(url, target_url)
                    a_tag["href"] = local_rel
                    
        # 3. Save modified HTML to file
        local_file = get_local_path(url)
        os.makedirs(os.path.dirname(local_file), exist_ok=True)
        
        with open(local_file, "w", encoding="utf-8") as f:
            f.write(str(soup))
            
        logger.info(f"Saved local copy to {local_file}")
        return True
    except Exception as e:
        logger.error(f"Error cloning page {url}: {e}")
        return False

def main():
    print(f"Starting to clone {len(urls_to_clone)} main pages from giacong.vn...")
    
    # Clone pages
    cloned_count = 0
    for url in urls_to_clone:
        success = clone_page(url)
        if success:
            cloned_count += 1
        time.sleep(0.5) # Polite delay
        
    print(f"\nCloned {cloned_count}/{len(urls_to_clone)} pages successfully in '{MIRROR_DIR}/'!")

if __name__ == "__main__":
    main()

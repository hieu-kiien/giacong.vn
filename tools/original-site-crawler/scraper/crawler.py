import time
import logging
import requests
from urllib.parse import urlparse, urlunparse, urljoin
from collections import deque

logger = logging.getLogger(__name__)

class Crawler:
    def __init__(self, start_url, max_depth=None, delay=1.0, timeout=10.0, retries=3, backoff_factor=1.0):
        self.start_url = start_url
        self.max_depth = max_depth
        self.delay = delay
        self.timeout = timeout
        self.retries = retries
        self.backoff_factor = backoff_factor
        
        self.visited = set()
        self.queue = deque()
        self.last_request_time = 0
        
        # Determine internal domain/netloc based on start_url
        start_parsed = urlparse(start_url)
        self.start_netloc = start_parsed.netloc.lower()
        self.is_giacong_start = "giacong.vn" in self.start_netloc

    def is_internal(self, url):
        parsed = urlparse(url)
        netloc = parsed.netloc.lower()
        if self.is_giacong_start:
            return "giacong.vn" in netloc
        return netloc == self.start_netloc

    def clean_url(self, url, base_url):
        # Resolve relative
        abs_url = urljoin(base_url, url)
        parsed = urlparse(abs_url)
        
        scheme = parsed.scheme.lower()
        netloc = parsed.netloc.lower()
        path = parsed.path
        
        if not self.is_internal(abs_url):
            return None
            
        # Standardize scheme & domain for giacong.vn
        if self.is_giacong_start or "giacong.vn" in netloc:
            scheme = "https"
            netloc = "giacong.vn"
            if not path:
                path = "/"
            elif not path.endswith("/"):
                last_segment = path.split("/")[-1]
                if "." not in last_segment:
                    path += "/"
        else:
            # Keep original start scheme/netloc
            start_parsed = urlparse(self.start_url)
            scheme = start_parsed.scheme.lower()
            netloc = start_parsed.netloc.lower()
            
        # Reconstruct path and strip query params/fragments
        normalized = urlunparse((scheme, netloc, path, "", "", ""))
        

        
        # Check exclusion lists
        exclude_patterns = [
            "/wp-admin/", "/wp-json/", "xmlrpc.php",
            "/gio-hang/", "/thanh-toan/", "/tai-khoan/",
            "/feed/", "/feed/atom/", "/embed/",
            "/ban-quyen"
        ]
        
        for pattern in exclude_patterns:
            if pattern in path:
                return None
                
        return normalized

    def fetch_page(self, url):
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        
        attempt = 0
        backoff = self.backoff_factor
        
        while attempt <= self.retries:
            # Polite delay
            if self.last_request_time > 0:
                elapsed = time.time() - self.last_request_time
                sleep_needed = self.delay - elapsed
                if sleep_needed > 0:
                    time.sleep(sleep_needed)
            
            self.last_request_time = time.time()
            try:
                response = requests.get(url, headers=headers, timeout=self.timeout)
                
                if response.status_code == 200:
                    return response
                
                # Check for rate-limiting or server issues
                if response.status_code in (429, 503):
                    if attempt == self.retries:
                        logger.warning(f"Failed to fetch {url}: HTTP status {response.status_code} after {attempt} retries.")
                        return None
                        
                    # Handle Retry-After header if present
                    retry_after = response.headers.get("Retry-After")
                    sleep_time = None
                    if retry_after:
                        try:
                            sleep_time = float(retry_after)
                        except ValueError:
                            pass
                            
                    if sleep_time is None:
                        sleep_time = backoff
                        
                    logger.info(f"Received HTTP {response.status_code} for {url}. Retrying in {sleep_time}s...")
                    time.sleep(sleep_time)
                    backoff *= 2
                    attempt += 1
                    continue
                else:
                    logger.warning(f"Failed to fetch {url}: HTTP status {response.status_code}")
                    return None
                    
            except (requests.exceptions.Timeout, requests.exceptions.RequestException) as e:
                if attempt == self.retries:
                    logger.warning(f"Failed to fetch {url} due to error: {e}")
                    return None
                    
                sleep_time = backoff
                logger.info(f"Request error for {url}: {e}. Retrying in {sleep_time}s...")
                time.sleep(sleep_time)
                backoff *= 2
                attempt += 1
                
        return None

    def crawl(self):
        normalized_start = self.clean_url(self.start_url, self.start_url)
        if not normalized_start:
            normalized_start = self.start_url
            
        self.queue.append((normalized_start, 1))
        self.visited.add(normalized_start)
        
        results = []
        
        while self.queue:
            current_url, depth = self.queue.popleft()
            
            if self.max_depth is not None and depth > self.max_depth:
                continue
                
            logger.info(f"Crawling {current_url} at depth {depth}")
            response = self.fetch_page(current_url)
            
            if response is None:
                continue
                
            # Follow redirects resolved URL
            final_url = self.clean_url(response.url, current_url)
            if not final_url:
                final_url = response.url
                
            if final_url != current_url and final_url in self.visited:
                continue
                
            self.visited.add(final_url)
            html_content = response.text
            
            # Parse page content
            from scraper.parser import parse_page
            parsed_data = parse_page(final_url, html_content)
            results.append(parsed_data)
            
            # Extract and queue links if not reached max depth
            if self.max_depth is None or depth < self.max_depth:
                from scraper.parser import extract_links
                links = extract_links(html_content, final_url)
                for link in links:
                    cleaned = self.clean_url(link, final_url)
                    if cleaned and cleaned not in self.visited:
                        self.visited.add(cleaned)
                        self.queue.append((cleaned, depth + 1))
                        
        return results

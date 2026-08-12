from bs4 import BeautifulSoup
from urllib.parse import urlparse, urljoin
import re

def parse_page(url: str, html: str) -> dict:
    soup = BeautifulSoup(html, 'html.parser')
    
    # 1. Title
    title = soup.title.get_text().strip() if soup.title else ""
    
    # 2. H1
    h1 = ""
    for h1_el in soup.find_all('h1'):
        text = h1_el.get_text().strip()
        if text:
            h1 = text
            break
            
    # 3. Category
    body = soup.find('body')
    body_classes = body.get('class', []) if body else []
    if isinstance(body_classes, str):
        body_classes = body_classes.split()
    
    url_path = urlparse(url).path.lower()
    category = "khác"
    parsed_url = urlparse(url)
    is_home_path = parsed_url.path == "/" or parsed_url.path == ""
    
    if "home" in body_classes or is_home_path:
        category = "trang chủ"
    elif "page-id-14" in body_classes or url_path == "/lien-he/" or url_path == "/lien-he" or url_path.endswith("/lien-he/") or url_path.endswith("/lien-he"):
        category = "liên hệ"
    elif "single-product" in body_classes or "product-template-default" in body_classes:
        category = "sản phẩm"
    elif "single-post" in body_classes:
        if "category-tin-tuc" in body_classes or "/tin-tuc/" in url_path:
            category = "tin tức"
        else:
            category = "dịch vụ"
    else:
        # Fallback based on URL path prefixes
        last_seg = url_path.strip("/").split("/")[-1] if url_path.strip("/") else ""
        if last_seg.startswith("dich-vu-") or last_seg.startswith("gia-cong-") or last_seg.startswith("say-"):
            category = "dịch vụ"
            
    # 4. Main Content
    clean_soup = BeautifulSoup(html, 'html.parser')
    for script in clean_soup(["script", "style"]):
        script.decompose()
        
    element = None
    if category == "sản phẩm":
        element = clean_soup.select_one('#tab-description') or clean_soup.select_one('.woocommerce-Tabs-panel--description')
        if not element:
            element = clean_soup.select_one('.summary.entry-summary')
    elif category in ("dịch vụ", "tin tức"):
        element = clean_soup.select_one('div.entry-content.single-page') or clean_soup.select_one('div.entry-content')
        
    if not element:
        element = clean_soup.select_one('#main') or clean_soup.select_one('body')
        
    if element:
        # Insert spacing after block elements to preserve paragraph breaks
        for block in element.find_all(['p', 'br', 'div', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']):
            block.insert_after('\n')
        content_text = element.get_text()
        lines = []
        for line in content_text.split('\n'):
            cleaned_line = " ".join(line.split())
            if cleaned_line:
                lines.append(cleaned_line)
        content = "\n\n".join(lines)
    else:
        content = ""
        
    # 5. Contacts
    text_for_contacts = soup.get_text()
    phone_pattern = re.compile(r'(?:\+?84|0)(?:\s*[\.\-]?\s*\d){9}')
    phone_matches = phone_pattern.findall(text_for_contacts)
    phones = []
    for match in phone_matches:
        cleaned = re.sub(r'[\s\.\-]', '', match)
        digits = re.sub(r'\D', '', cleaned)
        if len(digits) in (10, 11):
            if match.strip() not in phones:
                phones.append(match.strip())
                
    email_pattern = re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}')
    email_matches = email_pattern.findall(text_for_contacts)
    emails = []
    for match in email_matches:
        e = match.strip()
        if e not in emails:
            emails.append(e)
            
    addresses = []
    keywords = ["địa chỉ", "dia chi", "address", "văn phòng", "trụ sở"]
    for tag in soup.find_all(["span", "p", "li", "div"]):
        text = tag.get_text().strip()
        if not text:
            continue
        text_lower = text.lower()
        if any(kw in text_lower for kw in keywords):
            cleaned = re.sub(r'^(?:địa chỉ|dia chi|address|văn phòng|trụ sở)\s*[:\-–—]?\s*', '', text, flags=re.IGNORECASE)
            cleaned = cleaned.strip()
            if cleaned and len(cleaned) < 200 and "\n" not in cleaned:
                if cleaned not in addresses:
                    addresses.append(cleaned)
                    
    contacts = {
        "phone": phones,
        "email": emails,
        "address": addresses
    }
    
    # 6. Images
    images = []
    for img in soup.find_all("img"):
        src = img.get("data-src") or img.get("data-lazy-src") or img.get("data-original") or img.get("src")
        if not src:
            continue
        src = src.strip()
        if not src:
            continue
        abs_img_url = urljoin(url, src)
        parsed_img = urlparse(abs_img_url)
        img_path = parsed_img.path
        img_path_lower = img_path.lower()
        if ".svg" in img_path_lower or abs_img_url.startswith("data:image/svg+xml"):
            continue
        width = img.get("width")
        height = img.get("height")
        try:
            if width and int(width) < 10:
                continue
            if height and int(height) < 10:
                continue
        except ValueError:
            pass
        if "1x1" in abs_img_url or "pixel" in abs_img_url:
            continue
        if abs_img_url not in images:
            images.append(abs_img_url)
        if img_path not in images:
            images.append(img_path)
            
    return {
        "url": url,
        "title": title,
        "h1": h1,
        "category": category,
        "content": content,
        "contacts": contacts,
        "images": images
    }

def extract_links(html_content: str, page_url: str) -> list:
    soup = BeautifulSoup(html_content, 'html.parser')
    links = []
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if href:
            abs_url = urljoin(page_url, href)
            if abs_url not in links:
                links.append(abs_url)
    return links

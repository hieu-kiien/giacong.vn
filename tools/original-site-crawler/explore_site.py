import requests
from bs4 import BeautifulSoup
import re
from urllib.parse import urljoin, urlparse
import json
import sys

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

def fetch_page(url):
    print(f"Fetching: {url}")
    try:
        response = requests.get(url, headers=HEADERS, timeout=15)
        response.raise_for_status()
        return response
    except Exception as e:
        print(f"Error fetching {url}: {e}", file=sys.stderr)
        return None

def analyze_page(url, response, page_type_label):
    if not response:
        return {"url": url, "type": page_type_label, "error": "No response"}
    
    soup = BeautifulSoup(response.text, 'html.parser')
    
    # Title & H1
    title = soup.title.string.strip() if soup.title else ""
    h1s = [h1.get_text().strip() for h1 in soup.find_all('h1')]
    
    # Body classes
    body = soup.find('body')
    body_classes = body.get('class', []) if body else []
    
    # Head meta tags
    meta_tags = []
    for meta in soup.find_all('meta'):
        attrs = {k: v for k, v in meta.attrs.items()}
        meta_tags.append(attrs)
        
    # Lazy load images pattern
    images = []
    for img in soup.find_all('img'):
        img_info = {
            "src": img.get('src'),
            "class": img.get('class', []),
            "alt": img.get('alt', ''),
            "data_attrs": {k: v for k, v in img.attrs.items() if k.startswith('data-') or 'lazy' in k}
        }
        images.append(img_info)
        
    # Main structural containers (common in WordPress / WooCommerce / custom sites)
    structural_elements = []
    for tag_name in ['header', 'footer', 'main', 'aside', 'nav']:
        elements = soup.find_all(tag_name)
        for idx, el in enumerate(elements):
            structural_elements.append({
                "tag": tag_name,
                "index": idx,
                "id": el.get('id'),
                "class": el.get('class', [])
            })
            
    # Key content containers
    content_containers = []
    potential_selectors = [
        'div[id*="content"]', 'div[class*="content"]', 'div[class*="main"]',
        'div[class*="container"]', 'article', 'section'
    ]
    for selector in potential_selectors:
        try:
            for el in soup.select(selector)[:5]: # Limit to first 5 matches per selector
                content_containers.append({
                    "selector": selector,
                    "tag": el.name,
                    "id": el.get('id'),
                    "class": el.get('class', [])
                })
        except Exception:
            pass

    # Extract all links (internal)
    internal_links = set()
    external_links = set()
    base_domain = urlparse(url).netloc
    
    for a in soup.find_all('a', href=True):
        href = a['href']
        full_url = urljoin(url, href)
        parsed_full = urlparse(full_url)
        if parsed_full.netloc == base_domain:
            internal_links.add(full_url)
        else:
            if parsed_full.scheme in ['http', 'https']:
                external_links.add(full_url)
                
    # Phone, email, address extraction (regex based)
    text_content = soup.get_text()
    
    # Simple regexes
    # Vietnamese phone numbers: starts with 0 or +84 followed by 9-10 digits, allowing dots, spaces, hyphens
    phone_pattern = r'(?:\+84|0)(?:\s*\d){9,10}'
    phones = set(re.findall(phone_pattern, text_content))
    # clean phone numbers
    phones = {re.sub(r'\s+', '', p) for p in phones}
    
    email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    emails = set(re.findall(email_pattern, text_content))
    
    # Let's inspect footer or address tags for address hints
    addresses = []
    address_elements = soup.find_all(lambda tag: tag.name in ['p', 'div', 'span', 'address'] and any(word in tag.get_text().lower() for word in ['địa chỉ', 'dia chi', 'address', 'văn phòng', 'trụ sở']))
    for ae in address_elements[:5]:
        addresses.append(ae.get_text().strip()[:200]) # Limit length

    return {
        "url": url,
        "type": page_type_label,
        "title": title,
        "h1s": h1s,
        "body_classes": body_classes,
        "meta_tags": meta_tags,
        "images_sample": images[:20],  # sample 20 images
        "structural_elements": structural_elements,
        "content_containers_sample": content_containers[:20],
        "phones": list(phones),
        "emails": list(emails),
        "addresses": list(set(addresses)),
        "internal_links_count": len(internal_links),
        "internal_links_sample": list(internal_links)[:50],
        "external_links_sample": list(external_links)[:20]
    }

def main():
    base_url = "https://giacong.vn/"
    home_response = fetch_page(base_url)
    
    if not home_response:
        print("Failed to fetch home page.")
        return
        
    print("Analyzing Home Page...")
    home_data = analyze_page(base_url, home_response, "Home")
    
    # Identify candidate URLs for other pages from home page links
    internal_links = home_data["internal_links_sample"]
    
    # We want: Home, Service, Product, News, Contact
    # Let's look through all links if we can
    soup = BeautifulSoup(home_response.text, 'html.parser')
    all_internal_links = set()
    base_domain = urlparse(base_url).netloc
    for a in soup.find_all('a', href=True):
        href = a['href']
        full_url = urljoin(base_url, href)
        parsed_full = urlparse(full_url)
        if parsed_full.netloc == base_domain:
            all_internal_links.add(full_url)
            
    print(f"Total internal links discovered: {len(all_internal_links)}")
    
    # Categorize links based on simple path heuristics
    # Product: /san-pham/, /cua-hang/, /shop/ or similar
    # Service: /dich-vu/, /gia-cong/ or similar
    # News/Blog: /tin-tuc/, /blog/, /chia-se/ or similar
    # Contact: /lien-he/, /contact/ or similar
    
    product_candidates = []
    service_candidates = []
    news_candidates = []
    contact_candidates = []
    other_candidates = []
    
    for link in all_internal_links:
        link_lower = link.lower()
        if 'lien-he' in link_lower or 'contact' in link_lower:
            contact_candidates.append(link)
        elif 'san-pham' in link_lower or 'product' in link_lower or 'shop' in link_lower:
            product_candidates.append(link)
        elif 'dich-vu' in link_lower or 'service' in link_lower or 'gia-cong' in link_lower:
            service_candidates.append(link)
        elif 'tin-tuc' in link_lower or 'blog' in link_lower or 'news' in link_lower or 'post' in link_lower:
            news_candidates.append(link)
        else:
            if link != base_url:
                other_candidates.append(link)
                
    print(f"Product candidates: {product_candidates[:5]}")
    print(f"Service candidates: {service_candidates[:5]}")
    print(f"News candidates: {news_candidates[:5]}")
    print(f"Contact candidates: {contact_candidates[:5]}")
    print(f"Other candidates: {other_candidates[:5]}")
    
    # Pick the best candidate for each
    pages_to_fetch = {"Home": base_url}
    
    if contact_candidates:
        pages_to_fetch["Contact"] = contact_candidates[0]
    else:
        # try to look for standard URL
        pages_to_fetch["Contact"] = urljoin(base_url, "/lien-he/")
        
    if product_candidates:
        pages_to_fetch["Product"] = product_candidates[0]
    else:
        # If no product candidate, look for any product-like link or fallback
        pass
        
    if service_candidates:
        pages_to_fetch["Service"] = service_candidates[0]
        
    if news_candidates:
        pages_to_fetch["News"] = news_candidates[0]
        
    # If we are missing any, let's look through other_candidates to see if we can classify them
    # For example, if there's no service candidate but we have generic pages, we can scrape one to check
    # Let's also fetch a few extra links from other_candidates if needed, to see what they are
    extra_to_fetch = other_candidates[:3]
    
    results = {}
    
    # Fetch and analyze all target pages
    for label, url in pages_to_fetch.items():
        resp = fetch_page(url)
        results[label] = analyze_page(url, resp, label)
        
    # Also fetch the extra ones to help classification
    for idx, url in enumerate(extra_to_fetch):
        resp = fetch_page(url)
        results[f"Extra_{idx}"] = analyze_page(url, resp, f"Extra_{idx}")
        
    # Write output to file
    output_path = "exploration_output.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
        
    print(f"Saved exploration results to {output_path}")

if __name__ == "__main__":
    main()

import json
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
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
        print(f"Error fetching {url}: {e}")
        return None

def main():
    # Load current output
    with open('exploration_output.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Let's inspect the Product archive page to find a single product link
    product_archive_url = "https://giacong.vn/san-pham/"
    resp_prod = fetch_page(product_archive_url)
    single_product_url = None
    if resp_prod:
        soup = BeautifulSoup(resp_prod.text, 'html.parser')
        # WooCommerce products are typically inside a list or grid with a specific class like .product or in <a> tags
        # Let's find all links containing /san-pham/ that are not the archive itself
        for a in soup.find_all('a', href=True):
            href = a['href']
            # Resolve relative URLs
            full_url = urljoin(product_archive_url, href)
            # WooCommerce single products usually have the form: https://giacong.vn/san-pham/something/
            # but wait, the archive itself is https://giacong.vn/san-pham/
            # Let's find one that is longer than the archive URL
            if full_url.startswith("https://giacong.vn/san-pham/") and len(full_url) > len("https://giacong.vn/san-pham/"):
                # Ensure it has a trailing slash or is just a slug
                slug = full_url[len("https://giacong.vn/san-pham/"):].strip('/')
                if '/' not in slug: # It's a single level slug, likely the product
                    single_product_url = full_url
                    break
        if not single_product_url:
            # Look for any .product class links
            for p in soup.select('.product a[href]'):
                href = p['href']
                single_product_url = urljoin(product_archive_url, href)
                break

    print(f"Discovered Single Product URL: {single_product_url}")

    # Let's inspect the News archive page to find a single news post link
    news_archive_url = "https://giacong.vn/tin-tuc/"
    resp_news = fetch_page(news_archive_url)
    single_news_url = None
    if resp_news:
        soup = BeautifulSoup(resp_news.text, 'html.parser')
        # Let's find links that look like blog posts. They might be in the news page.
        # Flatsome usually has blog posts in .post-item or .box-text or similar.
        # Let's find all links that aren't category pages or home page
        # WordPress posts might have a date or category in the path, or just a slug.
        # Let's collect links that contain some patterns or are inside post lists.
        # Let's print out some candidates first.
        candidates = []
        for a in soup.find_all('a', href=True):
            href = a['href']
            full_url = urljoin(news_archive_url, href)
            # Filter out pages like /page/2/, /tin-tuc/, or other obvious archives
            if full_url.startswith("https://giacong.vn/") and not any(x in full_url for x in ['/page/', '/tin-tuc/', 'lien-he', 'san-pham', 'gia-cong', 'dich-vu', '#']):
                if full_url != "https://giacong.vn/":
                    candidates.append(full_url)
        if candidates:
            single_news_url = candidates[0]
        else:
            # Let's look for tags like .post-item a
            post_links = soup.select('.post-item a[href], .entry-title a[href]')
            if post_links:
                single_news_url = urljoin(news_archive_url, post_links[0]['href'])

    print(f"Discovered Single News URL: {single_news_url}")

    # Now let's fetch and analyze Single Product and Single News
    from explore_site import analyze_page
    
    if single_product_url:
        resp = fetch_page(single_product_url)
        if resp:
            data["Single_Product"] = analyze_page(single_product_url, resp, "Single_Product")
            
    if single_news_url:
        resp = fetch_page(single_news_url)
        if resp:
            data["Single_News"] = analyze_page(single_news_url, resp, "Single_News")

    # Let's print structural info for all pages to help selector extraction
    # We want to write this to a separate details text file
    with open('exploration_details.txt', 'w', encoding='utf-8') as out:
        for name, page in data.items():
            if "error" in page:
                continue
                
            out.write(f"=========================================\n")
            out.write(f"PAGE: {name} ({page.get('type')})\n")
            out.write(f"URL: {page.get('url')}\n")
            out.write(f"Title: {page.get('title')}\n")
            out.write(f"H1s: {page.get('h1s')}\n")
            out.write(f"Body Classes: {page.get('body_classes')}\n\n")
            
            out.write("--- STRUCTURAL ELEMENTS ---\n")
            for el in page.get('structural_elements', []):
                out.write(f"Tag: {el['tag']}, ID: {el['id']}, Classes: {el['class']}\n")
            out.write("\n")
            
            out.write("--- KEY CONTAINER CANDIDATES ---\n")
            # Filter and print distinct key container candidates
            seen = set()
            for cc in page.get('content_containers_sample', []):
                key = (cc['tag'], cc['id'], tuple(cc['class']))
                if key not in seen:
                    seen.add(key)
                    out.write(f"Selector: {cc['selector']}, Tag: {cc['tag']}, ID: {cc['id']}, Classes: {cc['class']}\n")
            out.write("\n")

            out.write("--- IMAGES SAMPLE ---\n")
            for img in page.get('images_sample', [])[:5]:
                out.write(f"Src: {img.get('src')}\n")
                out.write(f"Class: {img.get('class')}\n")
                out.write(f"Alt: {img.get('alt')}\n")
                out.write(f"Data Attrs: {img.get('data_attrs')}\n\n")
                
            out.write("--- INTERNAL LINKS SAMPLE ---\n")
            for link in page.get('internal_links_sample', [])[:10]:
                out.write(f"  {link}\n")
            out.write("\n")

    # Save the updated json
    with open('exploration_output.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print("Done exploring details. Saved to exploration_output.json and exploration_details.txt")

if __name__ == "__main__":
    main()

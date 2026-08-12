import requests
import xml.etree.ElementTree as ET
import re
from urllib.parse import urlparse

def fetch_xml_urls(url):
    try:
        r = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=15)
        if r.status_code != 200:
            return []
        xml_content = r.text
        # Remove namespace for easier ElementTree lookup
        xml_content = re.sub(r'\sxmlns="[^"]+"', '', xml_content, count=1)
        root = ET.fromstring(xml_content)
        urls = [loc.text for loc in root.findall('.//loc')]
        return urls
    except Exception as e:
        print(f"Error fetching/parsing {url}: {e}")
        return []

def main():
    sitemaps = {
        "products": ["https://giacong.vn/product-sitemap.xml"],
        "pages": ["https://giacong.vn/page-sitemap.xml"],
        "posts": [
            "https://giacong.vn/post-sitemap1.xml",
            "https://giacong.vn/post-sitemap2.xml",
            "https://giacong.vn/post-sitemap3.xml",
            "https://giacong.vn/post-sitemap4.xml"
        ],
        "categories": ["https://giacong.vn/category-sitemap.xml"],
        "blocks": ["https://giacong.vn/blocks-sitemap.xml"]
    }

    report = {}
    for key, urls in sitemaps.items():
        report[key] = []
        for u in urls:
            found = fetch_xml_urls(u)
            print(f"Sitemap {u} has {len(found)} URLs.")
            report[key].extend(found)

    # Let's write the classification summary to a text file
    with open('sitemap_classification.txt', 'w', encoding='utf-8') as f:
        f.write("SITEMAP CLASSIFICATION REPORT\n")
        f.write("=============================\n\n")
        
        for key, urls in report.items():
            f.write(f"Category: {key.upper()} (Total: {len(urls)})\n")
            f.write("-" * 40 + "\n")
            for u in sorted(urls):
                f.write(f"  {u}\n")
            f.write("\n")
            
    print("Sitemap classification report written to sitemap_classification.txt")

if __name__ == "__main__":
    main()

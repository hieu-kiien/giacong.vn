import requests
from bs4 import BeautifulSoup
import xml.etree.ElementTree as ET

def fetch_xml(url):
    print(f"Fetching sitemap: {url}")
    try:
        r = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=15)
        if r.status_code == 200:
            return r.text
        return None
    except Exception as e:
        print(f"Error fetching sitemap: {e}")
        return None

def parse_sitemap(xml_content):
    urls = []
    if not xml_content:
        return urls
    try:
        # Sitemap can use namespaces, so we handle that
        # Remove namespace prefixes to make parsing easier
        import re
        xml_content = re.sub(r'\sxmlns="[^"]+"', '', xml_content, count=1)
        root = ET.fromstring(xml_content)
        for loc in root.findall('.//loc'):
            urls.append(loc.text)
    except Exception as e:
        print(f"Error parsing sitemap XML: {e}")
    return urls

def main():
    sitemap_index_url = "https://giacong.vn/sitemap_index.xml"
    xml_data = fetch_xml(sitemap_index_url)
    
    if not xml_data:
        # try standard sitemap.xml
        sitemap_index_url = "https://giacong.vn/sitemap.xml"
        xml_data = fetch_xml(sitemap_index_url)

    if not xml_data:
        print("Sitemap not found or failed to fetch.")
        return

    sub_sitemaps = parse_sitemap(xml_data)
    print(f"Found {len(sub_sitemaps)} sub-sitemaps.")
    
    all_urls = []
    for ss in sub_sitemaps:
        if ss.endswith('.xml'):
            ss_data = fetch_xml(ss)
            urls = parse_sitemap(ss_data)
            print(f"  {ss}: Found {len(urls)} URLs")
            all_urls.extend(urls)
        else:
            all_urls.append(ss)

    with open('sitemap_urls.txt', 'w', encoding='utf-8') as f:
        for u in sorted(list(set(all_urls))):
            f.write(u + '\n')
            
    print(f"Saved {len(all_urls)} URLs to sitemap_urls.txt")

if __name__ == "__main__":
    main()

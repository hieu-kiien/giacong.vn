import requests
from bs4 import BeautifulSoup

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

def analyze_content_wrapper(url, name):
    print(f"Fetching: {url}")
    try:
        r = requests.get(url, headers=HEADERS, timeout=15)
        if r.status_code != 200 or len(r.text) == 0:
            print(f"  Failed: Status {r.status_code}, Length {len(r.text)}")
            return
            
        soup = BeautifulSoup(r.text, 'html.parser')
        
        # Let's write the analysis to a file
        with open(f"html_structure_{name}.txt", "w", encoding="utf-8") as f:
            f.write(f"PAGE: {name}\n")
            f.write(f"URL: {url}\n")
            f.write(f"Title: {soup.title.string.strip() if soup.title else 'No Title'}\n")
            body = soup.find('body')
            f.write(f"Body Classes: {body.get('class', []) if body else []}\n\n")
            
            # Print elements in a tree-like hierarchy from body down to main content
            # Let's search for typical content containers and dump their children
            f.write("--- SECTORS CONTAINING TEXT (Selectors check) ---\n")
            
            # 1. Check entry-content (very common in posts/pages)
            entry_contents = soup.select('.entry-content')
            f.write(f"Count of .entry-content: {len(entry_contents)}\n")
            for idx, ec in enumerate(entry_contents):
                f.write(f"  [{idx}] Tag: {ec.name}, Classes: {ec.get('class')}\n")
                # Show first 200 chars of text
                text_snippet = ec.get_text().strip()[:300].replace('\n', ' ')
                f.write(f"      Text sample: {text_snippet}...\n")
                
            # 2. Check woocommerce description tab (common in products)
            woo_descs = soup.select('#tab-description')
            f.write(f"Count of #tab-description: {len(woo_descs)}\n")
            for idx, wd in enumerate(woo_descs):
                f.write(f"  [{idx}] Tag: {wd.name}, Classes: {wd.get('class')}\n")
                text_snippet = wd.get_text().strip()[:300].replace('\n', ' ')
                f.write(f"      Text sample: {text_snippet}...\n")
                
            # 3. Check product summary (for short description)
            woo_summaries = soup.select('.summary.entry-summary')
            f.write(f"Count of .summary.entry-summary: {len(woo_summaries)}\n")
            for idx, ws in enumerate(woo_summaries):
                f.write(f"  [{idx}] Tag: {ws.name}, Classes: {ws.get('class')}\n")
                text_snippet = ws.get_text().strip()[:300].replace('\n', ' ')
                f.write(f"      Text sample: {text_snippet}...\n")

            # 4. Check main tag content
            mains = soup.find_all('main')
            f.write(f"Count of <main>: {len(mains)}\n")
            for idx, m in enumerate(mains):
                f.write(f"  [{idx}] Tag: {m.name}, ID: {m.get('id')}, Classes: {m.get('class')}\n")
                
            # Let's dump all H1, H2, H3 tags
            f.write("\n--- HEADINGS ---\n")
            for h in soup.find_all(['h1', 'h2', 'h3']):
                f.write(f"{h.name}: {h.get_text().strip()}\n")
                
            # Check contact page details specifically if this is the contact page
            if name == "Contact":
                f.write("\n--- CONTACT DETAILS PAGE SCAN ---\n")
                # print text of elements containing address, phone, email keywords
                for tag in soup.find_all(lambda t: t.name in ['p', 'div', 'li', 'span'] and any(word in t.get_text().lower() for word in ['địa chỉ', 'address', 'văn phòng', 'hotline', 'điện thoại', 'email', 'mst'])):
                    # only print parent-most or child-most to avoid duplication
                    if len(tag.find_all()) < 2: # leaf or near-leaf node
                        f.write(f"  {tag.name}[class={tag.get('class')}]: {tag.get_text().strip()}\n")
                        
    except Exception as e:
        print(f"Error analyzing {url}: {e}")

def main():
    analyze_content_wrapper("https://giacong.vn/sua-bot-cho-nguoi-gia/", "Product")
    analyze_content_wrapper("https://giacong.vn/bot-chuoi-xanh/", "Service")
    analyze_content_wrapper("https://giacong.vn/lien-he/", "Contact")
    analyze_content_wrapper("https://giacong.vn/", "Home")
    print("HTML structures analyzed.")

if __name__ == "__main__":
    main()

import requests
from bs4 import BeautifulSoup

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

def test_url(url, out):
    out.write(f"Testing URL: {url}\n")
    try:
        r = requests.get(url, headers=HEADERS, timeout=10)
        out.write(f"  Status Code: {r.status_code}\n")
        out.write(f"  Final URL: {r.url}\n")
        if r.status_code == 200:
            soup = BeautifulSoup(r.text, 'html.parser')
            body = soup.find('body')
            body_classes = body.get('class', []) if body else 'No Body'
            title = soup.title.string.strip() if soup.title else 'No Title'
            h1s = [h1.get_text().strip() for h1 in soup.find_all('h1')]
            out.write(f"  Title: {title}\n")
            out.write(f"  H1s: {h1s}\n")
            out.write(f"  Body Classes: {body_classes}\n")
            product_div = soup.select('.product')
            out.write(f"  Has class .product: {len(product_div) > 0}\n")
            entry_content = soup.select('.entry-content')
            out.write(f"  Has class .entry-content: {len(entry_content) > 0}\n")
            
            # Save a snippet of the HTML to see what's in there
            out.write(f"  HTML Length: {len(r.text)}\n")
            out.write(f"  HTML Snippet: {r.text[:500].strip()}\n")
        else:
            out.write("  Failed to fetch content.\n")
    except Exception as e:
        out.write(f"  Error: {e}\n")
    out.write("\n")

def main():
    urls = [
        "https://giacong.vn/sua-bot-cho-nguoi-gia/",
        "https://giacong.vn/dich-vu-dong-goi-ca-phe-hoa-tan/",
        "https://giacong.vn/say-thang-hoa/"
    ]
    with open('test_fetch_results.txt', 'w', encoding='utf-8') as out:
        for u in urls:
            test_url(u, out)
    print("Done testing. Wrote to test_fetch_results.txt")

if __name__ == "__main__":
    main()

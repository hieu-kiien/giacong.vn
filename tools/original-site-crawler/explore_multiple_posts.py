import requests
from bs4 import BeautifulSoup

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

def test_url(url):
    try:
        r = requests.get(url, headers=HEADERS, timeout=10)
        if r.status_code == 200 and len(r.text) > 0:
            soup = BeautifulSoup(r.text, 'html.parser')
            title = soup.title.string.strip() if soup.title else 'No Title'
            body = soup.find('body')
            classes = body.get('class', []) if body else []
            return {"url": url, "length": len(r.text), "title": title, "classes": classes}
        return {"url": url, "status": r.status_code, "length": len(r.text)}
    except Exception as e:
        return {"url": url, "error": str(e)}

def main():
    urls = [
        "https://giacong.vn/bot-chuoi-xanh/",
        "https://giacong.vn/gia-song-sot-gung-me/",
        "https://giacong.vn/sot-cham-vit-quay-kinh-bac/",
        "https://giacong.vn/dich-vu-dong-goi-bao-jumbo/"
    ]
    
    with open('multiple_posts_results.txt', 'w', encoding='utf-8') as f:
        for u in urls:
            res = test_url(u)
            f.write(f"URL: {res.get('url')}\n")
            f.write(f"  Length: {res.get('length')}\n")
            if 'error' in res:
                f.write(f"  Error: {res['error']}\n")
            elif 'status' in res:
                f.write(f"  Status: {res['status']}\n")
            else:
                f.write(f"  Title: {res.get('title')}\n")
                f.write(f"  Classes: {res.get('classes')}\n")
            f.write("\n")
            
    print("Done testing multiple posts.")

if __name__ == "__main__":
    main()

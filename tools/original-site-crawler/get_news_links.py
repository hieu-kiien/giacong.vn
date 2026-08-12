import requests
from bs4 import BeautifulSoup

def main():
    r = requests.get('https://giacong.vn/tin-tuc/', headers={'User-Agent': 'Mozilla/5.0'})
    soup = BeautifulSoup(r.text, 'html.parser')
    with open('news_page_links.txt', 'w', encoding='utf-8') as f:
        for a in soup.find_all('a', href=True):
            f.write(f"Text: {a.get_text().strip()} | Href: {a['href']} | Parent: {a.parent.name} | Classes: {a.get('class', [])} | Parent Classes: {a.parent.get('class', [])}\n")
    print("Done")

if __name__ == "__main__":
    main()

import requests
from bs4 import BeautifulSoup

def main():
    r = requests.get('https://giacong.vn/san-pham/', headers={'User-Agent': 'Mozilla/5.0'})
    soup = BeautifulSoup(r.text, 'html.parser')
    with open('product_page_links.txt', 'w', encoding='utf-8') as f:
        for a in soup.find_all('a', href=True):
            f.write(f"{a.get_text().strip()} -> {a['href']}\n")
    print("Done")

if __name__ == "__main__":
    main()

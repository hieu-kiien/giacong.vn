import json
import sys

def main():
    with open('exploration_output.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    with open('exploration_summary.txt', 'w', encoding='utf-8') as out:
        for name, page in data.items():
            if "error" in page:
                out.write(f"=== {name} (Error: {page['error']}) ===\n")
                out.write(f"URL: {page.get('url')}\n\n")
                continue
                
            out.write(f"=== {name} ({page.get('type')}) ===\n")
            out.write(f"URL: {page.get('url')}\n")
            out.write(f"Title: {page.get('title')}\n")
            out.write(f"H1s: {page.get('h1s')}\n")
            out.write(f"Body Classes: {page.get('body_classes')}\n")
            out.write(f"Phones: {page.get('phones')}\n")
            out.write(f"Emails: {page.get('emails')}\n")
            out.write(f"Addresses: {len(page.get('addresses', []))}\n")
            for addr in page.get('addresses', []):
                out.write(f"  - {addr}\n")
                
            images = page.get("images_sample", [])
            out.write(f"Images count: {len(images)}\n")
            lazy_attrs = set()
            for img in images:
                lazy_attrs.update(img.get('data_attrs', {}).keys())
            out.write(f"Detected lazy-load attributes: {list(lazy_attrs)}\n")
            
            lazy_imgs = [img for img in images if img.get('data_attrs')]
            out.write(f"Sample lazy images count: {len(lazy_imgs)}\n")
            for img in lazy_imgs[:3]:
                out.write(f"  - src={img.get('src')}, data-attrs={img.get('data_attrs')}\n")
                
            out.write("\n")
            
    print("Successfully wrote summary to exploration_summary.txt")

if __name__ == "__main__":
    main()

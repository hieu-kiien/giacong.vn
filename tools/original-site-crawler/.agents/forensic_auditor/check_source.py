import os
import re

SCRAPER_DIR = r"c:\Users\hieuk\Desktop\cào giacong.vn\scraper"

def check_file_for_hardcoded(filepath):
    print(f"Checking {filepath}...")
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
        
    # Search for test phone numbers and email addresses
    test_phones = ["0947142999", "0947.142.999", "0947 142 999"]
    test_emails = ["info@giacong.vn", "feedback@giacong.vn", "support@giacong.vn"]
    test_addresses = ["123 Đường Gia Công"]
    
    violations = []
    
    for phone in test_phones:
        if phone in content:
            violations.append(f"Hardcoded test phone number '{phone}' found")
            
    for email in test_emails:
        if email in content:
            violations.append(f"Hardcoded test email '{email}' found")
            
    for addr in test_addresses:
        if addr in content:
            violations.append(f"Hardcoded test address '{addr}' found")
            
    # Check for simple constant returns or dummy function bodies
    # e.g., def parse_page(url, html): return { ... } with hardcoded properties
    # Let's inspect the functions
    return violations

def main():
    files = [
        os.path.join(SCRAPER_DIR, "crawler.py"),
        os.path.join(SCRAPER_DIR, "parser.py"),
        os.path.join(SCRAPER_DIR, "storage.py"),
        os.path.join(SCRAPER_DIR, "cli.py"),
        os.path.join(SCRAPER_DIR, "run.py") # Wait, run.py is in root
    ]
    
    # Add root run.py
    files.append(r"c:\Users\hieuk\Desktop\cào giacong.vn\run.py")
    
    all_violations = {}
    for filepath in files:
        if os.path.exists(filepath):
            violations = check_file_for_hardcoded(filepath)
            if violations:
                all_violations[filepath] = violations
        else:
            print(f"File not found: {filepath}")
            
    if all_violations:
        print("\n[VERDICT] INTEGRITY VIOLATION DETECTED!")
        for file, vios in all_violations.items():
            print(f"In file {file}:")
            for vio in vios:
                print(f"  - {vio}")
    else:
        print("\n[VERDICT] CLEAN - No hardcoded test values found in scraper source code.")

if __name__ == "__main__":
    main()

import urllib.request
import json
import sys

def test_cors():
    print("--- CORS Test ---")
    
    # 1. Test forbidden origin
    req1 = urllib.request.Request(
        'http://localhost:8000/api/posts',
        headers={'Origin': 'http://example.com'}
    )
    try:
        with urllib.request.urlopen(req1) as response:
            print("Forbidden Origin Response Status:", response.status)
            print("Forbidden Origin Response Headers:")
            headers = response.getheaders()
            cors_headers = {k: v for k, v in headers if 'access-control' in k.lower()}
            if not cors_headers:
                print("  (No CORS headers present - PASS)")
            else:
                for k, v in cors_headers.items():
                    print(f"  {k}: {v}")
    except Exception as e:
        print("Forbidden Origin Request Error:", e)

    # 2. Test allowed origin (http://localhost:3000)
    req2 = urllib.request.Request(
        'http://localhost:8000/api/posts',
        headers={'Origin': 'http://localhost:3000'}
    )
    try:
        with urllib.request.urlopen(req2) as response:
            print("Allowed Origin Response Status:", response.status)
            print("Allowed Origin Response Headers:")
            headers = response.getheaders()
            for k, v in headers:
                if 'access-control' in k.lower():
                    print(f"  {k}: {v}")
    except Exception as e:
        print("Allowed Origin Request Error:", e)

def test_posts_pagination():
    print("\n--- Posts Pagination Test ---")
    req = urllib.request.Request('http://localhost:8000/api/posts')
    try:
        with urllib.request.urlopen(req) as response:
            body = response.read().decode('utf-8')
            res_json = json.loads(body)
            
            keys = list(res_json.keys())
            data_list = res_json.get('data', [])
            total = res_json.get('total')
            current_page = res_json.get('current_page')
            
            print("Response Keys:", keys)
            print("Data Length:", len(data_list))
            print("Total:", total)
            print("Current Page:", current_page)
            
            # Assertions
            has_current_page = 'current_page' in res_json
            has_data = 'data' in res_json
            has_total = 'total' in res_json
            data_length_ok = len(data_list) <= 10
            
            print(f"Has current_page: {has_current_page}")
            print(f"Has data: {has_data}")
            print(f"Has total: {has_total}")
            print(f"Data length <= 10: {data_length_ok}")
            
            if has_current_page and has_data and has_total and data_length_ok:
                print("Pagination Assertion: PASS")
            else:
                print("Pagination Assertion: FAIL")
    except Exception as e:
        print("Posts Pagination Request Error:", e)

if __name__ == '__main__':
    test_cors()
    test_posts_pagination()

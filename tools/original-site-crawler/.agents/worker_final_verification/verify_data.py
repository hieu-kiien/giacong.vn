import json
import csv
import os

json_path = 'crawled_data.json'
csv_path = 'crawled_data.csv'

# Check existence
assert os.path.exists(json_path), 'JSON file does not exist'
assert os.path.exists(csv_path), 'CSV file does not exist'

# Verify JSON schema and count
with open(json_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

assert isinstance(data, list), 'JSON is not a list'
assert len(data) >= 15, f'JSON has only {len(data)} pages, expected >= 15'

required_keys = {'url', 'title', 'h1', 'category', 'content', 'contacts', 'images'}
found_phone = False
found_email = False

for idx, item in enumerate(data):
    assert isinstance(item, dict), f'Item {idx} is not a dictionary'
    for k in required_keys:
        assert k in item, f'Key "{k}" missing in item {idx}'
    
    contacts = item.get('contacts', {})
    phones = contacts.get('phone', [])
    emails = contacts.get('email', [])
    if '0947142999' in phones:
        found_phone = True
    if 'info@giacong.vn' in emails:
        found_email = True

assert found_phone, 'Phone 0947142999 not found in any crawled contact'
assert found_email, 'Email info@giacong.vn not found in any crawled contact'

print(f'JSON Validation passed! Total pages: {len(data)}')
print(f'Phone 0947142999 found: {found_phone}')
print(f'Email info@giacong.vn found: {found_email}')

# Verify CSV headers
with open(csv_path, 'r', encoding='utf-8') as f:
    reader = csv.reader(f)
    headers = next(reader)

expected_headers = ['url', 'title', 'h1', 'category', 'content', 'contacts', 'images']
assert headers == expected_headers, f'CSV headers mismatch: {headers}'
print('CSV headers validation passed!')

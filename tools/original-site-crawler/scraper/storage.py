import os
import stat
import json
import csv
from typing import List, Dict, Any

def check_write_permission(filepath: str) -> None:
    dirname = os.path.dirname(os.path.abspath(filepath))
    if os.path.exists(dirname):
        mode = os.stat(dirname).st_mode
        if not (mode & stat.S_IWRITE):
            raise PermissionError(f"Directory {dirname} is read-only")

def save_json(data: List[Dict[str, Any]], filepath: str) -> None:
    """Save collected data list to JSON format."""
    check_write_permission(filepath)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def save_csv(data: List[Dict[str, Any]], filepath: str) -> None:
    """Save collected data list to CSV format."""
    check_write_permission(filepath)
    headers = ["url", "title", "h1", "category", "content", "contacts", "images"]
    with open(filepath, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        for row in data:
            # Format complex structures as JSON strings for CSV representation
            contacts_str = json.dumps(row.get("contacts", {}), ensure_ascii=False)
            images_str = json.dumps(row.get("images", []), ensure_ascii=False)
            writer.writerow([
                row.get("url", ""),
                row.get("title", ""),
                row.get("h1", ""),
                row.get("category", ""),
                row.get("content", ""),
                contacts_str,
                images_str
            ])

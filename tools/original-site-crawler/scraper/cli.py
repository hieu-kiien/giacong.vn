import argparse
import sys
import logging
import os

def parse_args(args=None):
    parser = argparse.ArgumentParser(description="giacong.vn Web Scraper CLI")
    parser.add_argument("--start-url", required=True, help="Starting URL to crawl")
    parser.add_argument("--output-json", help="Path to save the JSON output")
    parser.add_argument("--output-csv", help="Path to save the CSV output")
    parser.add_argument("--max-depth", type=int, default=3, help="Maximum depth limit")
    parser.add_argument("--delay", type=float, default=1.0, help="Polite delay between requests in seconds")
    parser.add_argument("--timeout", type=float, default=10.0, help="HTTP connection timeout in seconds")
    parser.add_argument("--retries", type=int, default=3, help="Number of retries for transient HTTP errors")
    parser.add_argument("--backoff-factor", type=float, default=1.0, help="Exponential backoff factor")
    return parser.parse_args(args)

def main(args=None):
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    parsed_args = parse_args(args)
    
    from scraper.crawler import Crawler
    from scraper.storage import save_json, save_csv
    
    crawler = Crawler(
        start_url=parsed_args.start_url,
        max_depth=parsed_args.max_depth,
        delay=parsed_args.delay,
        timeout=parsed_args.timeout,
        retries=parsed_args.retries,
        backoff_factor=parsed_args.backoff_factor
    )
    
    results = crawler.crawl()
    
    # Always write outputs if requested, even if results are empty
    if parsed_args.output_json:
        try:
            save_json(results, parsed_args.output_json)
        except Exception as e:
            logging.error(f"Error saving JSON to {parsed_args.output_json}: {e}")
            sys.exit(1)
            
    if parsed_args.output_csv:
        try:
            save_csv(results, parsed_args.output_csv)
        except Exception as e:
            logging.error(f"Error saving CSV to {parsed_args.output_csv}: {e}")
            sys.exit(1)
            
    if not results:
        logging.error("No pages were successfully crawled.")
        sys.exit(1)
        
    sys.exit(0)

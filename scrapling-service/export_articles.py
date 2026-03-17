#!/usr/bin/env python3
"""
WeChat Article Batch Export Script
===================================
Takes article HTML files and exports them to markdown + images
using the Scrapling service.

Usage:
  # Export a single article HTML file
  python3 export_articles.py /path/to/article.html
  
  # Export multiple HTML files
  python3 export_articles.py /path/to/*.html
  
  # Specify output directory
  python3 export_articles.py --output /path/to/output /path/to/*.html

  # Use ZIP format (outputs individual ZIPs per article)
  python3 export_articles.py --format zip /path/to/*.html

Requirements:
  - Scrapling service running at http://localhost:8100
"""

import argparse
import os
import sys
import json

try:
    import httpx
except ImportError:
    print("Error: httpx not installed. Run: pip install httpx")
    sys.exit(1)


def export_article(html_path: str, output_dir: str, scrapling_url: str, fmt: str = "disk") -> dict:
    """Export a single article HTML file."""
    with open(html_path, "r", encoding="utf-8") as f:
        html = f.read()
    
    if fmt == "disk":
        resp = httpx.post(f"{scrapling_url}/parse-to-disk", json={
            "html": html,
            "output_dir": output_dir,
        }, timeout=120)
    elif fmt == "zip":
        resp = httpx.post(f"{scrapling_url}/parse", json={
            "html": html,
            "download_images": True,
            "output_format": "zip",
        }, timeout=120)
        
        if resp.status_code == 200:
            # Save ZIP
            filename = os.path.splitext(os.path.basename(html_path))[0] + ".zip"
            zip_path = os.path.join(output_dir, filename)
            os.makedirs(output_dir, exist_ok=True)
            with open(zip_path, "wb") as f:
                f.write(resp.content)
            return {"status": "ok", "path": zip_path, "size": len(resp.content)}
    
    if resp.status_code == 200:
        return resp.json()
    else:
        return {"status": "error", "code": resp.status_code, "detail": resp.text}


def main():
    parser = argparse.ArgumentParser(description="Export WeChat article HTML to Markdown + Images")
    parser.add_argument("files", nargs="+", help="HTML files to process")
    parser.add_argument("--output", "-o", default="/tmp/wechat-articles", help="Output directory")
    parser.add_argument("--format", "-f", choices=["disk", "zip"], default="disk", help="Output format")
    parser.add_argument("--scrapling-url", default="http://localhost:8100", help="Scrapling service URL")
    args = parser.parse_args()
    
    # Check service health
    try:
        health = httpx.get(f"{args.scrapling_url}/health", timeout=5)
        if health.status_code != 200:
            print(f"Error: Scrapling service at {args.scrapling_url} is not healthy")
            sys.exit(1)
    except Exception as e:
        print(f"Error: Cannot connect to Scrapling service at {args.scrapling_url}: {e}")
        sys.exit(1)
    
    print(f"Output directory: {args.output}")
    print(f"Format: {args.format}")
    print(f"Files to process: {len(args.files)}")
    print()
    
    success = 0
    failed = 0
    
    for i, filepath in enumerate(args.files):
        if not os.path.exists(filepath):
            print(f"[{i+1}/{len(args.files)}] ✗ File not found: {filepath}")
            failed += 1
            continue
        
        result = export_article(filepath, args.output, args.scrapling_url, args.format)
        
        if result.get("status") == "ok":
            title = result.get("title", os.path.basename(filepath))
            images = f"{result.get('image_count', '?')}/{result.get('total_images', '?')}"
            print(f"[{i+1}/{len(args.files)}] ✓ {title[:60]} ({images} images)")
            success += 1
        else:
            print(f"[{i+1}/{len(args.files)}] ✗ {filepath}: {result.get('detail', 'Unknown error')[:100]}")
            failed += 1
    
    print(f"\nDone: {success} success, {failed} failed")
    print(f"Output: {args.output}")


if __name__ == "__main__":
    main()

"""
WeChat Article Scrapling Service
---------------------------------
A FastAPI microservice that uses Scrapling to parse WeChat article HTML,
extract content, download images, and produce Markdown with local image references.

Modes:
1. POST /parse - Takes raw HTML, parses it, downloads images, returns markdown + images as ZIP
2. GET /fetch - Takes a WeChat article URL, fetches it (may hit captcha), parses, returns markdown ZIP
3. POST /parse-markdown - Takes raw HTML, returns just the markdown text (images as original URLs)
"""

import asyncio
import hashlib
import io
import os
import re
import tempfile
import time
import zipfile
from pathlib import Path
from typing import Optional
from urllib.parse import urljoin, urlparse

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import StreamingResponse, JSONResponse
from markdownify import markdownify as md
from scrapling import Fetcher

app = FastAPI(title="WeChat Article Scrapling Service", version="1.0.0")

# Image download timeout
IMAGE_TIMEOUT = 15
# Max concurrent image downloads
MAX_CONCURRENT_IMAGES = 5


def parse_wechat_html(html: str) -> dict:
    """
    Use Scrapling to parse WeChat article HTML and extract structured content.
    Returns dict with title, author, content_html, image_urls, publish_time.
    """
    from scrapling.parser import Adaptor
    
    page = Adaptor(html, auto_match=False)
    
    result = {
        "title": "",
        "author": "",
        "account_name": "",
        "content_html": "",
        "image_urls": [],
        "publish_time": "",
    }
    
    # Extract title
    title_el = page.find("#activity-name") or page.find(".rich_media_title")
    if title_el:
        result["title"] = title_el.text.strip()
    else:
        title_el = page.find("title")
        if title_el:
            result["title"] = title_el.text.strip()
    
    # Extract author
    author_el = page.find("#js_author_name") or page.find(".rich_media_meta_text")
    if author_el:
        result["author"] = author_el.text.strip()
    
    # Extract account name
    account_el = page.find("#js_name") or page.find(".account_nickname_inner")
    if account_el:
        result["account_name"] = account_el.text.strip()
    
    # Extract publish time
    pub_time_el = page.find("#publish_time")
    if pub_time_el:
        result["publish_time"] = pub_time_el.text.strip()
    
    # Extract main content
    content_el = page.find("#js_content")
    if content_el:
        content_html = content_el.html_content
        
        # Process images: convert data-src to src
        content_html = re.sub(
            r'<img([^>]*?)data-src="([^"]+)"',
            r'<img\1src="\2"',
            content_html
        )
        
        # Also handle data-original
        content_html = re.sub(
            r'<img([^>]*?)data-original="([^"]+)"',
            lambda m: m.group(0) if 'src="' in m.group(0) else f'<img{m.group(1)}src="{m.group(2)}"',
            content_html
        )
        
        result["content_html"] = content_html
        
        # Extract all image URLs
        img_urls = set()
        # From data-src attributes
        for match in re.finditer(r'data-src="(https?://[^"]+)"', content_html):
            img_urls.add(match.group(1))
        # From src attributes
        for match in re.finditer(r'src="(https?://mmbiz[^"]+)"', content_html):
            img_urls.add(match.group(1))
        # From src with protocol-relative URLs
        for match in re.finditer(r'src="//(mmbiz[^"]+)"', content_html):
            img_urls.add("https://" + match.group(1))
            
        result["image_urls"] = list(img_urls)
    else:
        # Try cgiDataNew approach
        cgi_match = re.search(r'var\s+content_noencode\s*=\s*["\'](.+?)["\'];', html, re.DOTALL)
        if not cgi_match:
            # Try extracting from window.cgiDataNew
            cgi_script = re.search(
                r'window\.cgiDataNew\s*=\s*\{(.+?)\}\s*;',
                html, re.DOTALL
            )
    
    return result


def html_to_markdown(content_html: str, image_map: dict = None) -> str:
    """
    Convert HTML content to Markdown, optionally replacing image URLs with local paths.
    """
    if image_map:
        for orig_url, local_path in image_map.items():
            content_html = content_html.replace(orig_url, local_path)
    
    # Clean up the HTML before conversion
    # Remove empty spans, divs etc
    content_html = re.sub(r'<(span|div|section|p)\s+style="[^"]*">\s*</\1>', '', content_html)
    
    # Convert to markdown
    markdown = md(
        content_html,
        heading_style="atx",
        bullets="-",
        strip=["script", "style", "iframe", "noscript"],
    )
    
    # Clean up excessive whitespace
    markdown = re.sub(r'\n{3,}', '\n\n', markdown)
    markdown = markdown.strip()
    
    return markdown


async def download_image(client: httpx.AsyncClient, url: str, semaphore: asyncio.Semaphore) -> tuple:
    """Download a single image. Returns (url, bytes, content_type) or (url, None, None) on failure."""
    async with semaphore:
        try:
            # Clean URL
            clean_url = url.split("&amp;")[0] if "&amp;" in url else url
            
            resp = await client.get(clean_url, timeout=IMAGE_TIMEOUT, follow_redirects=True)
            if resp.status_code == 200:
                content_type = resp.headers.get("content-type", "image/jpeg")
                return (url, resp.content, content_type)
        except Exception as e:
            print(f"Failed to download image {url[:80]}: {e}")
        
        return (url, None, None)


async def download_images(image_urls: list) -> dict:
    """
    Download all images concurrently.
    Returns dict mapping original URL -> (bytes, extension).
    """
    results = {}
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_IMAGES)
    
    async with httpx.AsyncClient(
        headers={
            "Referer": "https://mp.weixin.qq.com/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        },
        follow_redirects=True,
    ) as client:
        tasks = [download_image(client, url, semaphore) for url in image_urls]
        done = await asyncio.gather(*tasks)
        
        for url, data, content_type in done:
            if data:
                # Determine extension
                ext = "jpg"
                if content_type:
                    if "png" in content_type:
                        ext = "png"
                    elif "gif" in content_type:
                        ext = "gif"
                    elif "webp" in content_type:
                        ext = "webp"
                    elif "svg" in content_type:
                        ext = "svg"
                
                # Generate filename from URL hash
                url_hash = hashlib.md5(url.encode()).hexdigest()[:12]
                filename = f"{url_hash}.{ext}"
                results[url] = (data, filename)
    
    return results


def create_markdown_zip(title: str, markdown: str, images: dict) -> io.BytesIO:
    """
    Create a ZIP file containing:
    - article.md (markdown with local image references)
    - images/ directory with all downloaded images
    """
    buf = io.BytesIO()
    
    # Sanitize title for directory name
    safe_title = re.sub(r'[<>:"/\\|?*]', '_', title)[:80] or "article"
    
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(f"{safe_title}/{safe_title}.md", markdown)
        
        for url, (data, filename) in images.items():
            zf.writestr(f"{safe_title}/images/{filename}", data)
    
    buf.seek(0)
    return buf


def save_markdown_to_disk(output_dir: str, title: str, markdown: str, images: dict) -> str:
    """
    Save markdown and images to disk.
    Returns the path to the created directory.
    """
    safe_title = re.sub(r'[<>:"/\\|?*]', '_', title)[:80] or "article"
    article_dir = os.path.join(output_dir, safe_title)
    images_dir = os.path.join(article_dir, "images")
    os.makedirs(images_dir, exist_ok=True)
    
    # Write markdown
    md_path = os.path.join(article_dir, f"{safe_title}.md")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(markdown)
    
    # Write images
    for url, (data, filename) in images.items():
        img_path = os.path.join(images_dir, filename)
        with open(img_path, "wb") as f:
            f.write(data)
    
    return article_dir


@app.get("/health")
async def health():
    return {"status": "ok", "service": "scrapling"}


@app.post("/parse")
async def parse_html(body: dict):
    """
    Parse WeChat article HTML and return markdown with images as a ZIP.
    
    Request body:
    {
        "html": "<full article html>",
        "download_images": true,  // optional, default true
        "output_format": "zip"    // "zip" or "json"
    }
    """
    html = body.get("html", "")
    if not html:
        raise HTTPException(status_code=400, detail="html field is required")
    
    download_imgs = body.get("download_images", True)
    output_format = body.get("output_format", "zip")
    
    # Parse the HTML
    parsed = parse_wechat_html(html)
    
    if not parsed["content_html"]:
        raise HTTPException(status_code=422, detail="Could not extract article content from HTML")
    
    # Download images if requested
    image_map = {}
    downloaded_images = {}
    
    if download_imgs and parsed["image_urls"]:
        downloaded_images = await download_images(parsed["image_urls"])
        # Build image map: original URL -> local relative path
        for url, (data, filename) in downloaded_images.items():
            image_map[url] = f"./images/{filename}"
    
    # Convert to markdown
    markdown = html_to_markdown(parsed["content_html"], image_map)
    
    # Add frontmatter
    frontmatter = f"""---
title: "{parsed['title']}"
author: "{parsed['author']}"
account: "{parsed['account_name']}"
date: "{parsed['publish_time']}"
---

"""
    full_markdown = frontmatter + markdown
    
    if output_format == "json":
        return JSONResponse({
            "title": parsed["title"],
            "author": parsed["author"],
            "account_name": parsed["account_name"],
            "publish_time": parsed["publish_time"],
            "markdown": full_markdown,
            "image_count": len(downloaded_images),
            "image_urls": parsed["image_urls"],
        })
    
    # Create ZIP
    zip_buf = create_markdown_zip(parsed["title"], full_markdown, downloaded_images)
    
    safe_title = re.sub(r'[<>:"/\\|?*]', '_', parsed["title"])[:80] or "article"
    # Use URL-encoded filename for non-ASCII compatibility
    from urllib.parse import quote
    encoded_title = quote(safe_title)
    
    return StreamingResponse(
        zip_buf,
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_title}.zip"
        }
    )


@app.post("/parse-to-disk")
async def parse_to_disk(body: dict):
    """
    Parse WeChat article HTML and save markdown + images to disk.
    
    Request body:
    {
        "html": "<full article html>",
        "output_dir": "/path/to/output"  // optional, defaults to /tmp/wechat-articles
    }
    """
    html = body.get("html", "")
    if not html:
        raise HTTPException(status_code=400, detail="html field is required")
    
    output_dir = body.get("output_dir", "/tmp/wechat-articles")
    
    # Parse
    parsed = parse_wechat_html(html)
    if not parsed["content_html"]:
        raise HTTPException(status_code=422, detail="Could not extract article content")
    
    # Download images
    downloaded_images = {}
    image_map = {}
    
    if parsed["image_urls"]:
        downloaded_images = await download_images(parsed["image_urls"])
        for url, (data, filename) in downloaded_images.items():
            image_map[url] = f"./images/{filename}"
    
    # Convert to markdown
    markdown = html_to_markdown(parsed["content_html"], image_map)
    
    frontmatter = f"""---
title: "{parsed['title']}"
author: "{parsed['author']}"
account: "{parsed['account_name']}"
date: "{parsed['publish_time']}"
---

"""
    full_markdown = frontmatter + markdown
    
    # Save to disk
    article_dir = save_markdown_to_disk(output_dir, parsed["title"], full_markdown, downloaded_images)
    
    return {
        "status": "ok",
        "title": parsed["title"],
        "path": article_dir,
        "markdown_file": os.path.join(article_dir, f"{re.sub(r'[<>:\"/\\\\|?*]', '_', parsed['title'])[:80]}.md"),
        "image_count": len(downloaded_images),
        "total_images": len(parsed["image_urls"]),
    }


@app.get("/fetch")
async def fetch_article(
    url: str = Query(..., description="WeChat article URL"),
    output_format: str = Query("zip", description="Output format: zip or json"),
):
    """
    Fetch a WeChat article by URL, parse it, and return markdown.
    Note: May fail due to WeChat captcha/anti-bot protection.
    """
    try:
        fetcher = Fetcher()
        page = fetcher.get(url, headers={
            "Referer": "https://mp.weixin.qq.com/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
        })
        html = page.html_content
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch article: {e}")
    
    # Check if we hit a captcha/verification page
    if 'captcha' in html.lower() or 'verify' in html.lower():
        raise HTTPException(
            status_code=403,
            detail="WeChat captcha/verification detected. Use /parse endpoint with pre-fetched HTML instead."
        )
    
    parsed = parse_wechat_html(html)
    if not parsed["content_html"]:
        raise HTTPException(status_code=422, detail="Could not extract article content")
    
    downloaded_images = await download_images(parsed["image_urls"])
    image_map = {url: f"./images/{fn}" for url, (_, fn) in downloaded_images.items()}
    
    markdown = html_to_markdown(parsed["content_html"], image_map)
    frontmatter = f"""---
title: "{parsed['title']}"
author: "{parsed['author']}"
account: "{parsed['account_name']}"
date: "{parsed['publish_time']}"
---

"""
    full_markdown = frontmatter + markdown
    
    if output_format == "json":
        return JSONResponse({
            "title": parsed["title"],
            "markdown": full_markdown,
            "image_count": len(downloaded_images),
        })
    
    zip_buf = create_markdown_zip(parsed["title"], full_markdown, downloaded_images)
    safe_title = re.sub(r'[<>:"/\\|?*]', '_', parsed["title"])[:80] or "article"
    from urllib.parse import quote
    encoded_title = quote(safe_title)
    
    return StreamingResponse(
        zip_buf,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_title}.zip"}
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8100)

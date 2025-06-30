import requests
from typing import List, Dict, Any
import hashlib
from concurrent.futures import ThreadPoolExecutor
import re

# Simple cache without lock - you're right, the model creates new instances
_CACHE = {}

def web_search(query: str, with_content: bool = True) -> Dict[str, Any]:
    """
    DuckDuckGo web search with content extraction using readability.
    """
    import time
    start = time.time()
    
    # Check cache
    cache_key = hashlib.md5(f"{query}_{with_content}".encode()).hexdigest()
    if cache_key in _CACHE:
        cached = _CACHE[cache_key].copy()
        cached["elapsed_time"] = time.time() - start
        return cached
    
    # Search
    searcher = WebSearcher()
    results = searcher.search(query, with_content)
    
    # Build response
    response = {
        "success": len(results) > 0,
        "query": query,
        "results": results,
        "elapsed_time": time.time() - start
    }
    
    # Cache it
    _CACHE[cache_key] = response
    if len(_CACHE) > 50:
        _CACHE.pop(next(iter(_CACHE)))
    
    return response


class WebSearcher:
    """Simple DuckDuckGo searcher with content extraction."""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        self.session.headers["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        
    def search(self, query: str, fetch_content: bool) -> List[Dict[str, Any]]:
        """Search and optionally fetch content."""
        # Get search results
        results = self._get_search_results(query)
        
        # Fetch content if requested
        if fetch_content and results:
            self._add_content_to_results(results)
            
        return results
    
    def _get_search_results(self, query: str) -> List[Dict[str, Any]]:
        """Get search results from DuckDuckGo."""
        try:
            resp = self.session.get(
                "https://html.duckduckgo.com/html/",
                params={"q": query},
                timeout=5
            )
            
            if resp.status_code != 200:
                return []
            
            # Parse results
            results = []
            blocks = resp.text.split('<div class="result results_links')[1:6]
            
            for block in blocks:
                result = self._parse_result_block(block)
                if result:
                    results.append(result)
                    
            return results
        except:
            return []
    
    def _parse_result_block(self, block: str) -> Dict[str, Any]:
        """Parse a single result from HTML."""
        try:
            # Get URL
            url_match = re.search(r'class="result__a"[^>]*href="([^"]+)"', block)
            if not url_match:
                return None
            
            url = url_match.group(1)
            if "uddg=" in url:
                url = requests.utils.unquote(url.split("uddg=")[1].split("&")[0])
            
            # Get title
            title_match = re.search(r'class="result__a"[^>]*>([^<]+)</a>', block)
            title = title_match.group(1) if title_match else ""
            
            # Get description
            desc_match = re.search(r'class="result__snippet"[^>]*>([^<]+)', block)
            desc = desc_match.group(1) if desc_match else ""
            
            return {
                "title": title.strip(),
                "url": url,
                "description": desc.strip(),
                "content": ""
            }
        except:
            return None
    
    def _add_content_to_results(self, results: List[Dict[str, Any]]):
        """Fetch content for all results in parallel."""
        with ThreadPoolExecutor(max_workers=5) as executor:
            executor.map(self._fetch_content, results)
    
    def _fetch_content(self, result: Dict[str, Any]):
        """Fetch and extract content from a URL."""
        try:
            resp = self.session.get(result["url"], timeout=5)
            
            if resp.status_code != 200:
                result["content"] = f"[HTTP {resp.status_code}]"
                return
            
            # Try to extract content
            content = self._extract_content(resp.text)
            result["content"] = content if content else "[No content extracted]"
            
        except Exception as e:
            result["content"] = f"[{type(e).__name__}]"
    
    def _extract_content(self, html: str) -> str:
        """Extract readable content from HTML."""
        # Try readability if available
        try:
            from readability import Document
            doc = Document(html)
            content_html = doc.summary()
            # Convert to text
            return self._html_to_text(content_html)
        except:
            pass
        
        # Try BeautifulSoup if available
        try:
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(html, 'html.parser')
            
            # Remove junk
            for tag in soup(['script', 'style', 'nav', 'header', 'footer']):
                tag.decompose()
            
            # Find content
            main = soup.find('main') or soup.find('article') or soup.body
            if main:
                return main.get_text(separator='\n', strip=True)
        except:
            pass
        
        # Fallback to regex
        # Remove scripts and styles
        text = re.sub(r'<(script|style)[^>]*>.*?</\1>', '', html, flags=re.DOTALL)
        # Remove tags
        text = re.sub(r'<[^>]+>', ' ', text)
        # Decode entities
        text = text.replace('&nbsp;', ' ').replace('&amp;', '&')
        text = text.replace('&lt;', '<').replace('&gt;', '>')
        text = text.replace('\u0097', '—')
        # Clean up
        text = re.sub(r'[\t\r]+', ' ', text)
        text = re.sub(r' +', ' ', text)
        return text.strip()
    
    def _html_to_text(self, html: str) -> str:
        """Convert HTML to plain text."""
        # Add newlines for structure
        html = re.sub(r'</(p|div|h[1-6])>', '\n\n', html, flags=re.I)
        html = re.sub(r'<br\s*/?>', '\n', html, flags=re.I)
        html = re.sub(r'<li[^>]*>', '\n• ', html, flags=re.I)
        
        # Remove all tags
        text = re.sub(r'<[^>]+>', '', html)
        
        # Decode HTML entities
        text = text.replace('&nbsp;', ' ').replace('&amp;', '&')
        text = text.replace('&lt;', '<').replace('&gt;', '>')
        text = text.replace('&quot;', '"').replace('&#39;', "'")
        text = text.replace('&#x27;', "'")
        
        # Fix unicode dash
        text = text.replace('\u0097', '—')
        
        # Clean whitespace aggressively
        text = re.sub(r'[\t\r]+', ' ', text)  # Remove tabs and carriage returns
        text = re.sub(r' +', ' ', text)  # Multiple spaces to single
        text = re.sub(r'\n +', '\n', text)  # Remove leading spaces on lines
        text = re.sub(r' +\n', '\n', text)  # Remove trailing spaces on lines
        text = re.sub(r'\n{3,}', '\n\n', text)  # Max 2 newlines
        
        return text.strip()
// url-sanitizer.ts
export class UrlSanitizer {
  sanitizeUrl(url: string): string {
    if (!url || typeof url !== 'string') return '#';
    url = url.trim();
    if (/^https?:\/\//i.test(url) || /^mailto:/i.test(url)) return url;
    if (url.startsWith('#')) return url;
    return '#';
  }
}
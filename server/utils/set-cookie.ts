export function extractSetCookieValues(headers: Headers): string[] {
  const native = headers.getSetCookie?.bind(headers);
  if (native) {
    const cookies = native();
    if (cookies.length > 0) return cookies;
  }

  const raw = headers.get('set-cookie');
  if (!raw) return [];

  // Regex split that avoids breaking on comma-containing Expires dates like
  // "Expires=Wed, 09 Jun 2027 10:18:14 GMT". The lookahead requires that the
  // comma be followed by a key=value token (no spaces in key), which dates never satisfy.
  return raw
    .split(/,(?=\s*[^;,=\s]+=[^;,]+)/)
    .map(c => c.trim())
    .filter(Boolean);
}

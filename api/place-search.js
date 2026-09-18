// The repository's first server code, and it exists for exactly one
// reason: KAKAO_REST_API_KEY must not ship to the browser. It reads one
// query parameter, asks Kakao, and returns the few fields the submit form
// needs. No database access, no other secret, no other route.
import { validateQuery, kakaoSearchUrl, mapKakaoDocuments } from './_lib/kakao.mjs';

// Best effort only: serverless instances are not shared, so this bounds a
// single warm instance, nothing more. The real limits are the CDN cache
// below and the query-length cap. If abuse ever appears, the answer is a
// bot challenge, not a bigger counter.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const bucket = hits.get(ip)?.filter(t => now - t < WINDOW_MS) ?? [];
  bucket.push(now);
  hits.set(ip, bucket);
  if (hits.size > 500) hits.clear(); // bounded memory; a warm instance is short-lived
  return bucket.length > MAX_PER_WINDOW;
}

export default async function handler(req, res) {
  // Rejected before the key check or any upstream call, so a wrong-method
  // request can never burn quota.
  if (req.method !== 'GET') return res.status(405).json({ code: 'method' });

  const key = process.env.KAKAO_REST_API_KEY?.trim();
  if (!key) return res.status(503).json({ code: 'unconfigured' });

  const url = new URL(req.url, 'http://localhost');
  const check = validateQuery(url.searchParams.get('q'));
  if (!check.ok) return res.status(400).json({ code: check.code });

  // x-forwarded-for's first element is whatever the client sent, so a
  // rotating fake value there would both bypass the limit and (via
  // hits.size > 500) force hits.clear() to fire continuously, wiping out
  // genuine IPs' windows too. x-vercel-forwarded-for / x-real-ip are set by
  // Vercel's edge itself and can't be forged by the client; only fall back
  // to x-forwarded-for when neither is present (e.g. local dev).
  const forwardedForFirst = (req.headers['x-forwarded-for'] ?? '').split(',')[0].trim();
  const ip = req.headers['x-vercel-forwarded-for'] || req.headers['x-real-ip'] || forwardedForFirst || 'unknown';
  if (rateLimited(ip)) return res.status(429).json({ code: 'rateLimited' });

  try {
    const upstream = await fetch(kakaoSearchUrl(check.query), {
      headers: { Authorization: `KakaoAK ${key}` },
      // Fail rather than follow: a redirect could otherwise carry the
      // Authorization header to a host we didn't intend, and this removes
      // the dependency on undici's behavior of stripping it cross-origin.
      redirect: 'error',
    });
    if (!upstream.ok) {
      // Kakao's body can carry the key back in an error echo; log the
      // status only, and never pass its body to the browser.
      console.error(`kakao place search failed: HTTP ${upstream.status}`);
      return res.status(502).json({ code: 'upstream' });
    }
    const results = mapKakaoDocuments(await upstream.json());
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({ results });
  } catch (error) {
    console.error(`kakao place search error: ${error?.name}`);
    return res.status(502).json({ code: 'upstream' });
  }
}

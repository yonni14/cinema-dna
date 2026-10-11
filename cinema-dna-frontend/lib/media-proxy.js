// Only the edge contacts R2. Never redirect the browser to this origin.
const MEDIA_ORIGIN = 'https://pub-d05124f3b7094e6b8b0af331b009eeef.r2.dev';
const CACHE_CONTROL = 'public, max-age=86400, s-maxage=86400';
const VALID_KEYS = {
  posters: /^\d+\.webp$/,
  directors: /^[a-z0-9_]+\.webp$/,
};

function failure(status, message, extraHeaders = {}) {
  return new Response(message, {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
  });
}

export async function serveMedia(context, directory) {
  const { request, params } = context;
  if (!['GET', 'HEAD'].includes(request.method)) {
    return failure(405, 'Method not allowed', { Allow: 'GET, HEAD' });
  }
  if (!VALID_KEYS[directory]?.test(params.key)) {
    return failure(404, 'Image not found');
  }

  const url = new URL(request.url);
  const retry = url.searchParams.has('imgretry');
  const cacheKey = new Request(url.toString(), { method: 'GET' });
  const cache = globalThis.caches?.default;
  // Retry URLs deliberately skip the edge cache, and keep their query upstream.
  // Failed responses and retry variants are never cached.
  if (cache && !retry) {
    try {
      const cached = await cache.match(cacheKey);
      if (cached) {
        return request.method === 'HEAD'
          ? new Response(null, { status: cached.status, headers: cached.headers })
          : cached;
      }
    } catch {
      // A cache outage must not prevent loading an available image.
    }
  }

  const upstreamUrl = new URL(`/${directory}/${params.key}`, MEDIA_ORIGIN);
  upstreamUrl.search = url.search;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let upstream;
  try {
    upstream = await fetch(upstreamUrl, {
      method: request.method,
      redirect: 'manual',
      signal: controller.signal,
    });
  } catch {
    return failure(502, 'Image temporarily unavailable');
  } finally {
    clearTimeout(timeout);
  }

  if (upstream.status !== 200) {
    if (upstream.body) await upstream.body.cancel();
    return failure(upstream.status === 404 ? 404 : 502,
      upstream.status === 404 ? 'Image not found' : 'Image temporarily unavailable');
  }
  // Do not cache or return a provider error/block page as a successful image.
  if (upstream.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'image/webp') {
    if (upstream.body) await upstream.body.cancel();
    return failure(502, 'Invalid upstream image');
  }

  const headers = new Headers({
    'Content-Type': 'image/webp',
    'Cache-Control': CACHE_CONTROL,
    'X-Content-Type-Options': 'nosniff',
  });
  for (const name of ['Content-Length', 'ETag', 'Last-Modified']) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  const response = new Response(request.method === 'HEAD' ? null : upstream.body, {
    status: 200,
    headers,
  });
  if (cache && !retry && request.method === 'GET') {
    context.waitUntil(cache.put(cacheKey, response.clone()).catch(() => {}));
  }
  return response;
}

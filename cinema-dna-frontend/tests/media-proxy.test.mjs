import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { serveMedia } from '../lib/media-proxy.js';

const origin = 'https://pub-d05124f3b7094e6b8b0af331b009eeef.r2.dev';
const originalFetch = globalThis.fetch;
const image = () => new Response('image-bytes', {
  headers: { 'Content-Type': 'image/webp', ETag: '"abc"', 'Last-Modified': 'Sat, 03 Oct 2026 19:37:10 GMT' },
});
function context(path = '/posters/0.webp', method = 'GET', key = '0.webp') {
  const work = [];
  return { request: new Request(`https://cinema-dna.pages.dev${path}`, { method }),
    params: { key }, waitUntil: p => work.push(p), work };
}

// Sequential subtests isolate the mocked runtime globals.
test('media proxy', async t => {
  try {
    await t.test('streams image bytes, metadata and cache headers without redirect', async () => {
      let seen;
      globalThis.fetch = async (url, options) => { seen = [url.toString(), options]; return image(); };
      const r = await serveMedia(context(), 'posters');
      assert.equal(r.status, 200);
      assert.equal(await r.text(), 'image-bytes');
      assert.equal(r.headers.get('Content-Type'), 'image/webp');
      assert.equal(r.headers.get('ETag'), '"abc"');
      assert.equal(r.headers.get('Cache-Control'), 'public, max-age=86400, s-maxage=86400');
      assert.equal(r.headers.get('Location'), null);
      assert.equal(seen[0], `${origin}/posters/0.webp`);
      assert.equal(seen[1].redirect, 'manual');
    });
    await t.test('director route', async () => {
      globalThis.fetch = async url => { assert.equal(url.toString(), `${origin}/directors/stanley_kubrick.webp`); return image(); };
      assert.equal((await serveMedia(context('/directors/stanley_kubrick.webp', 'GET', 'stanley_kubrick.webp'), 'directors')).status, 200);
    });
    await t.test('HEAD has no body', async () => {
      globalThis.fetch = async (_, options) => { assert.equal(options.method, 'HEAD'); return image(); };
      const r = await serveMedia(context('/posters/0.webp', 'HEAD'), 'posters');
      assert.equal(await r.text(), '');
      assert.equal(r.headers.get('Content-Type'), 'image/webp');
    });
    await t.test('unsupported methods and invalid keys do not fetch', async () => {
      globalThis.fetch = async () => { throw new Error('must not fetch'); };
      assert.equal((await serveMedia(context('/posters/0.webp', 'POST'), 'posters')).status, 405);
      for (const key of ['../secret', 'x.webp', '0.jpg', '', 'https://evil.test']) {
        assert.equal((await serveMedia(context('/posters/0.webp', 'GET', key), 'posters')).status, 404);
      }
    });
    await t.test('upstream errors, redirects and HTML are not exposed or cached', async () => {
      for (const status of [404, 429, 500, 302]) {
        globalThis.fetch = async () => new Response('provider error', { status, headers: { Location: origin } });
        const r = await serveMedia(context(), 'posters');
        assert.equal(r.status, status === 404 ? 404 : 502);
        assert.equal(r.headers.get('Cache-Control'), 'no-store');
        assert.equal(r.headers.get('Location'), null);
      }
      globalThis.fetch = async () => new Response('<html>block</html>', { headers: { 'Content-Type': 'text/html' } });
      assert.equal((await serveMedia(context(), 'posters')).status, 502);
      globalThis.fetch = async () => { throw new Error('offline'); };
      assert.equal((await serveMedia(context(), 'posters')).status, 502);
    });
    await t.test('edge cache hit avoids upstream and supports HEAD', async () => {
      globalThis.caches = { default: { match: async () => image() } };
      globalThis.fetch = async () => { throw new Error('must not fetch'); };
      assert.equal(await (await serveMedia(context(), 'posters')).text(), 'image-bytes');
      assert.equal(await (await serveMedia(context('/posters/0.webp', 'HEAD'), 'posters')).text(), '');
    });
    await t.test('successful GET fills cache in background', async () => {
      let stored;
      globalThis.caches = { default: { match: async () => undefined, put: async (req, res) => { stored = [req.url, await res.text()]; } } };
      globalThis.fetch = async () => image();
      const c = context();
      assert.equal(await (await serveMedia(c, 'posters')).text(), 'image-bytes');
      await Promise.all(c.work);
      assert.deepEqual(stored, ['https://cinema-dna.pages.dev/posters/0.webp', 'image-bytes']);
    });
    await t.test('retry bypasses cache and preserves query upstream', async () => {
      globalThis.caches = { default: { match: async () => { throw new Error('must not match'); }, put: async () => { throw new Error('must not put'); } } };
      globalThis.fetch = async url => { assert.equal(url.toString(), `${origin}/posters/0.webp?imgretry=2&v=abc`); return image(); };
      const c = context('/posters/0.webp?imgretry=2&v=abc');
      assert.equal((await serveMedia(c, 'posters')).status, 200);
      assert.equal(c.work.length, 0);
    });
    await t.test('cache failure still returns image', async () => {
      globalThis.caches = { default: { match: async () => { throw new Error('cache unavailable'); }, put: async () => { throw new Error('cache unavailable'); } } };
      globalThis.fetch = async () => image();
      const c = context();
      assert.equal((await serveMedia(c, 'posters')).status, 200);
      await Promise.all(c.work);
    });
  } finally {
    globalThis.fetch = originalFetch;
    delete globalThis.caches;
  }
});

test('asset resolver ignores legacy R2 env values for every catalog image', async () => {
  const source = (await readFile(new URL('../src/engine.js', import.meta.url), 'utf8'))
    .replaceAll('import.meta.env', JSON.stringify({ VITE_POSTER_BASE_URL: origin, VITE_ASSETS_BASE_URL: origin }));
  const { resolveAssetUrl } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const catalog = JSON.parse(await readFile(new URL('../public/final_classified_db.json', import.meta.url), 'utf8'));
  for (const film of catalog) {
    for (const field of ['local_poster', 'local_director_image']) {
      if (film[field]) assert.equal(resolveAssetUrl(film[field]), `/${film[field]}`);
    }
  }
  assert.equal(resolveAssetUrl(`${origin}/posters/1.webp?imgretry=3`), '/posters/1.webp?imgretry=3');
  assert.equal(resolveAssetUrl('/directors/stanley_kubrick.webp'), '/directors/stanley_kubrick.webp');
  assert.equal(resolveAssetUrl('https://other.example/photo.jpg'), 'https://other.example/photo.jpg');
  assert.equal(resolveAssetUrl(''), '');
});

test('function routes preserve rating suggestions and exclude ordinary static pages', async () => {
  const routes = JSON.parse(await readFile(new URL('../public/_routes.json', import.meta.url), 'utf8'));
  assert.deepEqual(routes.include, ['/posters/*', '/directors/*', '/api/rating-suggestion']);
  assert.equal(routes.version, 1);
});

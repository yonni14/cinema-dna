// Cloudflare Pages Function: POST /api/rating-suggestion
// שומר הצעת שינוי דירוג כקובץ JSON נפרד במאגר GitHub.
//
// משתני סביבה (Cloudflare Pages > Settings > Variables and Secrets). לעולם לא בקוד:
//   GITHUB_TOKEN   (Secret)  fine-grained PAT, רק למאגר הזה, הרשאה Contents: Read and write
//   IP_HASH_SALT   (Secret)  מחרוזת אקראית ארוכה, לצורך הצפנת ה-IP
//   GITHUB_REPO    (Text)    למשל yonni14/cinema-dna
//   GITHUB_BRANCH  (Text, אופציונלי) ברירת מחדל: submissions  (ענף נפרד, לא main, כדי שלא יפעיל build)
//   STORE_RAW_IP   (Text, אופציונלי) "true" = לשמור IP גולמי במקום hash. ברירת מחדל: לא.
//   אחסון חלופי פרטי (Supabase): SUPABASE_URL (Text), SUPABASE_SERVICE_KEY (Secret). אם מוגדרים, משתמשים בהם במקום GitHub.
//   RATE_LIMIT_KV  (KV binding, אופציונלי) להגבלת קצב אמינה. בלי זה יש הגבלה בזיכרון בלבד.

// ציר -> טווח מותר (חייב להתאים ל-DNA_SCHEMA / NEW_AXES באפליקציה)
const AXES = {
  chamber_intimacy: 10, emotional_restraint: 10, plot_vs_mood: 10, raw_vs_stylized: 10,
  emotional_warmth: 10, psychological_depth: 10, irony_and_satire: 10, ambiguity_level: 10,
  grounded_vs_surreal: 10, emotional_heaviness: 10, violence_level: 5, sexuality_level: 5,
  cognitive_effort: 10, closing_resonance: 10,
};

const MAX_BODY_BYTES = 8000;
const MAX_CHANGES = 14;
const REASON_MAX = 500;
const RATE_MAX = 5;          // הצעות ל-IP
const RATE_WINDOW_SEC = 3600; // בשעה
const memHits = new Map();

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

async function hmacHex(salt, text) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(salt), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

async function rateLimited(env, ipKey) {
  if (env.RATE_LIMIT_KV) {
    const k = `rs:${ipKey}`;
    const n = parseInt((await env.RATE_LIMIT_KV.get(k)) || '0', 10);
    if (n >= RATE_MAX) return true;
    await env.RATE_LIMIT_KV.put(k, String(n + 1), { expirationTtl: RATE_WINDOW_SEC });
    return false;
  }
  const now = Date.now();
  const arr = (memHits.get(ipKey) || []).filter((t) => now - t < RATE_WINDOW_SEC * 1000);
  if (arr.length >= RATE_MAX) return true;
  arr.push(now);
  memHits.set(ipKey, arr);
  return false;
}

export async function onRequestPost({ request, env }) {
  const hasSb = env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY;
  if (!env.IP_HASH_SALT || (!hasSb && (!env.GITHUB_TOKEN || !env.GITHUB_REPO))) return json({ error: 'not_configured' }, 500);

  const len = parseInt(request.headers.get('content-length') || '0', 10);
  if (len > MAX_BODY_BYTES) return json({ error: 'too_large' }, 413);
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return json({ error: 'too_large' }, 413);

  // רק מהאתר עצמו
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'forbidden' }, 403);

  let body;
  try { body = JSON.parse(text); } catch { return json({ error: 'bad_json' }, 400); }

  // honeypot: בוטים ממלאים. מחזירים הצלחה מזויפת ולא שומרים.
  if (body.website) return json({ ok: true });

  const movieId = typeof body.movie_id === 'string' ? body.movie_id : '';
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(movieId)) return json({ error: 'bad_movie' }, 400);
  if (!Array.isArray(body.changes) || body.changes.length < 1 || body.changes.length > MAX_CHANGES) return json({ error: 'bad_changes' }, 400);

  const imdb = typeof body.imdb_id === 'string' && /^tt\d{5,12}$/.test(body.imdb_id) ? body.imdb_id : '';
  const title = typeof body.title === 'string' ? body.title.replace(/[\u0000-\u001f]/g, '').slice(0, 120) : '';

  const seen = new Set();
  const changes = [];
  for (const c of body.changes) {
    if (!c || !Object.prototype.hasOwnProperty.call(AXES, c.axis) || seen.has(c.axis)) return json({ error: 'bad_axis' }, 400);
    seen.add(c.axis);
    const cur = Number(c.current), prop = Number(c.proposed);
    if (!Number.isInteger(cur) || !Number.isInteger(prop) || cur < 1 || cur > AXES[c.axis] || prop < 1 || prop > AXES[c.axis] || cur === prop) return json({ error: 'bad_value' }, 400);
    const reason = typeof c.reason === 'string' ? c.reason.trim().slice(0, REASON_MAX) : '';
    if (reason.length < 5) return json({ error: 'reason_required' }, 400);
    changes.push({ axis: c.axis, current: cur, proposed: prop, reason });
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const ipHash = await hmacHex(env.IP_HASH_SALT, ip);
  if (await rateLimited(env, ipHash)) return json({ error: 'rate_limited' }, 429);

  const now = new Date();
  const record = {
    movie_id: movieId,
    imdb_id: imdb,
    title,
    submitted_at: now.toISOString(),
    visitor: env.STORE_RAW_IP === 'true' ? { ip } : { ip_hash: ipHash },
    changes,
  };
  // אחסון: Supabase (טבלה פרטית) אם הוגדר, אחרת GitHub.
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY) {
    const row = {
      movie_id: movieId, imdb_id: imdb, title,
      ip: env.STORE_RAW_IP === 'true' ? ip : null,
      ip_hash: ipHash,
      changes,
    };
    const r = await fetch(`${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/rating_suggestions`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
    });
    if (!r.ok) return json({ error: 'storage_failed' }, 502);
    return json({ ok: true });
  }

  const rand = crypto.getRandomValues(new Uint32Array(1))[0].toString(16);
  const path = `data/rating-suggestions/${now.toISOString().replace(/[:.]/g, '-')}_${movieId}_${rand}.json`;
  const content = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(record, null, 2) + '\n')));

  const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'cinema-dna-rating-suggestions',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: `rating suggestion for ${movieId}`, content, branch: env.GITHUB_BRANCH || 'submissions' }),
  });
  if (!res.ok) return json({ error: 'storage_failed' }, 502);
  return json({ ok: true });
}

export function onRequest() {
  return json({ error: 'method_not_allowed' }, 405);
}

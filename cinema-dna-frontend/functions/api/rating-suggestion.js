// Cloudflare Pages Function: POST /api/rating-suggestion
// Accepts the payload shape sent by RatingSuggestionModal.jsx:
//   { movie_id, title, imdb_id, website (honeypot), changes: [{axis, current, proposed, reason}] }
// Stores it in the D1 table `rating_suggestions` (bound as env.DB).

const AXES = [
  "warmth_humanity",
  "psych_depth",
  "irony_satire",
  "moral_ambiguity",
  "surrealism",
  "pacing",
  "aesthetic",
  "structure",
];

const numOrNull = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const strOrNull = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.DB) {
    return new Response(JSON.stringify({ error: "D1 Database binding 'DB' not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const data = await request.json();

    // Honeypot field ("website") — bots fill it, humans never see it.
    // Silently accept without storing anything.
    if (data.website) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    const movie_id = data.movie_id;
    // The modal sends `title`; accept `movie_title` too for robustness.
    const movie_title = data.title || data.movie_title;
    const changes = Array.isArray(data.changes) ? data.changes : [];

    if (!movie_id || !movie_title || changes.length === 0) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";

    // Map the changes array onto the table's per-axis columns.
    const byAxis = {};
    for (const c of changes) {
      if (c && AXES.includes(c.axis)) byAxis[c.axis] = c;
    }
    const pairs = [];
    for (const axis of AXES) {
      const c = byAxis[axis];
      pairs.push(numOrNull(c && c.proposed), strOrNull(c && c.reason));
    }

    const query = `
      INSERT INTO rating_suggestions (
        movie_id, movie_title, user_ip,
        warmth_humanity, warmth_reason,
        psych_depth, psych_reason,
        irony_satire, irony_reason,
        moral_ambiguity, moral_reason,
        surrealism, surreal_reason,
        pacing, pacing_reason,
        aesthetic, aesthetic_reason,
        structure, structure_reason
      ) VALUES (
        ?1, ?2, ?3,
        ?4, ?5,
        ?6, ?7,
        ?8, ?9,
        ?10, ?11,
        ?12, ?13,
        ?14, ?15,
        ?16, ?17,
        ?18, ?19
      )
    `;

    await env.DB.prepare(query).bind(movie_id, movie_title, clientIP, ...pairs).run();

    return new Response(JSON.stringify({ success: true, message: "Suggestion recorded successfully" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || "Failed to process suggestion" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

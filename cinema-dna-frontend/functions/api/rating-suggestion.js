export async function onRequestPost(context) {
  const { request, env } = context;

  // בדיקת קיום קישור למסד הנתונים
  if (!env.DB) {
    return new Response(JSON.stringify({ error: "D1 Database binding 'DB' not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const data = await request.json();

    if (!data.movie_id || !data.movie_title) {
      return new Response(JSON.stringify({ error: "Missing required fields: movie_id or movie_title" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // הפקת כתובת IP לצורכי מעקב ללא חשיפת פרטי זיהוי
    const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";

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

    await env.DB.prepare(query)
      .bind(
        data.movie_id,
        data.movie_title,
        clientIP,
        data.warmth_humanity ?? null,
        data.warmth_reason ?? null,
        data.psych_depth ?? null,
        data.psych_reason ?? null,
        data.irony_satire ?? null,
        data.irony_reason ?? null,
        data.moral_ambiguity ?? null,
        data.moral_reason ?? null,
        data.surrealism ?? null,
        data.surreal_reason ?? null,
        data.pacing ?? null,
        data.pacing_reason ?? null,
        data.aesthetic ?? null,
        data.aesthetic_reason ?? null,
        data.structure ?? null,
        data.structure_reason ?? null
      )
      .run();

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

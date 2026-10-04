-- Supabase: SQL Editor > New query > Run. טבלה פרטית להצעות שינוי דירוג.
create table if not exists public.rating_suggestions (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  movie_id text not null,
  imdb_id text,
  title text,
  ip text,            -- ריק אלא אם הוגדר STORE_RAW_IP=true
  ip_hash text,       -- קוד מוצפן (HMAC) לזיהוי כפילויות
  changes jsonb not null
);
-- RLS פעיל וללא שום policy: אף אחד לא יכול לקרוא או לכתוב עם המפתח הציבורי (anon).
-- הפונקציה בצד השרת כותבת עם service key, שעוקף RLS. המפתח הזה רק ב-Cloudflare, לא בקוד.
alter table public.rating_suggestions enable row level security;

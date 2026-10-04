Cinema DNA - definitive code set, October 2 2026

Live:https://cinema-dna.pages.dev/

One complete cinema-dna-frontend directory. Back up your local version, then replace it as a directory, not merge it with older feature patches.
No favorites, personal profile, login button, auth components or cloud user profile synchronization. Matching/scoring remains unchanged. Weights still work within the current session.
Theory page has its own /theory URL, direct load/reload and browser Back/Forward support. Existing Manifesto also uses /manifesto. Theory content is the owner's final supplied text from October 2, 17:48. All words preserved; visual headings/paragraphs and numbered list restored.

Poster variable for this deployment:
VITE_POSTER_BASE_URL=https://pub-d05124f3b7094e6b8b0af331b009eeef.r2.dev
Set it in Cloudflare Pages Environment Variables BEFORE building. .env.example is a template, not automatically loaded by Vite. For local testing, copy .env.example to .env.
The app appends JSON local_poster paths, e.g. posters/0.webp, to this root. No numbered posters are bundled in this source package; originals remain in GitHub. upload_posters.py copies Hebrew-named originals into numbered output using posters_rename_map.csv.

Cloudflare Pages via Git:
Repository yonni14/cinema-dna
Root directory cinema-dna-frontend
Build command npm run build
Output directory dist
Node: use a version supported by Vite 8, e.g. Node 22.12 or newer.
Push the code first, then connect the repo. Cloudflare Pages provides SPA fallback for /theory and /manifesto; this package does not contain a top-level 404.html.

Local build: npm ci then npm run build
Local preview: npm run preview
R2 upload: run from the directory holding upload_posters.py and CSV, after npx wrangler@4 login:
python3 upload_posters.py --source ~/Downloads/cinema-dna-repo/posters --map posters_rename_map.csv --bucket cinema-dna-assets --account-id 0053fc6fe1a1f1e9222165d4d4890cce --apply
Upload can overwrite the numbered poster keys; it deletes nothing. Without --apply, only copies/dry-run. No R2 upload has been executed by us.

Checks performed: production build; separate theory URL; reload and browser Back/Forward; both page back controls; desktop/mobile screenshots; no horizontal overflow at 390px; no runtime errors. Poster origin was mocked with the actual files for visual testing, so successful live R2 loading is still unverified. Before public release, verify live poster access.
No passwords, tokens, .env, node_modules or build outputs included.

# Cinema DNA

A movie discovery app that matches films to your personal taste. Each of ~1,050 films is scored on 12 cinematic "DNA" axes — tone, gaze, pacing, threshold content and more. Matching compares a centered user profile against every film with Z-scores and weighted Manhattan distance, and the result is shown as an explorable DNA graph.

**Live:** https://cinema-dna.pages.dev

## Stack

- React 19 + Vite, Tailwind CSS, react-force-graph-2d
- Cloudflare Pages hosting; poster and director images served from R2 through Pages Functions (`cinema-dna-frontend/functions/`)
- Supabase for the visitor rating-suggestion feature

## Repository layout

- `cinema-dna-frontend/` — the app (Cloudflare Pages build root: `npm ci`, `npm run build`, output `dist/`)
  - `public/final_classified_db.json` — the classified film dataset
  - `src/` — UI and matching engine (`engine.js`)
- `upload_posters.py` + `posters_rename_map.csv` — asset pipeline that renames Hebrew-titled poster files to the numbered keys the app uses

## Local development

```sh
cd cinema-dna-frontend
npm ci
npm run dev
```

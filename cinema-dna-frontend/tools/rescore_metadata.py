#!/usr/bin/env python3
"""
rescore_metadata.py - offline re-scoring of NEW fields per movie, using the Gemini API (spec v2.0):

  peak_violence_threshold   1-4   (1 none, 2 mild/off-screen, 3 conventional cinematic violence, 4 extreme/traumatic)
  peak_sexuality_threshold  1-4   (1 none, 2 mild/implied, 3 conventional nudity/sex, 4 graphic/assault)
  trigger_warnings          subset of ["sexual_assault", "animal_harm", "suicide"]  ([] if none)
  cognitive_effort          1-10  (accessible ... highly demanding)
  closing_resonance         1-10  (comfort/uplift ... existential void)
  themes                    2-3 terms from a fixed 28-term English taxonomy

The model returns raw JSON only: no explanations, no rationales, no confidence scores.
Every answer is validated against the vocabulary and ranges; invalid answers are discarded and the film is
retried on the next run. The existing fields (violence_level, sexuality_level, ...) are NOT touched, and the
input file is never modified: results go to a progress file (jsonl) and are merged into a NEW json file.

API keys come ONLY from environment variables (never from files / the command line):
  GEMINI_API_KEYS="key1,key2,key3"     (comma separated)   or
  GEMINI_API_KEY_1, GEMINI_API_KEY_2, ... (numbered)

Resume: every finished batch is appended to the progress file immediately. Re-running the same command skips
movies that are already done. Per-key daily usage is stored in a state file (it never stores the keys), so the
script rotates to the next key when one reaches its daily request cap or gets a quota error (HTTP 429), and
stops cleanly when all keys are used up for today. Run it again the next day to continue.

Example:
  export GEMINI_API_KEYS="..."
  python3 rescore_metadata.py --input final_classified_db.json --output final_classified_db.rescored.json
  python3 rescore_metadata.py --input final_classified_db.json --dry-run --limit 2    # prints the prompt only
"""
import argparse, json, os, sys, time, datetime, urllib.request, urllib.error

DEFAULT_MODEL = "gemini-2.5-flash"   # change with --model or env GEMINI_MODEL
BASE_URL = os.environ.get("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta")

THEMES = [
    "Obsession & Self-Destruction",
    "Alienation & Urban Isolation",
    "Grief, Mourning & Loss",
    "Guilt, Remorse & Redemption",
    "Madness, Psychosis & Mental Collapse",
    "Identity Crisis & Self-Discovery",
    "Coming of Age & Loss of Innocence",
    "Repression, Anxiety & Shame",
    "Marital Decay & Relationship Breakdown",
    "Generational Divide & Parent-Child Conflict",
    "Dependency, Jealousy & Power Dynamics",
    "Desire, Carnal Lust & Degradation",
    "Collapse of the Family Unit",
    "Immigration, Displacement & Exile",
    "Social Class, Poverty & Exploitation",
    "Institutional Corruption & Political Power",
    "Systemic Violence & Organized Crime",
    "Conformism, Oppression & Suffocating Routine",
    "Moral Justice, Retribution & Crime",
    "Existential Dread & Mortality",
    "Faith, Doubt & Spiritual Seeking",
    "The Absurd, Chance & Meaninglessness",
    "Memory, Time & Oblivion",
    "Historical & Collective Trauma",
    "Art, Creation & the Price of Genius",
    "Moral Decay & Nihilism",
    "Man vs. Nature & the Elements",
    "Illusion, Deception & Perceived Reality",
]
TRIGGERS = ["sexual_assault", "animal_harm", "suicide"]

RUBRIC = """You are a film content rater. For each film, return ONLY raw JSON. Do not write explanations, rationales or confidence scores.
Rate the thresholds by the PEAK (most intense single scene or sequence) of the film, not the average. Rate themes and axes by the film's overall existential focus.

peak_violence_threshold (integer 1-4):
 1 = none (verbal conflict only, no physical violence)
 2 = mild / off-screen (slap, scuffle, implied impact without blood or graphic focus)
 3 = conventional cinematic violence (gunfights, fist fights, stylized action, superficial blood)
 4 = extreme / traumatic (brutal physical harm, gore, sadism, torture, visceral suffering)

peak_sexuality_threshold (integer 1-4):
 1 = none (platonic, kissing, fully clothed)
 2 = mild / implied (romantic tension, underwear, cuts away before sexual acts)
 3 = conventional nudity / sex (tasteful nudity, non-invasive sex scenes)
 4 = graphic / assault (prolonged or explicit sexual depiction, rape, sexual violation, physical humiliation)

trigger_warnings: array, a subset of ["sexual_assault", "animal_harm", "suicide"]; [] if none apply.

cognitive_effort (integer 1-10):
 1-3 accessible, entertaining, linear, effortless to parse
 4-7 moderately demanding, needs attention to subtext and multi-layered plots
 8-10 highly demanding: fragmented narrative, temporal disjunction, dense philosophy, slow cinema, surreal puzzle

closing_resonance (integer 1-10, comfort vs. existential void):
 1-3 uplift, catharsis, emotional reconciliation, resolution, warmth
 4-6 bittersweet, contemplative, neutral, unresolved but stable
 7-10 existential dread, emotional void, alienation, bleak emptiness, lingering devastation

themes: array of 2 to 3 strings, chosen EXCLUSIVELY from this list (exact spelling):
""" + "\n".join(" - " + t for t in THEMES) + """

Return ONLY JSON: an array with one object per film, in exactly this form:
{"id": "<the id given>", "peak_violence_threshold": 4, "peak_sexuality_threshold": 4, "trigger_warnings": ["sexual_assault"], "cognitive_effort": 8, "closing_resonance": 9, "themes": ["Immigration, Displacement & Exile", "Art, Creation & the Price of Genius"]}"""

FIELDS = ("peak_violence_threshold", "peak_sexuality_threshold", "trigger_warnings",
          "cognitive_effort", "closing_resonance", "themes")


def load_keys():
    keys = []
    raw = os.environ.get("GEMINI_API_KEYS", "")
    keys += [k.strip() for k in raw.split(",") if k.strip()]
    i = 1
    while os.environ.get("GEMINI_API_KEY_%d" % i):
        keys.append(os.environ["GEMINI_API_KEY_%d" % i].strip())
        i += 1
    seen, out = set(), []
    for k in keys:
        if k not in seen:
            seen.add(k)
            out.append(k)
    return out


def key_id(i):
    return "key%d" % (i + 1)     # state file never stores the key itself


def today():
    return datetime.datetime.utcnow().strftime("%Y-%m-%d")   # Google daily quotas reset on a Pacific-time day; this is a safe approximation (the 429 handler covers the rest)


def build_prompt(batch):
    lines = [RUBRIC, "", "Films:"]
    for m in batch:
        lines.append(json.dumps({
            "id": m["id"],
            "title": m.get("e_title") or m.get("h_title"),
            "year": m.get("year"),
            "director": m.get("director_e") or m.get("director_h"),
            "description": (m.get("description") or "")[:600],
        }, ensure_ascii=False))
    return "\n".join(lines)


class QuotaExhausted(Exception):
    pass


def call_gemini(key, model, prompt, timeout=90):
    url = "%s/models/%s:generateContent" % (BASE_URL, model)
    body = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0, "responseMimeType": "application/json"},
    }).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST",
                                 headers={"Content-Type": "application/json", "x-goog-api-key": key})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        data = json.loads(r.read().decode("utf-8"))
    text = data["candidates"][0]["content"]["parts"][0]["text"]
    return json.loads(text)


def clean(item):
    """Validate one model answer against the spec. Returns a dict with exactly FIELDS, or None if anything is invalid."""
    if not isinstance(item, dict):
        return None
    out = {}
    for f, lo, hi in (("peak_violence_threshold", 1, 4), ("peak_sexuality_threshold", 1, 4),
                      ("cognitive_effort", 1, 10), ("closing_resonance", 1, 10)):
        try:
            v = int(round(float(item[f])))
        except Exception:
            return None
        if v < lo or v > hi:
            return None
        out[f] = v
    tw = item.get("trigger_warnings")
    if not isinstance(tw, list) or any(t not in TRIGGERS for t in tw):
        return None
    out["trigger_warnings"] = [t for t in TRIGGERS if t in tw]          # unique, stable order
    th = item.get("themes")
    if not isinstance(th, list):
        return None
    th = [t for i, t in enumerate(th) if t in THEMES and t not in th[:i]]   # drop unknown terms and duplicates
    if len(th) < 2 or len(th) > 3:
        return None
    out["themes"] = th
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--input", required=True, help="movies json (list). Never modified.")
    ap.add_argument("--output", default=None, help="merged json to write (default: <input>.rescored.json)")
    ap.add_argument("--progress", default=None, help="progress jsonl (default: <input>.progress.jsonl)")
    ap.add_argument("--state", default=None, help="per-key usage state (default: <input>.keystate.json)")
    ap.add_argument("--model", default=os.environ.get("GEMINI_MODEL", DEFAULT_MODEL))
    ap.add_argument("--batch-size", type=int, default=5, help="films per request (fewer requests per day)")
    ap.add_argument("--daily-cap", type=int, default=1400, help="max requests per key per day (limit is 1500)")
    ap.add_argument("--retries", type=int, default=4, help="retries per batch on temporary errors")
    ap.add_argument("--limit", type=int, default=0, help="process at most N films this run (0 = all)")
    ap.add_argument("--sleep", type=float, default=1.0, help="seconds between requests")
    ap.add_argument("--dry-run", action="store_true", help="print the first prompt and exit, no API calls")
    ap.add_argument("--merge-only", action="store_true", help="only merge the progress file into the output")
    a = ap.parse_args()

    out_path = a.output or a.input + ".rescored.json"
    prog_path = a.progress or a.input + ".progress.jsonl"
    state_path = a.state or a.input + ".keystate.json"
    if os.path.abspath(out_path) == os.path.abspath(a.input):
        sys.exit("--output must be a different file than --input")

    with open(a.input, encoding="utf-8") as f:
        movies = json.load(f)
    done = {}
    if os.path.exists(prog_path):
        with open(prog_path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    r = json.loads(line)
                    c = clean(r)
                    if c:   # old or invalid progress lines are ignored and re-done
                        done[str(r["id"])] = c

    todo = [m for m in movies if str(m.get("id")) not in done]
    if a.limit:
        todo = todo[: a.limit]
    batches = [todo[i:i + a.batch_size] for i in range(0, len(todo), a.batch_size)]
    print("films: %d total, %d done, %d to do this run (%d requests)" % (len(movies), len(done), len(todo), len(batches)))

    if a.dry_run:
        if batches:
            print(build_prompt(batches[0]))
        return

    if not a.merge_only and batches:
        keys = load_keys()
        if not keys:
            sys.exit("No API keys: set GEMINI_API_KEYS=key1,key2 (or GEMINI_API_KEY_1, GEMINI_API_KEY_2, ...)")
        state = {}
        if os.path.exists(state_path):
            with open(state_path) as f:
                state = json.load(f)
        def used(i):
            s = state.get(key_id(i), {})
            return s.get("count", 0) if s.get("date") == today() else 0
        def bump(i):
            state[key_id(i)] = {"date": today(), "count": used(i) + 1}
            with open(state_path, "w") as f:
                json.dump(state, f)
        blocked = set()    # keys that returned a quota error during this run
        cur = 0

        def pick():
            nonlocal cur
            for off in range(len(keys)):
                i = (cur + off) % len(keys)
                if i not in blocked and used(i) < a.daily_cap:
                    cur = i
                    return i
            return None

        n_ok = 0
        for bi, batch in enumerate(batches):
            ids = {str(m["id"]) for m in batch}
            result = None
            attempt = 0
            while result is None:
                ki = pick()
                if ki is None:
                    print("All keys are used up for today (cap %d/key). Run again later to resume." % a.daily_cap)
                    batches = None
                    break
                try:
                    bump(ki)
                    raw = call_gemini(keys[ki], a.model, build_prompt(batch))
                    if isinstance(raw, dict):
                        raw = raw.get("results") or raw.get("films") or [raw]
                    got = {}
                    for it in raw:
                        c = clean(it)
                        if c and str(it.get("id")) in ids:
                            got[str(it["id"])] = c
                    if got:
                        result = got
                    else:
                        raise ValueError("no valid items in response")
                except urllib.error.HTTPError as e:
                    if e.code in (429, 403):
                        print("%s: HTTP %d (quota/permission), switching key" % (key_id(ki), e.code))
                        blocked.add(ki)
                        continue
                    attempt += 1
                    print("%s: HTTP %d, retry %d/%d" % (key_id(ki), e.code, attempt, a.retries))
                    if attempt > a.retries:
                        result = {}
                    else:
                        time.sleep(min(60, 2 ** attempt))
                except (urllib.error.URLError, TimeoutError, ValueError, KeyError, IndexError, json.JSONDecodeError) as e:
                    attempt += 1
                    print("%s: %s, retry %d/%d" % (key_id(ki), type(e).__name__, attempt, a.retries))
                    if attempt > a.retries:
                        result = {}
                    else:
                        time.sleep(min(60, 2 ** attempt))
            if batches is None:
                break
            with open(prog_path, "a", encoding="utf-8") as f:
                for mid, c in result.items():
                    rec = {"id": mid}
                    rec.update(c)
                    f.write(json.dumps(rec, ensure_ascii=False) + "\n")
                    done[mid] = c
                    n_ok += 1
            missing = ids - set(result)
            if missing:
                print("batch %d: %d film(s) without a valid score (will be retried next run)" % (bi + 1, len(missing)))
            if (bi + 1) % 10 == 0:
                print("progress: %d/%d requests, %d scored this run" % (bi + 1, len(batches), n_ok))
            time.sleep(a.sleep)
        print("scored this run: %d" % n_ok)

    # merge into a NEW file; the input stays untouched
    merged = []
    for m in movies:
        m2 = dict(m)
        c = done.get(str(m.get("id")))
        if c:
            m2.update(c)
        merged.append(m2)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(merged, f, ensure_ascii=False, indent=1)
    print("wrote %s (%d/%d films have the new fields)" % (out_path, len(done), len(movies)))


if __name__ == "__main__":
    main()

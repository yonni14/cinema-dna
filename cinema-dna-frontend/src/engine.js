export const DNA_SCHEMA = [
  { key: "chamber_intimacy", label: "קאמריות ואינטימיות פנים", min: 1, max: 10, weight: 1.5, category: "הזירה והמבע הקולנועי", low_label: "אפי ופתוח", high_label: "קאמרי ואינטימי" },
  { key: "emotional_restraint", label: "איפוק רגשי וסאבטקסט", min: 1, max: 10, weight: 1.4, category: "הזירה והמבע הקולנועי", low_label: "מתפרץ וסוער", high_label: "מאופק ושקט" },
  { key: "plot_vs_mood", label: "מנוע: עלילה מול הוויה", min: 1, max: 10, weight: 1.4, category: "הזירה והמבע הקולנועי", low_label: "מונחה עלילה", high_label: "מונחה אווירה וזמן" },
  { key: "raw_vs_stylized", label: "ריאליזם מול סגנון מוקפד", min: 1, max: 10, weight: 1.2, category: "הזירה והמבע הקולנועי", low_label: "גולמי ומחוספס", high_label: "מסוגנן ומהונדס" },
  { key: "emotional_warmth", label: "טמפרטורה רגשית וחמלה", min: 1, max: 10, weight: 1.6, category: "המבט, הטון והפסיכולוגיה", low_label: "קר ואנליטי", high_label: "חם והומניסטי" },
  { key: "psychological_depth", label: "עומק פסיכולוגי וקיומי", min: 1, max: 10, weight: 1.5, category: "המבט, הטון והפסיכולוגיה", low_label: "בידורי/חיצוני", high_label: "חפירה נפשית" },
  { key: "irony_and_satire", label: "אירוניה והומור קיומי", min: 1, max: 10, weight: 1.3, category: "המבט, הטון והפסיכולוגיה", low_label: "רצינות תהומית", high_label: "אירוניה וסאטירה" },
  { key: "ambiguity_level", label: "עמימות מוסרית ונרטיבית", min: 1, max: 10, weight: 1.2, category: "המבט, הטון והפסיכולוגיה", low_label: "מוסר וסיום ברורים", high_label: "אזור אפור ופתוח" },
  { key: "grounded_vs_surreal", label: "מציאות מול סוריאליזם", min: 1, max: 10, weight: 1.4, category: "המבט, הטון והפסיכולוגיה", low_label: "מציאות יומיומית", high_label: "סוריאליזם/אלגוריה" },
  { key: "emotional_heaviness", label: "כובד רגשי ומועקה", min: 1, max: 10, weight: 0.6, category: "כובד צפייה ומסנני סף", low_label: "קליל ומנחם", high_label: "מטלטל וכבד" },
  { key: "violence_level", label: "אלימות בסרט כולו", min: 1, max: 5, weight: 0.3, category: "כובד צפייה ומסנני סף", low_label: "ללא", high_label: "רבה לאורך הסרט" },
  { key: "sexuality_level", label: "מיניות בסרט כולו", min: 1, max: 5, weight: 0.3, category: "כובד צפייה ומסנני סף", low_label: "ללא", high_label: "רבה לאורך הסרט" }
];

// שני צירים חדשים (מפרט v2.0). מופיעים באפליקציה רק כשהם קיימים במאגר
export const NEW_AXES = [
  { key: "cognitive_effort", label: "מאמץ קוגניטיבי", min: 1, max: 10, weight: 1.2, category: "המבט, הטון והחוויה", low_label: "נגיש", high_label: "תובעני" },
  { key: "closing_resonance", label: "תחושת חתימה", min: 1, max: 10, weight: 1.2, category: "המבט, הטון והחוויה", low_label: "נחמה", high_label: "ריקנות קיומית" }
];

// מפתחות ה-DNA "הישנים" שיוצאים מוקטור הדמיון כשהצירים החדשים קיימים (נשארים כשדות וכסליידרי סינון)
const WHOLE_FILM_KEYS = ["violence_level", "sexuality_level"];

// false (החלטת המשתמש) = 12 הצירים הנוכחיים נשארים (כולל אלימות/מיניות של הסרט כולו) והצירים החדשים נוספים עליהם כשהם קיימים במאגר: 14 בסך הכל.
// true = כמו במפרט: 10 מקוריים + 2 חדשים, בלי אלימות/מיניות.
export const SPEC_VECTOR = false;

export const DNA_KEYS = DNA_SCHEMA.map(s => s.key);

// יצירת אובייקט משקלי ברירת מחדל דינמי מתוך הסכמה (כולל הצירים החדשים)
export const DEFAULT_WEIGHTS = [...DNA_SCHEMA, ...NEW_AXES].reduce((acc, item) => {
  acc[item.key] = item.weight;
  return acc;
}, {});

function readNum(item, key) {
  const v = item[key] ?? (item.dna || {})[key];
  const n = Number(v);
  return v !== null && v !== undefined && v !== "" && Number.isFinite(n) ? n : null;
}

/** האם הצירים החדשים קיימים במאגר (לפחות סרט אחד עם שני הציונים) */
export function hasNewAxesData(rawList) {
  return rawList.some((item) => readNum(item, "cognitive_effort") !== null && readNum(item, "closing_resonance") !== null);
}

/** הסכמה המוצגת באפליקציה (סליידרים, פילטרים): 12 הנוכחיים, ועוד 2 החדשים אם קיימים במאגר */
export function buildSchema(rawList) {
  return hasNewAxesData(rawList) ? [...DNA_SCHEMA, ...NEW_AXES] : DNA_SCHEMA;
}

/** המפתחות שנכנסים לוקטור הדמיון ולפירוט 12 הצירים */
export function getVectorKeys(schema) {
  const hasNew = schema.some((s) => s.key === "cognitive_effort");
  return schema
    .map((s) => s.key)
    .filter((k) => !(SPEC_VECTOR && hasNew && WHOLE_FILM_KEYS.includes(k)));
}

const TRIGGER_VOCAB = ["sexual_assault", "animal_harm", "suicide"];
function parseTriggerWarnings(v) {
  if (!Array.isArray(v)) return null; // null = אין נתון במאגר
  return v.filter((t) => TRIGGER_VOCAB.includes(t));
}
function parseThemes(v) {
  if (!Array.isArray(v)) return [];
  return v.filter((t) => typeof t === "string" && t).slice(0, 3);
}

function parsePeakThreshold(v) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 1 && n <= 4 ? n : null;
}

/**
 * עיבוד ראשוני של הנתונים מה-JSON:
 * שומר על חישוב ממוצע וסטיית תקן, ומשאיר וקטור z-score נקי
 */
export function processRawMovies(rawList, schemaArg) {
  const schema = schemaArg || buildSchema(rawList);
  const vectorKeys = getVectorKeys(schema);
  const n = rawList.length;
  const numFeatures = vectorKeys.length;

  const movies = rawList.map((item, idx) => {
    const dna = item.dna || {};
    const awards = item.awards || {};

    const movie = {
      id: idx,
      orig_id: item.id || String(idx),
      h_title: item.h_title || item.display_h || "ללא שם",
      e_title: item.e_title || item.display_e || "",
      year: parseInt(item.year || 0, 10),
      director_h: item.director_h || item.display_dir || "לא ידוע",
      director_e: item.director_e || "",
      local_poster: item.local_poster || "",
      description: item.description || "",
      wiki_url: item.wiki_url || "",
      wiki_url: item.wiki_url || "",
      imdb_id: item.imdb_id || "",
      director_nm_id: item.director_nm_id || "",
      director_wiki_url: item.director_wiki_url || "",
      local_director_image: item.local_director_image || "",
      oscar_wins: parseInt(item.oscar_wins ?? awards.oscar_wins ?? 0, 10),
      oscar_nominations: parseInt(item.oscar_nominations ?? awards.oscar_nominations ?? 0, 10),
      // שדות סף חדשים (1-4) מסקריפט הסקורינג המחודש; null אם עדיין לא קיימים במאגר
      peak_violence_threshold: parsePeakThreshold(item.peak_violence_threshold ?? dna.peak_violence_threshold),
      peak_sexuality_threshold: parsePeakThreshold(item.peak_sexuality_threshold ?? dna.peak_sexuality_threshold),
      // שדות חדשים (מפרט v2.0): אופציונליים. null / [] כשעדיין אין במאגר
      trigger_warnings: parseTriggerWarnings(item.trigger_warnings ?? dna.trigger_warnings),
      themes: parseThemes(item.themes ?? dna.themes),
      zKeys: vectorKeys,
      dna: {}
    };

    schema.forEach((s) => {
      const mid = s.max === 5 ? 3 : 5;
      let val = dna[s.key] ?? item[s.key] ?? mid;
      val = Math.round(Number(val));
      if (isNaN(val)) val = mid;
      movie.dna[s.key] = Math.max(s.min, Math.min(s.max, val));
    });

    return movie;
  });

  // חישוב ממוצע וסטיית תקן (StandardScaler)
  const means = new Array(numFeatures).fill(0);
  const stds = new Array(numFeatures).fill(0);

  for (let j = 0; j < numFeatures; j++) {
    const key = vectorKeys[j];
    let sum = 0;
    for (let i = 0; i < n; i++) sum += movies[i].dna[key];
    means[j] = sum / n;

    let varSum = 0;
    for (let i = 0; i < n; i++) {
      const diff = movies[i].dna[key] - means[j];
      varSum += diff * diff;
    }
    stds[j] = Math.sqrt(varSum / n) || 1.0;
  }

  // שמירת וקטור ה-Z הטהור לכל סרט
  movies.forEach((m) => {
    m.zVector = vectorKeys.map((k, j) => (m.dna[k] - means[j]) / stds[j]);
  });

  return movies;
}

/**
 * מציאת הסרטים הדומים ביותר עם תמיכה במשקלים דינמיים וביטול פרמטרים
 */
export function getRecommendations(targetMovie, allMovies, topK = 8, customWeights = DEFAULT_WEIGHTS) {
  if (!targetMovie || !allMovies || allMovies.length === 0) return [];

  const targetVec = targetMovie.zVector;
  const numFeatures = targetVec.length;
  const targetDir = targetMovie.director_h;

  // הכנת מערך משקלים פעיל לפי סדר מפתחות הוקטור של הסרט
  const vectorKeys = targetMovie.zKeys || DNA_KEYS;
  const activeWeights = vectorKeys.map(k => customWeights[k] ?? DEFAULT_WEIGHTS[k] ?? 0);

  const scored = [];
  const allDists = [];

  for (let i = 0; i < allMovies.length; i++) {
    const other = allMovies[i];
    if (other.id === targetMovie.id) continue;

    let distSq = 0;
    const otherVec = other.zVector;

    for (let j = 0; j < numFeatures; j++) {
      const w = activeWeights[j];
      if (w <= 0) continue; // דילוג על מאפיין שמנוטרל
      const diff = targetVec[j] - otherVec[j];
      distSq += w * (diff * diff);
    }

    const dist = Math.sqrt(distSq);
    scored.push({ movie: other, dist });
    if (dist > 0) allDists.push(dist);
  }

  // חישוב scale_factor (אחוזון 40 של המרחקים)
  allDists.sort((a, b) => a - b);
  const p40Idx = Math.floor(allDists.length * 0.4);
  const scaleFactor = allDists[p40Idx] || 1.0;

  // המרה לציוני דמיון
  scored.forEach((item) => {
    let sim = 100.0 * Math.exp(-0.45 * Math.pow(item.dist / scaleFactor, 1.3));

    // בונוס במאי (+6 עד תקרה של 96)
    if (targetDir && targetDir !== "לא ידוע" && item.movie.director_h === targetDir) {
      sim = Math.min(96.0, sim + 6.0);
    }

    item.score = Math.round(sim * 10) / 10;
  });

  scored.sort((a, b) => b.score - a.score);
  return topK ? scored.slice(0, topK) : scored;
}

/**
 * סינון סרטים לפי סליידרים ידניים
 */
export function filterMoviesByDna(allMovies, filters) {
  return allMovies.filter((m) => {
    for (const [key, range] of Object.entries(filters)) {
      if (!range) continue;
      const val = m.dna[key];
      if (val < range[0] || val > range[1]) return false;
    }
    return true;
  });
}
/**
 * פתרון נתיב נכס מדיה (פוסטר / תמונת במאי).
 * כאשר מוגדר VITE_ASSETS_BASE_URL (למשל דומיין R2 ציבורי), הנתיב היחסי
 * משורשר אליו; אחרת מוחזר הנתיב המקומי מתוך public/.
 */
const POSTER_BASE_URL = (import.meta.env.VITE_POSTER_BASE_URL || "").replace(/\/+$/, "");
const ASSETS_BASE_URL = (import.meta.env.VITE_ASSETS_BASE_URL || "").replace(/\/+$/, "");

export function resolveAssetUrl(localPath) {
  if (!localPath) return "";
  const clean = String(localPath).replace(/^\/+/, "");
  if (/^https?:\/\//i.test(clean)) return clean;
  const base = clean.startsWith("posters/") ? (POSTER_BASE_URL || ASSETS_BASE_URL) : ASSETS_BASE_URL;
  return base ? `${base}/${clean}` : `/${clean}`;
}


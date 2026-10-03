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
  { key: "violence_level", label: "רמת אלימות", min: 1, max: 5, weight: 0.3, category: "כובד צפייה ומסנני סף", low_label: "ללא", high_label: "קיצוני" },
  { key: "sexuality_level", label: "רמת מיניות", min: 1, max: 5, weight: 0.3, category: "כובד צפייה ומסנני סף", low_label: "ללא", high_label: "מפורש" }
];

export const DNA_KEYS = DNA_SCHEMA.map(s => s.key);

// יצירת אובייקט משקלי ברירת מחדל דינמי מתוך הסכמה
export const DEFAULT_WEIGHTS = DNA_SCHEMA.reduce((acc, item) => {
  acc[item.key] = item.weight;
  return acc;
}, {});

/**
 * עיבוד ראשוני של הנתונים מה-JSON:
 * שומר על חישוב ממוצע וסטיית תקן, ומשאיר וקטור z-score נקי
 */
export function processRawMovies(rawList) {
  const n = rawList.length;
  const numFeatures = DNA_KEYS.length;

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
      dna: {}
    };

    DNA_SCHEMA.forEach((s) => {
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
    const key = DNA_KEYS[j];
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
    m.zVector = DNA_KEYS.map((k, j) => (m.dna[k] - means[j]) / stds[j]);
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

  // הכנת מערך משקלים פעיל לפי סדר המאפיינים ב-DNA_KEYS
  const activeWeights = DNA_KEYS.map(k => customWeights[k] ?? 0);

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

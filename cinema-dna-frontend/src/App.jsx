import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Settings, X, SlidersHorizontal, ArrowRight, ArrowLeft } from 'lucide-react';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { DNA_SCHEMA, processRawMovies, getRecommendations, DEFAULT_WEIGHTS, resolveAssetUrl } from './engine';
import WeightsSettingsModal from './components/WeightsSettingsModal';
import TheoryPage from './components/TheoryPage';

// חלוקת 12 הצירים ל-3 קטגוריות
const CATEGORIES_CONFIG = [
  {
    id: 'form',
    index: '01',
    heTitle: 'הזירה והמבע הקולנועי',
    keys: ['chamber_intimacy', 'emotional_restraint', 'plot_vs_mood', 'raw_vs_stylized'],
  },
  {
    id: 'tone',
    index: '02',
    heTitle: 'המבט, הטון והפסיכולוגיה',
    keys: [
      'emotional_warmth',
      'psychological_depth',
      'irony_and_satire',
      'ambiguity_level',
      'grounded_vs_surreal',
      'emotional_heaviness',
    ],
  },
  {
    id: 'thresholds',
    index: '03',
    heTitle: 'מסנני סף וצפייה',
    keys: ['violence_level', 'sexuality_level'],
  },
];

// דיאגרמה מעגלית שווייצרית (Circular Gauge)
const CircularGauge = ({
  value = 0,
  size = 96,
  strokeWidth = 2.5,
  label = '',
  color = '#141614',
  bgColor = '#DCD7CE',
}) => {
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center relative select-none" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={bgColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-1">
        <span className="font-mono-tech font-bold text-base md:text-lg text-[#141614] leading-none">
          {value}%
        </span>
        {label && (
          <span className="font-mono-tech text-[8px] tracking-widest text-[#858A81] uppercase mt-1">
            {label}
          </span>
        )}
      </div>
    </div>
  );
};

function App() {
  const [allMovies, setAllMovies] = useState([]);
  const [schema, setSchema] = useState([]);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [pinnedComparisonMovie, setPinnedComparisonMovie] = useState(null);
  const [navigationHistory, setNavigationHistory] = useState([]);
  const [hoveredMovieId, setHoveredMovieId] = useState(null);
  const [selectedDirector, setSelectedDirector] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(40);
  const [loading, setLoading] = useState(true);
  const [numFilters, setNumFilters] = useState({});

  // קטגוריות סינון סגורות כברירת מחדל
  const [openCategories, setOpenCategories] = useState({
    form: false,
    tone: false,
    thresholds: false,
  });

  const [showFullDnaBreakdown, setShowFullDnaBreakdown] = useState(false);
  const [showDirectorFullDna, setShowDirectorFullDna] = useState(false);
  const pageFromPath = () => window.location.pathname.replace(/\/$/, '') === '/theory'
    ? 'theory' : 'home';
  const [currentPage, setCurrentPage] = useState(pageFromPath);
  const navigateToPage = (page) => {
    const path = page === 'home' ? '/' : `/${page}`;
    if (window.location.pathname !== path) window.history.pushState({}, '', path);
    setCurrentPage(page);
    setShowSearchDropdown(false);
    setIsMobileFiltersOpen(false);
    window.scrollTo({ top: 0 });
  };
  useEffect(() => {
    const onPopState = () => {
      setCurrentPage(pageFromPath());
      setShowSearchDropdown(false);
      setIsMobileFiltersOpen(false);
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);

  const searchContainerRef = useRef(null);

  useEffect(() => {
    fetch(`/final_classified_db.json?v=${Date.now()}`)
      .then((res) => res.json())
      .then((rawData) => {
        const processed = processRawMovies(rawData);
        setAllMovies(processed);
        setSchema(DNA_SCHEMA);

        const initialFilters = {};
        DNA_SCHEMA.forEach((item) => {
          initialFilters[item.key] = [item.min ?? 1, item.max ?? 10];
        });
        setNumFilters(initialFilters);
        setLoading(false);
      })
      .catch((err) => {
        console.error('שגיאה בטעינת נתונים:', err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const corpusStats = useMemo(() => {
    if (!allMovies.length || !schema.length) return {};
    const stats = {};
    schema.forEach((axis) => {
      const vals = allMovies.map((m) => Number(m.dna?.[axis.key] ?? axis.min ?? 1));
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const variance = vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / vals.length;
      const std = Math.sqrt(variance) || 1;
      stats[axis.key] = { mean, std };
    });
    return stats;
  }, [allMovies, schema]);

  const computeVectorDistance = (movieA, movieB) => {
    if (!movieA || !movieB || !schema.length) return 0;
    let sumSq = 0;
    schema.forEach((axis) => {
      const w = weights[axis.key] ?? axis.weight ?? 1.0;
      if (w <= 0) return;
      const stat = corpusStats[axis.key] || { mean: 5, std: 1 };
      const valA = Number(movieA.dna?.[axis.key] ?? movieA[axis.key] ?? axis.min ?? 1);
      const valB = Number(movieB.dna?.[axis.key] ?? movieB[axis.key] ?? axis.min ?? 1);
      const zA = (valA - stat.mean) / stat.std;
      const zB = (valB - stat.mean) / stat.std;
      sumSq += w * Math.pow(zA - zB, 2);
    });
    return Math.sqrt(sumSq);
  };

  const schemaMap = useMemo(() => {
    const map = {};
    schema.forEach((item) => {
      map[item.key] = item;
    });
    return map;
  }, [schema]);

  const resetFilters = () => {
    const reset = {};
    schema.forEach((item) => {
      reset[item.key] = [item.min ?? 1, item.max ?? 10];
    });
    setNumFilters(reset);
    setDisplayLimit(40);
  };

  const hasActiveFilters = useMemo(() => {
    return schema.some((item) => {
      const range = numFilters[item.key];
      if (!range) return false;
      return range[0] > (item.min ?? 1) || range[1] < (item.max ?? 10);
    });
  }, [schema, numFilters]);

  const handleMovieSelect = (id, options = {}) => {
    if (id === undefined || id === null) return;
    const movie = allMovies.find((m) => String(m.id) === String(id));
    if (!movie) return;

    setDisplayLimit(40);
    setSearchQuery('');
    setShowSearchDropdown(false);
    setSelectedDirector(null);

    const { isBackNavigation = false, explicitComparisonTarget = null } = options;

    if (!isBackNavigation) {
      if (selectedMovie) {
        setNavigationHistory((prev) => [
          ...prev,
          {
            movie: selectedMovie.movie,
            previousComparison: pinnedComparisonMovie,
          },
        ]);
        setPinnedComparisonMovie(explicitComparisonTarget || selectedMovie.movie);
      } else {
        setNavigationHistory([]);
        setPinnedComparisonMovie(explicitComparisonTarget || null);
      }
    }

    const recs = getRecommendations(movie, allMovies, allMovies.length, weights);
    const matchScores = {};
    const rawDistances = {};

    recs.forEach((r) => {
      matchScores[r.movie.id] = r.score;
      if (typeof r.distance === 'number') {
        rawDistances[r.movie.id] = r.distance;
      }
    });

    setSelectedMovie({
      movie: {
        ...movie,
        display_h: movie.h_title || movie.display_h,
        display_e: movie.e_title || movie.display_e,
        display_dir: movie.director_h || movie.display_dir,
        ...movie.dna,
      },
      match_scores: matchScores,
      raw_distances: rawDistances,
      recommendations: recs.slice(0, 8),
    });

    setShowFullDnaBreakdown(false);
    setHoveredMovieId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoBack = () => {
    if (navigationHistory.length === 0) {
      handleClearSelection();
      return;
    }
    const lastEntry = navigationHistory[navigationHistory.length - 1];
    const newHistory = navigationHistory.slice(0, -1);
    setNavigationHistory(newHistory);
    setPinnedComparisonMovie(lastEntry.previousComparison);
    handleMovieSelect(lastEntry.movie.id, { isBackNavigation: true });
  };

  const handleClearSelection = () => {
    setSelectedMovie(null);
    setPinnedComparisonMovie(null);
    setNavigationHistory([]);
    setHoveredMovieId(null);
    setSelectedDirector(null);
  };

  const handleDirectorSelect = (directorName) => {
    if (!directorName || directorName === 'לא ידוע') return;
    setSelectedDirector(directorName);
    setSelectedMovie(null);
    setPinnedComparisonMovie(null);
    setSearchQuery('');
    setShowSearchDropdown(false);
    setDisplayLimit(40);
    setShowDirectorFullDna(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (selectedMovie && allMovies.length > 0) {
      const activeMovieObj = allMovies.find((m) => m.id === selectedMovie.movie.id);
      if (!activeMovieObj) return;

      const recs = getRecommendations(activeMovieObj, allMovies, allMovies.length, weights);
      const matchScores = {};
      const rawDistances = {};

      recs.forEach((r) => {
        matchScores[r.movie.id] = r.score;
        if (typeof r.distance === 'number') {
          rawDistances[r.movie.id] = r.distance;
        }
      });

      setSelectedMovie((prev) => ({
        ...prev,
        match_scores: matchScores,
        raw_distances: rawDistances,
        recommendations: recs.slice(0, 8),
      }));
    }
  }, [weights, allMovies]);

  const searchDropdownData = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return { movies: [], directors: [] };

    const matchedMovies = allMovies
      .filter(
        (m) =>
          (m.h_title || '').toLowerCase().includes(q) ||
          (m.e_title || '').toLowerCase().includes(q) ||
          (m.director_h || '').toLowerCase().includes(q) ||
          (m.director_e || '').toLowerCase().includes(q)
      )
      .slice(0, 6);

    const directorSet = new Map();
    allMovies.forEach((m) => {
      const dirH = m.director_h || '';
      const dirE = m.director_e || '';
      if (
        (dirH && dirH !== 'לא ידוע' && dirH.toLowerCase().includes(q)) ||
        (dirE && dirE.toLowerCase().includes(q))
      ) {
        if (!directorSet.has(dirH)) {
          directorSet.set(dirH, { nameH: dirH, nameE: dirE, count: 1 });
        } else {
          directorSet.get(dirH).count += 1;
        }
      }
    });

    return {
      movies: matchedMovies,
      directors: Array.from(directorSet.values()).slice(0, 4),
    };
  }, [searchQuery, allMovies]);

  const directorStats = useMemo(() => {
    if (!selectedDirector || !allMovies.length || !schema.length) return null;

    const dMovies = allMovies.filter(
      (m) =>
        (m.director_h && m.director_h.toLowerCase() === selectedDirector.toLowerCase()) ||
        (m.director_e && m.director_e.toLowerCase() === selectedDirector.toLowerCase())
    );

    if (dMovies.length === 0) return null;

    const directorH = dMovies[0].director_h || selectedDirector;
    const directorE = dMovies[0].director_e || '';

    const avgDna = {};
    schema.forEach((axis) => {
      const sum = dMovies.reduce((acc, m) => acc + Number(m.dna?.[axis.key] ?? axis.min ?? 1), 0);
      avgDna[axis.key] = Number((sum / dMovies.length).toFixed(1));
    });

    const pillars = CATEGORIES_CONFIG.map((cat) => {
      let totalNormalized = 0;
      let count = 0;
      cat.keys.forEach((k) => {
        const item = schemaMap[k];
        if (!item) return;
        const val = avgDna[k] ?? item.min ?? 1;
        const min = item.min ?? 1;
        const max = item.max ?? 10;
        totalNormalized += (val - min) / (max - min);
        count += 1;
      });
      const avgScore = count > 0 ? Math.round((totalNormalized / count) * 100) : 50;
      return {
        id: cat.id,
        index: cat.index,
        title: cat.heTitle,
        score: avgScore,
      };
    });

    // דירוג תכונות חתימה לפי מרחק סטיות תקן מהקורפוס (|Z-Score|)
    const traits = schema
      .map((axis) => {
        const val = avgDna[axis.key];
        const stat = corpusStats[axis.key] || { mean: 5, std: 1 };
        const zScore = (val - stat.mean) / stat.std;
        const absZ = Math.abs(zScore);

        return {
          ...axis,
          avgVal: val,
          zScore: Number(zScore.toFixed(2)),
          absZ,
        };
      })
      .sort((a, b) => b.absZ - a.absZ);

    const searchTarget = directorE || directorH;

   // שליפת הנתונים המאומתים ישירות מרשימת הסרטים של הבמאי
  const matchedMovie = dMovies.find((m) => m.director_nm_id && m.director_nm_id.startsWith('nm'));

  // ויקיפדיה מאומתת בלבד מה-JSON
  const wikiUrl = matchedMovie?.director_wiki_url || null;

  // קישור ישיר לפרופיל IMDb של הבמאי לפי ה-nm_id המאומת
  const imdbUrl = matchedMovie?.director_nm_id
    ? `https://www.imdb.com/name/${matchedMovie.director_nm_id}/`
    : null;

  // קישור מנוקה ל-Letterboxd
  const cleanLbName = (directorE || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const lbUrl = cleanLbName ? `https://letterboxd.com/director/${cleanLbName}/` : null;

    return {
      directorH,
      directorE,
      movieCount: dMovies.length,
      avgDna,
      pillars,
      topTraits: traits.slice(0, 4),
      wikiUrl,
      lbUrl,
      imdbUrl,
    };
    }, [selectedDirector, allMovies, schema, schemaMap, corpusStats]);


  const filteredAndSortedMovies = useMemo(() => {
    let result = [...allMovies];

    if (selectedDirector) {
      result = result.filter(
        (m) =>
          (m.director_h && m.director_h.toLowerCase() === selectedDirector.toLowerCase()) ||
          (m.director_e && m.director_e.toLowerCase() === selectedDirector.toLowerCase())
      );
    }

    schema.forEach((item) => {
      const range = numFilters[item.key];
      if (range) {
        const [min, max] = range;
        result = result.filter((m) => {
          const val = m.dna?.[item.key] ?? item.min ?? 1;
          return val >= min && val <= max;
        });
      }
    });

    if (selectedMovie) {
      const activeId = selectedMovie.movie.id;
      const scores = selectedMovie.match_scores || {};
      const distances = selectedMovie.raw_distances || {};

      result = result
        .filter((m) => m.id !== activeId)
        .map((m) => {
          const sameDirector =
            m.director_h &&
            m.director_h !== 'לא ידוע' &&
            m.director_h === selectedMovie.movie.display_dir;
          const dist =
            distances[m.id] !== undefined
              ? distances[m.id]
              : computeVectorDistance(selectedMovie.movie, m);

          return {
            ...m,
            display_h: m.h_title,
            display_e: m.e_title,
            display_dir: m.director_h,
            matchScore: scores[m.id] || 0,
            vectorDistance: dist,
            directorBonus: sameDirector ? 6 : 0,
          };
        });
      result.sort((a, b) => b.matchScore - a.matchScore);
    } else {
      result = result.map((m) => ({
        ...m,
        display_h: m.h_title,
        display_e: m.e_title,
        display_dir: m.director_h,
      }));
      result.sort((a, b) => b.year - a.year);
    }

    return result;
  }, [allMovies, schema, numFilters, selectedMovie, selectedDirector, weights, corpusStats]);

  const visibleMovies = filteredAndSortedMovies.slice(0, displayLimit);

  const comparisonMovie = useMemo(() => {
    if (!selectedMovie) return null;

    if (hoveredMovieId !== null) {
      const hovered = allMovies.find((m) => m.id === hoveredMovieId);
      if (hovered && hovered.id !== selectedMovie.movie.id) {
        const score = selectedMovie.match_scores?.[hovered.id] || 0;
        const dist =
          selectedMovie.raw_distances?.[hovered.id] ??
          computeVectorDistance(selectedMovie.movie, hovered);
        const sameDir =
          hovered.director_h &&
          hovered.director_h !== 'לא ידוע' &&
          hovered.director_h === selectedMovie.movie.display_dir;

        return {
          ...hovered,
          display_h: hovered.h_title,
          display_e: hovered.e_title,
          display_dir: hovered.director_h,
          matchScore: score,
          vectorDistance: dist,
          directorBonus: sameDir ? 6 : 0,
          comparisonSource: 'hover',
        };
      }
    }

    if (pinnedComparisonMovie && pinnedComparisonMovie.id !== selectedMovie.movie.id) {
      const origInAll = allMovies.find((m) => m.id === pinnedComparisonMovie.id);
      if (origInAll) {
        const score = selectedMovie.match_scores?.[origInAll.id] || 0;
        const dist =
          selectedMovie.raw_distances?.[origInAll.id] ??
          computeVectorDistance(selectedMovie.movie, origInAll);
        const sameDir =
          origInAll.director_h &&
          origInAll.director_h !== 'לא ידוע' &&
          origInAll.director_h === selectedMovie.movie.display_dir;

        return {
          ...origInAll,
          display_h: origInAll.h_title,
          display_e: origInAll.e_title,
          display_dir: origInAll.director_h,
          matchScore: score,
          vectorDistance: dist,
          directorBonus: sameDir ? 6 : 0,
          comparisonSource: 'origin',
        };
      }
    }

    if (filteredAndSortedMovies.length > 0) {
      return {
        ...filteredAndSortedMovies[0],
        comparisonSource: 'top_match',
      };
    }

    return null;
  }, [selectedMovie, filteredAndSortedMovies, hoveredMovieId, pinnedComparisonMovie, allMovies]);

  const matchAnalysisData = useMemo(() => {
    if (!selectedMovie || !comparisonMovie || !schema.length) return null;

    let zeroCount = 0;
    let closeCount = 0;
    let diffCount = 0;

    const allAxes = schema.map((axis) => {
      const valSelected = Number(selectedMovie.movie[axis.key] ?? axis.min ?? 1);
      const valTarget = Number(
        comparisonMovie.dna?.[axis.key] ?? comparisonMovie[axis.key] ?? axis.min ?? 1
      );
      // מסלול: מסרט ההשוואה (הקודם) אל הסרט שנבחר (החדש)
      const rawDelta = valSelected - valTarget;
      const absDelta = Math.abs(rawDelta);

      if (absDelta === 0) zeroCount += 1;
      else if (absDelta === 1) closeCount += 1;
      else diffCount += 1;

      return {
        key: axis.key,
        label: axis.label,
        valSelected,
        valTarget,
        max: axis.max ?? 10,
        rawDelta,
        absDelta,
      };
    });

    const sortedAxes = [...allAxes].sort((a, b) => b.absDelta - a.absDelta);

    return {
      axes: sortedAxes,
      targetMovie: comparisonMovie,
      zeroCount,
      closeCount,
      diffCount,
    };
  }, [selectedMovie, comparisonMovie, schema]);

  const categoryPillars = useMemo(() => {
    if (!selectedMovie || !schema.length) return [];

    return CATEGORIES_CONFIG.map((cat) => {
      let totalNormalized = 0;
      let count = 0;

      cat.keys.forEach((k) => {
        const item = schemaMap[k];
        if (!item) return;
        const val = Number(selectedMovie.movie[k] ?? item.min ?? 1);
        const min = item.min ?? 1;
        const max = item.max ?? 10;
        const norm = (val - min) / (max - min);
        totalNormalized += norm;
        count += 1;
      });

      const avgScore = count > 0 ? Math.round((totalNormalized / count) * 100) : 50;
      return {
        id: cat.id,
        index: cat.index,
        title: cat.heTitle,
        score: avgScore,
      };
    });
  }, [selectedMovie, schema, schemaMap]);

  const PLACEHOLDER_IMG = 'https://via.placeholder.com/300x450/EFECE4/858A81?text=NO+IMAGE';

  const getImageUrl = (localPath) => {
    const resolved = resolveAssetUrl(localPath);
    if (!resolved) return PLACEHOLDER_IMG;
    return resolved;
  };

  // אם קובץ המדיה לא קיים (למשל אחרי מעבר ל-R2 או מחיקת תיקיות מקומיות),
  // מחליפים לפלייסהולדר במקום אייקון תמונה שבורה.
  const handleImgError = (e) => {
    if (e.currentTarget.src !== PLACEHOLDER_IMG) e.currentTarget.src = PLACEHOLDER_IMG;
  };

  const toggleSidebarCategory = (catId) => {
    setOpenCategories((prev) => ({
      ...prev,
      [catId]: !prev[catId],
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F5F0] text-[#141614]">
        <div className="flex flex-col items-center gap-3">
          <span className="font-mono-tech text-xs tracking-[0.2em] text-[#858A81] uppercase">
            LOADING FILM DATABASE
          </span>
          <div className="w-48 h-[1px] bg-[#DCD7CE] relative overflow-hidden">
            <div className="w-1/2 h-full bg-[#141614] animate-pulse" />
          </div>
          <span className="font-mono-tech text-[10px] text-[#858A81]">1,053 RECORDS</span>
        </div>
      </div>
    );
  }

  const renderSidebarContent = () => (
    <div className="space-y-8">
      <div className="pb-4 border-b border-[#DCD7CE]">
        <div className="flex items-baseline justify-between" dir="ltr">
          <div>
            <h2 className="font-mono-tech text-xs font-semibold tracking-[0.14em] text-[#141614] uppercase">
              DNA PROFILE
            </h2>
            <p className="font-mono-tech text-[10px] tracking-[0.12em] text-[#858A81] mt-0.5">
              12 DIMENSIONS
            </p>
          </div>

          <div className="flex items-center gap-3">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="font-mono-tech text-[10px] tracking-wider text-[#52574F] hover:text-[#141614] hover:underline cursor-pointer uppercase"
              >
                [ RESET ]
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="font-mono-tech text-[10px] tracking-wider text-[#52574F] hover:text-[#141614] cursor-pointer uppercase flex items-center gap-1"
              title="כיול משקולות DNA"
            >
              <Settings className="w-3 h-3" />
              <span>WEIGHTS</span>
            </button>
          </div>
        </div>
      </div>

      {CATEGORIES_CONFIG.map((cat) => {
        const isOpen = openCategories[cat.id] ?? false;
        const items = cat.keys.map((k) => schemaMap[k]).filter(Boolean);

        return (
          <div key={cat.id} className="border-b border-[#DCD7CE] pb-6 last:border-b-0">
            <button
              type="button"
              onClick={() => toggleSidebarCategory(cat.id)}
              className="w-full flex items-baseline justify-between text-right pb-3 mb-4 border-b border-[#DCD7CE]/60 cursor-pointer group select-none"
              dir="rtl"
            >
              <div>
                <span className="font-mono-tech text-[10px] text-[#858A81] block mb-0.5">
                  {cat.index}
                </span>
                <span className="text-sm font-semibold text-[#141614] group-hover:text-[#52574F] transition-colors">
                  {cat.heTitle}
                </span>
              </div>
              <span className="font-mono-tech text-xs text-[#858A81] group-hover:text-[#141614]">
                {isOpen ? '−' : '+'}
              </span>
            </button>

            {isOpen && (
              <div className="space-y-6 pt-1">
                {items.map((item) => {
                  const minVal = item.min ?? 1;
                  const maxVal = item.max ?? 10;
                  const currentRange = numFilters[item.key] || [minVal, maxVal];
                  const isFiltered = currentRange[0] > minVal || currentRange[1] < maxVal;
                  const axisWeight = weights[item.key] ?? item.weight ?? 1.0;

                  return (
                    <div
                      key={item.key}
                      className={`space-y-1.5 ${axisWeight === 0 ? 'opacity-35' : ''}`}
                    >
                      <div className="flex justify-between items-baseline" dir="rtl">
                        <span className="text-xs font-medium text-[#141614]">{item.label}</span>
                        <span
                          className={`font-mono-tech text-xs font-semibold ${
                            isFiltered ? 'text-[#141614] underline' : 'text-[#141614]'
                          }`}
                          dir="ltr"
                        >
                          {currentRange[0]}—{currentRange[1]}
                        </span>
                      </div>

                      <div
                        className="flex justify-between items-center text-[10px] text-[#52574F] pt-0.5"
                        dir="ltr"
                      >
                        <span>{item.low_label}</span>
                        <span>{item.high_label}</span>
                      </div>

                      <div dir="ltr" className="pt-0.5">
                        <Slider
                          range={true}
                          min={minVal}
                          max={maxVal}
                          value={currentRange}
                          onChange={(val) => {
                            setNumFilters((prev) => ({ ...prev, [item.key]: val }));
                            setDisplayLimit(40);
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#141614]">
      {/* HEADER */}
      <header className="min-h-[72px] py-4 md:py-0 border-b border-[#DCD7CE] px-6 md:px-10 flex flex-wrap md:flex-nowrap items-center justify-between gap-4 md:gap-6">
        <div className="flex items-baseline gap-3">
          <button
            type="button"
            onClick={() => { handleClearSelection(); navigateToPage('home'); }}
            className="text-right cursor-pointer group flex items-baseline gap-2"
          >
            <span className="font-mono-tech text-xs text-[#858A81]">01</span>
            <span className="text-lg font-bold tracking-tight text-[#141614] group-hover:text-[#52574F] transition-colors">
              קולנוע DNA
            </span>
          </button>
        </div>

        {/* SEARCH */}
        <div className="relative order-3 md:order-none w-full md:w-auto md:flex-1 md:max-w-md" ref={searchContainerRef}>
          <input
            type="text"
            placeholder="⌕  חיפוש סרט, במאי..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSearchDropdown(true);
            }}
            onFocus={() => setShowSearchDropdown(true)}
            className="w-full h-[36px] bg-transparent border border-[#DCD7CE] focus:border-[#141614] rounded-none px-3 text-right text-xs font-medium text-[#141614] placeholder-[#858A81] focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setShowSearchDropdown(false);
              }}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#858A81] hover:text-[#141614] text-xs cursor-pointer"
            >
              ×
            </button>
          )}

          {showSearchDropdown &&
            (searchDropdownData.movies.length > 0 ||
              searchDropdownData.directors.length > 0) && (
              <div className="absolute z-50 w-full mt-[1px] bg-[#F7F5F0] border border-[#B2ACA0] shadow-sm rounded-none max-h-80 overflow-y-auto">
                {searchDropdownData.movies.length > 0 && (
                  <div>
                    <div
                      className="px-3 py-1.5 border-b border-[#DCD7CE] font-mono-tech text-[9px] tracking-widest text-[#858A81] uppercase"
                      dir="ltr"
                    >
                      FILMS
                    </div>
                    {searchDropdownData.movies.map((movie) => (
                      <button
                        key={movie.id}
                        type="button"
                        onClick={() => handleMovieSelect(movie.id)}
                        className="w-full px-3 py-2 text-right hover:bg-[#EFECE4] border-b border-[#DCD7CE]/60 last:border-b-0 flex items-baseline justify-between gap-3 cursor-pointer transition-colors"
                      >
                        <span className="text-xs font-medium text-[#141614] truncate">
                          {movie.h_title}
                        </span>
                        <span
                          className="font-mono-tech text-[10px] text-[#52574F] truncate shrink-0 movie-title-en"
                          dir="ltr"
                        >
                          {movie.e_title} ({movie.year})
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {searchDropdownData.directors.length > 0 && (
                  <div>
                    <div
                      className="px-3 py-1.5 border-y border-[#DCD7CE] font-mono-tech text-[9px] tracking-widest text-[#858A81] uppercase"
                      dir="ltr"
                    >
                      DIRECTORS
                    </div>
                    {searchDropdownData.directors.map((dir) => (
                      <button
                        key={dir.nameH}
                        type="button"
                        onClick={() => handleDirectorSelect(dir.nameH)}
                        className="w-full px-3 py-2 text-right hover:bg-[#EFECE4] border-b border-[#DCD7CE]/60 last:border-b-0 flex items-baseline justify-between gap-3 cursor-pointer transition-colors"
                      >
                        <span className="text-xs font-semibold text-[#141614]">{dir.nameH}</span>
                        <span className="font-mono-tech text-[10px] text-[#858A81]">
                          {dir.count} FILMS
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
        </div>

        {/* DATASET METADATA */}
        <div className="flex items-center flex-wrap gap-3 max-w-full" dir="ltr">
          <button
            type="button"
            onClick={() => {
              navigateToPage(currentPage === 'theory' ? 'home' : 'theory');
              window.scrollTo({ top: 0 });
            }}
            className="font-mono-tech text-[10px] tracking-wider text-[#141614] hover:text-[#52574F] border border-[#DCD7CE] px-2.5 py-1.5 cursor-pointer transition-colors"
            aria-pressed={currentPage === 'theory'}
          >
            {currentPage === 'theory' ? '[ חזרה לסרטים ]' : '[ מאחורי הסינון ]'}
          </button>

          <button
            type="button"
            onClick={() => setIsMobileFiltersOpen(true)}
            className="lg:hidden font-mono-tech text-[10px] tracking-wider text-[#141614] border border-[#DCD7CE] px-2 py-1.5 flex items-center gap-1.5 cursor-pointer"
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span>[ FILTERS ]</span>
          </button>

          <div className="text-left font-mono-tech text-[10px] tracking-wider text-[#858A81] uppercase">
            <span className="block text-[8px] text-[#858A81]">DATABASE</span>
            <span className="text-[#141614] font-medium">{allMovies.length.toLocaleString()} FILMS</span>
          </div>
        </div>
      </header>

            {currentPage === 'theory' ? (
        <TheoryPage
          onBack={() => {
            navigateToPage('home');
            window.scrollTo({ top: 0 });
          }}
        />
      ) : (
      <>
      {/* MAIN GRID */}
      <main className="px-6 md:px-10 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* COLUMN 1: SIDEBAR */}
          <aside className="hidden lg:block lg:col-span-3 lg:pl-6 lg:border-l lg:border-[#DCD7CE]">
            {renderSidebarContent()}
          </aside>

          {/* COLUMN 2: MAIN CONTENT */}
          <section className="lg:col-span-6 space-y-10">
            {/* DIRECTOR SPECIMEN */}
            {selectedDirector && directorStats && (
              <div className="pb-10 border-b border-[#DCD7CE] space-y-8">
                <div className="flex items-baseline justify-between pb-3 border-b border-[#DCD7CE]" dir="ltr">
                  <span className="font-mono-tech text-[10px] font-semibold tracking-widest text-[#858A81] uppercase">
                    DIRECTOR SPECIMEN
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedDirector(null)}
                    className="font-mono-tech text-[10px] tracking-wider text-[#141614] hover:text-[#52574F] cursor-pointer uppercase flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    <span>ALL FILMS</span>
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row items-start gap-6">
                  {directorStats.directorE && (
                    <div className="shrink-0 w-[125px] h-[165px] border border-[#DCD7CE] bg-[#EFECE4] overflow-hidden">
                      <img
                        src={getImageUrl(`directors/${directorStats.directorE.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}.webp`)}
                        alt={directorStats.directorH}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.parentElement.style.display = 'none';
                        }}
                      />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <h1 className="text-3xl md:text-4xl font-bold text-[#141614] leading-tight">
                      {directorStats.directorH}
                    </h1>
                    {directorStats.directorE && (
                      <h2 className="movie-title-en font-mono-tech text-xs tracking-widest text-[#52574F] uppercase mt-1" dir="ltr">
                        {directorStats.directorE}
                      </h2>
                    )}
                    <p className="font-mono-tech text-xs tracking-wider text-[#858A81] uppercase mt-2">
                      {directorStats.movieCount} FILMS IN CORPUS
                    </p>

                    <div className="mt-4 font-mono-tech text-[10px] tracking-widest text-[#52574F] flex items-center gap-2.5" dir="ltr">
                      <a
                        href={directorStats.wikiUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-[#141614] hover:underline"
                      >
                        WIKIPEDIA
                      </a>
                      <span>{'/'}</span>
                      <a
                        href={
                          filteredAndSortedMovies[0]?.director_nm_id
                            ? `https://www.imdb.com/name/${filteredAndSortedMovies[0].director_nm_id}/`
                            : directorStats.imdbUrl
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-[#141614] hover:underline"
                      >
                        IMDb
                      </a>
                      <span>{'/'}</span>
                      <a
                        href={
                          directorStats.directorE
                            ? `https://letterboxd.com/director/${directorStats.directorE
                                .toLowerCase()
                                .normalize('NFD')
                                .replace(/[\u0300-\u036f]/g, '')
                                .replace(/[^a-z0-9]+/g, '-')
                                .replace(/^-+|-+$/g, '')}/`
                            : directorStats.lbUrl
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-[#141614] hover:underline"
                      >
                        LETTERBOXD
                      </a>
                    </div>
                  </div>
                </div>

                {/* 3 הדיאגרמות של הבמאי */}
                <div className="pt-6 border-t border-[#DCD7CE] space-y-6">
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono-tech text-[10px] tracking-widest text-[#858A81] uppercase">
                      DIRECTOR SIGNATURE DNA / 3 PILLARS
                    </span>
                    <span className="text-xs text-[#52574F]">
                      סגנון משוקלל מכלל {directorStats.movieCount} הסרטים
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 py-2">
                    {directorStats.pillars.map((pil) => (
                      <div key={pil.id} className="flex flex-col items-center text-center space-y-2">
                        <CircularGauge
                          value={pil.score}
                          size={96}
                          strokeWidth={2.5}
                          label={pil.index}
                        />
                        <div>
                          <span className="text-xs font-semibold text-[#141614] block">
                            {pil.title}
                          </span>
                          <span className="font-mono-tech text-[10px] text-[#858A81]">
                            ממוצע פילמוגרפי
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* KEY SIGNATURE TRAITS וכפתור פתיחת הפירוט המלא */}
                  <div className="pt-4 border-t border-[#DCD7CE]/60">
                    <div className="flex items-baseline justify-between mb-3">
                      <span className="font-mono-tech text-[10px] tracking-widest text-[#858A81] uppercase">
                        KEY SIGNATURE TRAITS
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowDirectorFullDna((prev) => !prev)}
                        className="font-mono-tech text-xs font-semibold tracking-wider text-[#141614] hover:text-[#52574F] underline cursor-pointer transition-colors"
                      >
                        {showDirectorFullDna
                          ? 'הסתר את 12 הצירים המלאים  ↑'
                          : 'הצג את 12 הצירים המלאים  ↓'}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
                      {directorStats.topTraits.map((trait) => {
                        const val = Number(trait.avgVal ?? 1);
                        const min = trait.min ?? 1;
                        const max = trait.max ?? 10;
                        const pct = Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));

                        return (
                          <div key={trait.key} className="space-y-1">
                            <div className="flex justify-between items-baseline text-xs">
                              <span className="text-[#141614] font-medium truncate">{trait.label}</span>
                              <span className="font-mono-tech font-semibold text-[#141614]">{val}</span>
                            </div>

                            <div className="text-[10px] text-[#858A81] flex justify-between pt-0.5" dir="ltr">
                              <span>{trait.low_label}</span>
                              <span>{trait.high_label}</span>
                            </div>

                            <div className="relative h-2 flex items-center" dir="ltr">
                              <div className="w-full h-[2px] bg-[#DCD7CE]" />
                              <div
                                className="absolute h-[2px] bg-[#141614]"
                                style={{ width: `${pct}%`, left: 0 }}
                              />
                              <div
                                className="absolute w-2 h-2 rounded-full bg-[#141614] -translate-x-1/2"
                                style={{ left: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {/* פירוט 12 הצירים המלאים של ממוצע הבמאי (סגור בברירת מחדל) */}
                  {showDirectorFullDna && (
                    <div className="pt-6 border-t border-[#DCD7CE] space-y-8">
                      {CATEGORIES_CONFIG.map((cat) => {
                        const catItems = cat.keys.map((k) => schemaMap[k]).filter(Boolean);

                        return (
                          <div key={cat.id} className="space-y-4">
                            <div className="flex items-baseline gap-2 font-mono-tech text-xs text-[#858A81] pb-1 border-b border-[#DCD7CE]/60">
                              <span>{cat.index} {'/'}</span>
                              <span className="text-[#141614] font-semibold">{cat.heTitle}</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-5">
                              {catItems.map((item) => {
                                const val = Number(directorStats.avgDna[item.key] ?? item.min ?? 1);
                                const min = item.min ?? 1;
                                const max = item.max ?? 10;
                                const pct = Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));

                                return (
                                  <div key={item.key} className="space-y-1.5">
                                    <div className="flex justify-between items-baseline" dir="rtl">
                                      <span className="text-xs font-medium text-[#141614]">{item.label}</span>
                                      <span className="font-mono-tech text-xs font-semibold text-[#141614]" dir="ltr">
                                        {val}
                                        <span className="text-[10px] text-[#858A81]">/{max}</span>
                                      </span>
                                    </div>

                                    <div className="flex justify-between items-center text-[10px] text-[#52574F] pt-0.5" dir="ltr">
                                      <span>{item.low_label}</span>
                                      <span>{item.high_label}</span>
                                    </div>

                                    <div className="relative h-2 flex items-center" dir="ltr">
                                      <div className="w-full h-[2px] bg-[#DCD7CE]" />
                                      <div
                                        className="absolute h-[2px] bg-[#141614]"
                                        style={{ width: `${pct}%`, left: 0 }}
                                      />
                                      <div
                                        className="absolute w-2.5 h-2.5 rounded-full bg-[#141614] -translate-x-1/2 shadow-xs"
                                        style={{ left: `${pct}%` }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SELECTED FILM */}
            {selectedMovie && (
              <div className="pb-10 border-b border-[#DCD7CE] space-y-8">
                {/* Breadcrumbs */}
                <div className="flex items-center justify-between pb-2.5 border-b border-[#DCD7CE]" dir="ltr">
                  <div className="flex items-center gap-2 font-mono-tech text-[10px] tracking-wider text-[#858A81] uppercase truncate">
                    <button
                      type="button"
                      onClick={handleClearSelection}
                      className="hover:text-[#141614] cursor-pointer"
                    >
                      ALL FILMS
                    </button>
                    {navigationHistory.length > 0 && (
                      <>
                        <span>{'/'}</span>
                        <button
                          type="button"
                          onClick={handleGoBack}
                          className="hover:text-[#141614] cursor-pointer truncate max-w-[120px]"
                        >
                          {navigationHistory[navigationHistory.length - 1].movie.display_e ||
                            navigationHistory[navigationHistory.length - 1].movie.display_h}
                        </button>
                      </>
                    )}
                    <span>{'/'}</span>
                    <span className="text-[#141614] font-semibold truncate max-w-[140px]">
                      {selectedMovie.movie.display_e || selectedMovie.movie.display_h}
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    {navigationHistory.length > 0 && (
                      <button
                        type="button"
                        onClick={handleGoBack}
                        className="font-mono-tech text-[10px] tracking-wider text-[#141614] hover:text-[#52574F] cursor-pointer uppercase flex items-center gap-1"
                      >
                        <ArrowRight className="w-3 h-3" />
                        <span>PREVIOUS</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleClearSelection}
                      className="font-mono-tech text-[10px] tracking-wider text-[#858A81] hover:text-[#141614] cursor-pointer uppercase"
                    >
                      [ CLOSE ]
                    </button>
                  </div>
                </div>

                {/* פרטי הסרט */}
                <div className="flex flex-col sm:flex-row gap-8 items-start">
                  <div className="shrink-0">
                    <img
                      src={getImageUrl(selectedMovie.movie.local_poster)}
                      alt={selectedMovie.movie.display_h}
                      className="w-[175px] h-[260px] object-cover border border-[#DCD7CE]"
                      onError={handleImgError}
                    />
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch">
                    <div>
                      <div className="flex items-center gap-3">
                        <h1 className="text-3xl md:text-[34px] font-semibold text-[#141614] leading-tight tracking-tight">
                          {selectedMovie.movie.display_h}
                        </h1>
                      </div>
                      {selectedMovie.movie.display_e && (
                        <h2
                          className="movie-title-en font-mono-tech text-xs tracking-widest text-[#52574F] uppercase mt-1"
                          dir="ltr"
                        >
                          {selectedMovie.movie.display_e}
                        </h2>
                      )}

                      <div className="mt-4 flex items-baseline gap-2 text-xs text-[#52574F]">
                        <span className="font-mono-tech text-[#141614]">{selectedMovie.movie.year}</span>
                        <span>·</span>
                        <span>במאי:</span>
                        <button
                          type="button"
                          onClick={() => handleDirectorSelect(selectedMovie.movie.display_dir)}
                          className="text-[#141614] font-medium underline hover:no-underline cursor-pointer"
                        >
                          {selectedMovie.movie.display_dir}
                        </button>
                      </div>

                      {selectedMovie.movie.description && (
                        <p
                          dir="auto"
                          className="mt-4 text-[13px] font-normal text-[#141614] leading-relaxed max-w-xl"
                        >
                          {selectedMovie.movie.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-6 pt-4 border-t border-[#DCD7CE] flex flex-wrap items-center justify-between gap-4 text-xs">
                      {((selectedMovie.movie.oscar_wins ?? 0) > 0 ||
                        (selectedMovie.movie.oscar_nominations ?? 0) > 0) && (
                        <div className="font-mono-tech text-[10px] tracking-wider text-[#C5A059] uppercase flex items-center gap-1.5">
                          <span className="font-bold">★ OSCAR</span>
                          <span>
                            {selectedMovie.movie.oscar_wins ?? 0} WINS ·{' '}
                            {selectedMovie.movie.oscar_nominations ?? 0} NOM.
                          </span>
                        </div>
                      )}

                      <div
                        className="font-mono-tech text-[10px] tracking-widest text-[#858A81] flex items-center gap-2 mr-auto"
                        dir="ltr"
                      >
                        {selectedMovie.movie.wiki_url && (
                          <a
                            href={selectedMovie.movie.wiki_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-[#141614] transition-colors"
                          >
                            WIKI
                          </a>
                        )}
                        {selectedMovie.movie.wiki_url &&
                          (selectedMovie.movie.imdb_id ||
                            selectedMovie.movie.orig_id?.startsWith('tt')) && <span>·</span>}
                        {(selectedMovie.movie.imdb_id ||
                          selectedMovie.movie.orig_id?.startsWith('tt')) && (
                          <>
                            <a
                              href={`https://letterboxd.com/imdb/${
                                selectedMovie.movie.imdb_id || selectedMovie.movie.orig_id
                              }/`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-[#141614] transition-colors"
                            >
                              LETTERBOXD
                            </a>
                            <span>·</span>
                            <a
                              href={`https://www.imdb.com/title/${
                                selectedMovie.movie.imdb_id || selectedMovie.movie.orig_id
                              }/`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-[#141614] transition-colors"
                            >
                              IMDb
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3 דיאגרמות מעגליות לקטגוריות וכפתור פתיחת הפירוט המלא */}
                <div className="pt-6 border-t border-[#DCD7CE]">
                  <div className="flex items-baseline justify-between mb-4">
                    <span className="font-mono-tech text-[10px] tracking-widest text-[#858A81] uppercase">
                      DNA PILLARS SPECIMEN / 3 AXES
                    </span>
                   <button
                      type="button"
                      onClick={() => setShowFullDnaBreakdown((prev) => !prev)}
                      className="font-mono-tech text-xs font-semibold tracking-wider text-[#141614] hover:text-[#52574F] underline cursor-pointer transition-colors"
                    >
                      {showFullDnaBreakdown
                        ? 'הסתר את 12 הצירים המלאים  ↑'
                        : 'הצג את 12 הצירים המלאים  ↓'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 py-2">
                    {categoryPillars.map((pil) => (
                      <div key={pil.id} className="flex flex-col items-center text-center space-y-2">
                        <CircularGauge
                          value={pil.score}
                          size={96}
                          strokeWidth={2.5}
                          label={pil.index}
                        />
                        <div>
                          <span className="text-xs font-semibold text-[#141614] block">
                            {pil.title}
                          </span>
                          <span className="font-mono-tech text-[10px] text-[#858A81]">
                            מדד משוקלל
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* פירוט מלא של 12 הצירים בתצורה תואמת לסרגל הצד */}
                {showFullDnaBreakdown && (
                  <div className="pt-6 border-t border-[#DCD7CE] space-y-8">
                    {CATEGORIES_CONFIG.map((cat) => {
                      const catItems = cat.keys.map((k) => schemaMap[k]).filter(Boolean);

                      return (
                        <div key={cat.id} className="space-y-4">
                          <div className="flex items-baseline gap-2 font-mono-tech text-xs text-[#858A81] pb-1 border-b border-[#DCD7CE]/60">
                            <span>{cat.index} {'/'}</span>
                            <span className="text-[#141614] font-semibold">{cat.heTitle}</span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-5">
                            {catItems.map((item) => {
                              const val = Number(selectedMovie.movie[item.key] ?? item.min ?? 1);
                              const min = item.min ?? 1;
                              const max = item.max ?? 10;
                              const pct = Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));

                              return (
                                <div key={item.key} className="space-y-1.5">
                                  <div className="flex justify-between items-baseline" dir="rtl">
                                    <span className="text-xs font-medium text-[#141614]">{item.label}</span>
                                    <span className="font-mono-tech text-xs font-semibold text-[#141614]" dir="ltr">
                                      {val}
                                      <span className="text-[10px] text-[#858A81]">/{max}</span>
                                    </span>
                                  </div>

                                  <div className="flex justify-between items-center text-[10px] text-[#52574F] pt-0.5" dir="ltr">
                                    <span>{item.low_label}</span>
                                    <span>{item.high_label}</span>
                                  </div>

                                  <div className="relative h-2 flex items-center" dir="ltr">
                                    <div className="w-full h-[2px] bg-[#DCD7CE]" />
                                    <div
                                      className="absolute h-[2px] bg-[#141614]"
                                      style={{ width: `${pct}%`, left: 0 }}
                                    />
                                    <div
                                      className="absolute w-2.5 h-2.5 rounded-full bg-[#141614] -translate-x-1/2 shadow-xs"
                                      style={{ left: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* MOVIE GRID */}
            <div className="space-y-6">
              <div className="flex items-baseline justify-between pb-3 border-b border-[#DCD7CE]" dir="ltr">
                <span className="font-mono-tech text-[10px] tracking-widest text-[#858A81] uppercase">
                  {selectedMovie ? 'SIMILAR FILMS' : selectedDirector ? 'DIRECTOR CATALOG' : 'CATALOG'}
                </span>
                <span className="font-mono-tech text-[10px] tracking-wider text-[#52574F]">
                  {filteredAndSortedMovies.length} ENTRIES
                </span>
              </div>

              {filteredAndSortedMovies.length === 0 ? (
                <div className="py-20 text-center">
                  <p className="font-mono-tech text-xs tracking-wider text-[#141614] uppercase">
                    NO FILMS MATCH THE CURRENT PROFILE
                  </p>
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="mt-4 font-mono-tech text-xs tracking-wider text-[#52574F] hover:text-[#141614] underline cursor-pointer uppercase"
                  >
                    RESET ALL FILTERS
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-10">
                    {visibleMovies.map((movie, idx) => {
                      const indexStr = String(idx + 1).padStart(2, '0');
                      const isCompared = selectedMovie && comparisonMovie?.id === movie.id;

                      return (
                        <div
                          key={movie.id}
                          onClick={() => handleMovieSelect(movie.id)}
                          onMouseEnter={() => setHoveredMovieId(movie.id)}
                          onMouseLeave={() => setHoveredMovieId(null)}
                          className="group cursor-pointer flex flex-col"
                        >
                          <div
                            className={`relative aspect-[2/3] w-full border overflow-hidden bg-[#EFECE4] transition-colors ${
                              isCompared
                                ? 'border-[#141614]'
                                : 'border-[#DCD7CE] group-hover:border-[#141614]'
                            }`}
                          >
                            <img
                              src={getImageUrl(movie.local_poster)}
                              alt={movie.display_h}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onError={handleImgError}
                            />


                            {selectedMovie && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPinnedComparisonMovie(movie);
                                }}
                                className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity font-mono-tech text-[9px] tracking-wider bg-[#141614] text-[#F7F5F0] px-2 py-1 cursor-pointer"
                              >
                                COMPARE →
                              </button>
                            )}
                          </div>

                          <div className="pt-2.5 space-y-1">
                            <div className="flex items-baseline justify-between font-mono-tech text-[10px] text-[#858A81]" dir="ltr">
                              <span>{indexStr}</span>
                              {(movie.oscar_wins ?? 0) > 0 && (
                                <span className="text-[#C5A059] font-medium tracking-wider">
                                  ★ OSCAR ×{movie.oscar_wins}
                                </span>
                              )}
                            </div>

                            <h4
                              className="text-sm font-semibold text-[#141614] truncate leading-tight group-hover:underline"
                              title={movie.display_h}
                            >
                              {movie.display_h}
                            </h4>

                            {movie.display_e && (
                              <div
                                className="movie-title-en font-mono-tech text-[11px] text-[#52574F] uppercase truncate"
                                dir="ltr"
                              >
                                {movie.display_e}
                              </div>
                            )}

                            <div className="flex items-baseline justify-between text-[11px] text-[#858A81] pt-0.5">
                              <span className="truncate">{movie.display_dir}</span>
                              <span className="font-mono-tech">{movie.year}</span>
                            </div>

                            {selectedMovie && movie.matchScore > 0 && (
                              <div className="pt-1.5 border-t border-[#DCD7CE]/60 flex items-baseline justify-between" dir="ltr">
                                <span className="font-mono-tech text-sm font-bold text-[#141614]">
                                  {movie.matchScore}%
                                </span>
                                <span className="font-mono-tech text-[9px] tracking-widest text-[#858A81]">
                                  SIMILARITY
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-12 border-t border-[#DCD7CE] text-center space-y-2">
                    <div className="font-mono-tech text-[10px] tracking-widest text-[#858A81] uppercase">
                      1–{visibleMovies.length} OF {filteredAndSortedMovies.length}
                    </div>

                    {displayLimit < filteredAndSortedMovies.length ? (
                      <button
                        type="button"
                        onClick={() => setDisplayLimit((prev) => prev + 40)}
                        className="font-mono-tech text-xs tracking-wider text-[#141614] hover:text-[#52574F] underline cursor-pointer uppercase"
                      >
                        LOAD MORE FILMS  ↓
                      </button>
                    ) : (
                      <div className="font-mono-tech text-[10px] tracking-widest text-[#858A81] uppercase">
                        END OF CATALOG
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </section>

          {/* COLUMN 3: MATCH ANALYSIS (האדום היחיד במערכת נמצא כאן) */}
          <aside className="lg:col-span-3 lg:pr-6 lg:border-r lg:border-[#DCD7CE] space-y-8">
            <div className="pb-4 border-b border-[#DCD7CE]">
              <h2 className="font-mono-tech text-xs font-semibold tracking-[0.14em] text-[#141614] uppercase">
                MATCH ANALYSIS
              </h2>
              <p className="font-mono-tech text-[10px] tracking-[0.12em] text-[#858A81] mt-0.5 uppercase">
                DIAGNOSTIC SPECIMEN
              </p>
            </div>

            {selectedMovie && matchAnalysisData ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={getImageUrl(selectedMovie.movie.local_poster)}
                      alt={selectedMovie.movie.display_h}
                      className="w-[42px] h-[63px] object-cover border border-[#DCD7CE] shrink-0"
                      onError={handleImgError}
                    />
                    <div className="min-w-0">
                      <span className="font-mono-tech text-[9px] text-[#858A81] uppercase block">
                        SELECTED
                      </span>
                      <h4 className="text-xs font-semibold text-[#141614] truncate">
                        {selectedMovie.movie.display_h}
                      </h4>
                    </div>
                  </div>

                  <span className="font-mono-tech text-[10px] text-[#858A81] shrink-0">VS</span>

                  <div className="flex items-center gap-2.5 min-w-0 justify-end">
                    <div className="min-w-0 text-left">
                      <span className="font-mono-tech text-[9px] text-[#858A81] uppercase block">
                        COMPARE
                      </span>
                      <button
                        type="button"
                        onClick={() => handleMovieSelect(matchAnalysisData.targetMovie.id)}
                        className="text-xs font-semibold text-[#141614] hover:underline truncate block"
                        title={matchAnalysisData.targetMovie.display_h}
                      >
                        {matchAnalysisData.targetMovie.display_h}
                      </button>
                    </div>
                    <img
                      src={getImageUrl(matchAnalysisData.targetMovie.local_poster)}
                      alt={matchAnalysisData.targetMovie.display_h}
                      className="w-[42px] h-[63px] object-cover border border-[#DCD7CE] shrink-0"
                      onError={handleImgError}
                    />
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center py-4 border-y border-[#DCD7CE]">
                  <CircularGauge
                    value={matchAnalysisData.targetMovie.matchScore}
                    size={110}
                    strokeWidth={3}
                    label="SIMILARITY"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 border-b border-[#DCD7CE] pb-4 text-center" dir="ltr">
                  <div>
                    <div className="font-mono-tech text-base font-bold text-[#141614]">
                      {String(matchAnalysisData.zeroCount).padStart(2, '0')}
                    </div>
                    <div className="font-mono-tech text-[8px] tracking-wider text-[#858A81] uppercase">
                      IDENTICAL
                    </div>
                  </div>
                  <div>
                    <div className="font-mono-tech text-base font-bold text-[#141614]">
                      {String(matchAnalysisData.closeCount).padStart(2, '0')}
                    </div>
                    <div className="font-mono-tech text-[8px] tracking-wider text-[#858A81] uppercase">
                      CLOSE (±1)
                    </div>
                  </div>
                  <div>
                    <div className="font-mono-tech text-base font-bold text-[#D93829]">
                      {String(matchAnalysisData.diffCount).padStart(2, '0')}
                    </div>
                    <div className="font-mono-tech text-[8px] tracking-wider text-[#D93829] uppercase">
                      DIFFERENT (≥2)
                    </div>
                  </div>
                </div>

                {/* 12 הצירים - צבע אדום בלעדי לפער של 2 ומעלה */}
                <div className="space-y-4">
                  <div className="flex items-baseline justify-between font-mono-tech text-[10px] text-[#858A81] uppercase" dir="ltr">
                    <span>12 AXES DELTA</span>
                    <span>LARGEST FIRST</span>
                  </div>

                  <div className="space-y-3">
                    {matchAnalysisData.axes.map((dim) => {
                      const deltaStr =
                        dim.rawDelta > 0
                          ? `+${dim.rawDelta}`
                          : dim.rawDelta === 0
                          ? '0'
                          : `${dim.rawDelta}`;
                      const isHighDiff = dim.absDelta >= 2;

                      return (
                        <div key={dim.key} className="space-y-1">
                          <div className="flex justify-between items-baseline text-xs">
                            <span className="text-[#141614] truncate">{dim.label}</span>
                            <span
                              className={`font-mono-tech text-xs shrink-0 ${
                                isHighDiff
                                  ? 'text-[#D93829] font-bold'
                                  : 'text-[#141614] font-medium'
                              }`}
                              dir="ltr"
                            >
                              {dim.valTarget} → {dim.valSelected} ({deltaStr})
                            </span>
                          </div>

                          <div className="w-full h-[1px] bg-[#DCD7CE] relative">
                            {dim.absDelta > 0 && (
                              <div
                                className={`h-full absolute ${
                                  isHighDiff ? 'bg-[#D93829]' : 'bg-[#141614]'
                                }`}
                                style={{ width: `${Math.min(100, (dim.absDelta / 9) * 100)}%` }}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4 border-t border-[#DCD7CE] space-y-1.5 font-mono-tech text-[10px]" dir="ltr">
                  <div className="flex justify-between">
                    <span className="text-[#858A81]">VECTOR DISTANCE</span>
                    <span className="text-[#141614]">
                      {(matchAnalysisData.targetMovie.vectorDistance ?? 0).toFixed(3)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#858A81]">DIRECTOR BONUS</span>
                    <span className="text-[#141614]">
                      +{matchAnalysisData.targetMovie.directorBonus ?? 0}%
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 font-mono-tech text-[10px] text-[#858A81]" dir="ltr">
                <p className="font-sans text-xs text-[#52574F] leading-relaxed" dir="rtl">
                  בחר סרט מהגריד כדי לטעון ניתוח מרחק אוקלידי משוקלל והשוואת 12 צירים מלאה.
                </p>
                <div className="pt-4 border-t border-[#DCD7CE] space-y-1.5">
                  <div className="flex justify-between">
                    <span>CORPUS</span>
                    <span className="text-[#141614]">{allMovies.length} FILMS</span>
                  </div>
                  <div className="flex justify-between">
                    <span>DIMENSIONS</span>
                    <span className="text-[#141614]">{schema.length} AXES</span>
                  </div>
                  <div className="flex justify-between">
                    <span>SCALING</span>
                    <span className="text-[#141614]">Z-SCORE / P40</span>
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>
      </>
      )}

      {/* MOBILE DRAWER */}
      {isMobileFiltersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden bg-black/40 flex justify-end">
          <div className="w-full max-w-[320px] bg-[#F7F5F0] border-r border-[#DCD7CE] h-full overflow-y-auto p-6">
            <div className="flex items-center justify-between pb-3 mb-6 border-b border-[#DCD7CE]" dir="ltr">
              <span className="font-mono-tech text-xs font-semibold tracking-wider text-[#141614]">
                DNA FILTERS
              </span>
              <button
                type="button"
                onClick={() => setIsMobileFiltersOpen(false)}
                className="text-[#858A81] hover:text-[#141614] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {renderSidebarContent()}
          </div>
        </div>
      )}

      {/* WEIGHTS MODAL */}
      <WeightsSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        weights={weights}
        setWeights={setWeights}
        onReset={() => setWeights(DEFAULT_WEIGHTS)}
      />
    </div>
  );
}

export default App;

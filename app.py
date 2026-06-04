import streamlit as st
import pandas as pd
import json
import os
import base64
from sklearn.metrics.pairwise import cosine_similarity
from streamlit_agraph import agraph, Node, Edge, Config

st.set_page_config(page_title="קולנוע DNA | מערכת ניתוח", layout="wide")


def get_binding_trait(m1, m2, num_params):
    # מוצא את הפרמטר שבו ההפרש הוא המינימלי והערך הוא הגבוה ביותר
    best_trait = ""
    min_diff = 5
    max_val = 0

    for k, (lbl, mx) in num_params.items():
        val1 = m1.get(k, 0)
        val2 = m2.get(k, 0)
        diff = abs(val1 - val2)
        avg = (val1 + val2) / 2

        if diff <= min_diff and avg > max_val:
            min_diff = diff
            max_val = avg
            best_trait = lbl
    return best_trait

# ניהול סטייט
if 'selected_movie_idx' not in st.session_state:
    st.session_state.selected_movie_idx = None
if 'display_limit' not in st.session_state:
    st.session_state.display_limit = 40
if "selected" in st.query_params:
    st.session_state.selected_movie_idx = int(st.query_params["selected"])


def reset_limit():
    st.session_state.display_limit = 40


st.markdown("""
    <style>
@import url('https://fonts.googleapis.com/css2?family=Rubik:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300&display=swap');

/* דריסה טוטאלית של צבעי סטרימליט - משנה הכל לטורקיז! */
:root {
    --primary-color: #00ced1 !important;
    --background-color: #f8fafc !important;
}

html, body, [data-testid="stAppViewContainer"] { 
    font-family: 'Rubik', sans-serif; direction: rtl; text-align: right; color: #1e293b; 
    background-color: transparent !important; /* חשוב כדי לא להסתיר את הרקע */
}

[data-testid="stMainBlockContainer"],
[data-testid="stVerticalBlock"],
[data-testid="stVerticalBlockBorderWrapper"],
[data-testid="stHorizontalBlock"],
[data-testid="stColumn"],
.main .block-container,
section.main > div {
    background: transparent !important;
    background-color: transparent !important;
}

/* הסתרת הפס העליון הלבן */
[data-testid="stHeader"] { background-color: transparent !important; }


/* תמונת רקע קולנועית */
.stApp {
    background-image:
        linear-gradient(
            to bottom,
            rgba(248,250,252,0.0) 0%,
            rgba(248,250,252,0.0) 20%,
            rgba(248,250,252,0.75) 48%,
            rgba(248,250,252,1.0) 65%
        ),
        url('https://images.unsplash.com/photo-1478720568477-152d9b164e26?q=80&w=2000&auto=format&fit=crop') !important;
    background-size: cover !important;
    background-repeat: no-repeat !important;
    background-attachment: fixed !important;
    background-position: center top !important;
}

/* הופך את התיבה של הגרף לשקופה */
iframe { background-color: transparent !important; }

    /* עיצוב חיפוש */
    .search-title { font-size: 1.1em; font-weight: 600; color: #334155; margin-bottom: 8px; margin-top: 5px; }
    div[data-baseweb="input"] { border-radius: 8px !important; background-color: rgba(255,255,255,0.9) !important; border: 1px solid #cbd5e1 !important; }
    div[data-baseweb="input"]:focus-within { border-color: #00ced1 !important; box-shadow: 0 0 0 2px rgba(0,206,209,0.2) !important; }
    div[data-baseweb="input"] input { font-weight: 300 !important; font-style: italic !important; color: #475569 !important; font-size: 1.1em !important; }

    .filter-title { font-size: 1.1em; font-weight: 700; color: #0f172a; margin-top: 25px; margin-bottom: 5px; }

    /* ======== תיקון הסליידרים הדו-צדדיים ======== */
    /* מכריח את הסליידר לעבוד LTR כדי שהנקודות יוצגו כראוי */
    div[data-testid="stSlider"] { direction: ltr !important; margin-bottom: -15px !important; }
    div[data-testid="stSlider"] > div { direction: ltr !important; }
    div[data-testid="stSlider"] label { direction: rtl !important; text-align: right; width: 100%; }
    
    /* קו רקע עדין וטקסט - מחקנו את פקודת הצבע ההרסנית שהפכה אותם למלבנים */
    .stSlider [data-testid="stTickBar"] > div { background-color: rgba(0,206,209, 0.2) !important; }
    div[data-testid="stSliderTickBarMin"], div[data-testid="stSliderTickBarMax"] { color: #64748b !important; }
    /* עיצוב חיפוש */
    .search-title { font-size: 1.1em; font-weight: 600; color: #334155; margin-bottom: 8px; margin-top: 5px; }
    div[data-baseweb="input"] { border-radius: 8px !important; background-color: rgba(255,255,255,0.9) !important; border: 1px solid #cbd5e1 !important; }
    div[data-baseweb="input"]:focus-within { border-color: #0ea5e9 !important; box-shadow: 0 0 0 2px rgba(14,165,233,0.2) !important; }
    div[data-baseweb="input"] input { font-weight: 300 !important; font-style: italic !important; color: #475569 !important; font-size: 1.1em !important; }

    .filter-title { font-size: 1.1em; font-weight: 700; color: #0f172a; margin-top: 25px; margin-bottom: 5px; }

    /* ======== סליידרים ======== */
    /* מכריח את הסליידר לעבוד מימין לשמאל בלי להעלים את הכפתורים! */
    div[data-testid="stSlider"] { direction: ltr !important; margin-bottom: -15px !important; }
    div[data-testid="stSlider"] > div { direction: ltr !important; }
    div[data-testid="stSlider"] label { direction: rtl !important; text-align: right; width: 100%; }

    /* עיצוב צבעי הטורקיז/תכלת לסליידרים */
    .stSlider [data-testid="stTickBar"] > div { background-color: rgba(14, 165, 233, 0.15) !important; }
    .stSlider [data-testid="stThumb"] { background-color: #0ea5e9 !important; border: 2px solid #0ea5e9 !important; }
    .stSlider [data-testid="stSliderTrack"] > div > div { background-color: #0ea5e9 !important; }
    div[data-testid="stSliderTickBarMin"], div[data-testid="stSliderTickBarMax"] { color: #64748b !important; }

    /* ======== עיצוב הגלולות (Pills) והעלמת כל הריבועים ======== */
    div[data-testid="stPills"] { gap: 8px !important; }
    div[data-testid="stPills"] button {
        background-color: #ffffff !important; border: 1px solid #cbd5e1 !important;
        border-radius: 20px !important; padding: 4px 16px !important; color: #475569 !important; font-weight: 500 !important;
    }
    div[data-testid="stPills"] button:hover { border-color: #0ea5e9 !important; }
    /* מצב לחוץ (מסומן) */
    div[data-testid="stPills"] button[data-pressed="true"], div[data-testid="stPills"] button[aria-pressed="true"] {
        background-color: #f0f9ff !important; border-color: #0ea5e9 !important; color: #0284c7 !important; font-weight: 600 !important;
    }
    /* העלמה אגרסיבית של כל סממן ריבוע או V שיכול להופיע */
    div[data-testid="stPills"] button svg { display: none !important; }

    /* פוסטרים וכרטיסים */
    .poster-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 15px; direction: rtl; margin-top: 10px; justify-content: flex-end; }
    .poster-card { position: relative; aspect-ratio: 2/3; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; cursor: pointer; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.05); text-decoration: none !important; display: block; transition: all 0.2s; }
    .poster-card:hover { border-color: #0ea5e9; box-shadow: 0 8px 20px rgba(14,165,233,0.15); transform: translateY(-2px); }
    .poster-img { width: 100%; height: 100%; object-fit: cover; }
    .poster-overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(255, 255, 255, 0.85); backdrop-filter: blur(2px); display: flex; flex-direction: column; justify-content: center; align-items: center; opacity: 0; transition: opacity 0.2s ease; padding: 10px; text-align: center; }
    .poster-card:hover .poster-overlay { opacity: 1; }
    .poster-title { color: #0f172a; font-size: 1.05em; font-weight: 700; margin: 0 0 5px 0; line-height: 1.2; }
    .poster-meta { color: #64748b; font-size: 0.85em; margin: 0; font-weight: 500; }
    .match-badge { position: absolute; top: 8px; right: 8px; background: rgba(16, 185, 129, 0.95); color: white; padding: 3px 8px; border-radius: 12px; font-size: 0.75em; font-weight: 700; z-index: 5;}

    /* כרטיס נתונים מורחב */
    /* כרטיס נתונים מורחב */
    .cinema-card { background: rgba(255,255,255,0.5); backdrop-filter: blur(22px); -webkit-backdrop-filter: blur(22px); border: 1px solid rgba(255,255,255,0.75); box-shadow: 0 8px 32px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.9); border-radius: 20px; padding: 30px; margin-bottom: 20px; display: flex; gap: 30px; direction: rtl; }
    .movie-poster-large { width: 220px; border-radius: 8px; box-shadow: 0 8px 20px rgba(0,0,0,0.1); object-fit: cover; }
    .movie-content { flex-grow: 1; display: flex; flex-direction: column; }
    .movie-title-large { font-size: 2.2em; font-weight: 800; margin: 0 0 5px 0; color: #0f172a; }
    .tags-container { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
    .pill-tag { background: #f0f9ff; color: #0284c7; border: 1px solid #bae6fd; padding: 4px 12px; border-radius: 20px; font-size: 0.85em; font-weight: 600; }
    .bars-grid { display: grid; grid-template-columns: 1fr 1fr; column-gap: 40px; row-gap: 12px; }
    .bar-item { display: flex; flex-direction: column; gap: 4px; direction: rtl; }
    .bar-header { display: flex; justify-content: space-between; font-size: 0.85em; color: #475569; flex-direction: row-reverse; font-weight: 500;}
    .bar-val { color: #0f172a; font-weight: 700; direction: ltr; }
    .bar-track { width: 100%; height: 6px; background: #e2e8f0; border-radius: 10px; overflow: hidden; direction: ltr; }
    .bar-fill { height: 100%; background: linear-gradient(90deg, #38bdf8, #10b981); border-radius: 10px; }

    hr { border-color: #e2e8f0; margin: 15px 0; }

    .hero-wrapper { position: relative; width: 100%; height: 340px; overflow: hidden; border-radius: 16px; margin-bottom: 28px; box-shadow: 0 16px 48px rgba(0,0,0,0.18); }
    .hero-img { width: 100%; height: 100%; object-fit: cover; object-position: center 40%; filter: brightness(0.6) saturate(0.75); }
    .hero-fade { position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, transparent 35%, rgba(248,250,252,0.7) 72%, rgba(248,250,252,1) 100%); }
    .hero-content { position: absolute; bottom: 36px; right: 36px; text-align: right; z-index: 2; }
    .hero-eyebrow { display: block; font-size: 0.75em; letter-spacing: 0.3em; color: rgba(255,255,255,0.65); font-weight: 400; text-transform: uppercase; margin-bottom: 8px; text-shadow: 0 2px 12px rgba(0,0,0,0.6); }
    .hero-title { font-size: 3.8em; font-weight: 900; color: white; text-shadow: 0 4px 24px rgba(0,0,0,0.45); margin: 0; line-height: 1; letter-spacing: -0.03em; }
    .hero-sub { font-size: 1em; color: rgba(255,255,255,0.6); margin: 10px 0 0 0; font-weight: 300; font-style: italic; text-shadow: 0 2px 10px rgba(0,0,0,0.5); }

    .graph-section-header { display: flex; align-items: center; gap: 12px; direction: rtl; background: rgba(255,255,255,0.45); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.7); border-radius: 12px; padding: 12px 18px; margin: 12px 0 0 0; }
    .gsn-dot { width: 9px; height: 9px; min-width: 9px; border-radius: 50%; background: #00ced1; box-shadow: 0 0 8px rgba(0,206,209,0.55); }
    .gsn-title { font-size: 0.9em; font-weight: 700; color: #0f172a; }
    /* עיצוב חיפוש Spotlight עבור Streamlit Selectbox */
    div[data-baseweb="select"] {
        background: rgba(30, 30, 30, 0.65) !important;
        backdrop-filter: blur(20px) !important;
        -webkit-backdrop-filter: blur(20px) !important;
        border: 1px solid rgba(255, 255, 255, 0.1) !important;
        border-radius: 16px !important;
        box-shadow: 0 15px 40px rgba(0, 0, 0, 0.5) !important;
        color: white !important;
        direction: rtl;
    }
    
    div[data-baseweb="select"] > div { background: transparent !important; color: white !important; }
    
    /* עיצוב התקציר (Description) בתוך כרטיסיית הסרט */
    .movie-desc-text {
        color: #cbd5e1;
        font-size: 1.05em;
        line-height: 1.6;
        margin-top: 15px;
        margin-bottom: 10px;
        font-weight: 300;
        background: rgba(0, 0, 0, 0.15);
        padding: 15px;
        border-radius: 10px;
        border-right: 3px solid #00ced1;
    }
    </style>
""", unsafe_allow_html=True)


@st.cache_data(max_entries=1000)
def get_image_base64_cached(image_path):
    if not image_path or pd.isna(image_path) or not os.path.exists(image_path):
        return "https://via.placeholder.com/300x450/f8fafc/94a3b8?text=No+Poster"
    try:
        with open(image_path, "rb") as f:
            return f"data:image/webp;base64,{base64.b64encode(f.read()).decode()}"
    except:
        return "https://via.placeholder.com/300x450/f8fafc/94a3b8?text=No+Poster"


@st.cache_data
def load_data():
    if not os.path.exists("final_classified_db.json"): return pd.DataFrame()
    with open("final_classified_db.json", "r", encoding="utf-8") as f:
        data = json.load(f)
    flat = []
    for item in data:
        row = item.copy()
        if 'dna' in row: row.update(row['dna'])
        flat.append(row)
    return pd.DataFrame(flat)


@st.cache_resource
def precompute_global_graph(df, all_cols):
    # חישוב מטריצת דמיון גלובלית
    matrix = df[all_cols].fillna(0).astype(float)
    matrix = matrix / matrix.max().replace(0, 1)
    sim_matrix = cosine_similarity(matrix.values)

    # בניית רשימת קשרים (לכל סרט את ה-6 הכי דומים לו)
    global_edges = {}
    for i in range(len(df)):
        similar_indices = sim_matrix[i].argsort()[-7:-1][::-1]
        global_edges[i] = [int(idx) for idx in similar_indices]

    return global_edges


# ==================== 1. טעינת נתונים והכנת תשתיות ====================
df = load_data()

if df.empty:
    st.error("קובץ הנתונים לא נמצא.")
else:
    # יצירת עמודות תצוגה קבועות
    df['display_h'] = df.get('h_title', 'ללא שם')
    df['display_e'] = df.get('e_title', '')
    df['display_dir'] = df.get('director_h', 'לא ידוע')
    df['search_name'] = df['display_h'] + " (" + df['display_e'] + ")"

    # הגדרת המילונים והפרמטרים הנדרשים לחישובים
    num_params = {
        'psychological_depth': ('עומק פסיכולוגי', 5), 'moral_ambiguity': ('עמימות מוסרית', 5),
        'emotional_restraint': ('איפוק רגשי', 5), 'compassion_for_flawed': ('חמלה לפגומים', 5),
        'violence_level': ('אלימות', 5), 'sexuality_level': ('מיניות', 5),
        'social_alienation': ('ניכור חברתי', 3), 'substance_use': ('שימוש בחומרים', 3),
        'slow_pacing': ('קצב איטי', 3)
    }
    bool_params = {
        'existential_conflict': 'קונפליקט קיומי', 'visual_dominance': 'דומיננטיות ויזואלית',
        'gritty_realism': 'ריאליזם גריטי', 'auteur_style': 'סגנון אוטר',
        'non_linear': 'מבנה לא ליניארי', 'open_ending': 'סוף פתוח',
        'heavy_trauma': 'טראומה קשה', 'camera_intimacy': 'אינטימיות מצלמה'
    }
    all_cols = list(num_params.keys()) + list(bool_params.keys())

    # חישוב מטריצת הקשרים הגלובלית (מתבצע פעם אחת בלבד ושמור במשאבי השרת)
    global_connectivity = precompute_global_graph(df, all_cols)

    # ==================== 2. בניית ממשק המשתמש (UI) ====================
    st.markdown("""
        <div style="padding: 60px 0 20px 0; text-align: right;">
            <p style="font-size:0.8em; letter-spacing:0.25em; color:rgba(255,255,255,0.75); text-shadow:0 2px 10px rgba(0,0,0,0.5); margin:0 0 8px 0; font-weight:400; text-transform:uppercase;">מערכת ניתוח קולנועי</p>
            <h1 style="font-size:3.2em; font-weight:900; color:white; text-shadow:0 4px 20px rgba(0,0,0,0.4); margin:0; letter-spacing:-0.02em;">קולנוע <span style="color:#00ced1;">DNA</span></h1>
        </div>
        """, unsafe_allow_html=True)

    col_filters, col_grid = st.columns([1, 3], gap="large")
    f_df = df.copy()
    matched_movie = "ללא בחירה"
    target_row = None

    # ==================== צד ימין: חיפוש וסינון ====================
    with col_filters:
        st.markdown('<div class="search-title">חיפוש חכם (Spotlight)</div>', unsafe_allow_html=True)

        # יצירת רשימה שמתחילה בריק, ואז כל שמות הסרטים
        options = [""] + df['search_name'].tolist()

        # Selectbox מאפשר חיפוש דינמי שמציג תוצאות קופצות למטה
        selected_search = st.selectbox(
            "בחר סרט",
            options,
            index=0,
            label_visibility="collapsed",
            placeholder="הקלד שם סרט כאן...",
            on_change=reset_limit
        )

        if selected_search != "":
            matched_movie = selected_search
            target_row = df[df['search_name'] == matched_movie].iloc[0]

        if matched_movie != "ללא בחירה":
            matrix = df[all_cols].fillna(0).astype(float)
            matrix = matrix / matrix.max().replace(0, 1)
            target = matrix.iloc[[df[df['search_name'] == matched_movie].index[0]]].values
            df['Match %'] = (cosine_similarity(target, matrix.values)[0] * 100).round(1)
            f_df = df.copy()
            sort_col = 'Match %'
        else:
            df['Match %'] = 0.0
            f_df = df.copy()
            sort_col = 'year'
        st.divider()
        st.markdown('<div class="filter-title">פסיכולוגיה</div>', unsafe_allow_html=True)
        for k in ['psychological_depth', 'compassion_for_flawed', 'moral_ambiguity', 'social_alienation']:
            lbl, mx = num_params[k]
            rng = st.slider(lbl, 0, mx, (0, mx), key=f"f_{k}", on_change=reset_limit)
            f_df = f_df[f_df[k].between(rng[0], rng[1])]

        st.divider()
        st.markdown('<div class="filter-title">סגנון קולנועי</div>', unsafe_allow_html=True)

        # --- החלפה 1: גלולות (Pills) במקום צ'קבוקסים ---
        style_keys = ['camera_intimacy', 'visual_dominance', 'auteur_style', 'non_linear', 'open_ending']
        style_labels = [bool_params[k] for k in style_keys]
        selected_styles = st.pills("סגנון", options=style_labels, selection_mode="multi", key="pills_style",
                                   label_visibility="collapsed", on_change=reset_limit)

        if selected_styles:
            for k, lbl in zip(style_keys, style_labels):
                if lbl in selected_styles:
                    f_df = f_df[f_df[k] == True]
        # -----------------------------------------------

        for k in ['slow_pacing', 'emotional_restraint']:
            lbl, mx = num_params[k]
            rng = st.slider(lbl, 0, mx, (0, mx), key=f"f_{k}", on_change=reset_limit)
            f_df = f_df[f_df[k].between(rng[0], rng[1])]

        st.divider()
        st.markdown('<div class="filter-title">תוכן רגיש</div>', unsafe_allow_html=True)
        for k in ['violence_level', 'sexuality_level', 'substance_use']:
            lbl, mx = num_params[k]
            rng = st.slider(lbl, 0, mx, (0, mx), key=f"f_{k}", on_change=reset_limit)
            f_df = f_df[f_df[k].between(rng[0], rng[1])]

        # --- החלפה 2: גלולות (Pills) במקום צ'קבוקסים ---
        content_options = ["ריאליזם גריטי", "הסתר טראומה"]
        selected_content = st.pills("תוכן", options=content_options, selection_mode="multi", key="pills_content",
                                    label_visibility="collapsed", on_change=reset_limit)

        if selected_content:
            if "ריאליזם גריטי" in selected_content:
                f_df = f_df[f_df['gritty_realism'] == True]
            if "הסתר טראומה" in selected_content:
                f_df = f_df[f_df['heavy_trauma'] == False]
        # -----------------------------------------------

        f_df = f_df.sort_values(sort_col, ascending=False)

    # ==================== צד שמאל: כרטיס וגריד ====================
    with col_grid:
        if st.session_state.selected_movie_idx is not None and st.session_state.selected_movie_idx in f_df.index:
            m = f_df.loc[st.session_state.selected_movie_idx]
            poster_full = get_image_base64_cached(m.get('local_poster'))

            tags_html = "".join([f'<div class="pill-tag">{lbl}</div>' for k, lbl in bool_params.items() if m.get(k)])
            bars_html = "".join([
                f'<div class="bar-item"><div class="bar-header"><span>{m.get(k, 0)}/{mx}</span><span>{lbl}</span></div><div class="bar-track"><div class="bar-fill" style="width: {(m.get(k, 0) / mx) * 100 if mx > 0 else 0}%;"></div></div></div>'
                for k, (lbl, mx) in num_params.items()])

            # בדיקה אם יש תקציר לסרט
            movie_desc = m.get('description', '')
            desc_html = ""

            if pd.notna(movie_desc) and movie_desc.strip() != "":
                # בניית בלוק ה-HTML עבור התקציר
                desc_html = f'<div class="movie-desc-text">{movie_desc}</div>'

            st.markdown(
                f'''<div class="cinema-card">
                                <div class="poster-container">
                                    <img src="{poster_full}" class="movie-poster-large">
                                </div>
                                <div class="movie-content">
                                    <h1 class="movie-title-large">{m["display_h"]}</h1>
                                    <div style="color: #64748b; font-size: 1.1em; margin-bottom: 25px;">
                                        {m["display_e"]} &nbsp;|&nbsp; במאי: {m["display_dir"]} &nbsp;|&nbsp; שנת {int(m["year"])}
                                    </div>
                                    <div class="tags-container">{tags_html}</div>
                                    <div class="bars-grid">{bars_html}</div>
                                    {desc_html} 
                                </div>
                            </div>''',
                unsafe_allow_html=True)

            st.markdown("""
                       <div class="graph-section-header">
                           <span class="gsn-dot"></span>
                           <div>
                               <div class="gsn-title">רשת DNA גלובלית</div>
                               <div class="gsn-sub">לחץ על סרט לניווט בין שכנים</div>
                           </div>
                       </div>
                       """, unsafe_allow_html=True)

            nodes = []
            edges = []
            current_idx = int(m.name)

            # 1. יצירת רשימת סרטים לתצוגה
            neighbor_indices = global_connectivity.get(current_idx, [])
            all_visible_indices = set([current_idx] + neighbor_indices)

            for n_idx in neighbor_indices:
                sub_neighbors = global_connectivity.get(n_idx, [])[:2]
                all_visible_indices.update(sub_neighbors)

            # 2. יצירת הצמתים (Nodes) - עם ID ייחודי לכל רינדור!
            for idx in all_visible_indices:
                row = df.loc[idx]
                is_main = (idx == current_idx)
                is_neighbor = (idx in neighbor_indices)

                img_b64 = get_image_base64_cached(row.get('local_poster'))

                nodes.append(Node(
                    id=f"{idx}_{current_idx}",  # <-- הטריק שמונע קריסה
                    label=row['display_h'],
                    shape="image",
                    image=img_b64,
                    size=45 if is_main else (28 if is_neighbor else 18),
                    font={'color': '#1e293b', 'size': 14 if is_main else 11, 'face': 'Rubik', 'vadjust': 10}
                ))

            # 3. יצירת הקשרים (Edges) - מותאם ל-ID החדש
            for src_idx in all_visible_indices:
                targets = global_connectivity.get(src_idx, [])
                for tgt_idx in targets:
                    if tgt_idx in all_visible_indices:
                        is_primary = (src_idx == current_idx or tgt_idx == current_idx)
                        edges.append(Edge(
                            source=f"{src_idx}_{current_idx}",  # <-- התאמה לטריק
                            target=f"{tgt_idx}_{current_idx}",  # <-- התאמה לטריק
                            color="#00ced1" if is_primary else "#cbd5e1",
                            width=2 if is_primary else 1,
                            dashed=not is_primary
                        ))

            # 4. הגדרות תצוגה
            config = Config(
                width=900, height=500,
                directed=False,
                physics=True,
                nodeHighlightBehavior=True,
                highlightColor="#00ced1",
                collapsible=False,
                interaction={'zoomView': False, 'dragView': True},
                backgroundColor="rgba(255, 255, 255, 0.0)"
            )

            # הצגת הגרף (בלי ה-key שעשה צרות)
            clicked_id = agraph(nodes=nodes, edges=edges, config=config)

            # 5. מנגנון הניווט שקורא את ה-ID החדש
            if clicked_id:
                try:
                    # מחלצים רק את המספר האמיתי של הסרט שנלחץ (לפני הקו התחתון)
                    new_idx = int(clicked_id.split('_')[0])
                    if new_idx != current_idx:
                        st.session_state.selected_movie_idx = new_idx
                        st.query_params["selected"] = str(new_idx)
                        st.rerun()
                except (ValueError, IndexError):
                    pass

            st.write("")
            # ---------------------

            col_b1, col_b2, col_b3 = st.columns([3, 1, 3])
            with col_b2:
                if st.button("סגור נתונים", use_container_width=True):
                    st.session_state.selected_movie_idx = None
                    if "selected" in st.query_params: del st.query_params["selected"]
                    st.rerun()
            st.divider()

            # ==========================================
            # מכאן זה הגריד - הוא חייב להיות מיושר לכאן! (8 רווחים בלבד)
            # ==========================================

            # חילוץ כמות הסרטים המותרת לטעינה כרגע בלבד! (מונע קריסה)
        movies_to_show = f_df.head(st.session_state.display_limit)

        st.markdown(
            f'<p style="color:#64748b; font-weight:600; margin-bottom: 5px;">מציג {len(movies_to_show)} מתוך {len(f_df)} סרטים</p>',
            unsafe_allow_html=True)

        grid_html = '<div class="poster-grid">'
        for idx, row in movies_to_show.iterrows():
            img_b64 = get_image_base64_cached(row.get('local_poster'))
            match_tag = f'<div class="match-badge">{row["Match %"]}%</div>' if matched_movie != "ללא בחירה" else ""
            grid_html += f'<a href="/?selected={idx}" target="_self" class="poster-card">{match_tag}<img src="{img_b64}" class="poster-img" loading="lazy"><div class="poster-overlay"><p class="poster-title">{row["display_h"]}</p><p class="poster-meta">{int(row["year"])} | {row["display_dir"]}</p></div></a>'
        grid_html += '</div>'

        st.markdown(grid_html.replace('\n', ''), unsafe_allow_html=True)

        # מנגנון טעינה בטוח
        if st.session_state.display_limit < len(f_df):
            st.write("")
            if st.button(" הצג עוד ", use_container_width=True):
                st.session_state.display_limit += 40
                st.rerun()

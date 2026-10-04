import React from 'react';
import { ArrowRight } from 'lucide-react';
import { DNA_SCHEMA } from '../engine';

/**
 * עמוד המניפסט התאורטי — נפרד מדף הבית.
 * התוכן נגזר מהמימוש בפועל ב-engine.js (12 הצירים, הנורמליזציה, מטריקת המרחק).
 */
export default function ManifestoPage({ onBack }) {
  return (
    <main className="px-6 md:px-10 py-10" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-10">
        <button
          type="button"
          onClick={onBack}
          className="font-mono-tech text-[10px] tracking-wider text-[#52574F] hover:text-[#141614] border border-[#DCD7CE] px-3 py-1.5 cursor-pointer uppercase transition-colors flex items-center gap-2"
        >
          <ArrowRight className="w-3 h-3" />
          <span>[ BACK ]</span>
        </button>

        <div className="border-b border-[#141614] pb-4" dir="ltr">
          <div className="flex items-baseline justify-between">
            <span className="font-mono-tech text-[10px] font-bold tracking-widest text-[#141614] uppercase">
              THEORETICAL FRAMEWORK &amp; METHODOLOGY
            </span>
            <span className="font-mono-tech text-[10px] text-[#858A81]">PROJECT GENOME V5.0</span>
          </div>
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-[#141614] leading-tight tracking-tight">
          Cinema DNA: מיפוי וקטורי רב־ממדי של המבע הקולנועי
        </h1>

        {/* 1. מטרת המערכת */}
        <section className="space-y-3">
          <h2 className="font-mono-tech text-xs font-semibold tracking-[0.14em] text-[#141614] uppercase" dir="ltr">
            01 / PURPOSE
          </h2>
          <p className="text-sm leading-relaxed text-[#52574F]">
            המערכת ממליצה על סרטים לפי דמיון מבני — לא לפי ז'אנר, שחקנים או פופולריות.
            כל סרט מפורק ל־12 צירים אונטולוגיים שמתארים את המבע הקולנועי שלו: הזירה,
            המבט, הטון והפסיכולוגיה. שני סרטים "קרובים" הם כאלה שחולקים DNA קולנועי דומה,
            גם אם צולמו ביבשות שונות ובהפרש של חמישים שנה.
          </p>
        </section>

        {/* 2. שנים-עשר הצירים */}
        <section className="space-y-4">
          <h2 className="font-mono-tech text-xs font-semibold tracking-[0.14em] text-[#141614] uppercase" dir="ltr">
            02 / THE 12 AXES
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[#DCD7CE] border border-[#DCD7CE]">
            {DNA_SCHEMA.map((axis, i) => (
              <div key={axis.key} className="bg-[#F7F5F0] p-4 space-y-1.5">
                <div className="flex items-baseline justify-between gap-2" dir="ltr">
                  <span className="font-mono-tech text-[10px] text-[#858A81]">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="font-mono-tech text-[10px] text-[#858A81] uppercase tracking-wider">
                    {axis.category}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-[#141614]">{axis.label}</h3>
                <div className="flex items-center justify-between text-[11px] text-[#858A81]" dir="ltr">
                  <span>{axis.low_label}</span>
                  <span className="font-mono-tech">⟷</span>
                  <span>{axis.high_label}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 3. כיול המרחב */}
        <section className="space-y-3">
          <h2 className="font-mono-tech text-xs font-semibold tracking-[0.14em] text-[#141614] uppercase" dir="ltr">
            03 / CALIBRATION
          </h2>
          <div className="text-sm leading-relaxed text-[#52574F] space-y-3">
            <p>
              צירי ה־DNA נמדדים בסקאלות שונות, ולכן כל ציר עובר נורמליזציית Z-score
              מול כלל הקורפוס (1,051 סרטים): כל סרט מיוצג כווקטור של 12 סטיות תקן
              מהממוצע. כך ציר עם טווח צר לא "נבלע" על ידי ציר עם טווח רחב.
            </p>
            <p>
              המרחק בין שני סרטים הוא אוקלידי משוקלל — כל ציר מקבל משקל משלו
              (בין 1.2 ל־1.6), והמשתמש יכול לכייל את המשקולות או לנטרל צירים
              לחלוטין. קנה המידה של הציון נגזר מאחוזון 40 של כלל המרחקים בקורפוס,
              והמרחק מומר לציון דמיון בדעיכה אקספוננציאלית.
              בונוס במאי של 6 נקודות (עד תקרה של 96) ניתן לסרטים מאותו במאי.
            </p>
          </div>
        </section>

        {/* 4. משמעות אסתטית */}
        <section className="space-y-3">
          <h2 className="font-mono-tech text-xs font-semibold tracking-[0.14em] text-[#141614] uppercase" dir="ltr">
            04 / AESTHETIC MEANING
          </h2>
          <p className="text-sm leading-relaxed text-[#52574F]">
            ההשוואה בין במאים ויצירות הופכת את הטעם האישי לניתוח בר־מדידה:
            במקום "אהבתי את הסרט", אפשר לראות <em>למה</em> — אילו צירים משותפים
            לסרטים שאתה אוהב, ואיפה הטעם שלך חורג מהממוצע. 
          </p>
        </section>
      </div>
    </main>
  );
}


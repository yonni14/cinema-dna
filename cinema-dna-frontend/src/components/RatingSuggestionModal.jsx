import React, { useState, useMemo } from 'react';
import { X } from 'lucide-react';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';

// ---- טקסטים והגדרות (קל לשנות) ----
export const RATING_SUGGESTION_ENDPOINT = '/api/rating-suggestion';
const TITLE = 'הצעת שינוי הדירוג';
const INTRO = 'הזז סליידר למקום שנראה לך נכון. מתחת לכל סליידר שהזזת תופיע תיבה להסבר.';
const REASON_PLACEHOLDER = 'למה הדירוג צריך להיות שונה?';
const PRIVACY_NOTE = 'ההצעה נשמרת במאגר ציבורי יחד עם מזהה הסרט והנימוק שלך. כתובת ה-IP שלך לא נשמרת כמו שהיא, אלא כקוד מוצפן שאי אפשר לשחזר ממנו את הכתובת.';
const REASON_REQUIRED = true; // האם חובה לנמק כל סליידר שהוזז
const REASON_MIN = 5;
const REASON_MAX = 500;

function RatingSuggestionModal({ isOpen, onClose, movie, schema, endpoint = RATING_SUGGESTION_ENDPOINT }) {
  const [values, setValues] = useState({});
  const [reasons, setReasons] = useState({});
  const [status, setStatus] = useState('idle'); // idle | sending | done | error
  const [errorMsg, setErrorMsg] = useState('');
  const [hp, setHp] = useState('');

  const axes = schema || [];
  const current = useMemo(() => {
    const out = {};
    axes.forEach((a) => {
      const v = Number(movie?.[a.key]);
      out[a.key] = Number.isFinite(v) ? v : 5;
    });
    return out;
  }, [axes, movie]);

  if (!isOpen || !movie) return null;

  const valueOf = (k) => (values[k] !== undefined ? values[k] : current[k]);
  const moved = axes.filter((a) => valueOf(a.key) !== current[a.key]);
  const reasonOk = (k) => {
    const r = (reasons[k] || '').trim();
    return REASON_REQUIRED ? r.length >= REASON_MIN : true;
  };
  const canSend = moved.length > 0 && moved.every((a) => reasonOk(a.key)) && status !== 'sending';

  const handleClose = () => {
    setValues({});
    setReasons({});
    setStatus('idle');
    setErrorMsg('');
    onClose();
  };

  const submit = async () => {
    setStatus('sending');
    setErrorMsg('');
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          movie_id: movie.orig_id,
          imdb_id: movie.imdb_id || '',
          title: movie.display_e || movie.e_title || movie.display_h || '',
          website: hp,
          changes: moved.map((a) => ({
            axis: a.key,
            current: current[a.key],
            proposed: valueOf(a.key),
            reason: (reasons[a.key] || '').trim(),
          })),
        }),
      });
      if (!res.ok) {
        let msg = 'השליחה נכשלה, נסה שוב מאוחר יותר.';
        if (res.status === 429) msg = 'נשלחו הרבה הצעות. נסה שוב מאוחר יותר.';
        throw new Error(msg);
      }
      setStatus('done');
    } catch (e) {
      setErrorMsg(e.message || 'השליחה נכשלה, נסה שוב מאוחר יותר.');
      setStatus('error');
    }
  };

  return (
    <div data-rating-modal className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-xs p-4" dir="rtl">
      <div className="bg-[#F7F5F0] border border-[#DCD7CE] shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between px-5 py-4 border-b border-[#DCD7CE]">
          <div>
            <h2 className="text-sm font-semibold text-[#141614]">{TITLE}</h2>
            <p className="text-xs text-[#52574F] mt-0.5">{movie.display_h}</p>
          </div>
          <button type="button" onClick={handleClose} aria-label="סגור" className="text-[#858A81] hover:text-[#141614] p-1 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {status === 'done' ? (
          <div className="px-5 py-10 text-center space-y-4">
            <p className="text-sm text-[#141614]">תודה, ההצעה נשלחה.</p>
            <button type="button" onClick={handleClose} className="text-xs border border-[#141614] px-4 py-1.5 cursor-pointer hover:bg-[#141614] hover:text-[#F7F5F0] transition-colors">
              סגור
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
              <p className="text-xs text-[#52574F]">{INTRO}</p>
              {axes.map((a) => {
                const v = valueOf(a.key);
                const isMoved = v !== current[a.key];
                const min = a.min ?? 1;
                const max = a.max ?? 10;
                return (
                  <div key={a.key} className="space-y-1.5">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs font-medium text-[#141614]">{a.label}</span>
                      <span className="font-mono-tech text-xs text-[#141614]" dir="ltr">
                        {isMoved ? `${current[a.key]} → ${v}` : v}
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px] text-[#52574F]" dir="ltr">
                      <span>{a.low_label}</span>
                      <span>{a.high_label}</span>
                    </div>
                    <div dir="ltr" className="pt-0.5 px-1">
                      <Slider
                        min={min}
                        max={max}
                        value={v}
                        onChange={(val) => setValues((p) => ({ ...p, [a.key]: val }))}
                      />
                    </div>
                    {isMoved && (
                      <textarea
                        value={reasons[a.key] || ''}
                        onChange={(e) => setReasons((p) => ({ ...p, [a.key]: e.target.value.slice(0, REASON_MAX) }))}
                        placeholder={REASON_PLACEHOLDER}
                        rows={2}
                        className="w-full mt-2 text-xs border border-[#DCD7CE] bg-white/60 p-2 focus:outline-none focus:border-[#141614]"
                      />
                    )}
                  </div>
                );
              })}
              {/* honeypot: מוסתר מבני אדם */}
              <input type="text" name="website" value={hp} onChange={(e) => setHp(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} />
            </div>

            <div className="px-5 py-4 border-t border-[#DCD7CE] space-y-3">
              <p className="text-[10px] text-[#858A81] leading-relaxed">{PRIVACY_NOTE}</p>
              {status === 'error' && <p className="text-xs text-red-700">{errorMsg}</p>}
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#858A81]">
                  {moved.length > 0 && !moved.every((a) => reasonOk(a.key)) ? 'חסר נימוק בסליידר שהוזז.' : ''}
                </span>
                <button
                  type="button"
                  disabled={!canSend}
                  onClick={submit}
                  className={`text-xs px-4 py-1.5 border transition-colors ${
                    canSend ? 'border-[#141614] bg-[#141614] text-[#F7F5F0] cursor-pointer' : 'border-[#DCD7CE] text-[#858A81] cursor-not-allowed'
                  }`}
                >
                  {status === 'sending' ? 'שולח...' : 'שלח הצעה'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default RatingSuggestionModal;

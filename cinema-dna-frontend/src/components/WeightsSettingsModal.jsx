import React from 'react';
import { X, RotateCcw } from 'lucide-react';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { DNA_SCHEMA, DEFAULT_WEIGHTS } from '../engine';

function WeightsSettingsModal({ isOpen, onClose, weights, setWeights, onReset, schema }) {
  if (!isOpen) return null;
  const axes = schema && schema.length ? schema : DNA_SCHEMA;

  const handleSliderChange = (key, val) => {
    setWeights((prev) => ({
      ...prev,
      [key]: val,
    }));
  };

  const hasAnyModified = axes.some(
    (item) => (weights[item.key] ?? item.weight ?? 1.0) !== (DEFAULT_WEIGHTS[item.key] ?? 1.0)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-[#F7F5F0] border border-[#DCD7CE] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#DCD7CE]" dir="ltr">
          <div className="text-left">
            <h2 className="font-mono-tech text-xs font-semibold tracking-[0.14em] text-[#141614] uppercase">
              DNA WEIGHTS
            </h2>
            <p className="font-mono-tech text-[10px] tracking-[0.12em] text-[#858A81] mt-0.5 uppercase">
              VECTOR DISTANCE CALIBRATION (×0.0 — ×2.5)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#858A81] hover:text-[#141614] p-1 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* BODY */}
        <div className="p-6 overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 gap-6">
            {axes.map((item) => {
              const currentWeight = weights[item.key] ?? item.weight ?? 1.0;
              const defaultWeight = DEFAULT_WEIGHTS[item.key] ?? 1.0;
              const isModified = Math.abs(currentWeight - defaultWeight) > 0.01;

              return (
                <div key={item.key} className="space-y-1.5 group">
                  <div className="flex justify-between items-baseline" dir="rtl">
                    <span
                      className={`text-xs font-medium transition-colors ${
                        isModified ? 'text-[#141614] font-bold underline' : 'text-[#141614] group-hover:text-[#52574F]'
                      }`}
                    >
                      {item.label}
                    </span>
                    <span className="font-mono-tech text-xs font-semibold text-[#141614]" dir="ltr">
                      ×{currentWeight.toFixed(1)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-[#52574F]" dir="ltr">
                    <span>{item.low_label}</span>
                    <span>{item.high_label}</span>
                  </div>

                  <div dir="ltr" className="pt-0.5">
                    <Slider
                      min={0.0}
                      max={2.5}
                      step={0.1}
                      value={currentWeight}
                      onChange={(val) => handleSliderChange(item.key, val)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#DCD7CE] bg-[#EFECE4]" dir="ltr">
          <button
            type="button"
            onClick={onReset}
            disabled={!hasAnyModified}
            className="font-mono-tech text-[10px] tracking-[0.14em] text-[#52574F] hover:text-[#141614] disabled:opacity-40 cursor-pointer uppercase flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>[ RESET DEFAULTS ]</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="font-mono-tech text-[10px] font-semibold tracking-[0.14em] text-[#F7F5F0] bg-[#141614] hover:bg-[#2C302B] px-5 py-2 cursor-pointer uppercase transition-colors"
          >
            [ APPLY ]
          </button>
        </div>
      </div>
    </div>
  );
}

export default WeightsSettingsModal;

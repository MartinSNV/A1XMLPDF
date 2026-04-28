import React, { useRef, useState, useEffect, useCallback } from 'react';
import type { FormDataState, UplatnitelnaFormDataState } from '../types';

// ── Údaje správcu (splnomocnenec) ─────────────────────────────────────────
const AGENT_NAME = 'Vaša firma s.r.o.';
const AGENT_ICO = '12345678';
// ─────────────────────────────────────────────────────────────────────────

interface Props {
  formData: FormDataState | UplatnitelnaFormDataState;
  formType: 'PD_A1' | 'UPLATNITELNA_LEGISLATIVA';
  onSign: (signatureBase64: string) => void;
  onBack: () => void;
}

const FORM_NAME: Record<string, string> = {
  PD_A1: 'PD A1 – Žiadosť o vystavenie prenosného dokumentu A1 z dôvodu vyslania SZČO',
  UPLATNITELNA_LEGISLATIVA: 'Žiadosť o určenie uplatniteľnej legislatívy pre SZČO',
};

const PowerOfAttorney: React.FC<Props> = ({ formData, formType, onSign, onBack }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null);
  const today = new Date().toLocaleDateString('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const meno = `${(formData as any).titulPred ? (formData as any).titulPred + ' ' : ''}${formData.meno} ${formData.priezvisko}${(formData as any).titulZa ? ', ' + (formData as any).titulZa : ''}`.trim();
  const ico = formData.ico;
  const obchodneMeno = formData.obchodneMeno;
  const adresa = formData.adresaPobytu;
  const adresaStr = `${adresa.ulica} ${adresa.supisneCislo}${adresa.orientacneCislo ? '/' + adresa.orientacneCislo : ''}, ${adresa.psc} ${adresa.obec}`;

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      const touch = e.touches[0];
      return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
    }
    return { x: ((e as React.MouseEvent).clientX - rect.left) * scaleX, y: ((e as React.MouseEvent).clientY - rect.top) * scaleY };
  };

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsDrawing(true);
    setLastPos(getPos(e, canvas));
  }, []);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing || !canvasRef.current || !lastPos) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.x, lastPos.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    setLastPos(pos);
    setHasSignature(true);
  }, [isDrawing, lastPos]);

  const endDraw = useCallback(() => {
    setIsDrawing(false);
    setLastPos(null);
  }, []);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const sig = canvas.toDataURL('image/png');
    onSign(sig);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
      <div className="fixed top-4 left-4 z-10">
        <button
          onClick={onBack}
          className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:text-blue-600 transition-colors"
          title="Späť na prílohy"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      <main className="max-w-3xl mx-auto px-4 pt-16 pb-12">
        <div className="mb-8 text-center">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-semibold mb-3">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Splnomocnenie
          </span>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Podpis splnomocnenia</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Prečítajte si text splnomocnenia a podpíšte sa do poľa nižšie.</p>
        </div>

        {/* Text splnomocnenia */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 p-8 mb-6 font-serif text-gray-800 dark:text-gray-200 text-sm leading-relaxed">
          <h2 className="text-center text-xl font-bold tracking-widest mb-8 uppercase dark:text-white">Splnomocnenie</h2>

          <div className="mb-6">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Splnomocniteľ</p>
            <p className="font-semibold">{meno || '(meno a priezvisko)'}</p>
            {obchodneMeno && <p>{obchodneMeno}</p>}
            {ico && <p>IČO: {ico}</p>}
            {adresa.obec && <p>{adresaStr}</p>}
          </div>

          <p className="text-center my-6 text-gray-600 dark:text-gray-400 italic">týmto splnomocňujem</p>

          <div className="mb-6">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Splnomocnenec</p>
            <p className="font-semibold">{AGENT_NAME}</p>
            <p>IČO: {AGENT_ICO}</p>
          </div>

          <div className="mb-6 p-4 bg-gray-50 dark:bg-slate-700 rounded-xl border border-gray-200 dark:border-gray-600">
            <p className="mb-2">
              na zastupovanie a podanie žiadosti typu:
            </p>
            <p className="font-semibold">{FORM_NAME[formType]}</p>
            <p className="mt-2">
              na Sociálnu poisťovňu v mojom mene.
            </p>
          </div>

          <p className="mb-2">Splnomocnenie sa vzťahuje na:</p>
          <ul className="list-disc list-inside mb-6 space-y-1 text-gray-700 dark:text-gray-300">
            <li>podanie formulára na Sociálnu poisťovňu SR</li>
            <li>komunikáciu so Sociálnou poisťovňou vo veci tejto žiadosti</li>
            <li>prevzatie písomností a rozhodnutí v danej veci</li>
          </ul>

          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-600">
            <p>V {adresa.obec || '___________'}, dňa {today}</p>
            <div className="mt-6 flex justify-between items-end">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Splnomocniteľ:</p>
                <p className="font-semibold">{meno || '______________________'}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 dark:text-gray-400">vlastnoručný podpis</p>
                <div className="mt-1 w-48 border-b-2 border-gray-400 dark:border-gray-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Canvas podpisu */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Vlastnoručný podpis</p>
            <button
              type="button"
              onClick={clearCanvas}
              className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Vymazať podpis
            </button>
          </div>
          <div className="relative rounded-xl overflow-hidden border-2 border-dashed border-gray-300 dark:border-gray-600 bg-white"
            style={{ touchAction: 'none' }}>
            <canvas
              ref={canvasRef}
              width={720}
              height={200}
              className="w-full cursor-crosshair block"
              style={{ height: '200px' }}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
            />
            {!hasSignature && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-gray-400 text-sm">Podpíšte sa myšou alebo prstom</p>
              </div>
            )}
          </div>
          {!hasSignature && (
            <p className="mt-2 text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Podpis je povinný pred odoslaním žiadosti.
            </p>
          )}
        </div>

        {/* Tlačidlá */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center justify-center gap-2 px-8 py-3 rounded-xl border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-slate-800 transition-all"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            Späť
          </button>
          <button
            type="button"
            disabled={!hasSignature}
            onClick={handleConfirm}
            className={`flex items-center justify-center gap-2 font-bold py-3 px-12 rounded-xl shadow-lg transition-all ${
              hasSignature
                ? 'bg-blue-600 hover:bg-blue-700 text-white hover:scale-105 active:scale-95'
                : 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Potvrdiť a pokračovať
          </button>
        </div>
      </main>
    </div>
  );
};

export default PowerOfAttorney;

import React, { useState, useCallback, useEffect } from 'react';
import type { FormDataState, Address, MiestoVyslania, UplatnitelnaFormDataState } from './types';
import FormSection from './components/FormSection';
import InputField from './components/InputField';
import SelectField from './components/SelectField';
import ThemeSwitcher from './components/ThemeSwitcher';
import CheckboxField from './components/CheckboxField';
import AddressFields from './components/AddressFields';
import { COUNTRIES, BRANCH_OFFICES, NACE_CATEGORIES, TITLES_BEFORE, TITLES_AFTER } from './constants';
import { BRANCH_OFFICE_BY_PSC } from './psc_mapping';
import { generateA1Xml, parseBirthDateFromRc } from './utils';
import { useRpo } from './hooks/useRpo';
import UplatnitelnaForm, { initialUplatnitelnaData } from './UplatnitelnaForm';

const emptyAddress: Address = { ulica: '', supisneCislo: '', orientacneCislo: '', obec: '', psc: '', stat: 'Slovenská republika' };
const emptyMiesto = (): MiestoVyslania => ({ obchodneMeno: '', ico: '', adresa: { ...emptyAddress, stat: '' } });

const initialFormData: FormDataState = {
  titulPred: '', meno: '', priezvisko: '', rodnePriezvisko: '', titulZa: '', rodneCislo: '', datumNarodenia: '', miestoNarodenia: '',
  statNarodenia: 'Slovenská republika', statnaPrislusnost: 'Slovenská republika', pohlavie: 'Muž', adresaPobytu: { ...emptyAddress },
  email: '', telefon: '', pobytovyPreukaz: false,
  zadatAdresuPrechodnehoPobytu: false, adresaPrechodnehoPobytu: { ...emptyAddress },
  zadatKorespodencnuAdresu: false, korespodencnaAdresa: { ...emptyAddress },
  ico: '', obchodneMeno: '', datumZaciatkuCinnosti: '', identifikacneCisloVSocialnejPoistovni: '', cinnostSZCONaSlovensku: '', skNace: 'F',
  zadatAdresuMiestaPodnikania: false, adresaMiestaPodnikania: { ...emptyAddress },
  prerusenieZivnosti: false, prerusenieOd: '', prerusenieDo: '',
  skutocnaCinnostOd: '', skutocnaCinnostDo: '', skutocnaCinnostHodinMesacne: '',
  cinnostVStatePredVyslanim: false, cinnostVStatePredOd: '', cinnostVStatePredDo: '',
  statVyslania: '', adresaVyslania: { ...emptyAddress, stat: '' }, dalsieMiestaVyslania: [],
  datumZaciatkuVyslania: '', datumKoncaVyslania: '',
  obchodneMenoPrijimajucejOsoby: '', icoPrijimajucejOsoby: '', popisCinnosti: '',
  obvykleMiestoVykonuCinnosti: true, zachovaPriestory: true,
  nahradenieOsoby: false, vykonavanieCinnostiPreInuOsobu: false, najomPracovnejSily: false,
  vydanyVInejKrajine: false, vydanyVInejKrajineOd: '', vydanyVInejKrajineDo: '',
  vydanyVInejKrajineDatum: '', vydanyVInejKrajineInstitucia: '',
  pobocka: 'BA', poznamka: '', isForeigner: false
};

const SpinnerIcon = () => (
  <svg className="animate-spin h-6 w-6 text-blue-600 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

const CheckIcon = () => (
  <svg className="h-6 w-6 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const PdfIcon = () => (
  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6M9 17h4" />
  </svg>
);

const App: React.FC = () => {
  const [step, setStep] = useState<'welcome' | 'select' | 'form' | 'uplatnitelna'>('welcome');
  const [formData, setFormData] = useState<FormDataState>(initialFormData);
  const [uplatnitelnaData, setUplatnitelnaData] = useState<UplatnitelnaFormDataState>(initialUplatnitelnaData());
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const { loading: rpoLoading, error: rpoError, success: icoFetchSuccess } = useRpo(formData.ico, setFormData);

  const dateError = React.useMemo(() => {
    if (formData.datumZaciatkuVyslania && formData.datumKoncaVyslania) {
      const start = new Date(formData.datumZaciatkuVyslania);
      const end = new Date(formData.datumKoncaVyslania);
      if (end < start) return 'Dátum konca vyslania nesmie byť skôr ako dátum začiatku.';
    }
    return null;
  }, [formData.datumZaciatkuVyslania, formData.datumKoncaVyslania]);

  useEffect(() => {
    if (icoFetchSuccess && step === 'welcome') {
      const timer = setTimeout(() => setStep('select'), 1000);
      return () => clearTimeout(timer);
    }
  }, [icoFetchSuccess, step]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const target = e.target as HTMLInputElement;
    const { name, value, type } = target;
    const checked = target.checked;

    setFormData(prev => {
      let newState = { ...prev };
      if (name.includes('.')) {
        const parts = name.split('.');
        if (parts.length === 3) {
          // dalsieMiestaVyslania.0.obchodneMeno or dalsieMiestaVyslania.0.adresa.ulica handled below
        } else {
          const [parent, child] = parts;
          const parentKey = parent as keyof FormDataState;
          newState = { ...newState, [parentKey]: { ...(newState[parentKey] as object), [child]: value } };
        }
      } else {
        newState = { ...newState, [name]: type === 'checkbox' ? checked : value };
      }
      if (name === 'rodneCislo') {
        const birthDate = parseBirthDateFromRc(value);
        if (birthDate) newState.datumNarodenia = birthDate;
      }
      if (name === 'adresaPobytu.psc') {
        const cleanPsc = value.replace(/\s/g, '');
        const branchCode = BRANCH_OFFICE_BY_PSC[cleanPsc];
        if (branchCode) newState.pobocka = branchCode;
      }
      return newState;
    });
  }, []);

  const handleDownloadPdf = useCallback(async () => {
    setPdfLoading(true);
    setPdfError(null);
    try {
      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.details || 'Chyba pri generovaní PDF');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ziadost-A1-SZCO.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setPdfError(err.message || 'Chyba pri sťahovaní PDF');
    } finally {
      setPdfLoading(false);
    }
  }, [formData]);

  if (step === 'welcome') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 p-4 transition-colors duration-500">
        <ThemeSwitcher />
        <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg text-white">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Vitajte</h1>
            <p className="text-gray-600 dark:text-gray-400">Zadajte IČO pre automatické vyplnenie údajov.</p>
          </div>
          <div className="space-y-6">
            <div className="relative">
              <label htmlFor="ico-welcome" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">IČO podnikateľa</label>
              <div className="relative">
                <input id="ico-welcome" name="ico" type="text" inputMode="numeric" placeholder="Zadajte IČO" className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-gray-600 rounded-xl outline-none text-lg tracking-wider dark:text-white" value={formData.ico} onChange={handleChange} />
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                  {rpoLoading ? <SpinnerIcon /> : icoFetchSuccess ? <CheckIcon /> : null}
                </div>
              </div>
              {rpoError && <p className="mt-2 text-sm text-red-600 dark:text-red-400 font-medium">{rpoError}</p>}
            </div>
            <div className="flex flex-col space-y-3 pt-2">
              <div className="h-8 flex items-center justify-center text-sm font-medium transition-all duration-300">
                {rpoLoading ? (
                  <span className="text-blue-600 dark:text-blue-400 flex items-center gap-2"><SpinnerIcon /> Hľadám údaje v registri...</span>
                ) : icoFetchSuccess ? (
                  <span className="text-green-600 dark:text-green-400 flex items-center gap-2"><CheckIcon /> Údaje úspešne načítané, pokračujem...</span>
                ) : (
                  <span className="text-gray-400 dark:text-gray-500">Zadajte IČO pre automatické vyhľadanie</span>
                )}
              </div>
              <button onClick={() => setStep('select')} className="w-full py-3 px-6 text-blue-600 dark:text-blue-400 font-semibold hover:bg-blue-50 dark:hover:bg-slate-700 rounded-xl transition-all border border-transparent hover:border-blue-100 dark:hover:border-slate-600">
                Pokračovať bez IČO
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Výber formulára ──────────────────────────────────────────────────────
  if (step === 'select') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 p-4 transition-colors duration-500">
        <ThemeSwitcher />
        <div className="max-w-2xl w-full bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8">
          <button onClick={() => setStep('welcome')}
            className="mb-6 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            Späť
          </button>
          <div className="text-center mb-8">
            <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg text-white">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Vyberte typ žiadosti</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {formData.obchodneMeno ? `Údaje pre ${formData.obchodneMeno} sú načítané.` : 'Vyberte formulár, ktorý chcete vyplniť.'}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Karta 1 – Vyslanie */}
            <button onClick={() => setStep('form')}
              className="group text-left p-6 rounded-2xl border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 transition-all hover:shadow-lg hover:-translate-y-1 bg-white dark:bg-slate-800">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/40 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-600 transition-colors">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                PD A1 – Vyslanie
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                Žiadosť o vystavenie prenosného dokumentu A1 z dôvodu vyslania SZČO do iného členského štátu EÚ.
              </p>
              <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 group-hover:gap-2 transition-all">
                Otvoriť formulár
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>

            {/* Karta 2 – Uplatniteľná legislatíva */}
            <button onClick={() => {
              setUplatnitelnaData(initialUplatnitelnaData({
                meno: formData.meno,
                priezvisko: formData.priezvisko,
                rodnePriezvisko: formData.rodnePriezvisko,
                titulPred: formData.titulPred,
                titulZa: formData.titulZa,
                rodneCislo: formData.rodneCislo,
                datumNarodenia: formData.datumNarodenia,
                miestoNarodenia: formData.miestoNarodenia,
                statNarodenia: formData.statNarodenia,
                statnaPrislusnost: formData.statnaPrislusnost,
                pohlavie: formData.pohlavie,
                adresaPobytu: { ...formData.adresaPobytu },
                email: formData.email,
                telefon: formData.telefon,
                pobytovyPreukaz: formData.pobytovyPreukaz,
                ico: formData.ico,
                obchodneMeno: formData.obchodneMeno,
                adresaMiestaPodnikania: { ...formData.adresaMiestaPodnikania },
                skNace: formData.skNace,
                pobocka: formData.pobocka,
                isForeigner: formData.isForeigner,
              }));
              setStep('uplatnitelna');
            }}
              className="group text-left p-6 rounded-2xl border-2 border-gray-200 dark:border-gray-700 hover:border-green-500 dark:hover:border-green-400 transition-all hover:shadow-lg hover:-translate-y-1 bg-white dark:bg-slate-800">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/40 rounded-xl flex items-center justify-center mb-4 group-hover:bg-green-600 transition-colors">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                Uplatniteľná legislatíva
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                Žiadosť o určenie uplatniteľnej legislatívy pre SZČO vykonávajúcu činnosť vo viacerých štátoch EÚ.
              </p>
              <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-green-600 dark:text-green-400 group-hover:gap-2 transition-all">
                Otvoriť formulár
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Formulár: Uplatniteľná legislatíva ──────────────────────────────────
  if (step === 'uplatnitelna') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
        <ThemeSwitcher />
        <div className="fixed top-4 left-4 z-10">
          <button onClick={() => setStep('select')}
            className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:text-green-600 transition-colors"
            title="Späť na výber formulára">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
        <main className="max-w-5xl mx-auto px-4 pt-16 pb-8">
          <div className="mb-8 text-center">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm font-semibold mb-3">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Žiadosť o určenie uplatniteľnej legislatívy
            </span>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Uplatniteľná legislatíva – SZČO
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
              Vyplňte formulár a stiahnite XML pre podanie na Sociálnu poisťovňu
            </p>
          </div>
          <UplatnitelnaForm formData={uplatnitelnaData} setFormData={setUplatnitelnaData} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
      <ThemeSwitcher />
      <div className="fixed top-4 left-4 z-10">
        <button onClick={() => { setFormData(initialFormData); setStep('select'); }}
          className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:text-red-600 transition-colors"
          title="Resetovať formulár a vrátiť sa na úvod">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      <main className="container mx-auto px-4 py-8 pt-20 max-w-5xl">
        <form onSubmit={(e) => { e.preventDefault(); if (!dateError) generateA1Xml(formData); }}>

          {/* ── 1. Žiadateľ ── */}
          <FormSection title="1. Údaje o žiadateľovi">
            <InputField label="Titul pred menom" id="titulPred" name="titulPred" value={formData.titulPred} onChange={handleChange} suggestions={TITLES_BEFORE} />
            <InputField label="Meno" id="meno" name="meno" value={formData.meno} onChange={handleChange} required />
            <InputField label="Priezvisko" id="priezvisko" name="priezvisko" value={formData.priezvisko} onChange={handleChange} required />
            <InputField label="Rodné priezvisko" id="rodnePriezvisko" name="rodnePriezvisko" value={formData.rodnePriezvisko} onChange={handleChange} />
            <InputField label="Titul za menom" id="titulZa" name="titulZa" value={formData.titulZa} onChange={handleChange} suggestions={TITLES_AFTER} />
            <InputField label="Rodné číslo" id="rodneCislo" name="rodneCislo" value={formData.rodneCislo} onChange={handleChange} required />
            <InputField label="Dátum narodenia" id="datumNarodenia" name="datumNarodenia" type="date" value={formData.datumNarodenia} onChange={handleChange} required />
            <InputField label="Miesto narodenia" id="miestoNarodenia" name="miestoNarodenia" value={formData.miestoNarodenia} onChange={handleChange} />
            <SelectField label="Štát narodenia" id="statNarodenia" name="statNarodenia" value={formData.statNarodenia} onChange={handleChange} options={COUNTRIES} />
            <SelectField label="Štátna príslušnosť" id="statnaPrislusnost" name="statnaPrislusnost" value={formData.statnaPrislusnost} onChange={handleChange} options={COUNTRIES} />
            <SelectField label="Pohlavie" id="pohlavie" name="pohlavie" value={formData.pohlavie} onChange={handleChange} options={['Muž', 'Žena']} />
            <InputField label="E-mail" id="email" name="email" type="email" value={formData.email} onChange={handleChange} required />
            <InputField label="Telefón" id="telefon" name="telefon" type="tel" value={formData.telefon} onChange={handleChange} required />
            <CheckboxField label="Mám pobytový preukaz v SR" id="pobytovyPreukaz" name="pobytovyPreukaz" checked={formData.pobytovyPreukaz} onChange={handleChange} />
            <div className="md:col-span-3 mt-4 border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-lg font-medium mb-4">Adresa trvalého pobytu</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AddressFields address={formData.adresaPobytu} namePrefix="adresaPobytu" onChange={handleChange} required />
              </div>
            </div>
          </FormSection>

          {/* ── 2. Podnikanie ── */}
          <FormSection title="2. Podnikanie na Slovensku">
            <InputField label="IČO" id="ico" name="ico" inputMode="numeric" value={formData.ico} onChange={handleChange} required />
            <InputField label="Obchodné meno" id="obchodneMeno" name="obchodneMeno" value={formData.obchodneMeno} onChange={handleChange} required gridSpan="md:col-span-2" />

            <div className="md:col-span-3 mt-4 p-4 border border-gray-100 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-slate-800">
              <h3 className="text-lg font-medium mb-4">Adresa miesta podnikania</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AddressFields address={formData.adresaMiestaPodnikania} namePrefix="adresaMiestaPodnikania" onChange={handleChange} required />
              </div>
            </div>

            <InputField label="Dátum začiatku činnosti SZČO" id="datumZaciatkuCinnosti" name="datumZaciatkuCinnosti" type="date" value={formData.datumZaciatkuCinnosti} onChange={handleChange} required />
            <SelectField label="SK NACE (Ekonomická činnosť)" id="skNace" name="skNace" value={formData.skNace} onChange={handleChange} options={NACE_CATEGORIES.map(n => n.name)} />
            <InputField
              label="Popis činnosti na Slovensku"
              id="cinnostSZCONaSlovensku"
              name="cinnostSZCONaSlovensku"
              type="textarea"
              value={formData.cinnostSZCONaSlovensku}
              onChange={handleChange}
              required
              gridSpan="md:col-span-3"
              suggestions={formData.dostupneCinnosti}
            />

            {/* Prerušenie živnosti */}
            <div className="md:col-span-3 border-t border-gray-200 dark:border-gray-700 pt-6">
              <CheckboxField label="Živnosť bola prerušená" id="prerusenieZivnosti" name="prerusenieZivnosti" checked={formData.prerusenieZivnosti} onChange={handleChange} />
              {formData.prerusenieZivnosti && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
                  <InputField label="Prerušenie od" id="prerusenieOd" name="prerusenieOd" type="date" value={formData.prerusenieOd} onChange={handleChange} />
                  <InputField label="Prerušenie do" id="prerusenieDo" name="prerusenieDo" type="date" value={formData.prerusenieDo} onChange={handleChange} />
                </div>
              )}
            </div>

            {/* Skutočná činnosť na Slovensku */}
            <div className="md:col-span-3 border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-lg font-medium mb-4">Skutočná činnosť na Slovensku (referenčné obdobie)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <InputField label="Od" id="skutocnaCinnostOd" name="skutocnaCinnostOd" type="date" value={formData.skutocnaCinnostOd} onChange={handleChange} />
                <InputField label="Do" id="skutocnaCinnostDo" name="skutocnaCinnostDo" type="date" value={formData.skutocnaCinnostDo} onChange={handleChange} />
                <InputField label="Suma všetkých faktúr (€)" id="skutocnaCinnostHodinMesacne" name="skutocnaCinnostHodinMesacne" type="number" value={formData.skutocnaCinnostHodinMesacne} onChange={handleChange} />
              </div>
            </div>

          </FormSection>

          {/* ── 3. Vyslanie ── */}
          <FormSection title="3. Údaje o vyslaní">
            <div className="md:col-span-3 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="flex flex-col">
                  <InputField label="Začiatok vyslania" id="datumZaciatkuVyslania" name="datumZaciatkuVyslania" type="date" value={formData.datumZaciatkuVyslania} onChange={handleChange} required error={!!dateError} />
                  {dateError && <span className="text-[10px] uppercase tracking-wider text-red-600 dark:text-red-400 mt-1 font-bold animate-pulse">Chybný dátum</span>}
                </div>
                <div className="flex flex-col">
                  <InputField label="Koniec vyslania" id="datumKoncaVyslania" name="datumKoncaVyslania" type="date" value={formData.datumKoncaVyslania} onChange={handleChange} required min={formData.datumZaciatkuVyslania} error={!!dateError} />
                  {dateError && <span className="text-[10px] uppercase tracking-wider text-red-600 dark:text-red-400 mt-1 font-bold animate-pulse">Nesmie byť pred začiatkom</span>}
                </div>
                <SelectField label="Štát vyslania" id="statVyslania" name="statVyslania" value={formData.statVyslania} onChange={handleChange} options={COUNTRIES.filter(c => c !== 'Slovenská republika')} required />
              </div>

              <InputField
                label="Popis činnosti počas vyslania"
                id="popisCinnosti"
                name="popisCinnosti"
                type="textarea"
                value={formData.popisCinnosti}
                onChange={handleChange}
                required
                gridSpan="md:col-span-3"
              />

              {/* Otázky Q5/Q6 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Predpokladáte výkon SZČO na Slovensku aj po ukončení vyslania?
                  </p>
                  <CheckboxField label="Áno" id="obvykleMiestoVykonuCinnosti" name="obvykleMiestoVykonuCinnosti" checked={formData.obvykleMiestoVykonuCinnosti} onChange={handleChange} />
                </div>
                <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Zachováte si počas vyslania priestory potrebné na výkon SZČO na Slovensku?
                  </p>
                  <CheckboxField label="Áno" id="zachovaPriestory" name="zachovaPriestory" checked={formData.zachovaPriestory} onChange={handleChange} />
                </div>
              </div>

              {/* Hlavné miesto vyslania */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <h3 className="text-lg font-medium mb-4">Hlavné miesto výkonu činnosti</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <InputField label="Obchodné meno prijímajúcej osoby" id="obchodneMenoPrijimajucejOsoby" name="obchodneMenoPrijimajucejOsoby" value={formData.obchodneMenoPrijimajucejOsoby} onChange={handleChange} gridSpan="md:col-span-2" />
                  <InputField label="IČO prijímajúcej osoby" id="icoPrijimajucejOsoby" name="icoPrijimajucejOsoby" value={formData.icoPrijimajucejOsoby} onChange={handleChange} />
                  <AddressFields address={formData.adresaVyslania} namePrefix="adresaVyslania" onChange={handleChange} showStat={false} />
                </div>
              </div>

              {/* Predošlá činnosť v štáte vyslania */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700">
                  <CheckboxField
                    label="SZČO už v minulosti vykonávala činnosť v štáte, do ktorého je vyslaná"
                    id="cinnostVStatePredVyslanim"
                    name="cinnostVStatePredVyslanim"
                    checked={formData.cinnostVStatePredVyslanim}
                    onChange={handleChange}
                  />
                  {formData.cinnostVStatePredVyslanim && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
                      <InputField label="Od" id="cinnostVStatePredOd" name="cinnostVStatePredOd" type="date" value={formData.cinnostVStatePredOd} onChange={handleChange} />
                      <InputField label="Do" id="cinnostVStatePredDo" name="cinnostVStatePredDo" type="date" value={formData.cinnostVStatePredDo} onChange={handleChange} />
                    </div>
                  )}
                </div>
              </div>

              {/* Ďalšie miesta */}
              {(formData.dalsieMiestaVyslania || []).map((miesto, index) => (
                <div key={index} className="border border-gray-200 dark:border-gray-600 rounded-xl p-4 mt-4">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-medium text-gray-700 dark:text-gray-300">Ďalšie miesto #{index + 1}</h4>
                    <button type="button" onClick={() => {
                      setFormData(prev => ({ ...prev, dalsieMiestaVyslania: prev.dalsieMiestaVyslania.filter((_, i) => i !== index) }));
                    }} className="text-red-500 hover:text-red-700 text-sm">Odstrániť</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <InputField
                      label="Obchodné meno"
                      id={`miesto-${index}-obchodneMeno`}
                      name={`dalsieMiestaVyslania.${index}.obchodneMeno`}
                      value={miesto.obchodneMeno}
                      onChange={(e) => {
                        const newMiesta = [...formData.dalsieMiestaVyslania];
                        newMiesta[index] = { ...newMiesta[index], obchodneMeno: e.target.value };
                        setFormData(prev => ({ ...prev, dalsieMiestaVyslania: newMiesta }));
                      }}
                      gridSpan="md:col-span-2"
                    />
                    <InputField
                      label="IČO"
                      id={`miesto-${index}-ico`}
                      name={`dalsieMiestaVyslania.${index}.ico`}
                      value={miesto.ico}
                      onChange={(e) => {
                        const newMiesta = [...formData.dalsieMiestaVyslania];
                        newMiesta[index] = { ...newMiesta[index], ico: e.target.value };
                        setFormData(prev => ({ ...prev, dalsieMiestaVyslania: newMiesta }));
                      }}
                    />
                    <AddressFields
                      address={miesto.adresa}
                      namePrefix={`dalsieMiestaVyslania.${index}.adresa`}
                      onChange={(e) => {
                        const field = e.target.name.split('.').pop()!;
                        const newMiesta = [...formData.dalsieMiestaVyslania];
                        newMiesta[index] = { ...newMiesta[index], adresa: { ...newMiesta[index].adresa, [field]: e.target.value } };
                        setFormData(prev => ({ ...prev, dalsieMiestaVyslania: newMiesta }));
                      }}
                      showStat={false}
                    />
                  </div>
                </div>
              ))}

              <button type="button" onClick={() => setFormData(prev => ({ ...prev, dalsieMiestaVyslania: [...(prev.dalsieMiestaVyslania || []), emptyMiesto()] }))}
                className="mt-3 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Pridať ďalšie miesto výkonu činnosti
              </button>
            </div>
          </FormSection>

          {/* ── 4. Dokumenty a ostatné ── */}
          <FormSection title="4. Dokumenty a ostatné informácie">

            {/* Vydaný v inej krajine */}
            <div className="md:col-span-3 p-4 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <CheckboxField label="Bol mi vydaný formulár E101/PD A1 v inej krajine EÚ" id="vydanyVInejKrajine" name="vydanyVInejKrajine" checked={formData.vydanyVInejKrajine} onChange={handleChange} />
              {formData.vydanyVInejKrajine && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
                  <InputField label="Platnosť od" id="vydanyVInejKrajineOd" name="vydanyVInejKrajineOd" type="date" value={formData.vydanyVInejKrajineOd} onChange={handleChange} />
                  <InputField label="Platnosť do" id="vydanyVInejKrajineDo" name="vydanyVInejKrajineDo" type="date" value={formData.vydanyVInejKrajineDo} onChange={handleChange} />
                  <InputField label="Dátum vydania" id="vydanyVInejKrajineDatum" name="vydanyVInejKrajineDatum" type="date" value={formData.vydanyVInejKrajineDatum} onChange={handleChange} />
                  <InputField label="Vydávajúca inštitúcia" id="vydanyVInejKrajineInstitucia" name="vydanyVInejKrajineInstitucia" value={formData.vydanyVInejKrajineInstitucia} onChange={handleChange} gridSpan="md:col-span-2" />
                </div>
              )}
            </div>

            <SelectField label="Príslušná pobočka SP" id="pobocka" name="pobocka" value={formData.pobocka} onChange={handleChange} options={BRANCH_OFFICES.map(b => b.name)} values={BRANCH_OFFICES.map(b => b.code)} />
            <InputField label="Doplňujúce informácie" id="poznamka" name="poznamka" type="textarea" value={formData.poznamka} onChange={handleChange} gridSpan="md:col-span-2" />
          </FormSection>

          {/* ── Tlačidlá ── */}
          <div className="mt-12 flex flex-col items-center justify-center pb-12 gap-4">
            {dateError && (
              <p className="text-red-600 dark:text-red-400 font-medium mb-4 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {dateError}
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <button type="submit" disabled={!!dateError}
                className={`font-bold py-4 px-12 rounded-2xl shadow-xl transition-all ${dateError ? 'bg-gray-400 cursor-not-allowed opacity-50' : 'bg-blue-600 hover:bg-blue-700 text-white hover:scale-105 active:scale-95'}`}>
                Generovať a stiahnuť XML
              </button>
              <button type="button" disabled={!!dateError || pdfLoading} onClick={handleDownloadPdf}
                className={`flex items-center gap-2 font-bold py-4 px-10 rounded-2xl shadow-xl transition-all ${dateError || pdfLoading ? 'bg-gray-400 cursor-not-allowed opacity-50 text-white' : 'bg-red-600 hover:bg-red-700 text-white hover:scale-105 active:scale-95'}`}>
                {pdfLoading ? (<><SpinnerIcon />Generujem PDF...</>) : (<><PdfIcon />Stiahnuť PDF žiadosť</>)}
              </button>
            </div>
            {pdfError && (
              <p className="text-red-600 dark:text-red-400 text-sm font-medium flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {pdfError}
              </p>
            )}
          </div>
        </form>
      </main>
    </div>
  );
};

export default App;
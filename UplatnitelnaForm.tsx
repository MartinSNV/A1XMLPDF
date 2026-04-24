import React, { useState, useCallback } from 'react';
import type { UplatnitelnaFormDataState, Address, MiestoVykonuCinnosti, KrajinaPodiel, PrijemRok } from './types';
import FormSection from './components/FormSection';
import InputField from './components/InputField';
import SelectField from './components/SelectField';
import CheckboxField from './components/CheckboxField';
import AddressFields from './components/AddressFields';
import { COUNTRIES, BRANCH_OFFICES, NACE_CATEGORIES, TITLES_BEFORE, TITLES_AFTER } from './constants';
import { generateUplatnitelnaXml } from './utilsUplatnitelna';
import AttachmentUpload, { type AttachmentFile } from './components/AttachmentUpload';

const emptyAddress: Address = { ulica: '', supisneCislo: '', orientacneCislo: '', obec: '', psc: '', stat: 'Slovenská republika' };
const emptyMiestoVykonu = (): MiestoVykonuCinnosti => ({ description: '', adresa: { ...emptyAddress, stat: '' } });
const emptyKrajinaPodiel = (): KrajinaPodiel => ({ krajina: '', podiel: 0 });
const emptyPrijemRok = (): PrijemRok => ({ rok: new Date().getFullYear() - 1, prijem: 0 });

export const initialUplatnitelnaData = (base?: Partial<UplatnitelnaFormDataState>): UplatnitelnaFormDataState => ({
  titulPred: '', meno: '', priezvisko: '', rodnePriezvisko: '', titulZa: '',
  rodneCislo: '', datumNarodenia: '', miestoNarodenia: '',
  statNarodenia: 'Slovenská republika', statnaPrislusnost: 'Slovenská republika',
  pohlavie: 'Muž', adresaPobytu: { ...emptyAddress },
  email: '', telefon: '', pobytovyPreukaz: false,
  ziadostOd: '', ziadostDo: '',
  opakovanaZiadost: false,
  datumZdravPoistenia: '',
  ico: '', obchodneMeno: '', adresaMiestaPodnikania: { ...emptyAddress },
  krajinaSidla: 'Slovenská republika',
  cinnostOd: '', cinnostDo: '',
  pracovnyCas: '',
  predmetSZCO: '',
  skNace: 'G – Veľkoobchod a maloobchod, oprava motorových vozidiel a motocyklov',
  typVykonu: 'iba_sr',
  miestaVykonu: [],
  krajinyVykonu: [],
  prijemAktualnyRok: 0,
  prijemAktualnyRokCislo: new Date().getFullYear(),
  predchadzajucePrijmy: [],
  casovyPodielSKPred: 100,
  casovePodielyIneKrajinyPred: [],
  casovyPodielSKPo: 100,
  casovePodielyIneKrajinyPo: [],
  prijmovyPodielSKPo: 100,
  prijmovePodielyIneKrajinyPo: [],
  vydanyVInejKrajine: false,
  vydanyVInejKrajineOd: '', vydanyVInejKrajineDo: '',
  vydanyVInejKrajineDatum: '', vydanyVInejKrajineInstitucia: '',
  doplnujuceInfo: '',
  pobocka: 'BA',
  isForeigner: false,
  ...base,
});

const AddIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
  </svg>
);

const RemoveBtn = ({ onClick }: { onClick: () => void }) => (
  <button type="button" onClick={onClick} className="text-red-500 hover:text-red-700 text-sm font-medium transition-colors">
    Odstrániť
  </button>
);

interface Props {
  formData: UplatnitelnaFormDataState;
  setFormData: React.Dispatch<React.SetStateAction<UplatnitelnaFormDataState>>;
  onReset: () => void;
}

const UplatnitelnaForm: React.FC<Props> = ({ formData, setFormData, onReset }) => {
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    setSubmitError(null);
    setSubmitSuccess(null);
    try {
      const fd = new FormData();
      fd.append('formType', 'UPLATNITELNA_LEGISLATIVA');
      fd.append('formData', JSON.stringify(formData));
      fd.append('attachmentMeta', JSON.stringify(attachments.map(a => ({ attachmentType: a.attachmentType }))));
      attachments.forEach(a => fd.append('attachments', a.file));

      const res = await fetch('/api/submit', { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Chyba pri odosielaní');
      }
      const data = await res.json();
      setSubmitSuccess(`Žiadosť bola úspešne podaná (ID: ${data.id}). Budeme vás kontaktovať.`);
      setAttachments([]);
    } catch (err: any) {
      setSubmitError(err.message || 'Chyba pri odosielaní žiadosti');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const target = e.target as HTMLInputElement;
    const { name, value, type } = target;
    const checked = target.checked;

    setFormData(prev => {
      if (name.includes('.')) {
        const [parent, child] = name.split('.');
        const parentKey = parent as keyof UplatnitelnaFormDataState;
        return { ...prev, [parentKey]: { ...(prev[parentKey] as object), [child]: value } };
      }
      return { ...prev, [name]: type === 'checkbox' ? checked : value };
    });
  }, [setFormData]);

  // ── helpers pre dynamické polia ──

  const updateMiestoVykonu = (index: number, field: string, value: string) => {
    setFormData(prev => {
      const updated = [...prev.miestaVykonu];
      if (field.startsWith('adresa.')) {
        const adresaField = field.replace('adresa.', '') as keyof Address;
        updated[index] = { ...updated[index], adresa: { ...updated[index].adresa, [adresaField]: value } };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      return { ...prev, miestaVykonu: updated };
    });
  };

  const updateKrajinaPodiel = (
    listKey: 'casovePodielyIneKrajinyPred' | 'casovePodielyIneKrajinyPo' | 'prijmovePodielyIneKrajinyPo',
    index: number,
    field: keyof KrajinaPodiel,
    value: string
  ) => {
    setFormData(prev => {
      const updated = [...prev[listKey]];
      updated[index] = { ...updated[index], [field]: field === 'podiel' ? Number(value) : value };
      return { ...prev, [listKey]: updated };
    });
  };

  const updatePrijemRok = (index: number, field: keyof PrijemRok, value: string) => {
    setFormData(prev => {
      const updated = [...prev.predchadzajucePrijmy];
      updated[index] = { ...updated[index], [field]: Number(value) };
      return { ...prev, predchadzajucePrijmy: updated };
    });
  };

  const handleKrajinyVykonu = (krajina: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      krajinyVykonu: checked
        ? [...prev.krajinyVykonu, krajina]
        : prev.krajinyVykonu.filter(k => k !== krajina),
    }));
  };

  const foreignCountries = COUNTRIES.filter(c => c !== 'Slovenská republika');

  return (
    <form onSubmit={handleSubmit}>
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

        {/* Obdobie žiadosti */}
        <div className="md:col-span-3 border-t border-gray-200 dark:border-gray-700 pt-6">
          <h3 className="text-lg font-medium mb-4">Obdobie, na ktoré sa žiadosť vzťahuje</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <InputField label="Od" id="ziadostOd" name="ziadostOd" type="date" value={formData.ziadostOd} onChange={handleChange} required />
            <InputField label="Do" id="ziadostDo" name="ziadostDo" type="date" value={formData.ziadostDo} onChange={handleChange} required />
            <InputField label="Dátum zdravotného poistenia" id="datumZdravPoistenia" name="datumZdravPoistenia" type="date" value={formData.datumZdravPoistenia} onChange={handleChange} />
          </div>
          <div className="mt-4">
            <CheckboxField label="Opakovaná / viacnásobná žiadosť" id="opakovanaZiadost" name="opakovanaZiadost" checked={formData.opakovanaZiadost} onChange={handleChange} />
          </div>
        </div>
      </FormSection>

      {/* ── 2. Podnikanie ── */}
      <FormSection title="2. Podnikanie na Slovensku">
        <InputField label="IČO" id="ico" name="ico" inputMode="numeric" value={formData.ico} onChange={handleChange} required />
        <InputField label="Obchodné meno" id="obchodneMeno" name="obchodneMeno" value={formData.obchodneMeno} onChange={handleChange} required gridSpan="md:col-span-2" />
        <SelectField label="Krajina sídla" id="krajinaSidla" name="krajinaSidla" value={formData.krajinaSidla} onChange={handleChange} options={COUNTRIES} />
        <SelectField label="SK NACE (Ekonomická činnosť)" id="skNace" name="skNace" value={formData.skNace} onChange={handleChange} options={NACE_CATEGORIES.map(n => n.name)} />

        <div className="md:col-span-3 mt-4 p-4 border border-gray-100 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-slate-800">
          <h3 className="text-lg font-medium mb-4">Adresa miesta podnikania</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AddressFields address={formData.adresaMiestaPodnikania} namePrefix="adresaMiestaPodnikania" onChange={handleChange} required />
          </div>
        </div>

        <div className="md:col-span-3 border-t border-gray-200 dark:border-gray-700 pt-6">
          <h3 className="text-lg font-medium mb-3">Obdobie výkonu živnosti</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <InputField label="Od" id="cinnostOd" name="cinnostOd" type="date" value={formData.cinnostOd} onChange={handleChange} required />
            <InputField label="Do" id="cinnostDo" name="cinnostDo" type="date" value={formData.cinnostDo} onChange={handleChange} required />
            <InputField label="Pracovný čas (hod/mesiac)" id="pracovnyCas" name="pracovnyCas" type="number" value={formData.pracovnyCas} onChange={handleChange} required />
          </div>
        </div>

        <InputField
          label="Predmet SZČO (popis činnosti)"
          id="predmetSZCO" name="predmetSZCO" type="textarea"
          value={formData.predmetSZCO} onChange={handleChange} required gridSpan="md:col-span-3"
        />
      </FormSection>

      {/* ── 3. Miesta výkonu činnosti ── */}
      <FormSection title="3. Miesta výkonu činnosti">
        <div className="md:col-span-3">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Kde vykonávate SZČO? Vyberte typ:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {[
              { value: 'iba_sr', label: 'Iba v sídle (SR)', desc: 'Samostatnú zárobkovú činnosť vykonávam iba v sídle' },
              { value: 'aj_ine', label: 'Aj v inej adrese / štáte', desc: 'Vykonávam okrem sídla aj z inej adresy alebo v inom štáte' },
            ].map(opt => (
              <label key={opt.value}
                className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  formData.typVykonu === opt.value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                }`}>
                <input type="radio" name="typVykonu" value={opt.value}
                  checked={formData.typVykonu === opt.value}
                  onChange={handleChange}
                  className="mt-1 accent-blue-600" />
                <div>
                  <p className="font-medium text-gray-800 dark:text-gray-200">{opt.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>

          {formData.typVykonu === 'aj_ine' && (
            <>
              {/* Miesta výkonu – adresy */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300">Konkrétne miesta výkonu (s adresou)</h3>
                </div>
                {formData.miestaVykonu.map((miesto, i) => (
                  <div key={i} className="border border-gray-200 dark:border-gray-600 rounded-xl p-4 mb-4">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-medium text-gray-700 dark:text-gray-300">Miesto #{i + 1}</span>
                      <RemoveBtn onClick={() => setFormData(prev => ({
                        ...prev, miestaVykonu: prev.miestaVykonu.filter((_, idx) => idx !== i)
                      }))} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-3">
                      <div className="md:col-span-3">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Popis miesta</label>
                        <input type="text" value={miesto.description}
                          onChange={e => updateMiestoVykonu(i, 'description', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm"
                          placeholder="Napr. Pobočka v Hamburgu"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {(['ulica', 'supisneCislo', 'orientacneCislo', 'obec', 'psc'] as const).map(field => (
                        <div key={field}>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">
                            {field === 'ulica' ? 'Ulica' : field === 'supisneCislo' ? 'Súp. č.' : field === 'orientacneCislo' ? 'Or. č.' : field === 'obec' ? 'Obec' : 'PSČ'}
                          </label>
                          <input type="text" value={(miesto.adresa as any)[field]}
                            onChange={e => updateMiestoVykonu(i, `adresa.${field}`, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm"
                          />
                        </div>
                      ))}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">Štát</label>
                        <select value={miesto.adresa.stat}
                          onChange={e => updateMiestoVykonu(i, 'adresa.stat', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm">
                          {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => setFormData(prev => ({ ...prev, miestaVykonu: [...prev.miestaVykonu, emptyMiestoVykonu()] }))}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg text-blue-700 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800 transition-colors">
                  <AddIcon />Pridať miesto výkonu
                </button>
              </div>

              {/* Krajiny výkonu */}
              <div>
                <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">Krajiny výkonu činnosti</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {foreignCountries.map(k => (
                    <label key={k} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={formData.krajinyVykonu.includes(k)}
                        onChange={e => handleKrajinyVykonu(k, e.target.checked)}
                        className="accent-blue-600 w-4 h-4" />
                      <span className="text-gray-700 dark:text-gray-300">{k}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </FormSection>

      {/* ── 4. Príjmy ── */}
      <FormSection title="4. Príjmy">
        <div className="md:col-span-3">
          <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-4">Aktuálny rok</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            <InputField label="Rok" id="prijemAktualnyRokCislo" name="prijemAktualnyRokCislo" type="number"
              value={String(formData.prijemAktualnyRokCislo)} onChange={e => setFormData(prev => ({ ...prev, prijemAktualnyRokCislo: Number(e.target.value) }))} required />
            <InputField label="Príjem (€)" id="prijemAktualnyRok" name="prijemAktualnyRok" type="number"
              value={String(formData.prijemAktualnyRok)} onChange={e => setFormData(prev => ({ ...prev, prijemAktualnyRok: Number(e.target.value) }))} required />
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300">Predchádzajúce roky</h3>
            </div>
            {formData.predchadzajucePrijmy.map((p, i) => (
              <div key={i} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3 items-end">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">Rok</label>
                  <input type="number" value={p.rok} onChange={e => updatePrijemRok(i, 'rok', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">Príjem (€)</label>
                  <input type="number" value={p.prijem} onChange={e => updatePrijemRok(i, 'prijem', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm" />
                </div>
                <RemoveBtn onClick={() => setFormData(prev => ({ ...prev, predchadzajucePrijmy: prev.predchadzajucePrijmy.filter((_, idx) => idx !== i) }))} />
              </div>
            ))}
            <button type="button" onClick={() => setFormData(prev => ({ ...prev, predchadzajucePrijmy: [...prev.predchadzajucePrijmy, emptyPrijemRok()] }))}
              className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg text-blue-700 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800 transition-colors">
              <AddIcon />Pridať predchádzajúci rok
            </button>
          </div>
        </div>
      </FormSection>

      {/* ── 5. Rozdelenie pracovného času ── */}
      <FormSection title="5. Rozdelenie pracovného času (%)">
        <div className="md:col-span-3 space-y-8">

          {/* PRED žiadosťou */}
          <div>
            <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">Pred podaním žiadosti</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">Slovenská republika (%)</label>
                <input type="number" min="0" max="100" value={formData.casovyPodielSKPred}
                  onChange={e => setFormData(prev => ({ ...prev, casovyPodielSKPred: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm" />
              </div>
            </div>
            {formData.casovePodielyIneKrajinyPred.map((k, i) => (
              <div key={i} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2 items-end">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">Krajina</label>
                  <select value={k.krajina} onChange={e => updateKrajinaPodiel('casovePodielyIneKrajinyPred', i, 'krajina', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm">
                    <option value="">-- Vybrať --</option>
                    {foreignCountries.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">Podiel (%)</label>
                  <input type="number" min="0" max="100" value={k.podiel}
                    onChange={e => updateKrajinaPodiel('casovePodielyIneKrajinyPred', i, 'podiel', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm" />
                </div>
                <RemoveBtn onClick={() => setFormData(prev => ({ ...prev, casovePodielyIneKrajinyPred: prev.casovePodielyIneKrajinyPred.filter((_, idx) => idx !== i) }))} />
              </div>
            ))}
            <button type="button" onClick={() => setFormData(prev => ({ ...prev, casovePodielyIneKrajinyPred: [...prev.casovePodielyIneKrajinyPred, emptyKrajinaPodiel()] }))}
              className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg text-blue-700 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800 transition-colors">
              <AddIcon />Pridať krajinu
            </button>
          </div>

          {/* PO žiadosti – čas */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-5">
            <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">Po podaní žiadosti – pracovný čas</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">Slovenská republika (%)</label>
                <input type="number" min="0" max="100" value={formData.casovyPodielSKPo}
                  onChange={e => setFormData(prev => ({ ...prev, casovyPodielSKPo: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm" />
              </div>
            </div>
            {formData.casovePodielyIneKrajinyPo.map((k, i) => (
              <div key={i} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2 items-end">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">Krajina</label>
                  <select value={k.krajina} onChange={e => updateKrajinaPodiel('casovePodielyIneKrajinyPo', i, 'krajina', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm">
                    <option value="">-- Vybrať --</option>
                    {foreignCountries.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">Podiel (%)</label>
                  <input type="number" min="0" max="100" value={k.podiel}
                    onChange={e => updateKrajinaPodiel('casovePodielyIneKrajinyPo', i, 'podiel', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm" />
                </div>
                <RemoveBtn onClick={() => setFormData(prev => ({ ...prev, casovePodielyIneKrajinyPo: prev.casovePodielyIneKrajinyPo.filter((_, idx) => idx !== i) }))} />
              </div>
            ))}
            <button type="button" onClick={() => setFormData(prev => ({ ...prev, casovePodielyIneKrajinyPo: [...prev.casovePodielyIneKrajinyPo, emptyKrajinaPodiel()] }))}
              className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg text-blue-700 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800 transition-colors">
              <AddIcon />Pridať krajinu
            </button>
          </div>

          {/* PO žiadosti – príjmy */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-5">
            <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">Po podaní žiadosti – príjmy</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">Slovenská republika (%)</label>
                <input type="number" min="0" max="100" value={formData.prijmovyPodielSKPo}
                  onChange={e => setFormData(prev => ({ ...prev, prijmovyPodielSKPo: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm" />
              </div>
            </div>
            {formData.prijmovePodielyIneKrajinyPo.map((k, i) => (
              <div key={i} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2 items-end">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">Krajina</label>
                  <select value={k.krajina} onChange={e => updateKrajinaPodiel('prijmovePodielyIneKrajinyPo', i, 'krajina', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm">
                    <option value="">-- Vybrať --</option>
                    {foreignCountries.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">Podiel (%)</label>
                  <input type="number" min="0" max="100" value={k.podiel}
                    onChange={e => updateKrajinaPodiel('prijmovePodielyIneKrajinyPo', i, 'podiel', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm" />
                </div>
                <RemoveBtn onClick={() => setFormData(prev => ({ ...prev, prijmovePodielyIneKrajinyPo: prev.prijmovePodielyIneKrajinyPo.filter((_, idx) => idx !== i) }))} />
              </div>
            ))}
            <button type="button" onClick={() => setFormData(prev => ({ ...prev, prijmovePodielyIneKrajinyPo: [...prev.prijmovePodielyIneKrajinyPo, emptyKrajinaPodiel()] }))}
              className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg text-blue-700 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800 transition-colors">
              <AddIcon />Pridať krajinu
            </button>
          </div>
        </div>
      </FormSection>

      {/* ── 6. Dokumenty a ostatné ── */}
      <FormSection title="6. Dokumenty a ostatné informácie">
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

        <SelectField label="Príslušná pobočka SP" id="pobocka" name="pobocka" value={formData.pobocka} onChange={handleChange}
          options={BRANCH_OFFICES.map(b => b.name)} values={BRANCH_OFFICES.map(b => b.code)} />
        <InputField label="Doplňujúce informácie" id="doplnujuceInfo" name="doplnujuceInfo" type="textarea"
          value={formData.doplnujuceInfo} onChange={handleChange} gridSpan="md:col-span-2" />
      </FormSection>

      {/* ── Prílohy ── */}
      <AttachmentUpload
        attachments={attachments}
        setAttachments={setAttachments}
        formType="UPLATNITELNA_LEGISLATIVA"
      />

      {/* ── Tlačidlo ── */}
      <div className="mt-12 flex flex-col items-center justify-center pb-12 gap-4">
        {submitSuccess ? (
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-semibold text-lg">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              {submitSuccess}
            </div>
            <button type="button" onClick={onReset}
              className="text-sm text-blue-600 dark:text-blue-400 underline">
              Podať ďalšiu žiadosť
            </button>
          </div>
        ) : (
          <button
            type="submit"
            disabled={submitLoading}
            className={`flex items-center gap-2 font-bold py-4 px-12 rounded-2xl shadow-xl transition-all ${submitLoading ? 'bg-gray-400 cursor-not-allowed opacity-50 text-white' : 'bg-green-600 hover:bg-green-700 text-white hover:scale-105 active:scale-95'}`}>
            {submitLoading ? (
              <>
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                Odosielam...
              </>
            ) : (
              <>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Podať žiadosť
              </>
            )}
          </button>
        )}
        {submitError && (
          <p className="text-red-600 dark:text-red-400 text-sm font-medium">{submitError}</p>
        )}
      </div>
    </form>
  );
};

export default UplatnitelnaForm;

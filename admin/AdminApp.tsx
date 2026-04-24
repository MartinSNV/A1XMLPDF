import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';

// ── Typy ────────────────────────────────────────────────────────────────────

type BundleStatus = 'NEW' | 'REVIEWED' | 'SUBMITTED' | 'COMPLETED';
type FormType = 'PD_A1' | 'UPLATNITELNA_LEGISLATIVA';

interface AttachmentMeta {
  id: string;
  fileName: string;
  attachmentType: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

interface Bundle {
  id: string;
  createdAt: string;
  formType: FormType;
  status: BundleStatus;
  ico: string;
  companyName: string;
  applicantName: string;
  _count: { attachments: number };
}

interface BundleDetail extends Bundle {
  formData: any;
  xmlContent: string | null;
  adminNote: string | null;
  attachments: AttachmentMeta[];
}

// ── Pomocné funkcie ──────────────────────────────────────────────────────────

const STATUS_LABELS: Record<BundleStatus, string> = {
  NEW: 'Nová',
  REVIEWED: 'Skontrolovaná',
  SUBMITTED: 'Odoslaná na SP',
  COMPLETED: 'Vybavená',
};

const STATUS_COLORS: Record<BundleStatus, string> = {
  NEW: 'bg-blue-100 text-blue-800',
  REVIEWED: 'bg-yellow-100 text-yellow-800',
  SUBMITTED: 'bg-purple-100 text-purple-800',
  COMPLETED: 'bg-green-100 text-green-800',
};

const FORM_LABELS: Record<FormType, string> = {
  PD_A1: 'PD A1 – Vyslanie',
  UPLATNITELNA_LEGISLATIVA: 'Uplatniteľná legislatíva',
};

const ATTACHMENT_TYPE_LABELS: Record<string, string> = {
  zivnostenskyList: 'Živnostenský list',
  dokladPobytu: 'Doklad o pobyte',
  zmluva: 'Zmluva',
  dokladPrijmov: 'Doklad o príjmoch',
  ine: 'Iný doklad',
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

// ── Hlavný Admin komponent ───────────────────────────────────────────────────

const AdminApp: React.FC = () => {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [selected, setSelected] = useState<BundleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<BundleStatus | 'ALL'>('ALL');
  const [filterType, setFilterType] = useState<FormType | 'ALL'>('ALL');
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);
  const [xmlGenerating, setXmlGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBundles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bundles');
      const data = await res.json();
      setBundles(data);
    } catch {
      setError('Chyba pri načítaní žiadostí');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBundles(); }, [fetchBundles]);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setSelected(null);
    try {
      const res = await fetch(`/api/bundles/${id}`);
      const data: BundleDetail = await res.json();
      setSelected(data);
      setNoteText(data.adminNote || '');
    } catch {
      setError('Chyba pri načítaní detailu');
    } finally {
      setDetailLoading(false);
    }
  };

  const updateStatus = async (id: string, status: BundleStatus) => {
    setSaving(true);
    try {
      await fetch(`/api/bundles/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      setSelected(prev => prev ? { ...prev, status } : prev);
      setBundles(prev => prev.map(b => b.id === id ? { ...b, status } : b));
    } catch {
      setError('Chyba pri zmene stavu');
    } finally {
      setSaving(false);
    }
  };

  const saveNote = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await fetch(`/api/bundles/${selected.id}/note`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminNote: noteText }),
      });
      setSelected(prev => prev ? { ...prev, adminNote: noteText } : prev);
    } catch {
      setError('Chyba pri ukladaní poznámky');
    } finally {
      setSaving(false);
    }
  };

  const generateAndDownloadXml = async () => {
    if (!selected) return;
    setXmlGenerating(true);
    try {
      const res = await fetch(`/api/bundles/${selected.id}/generate-xml`, { method: 'POST' });
      if (!res.ok) throw new Error('Chyba pri generovaní XML');
      const { xml } = await res.json();
      // Stiahni XML
      const blob = new Blob([xml], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ziadost-${selected.ico}-${selected.id.slice(0, 8)}.xml`;
      a.click();
      URL.revokeObjectURL(url);
      setSelected(prev => prev ? { ...prev, xmlContent: xml } : prev);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setXmlGenerating(false);
    }
  };

  const downloadZip = async () => {
    if (!selected) return;
    const res = await fetch(`/api/bundles/${selected.id}/zip`);
    if (!res.ok) { setError('Chyba pri generovaní ZIP'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ziadost-${selected.ico}-${selected.id.slice(0, 8)}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = bundles.filter(b =>
    (filterStatus === 'ALL' || b.status === filterStatus) &&
    (filterType === 'ALL' || b.formType === filterType)
  );

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 w-8 h-8 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900">A1 XMLPDF – Admin</h1>
          </div>
          <button onClick={fetchBundles} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Obnoviť
          </button>
        </div>
      </header>

      {error && (
        <div className="max-w-7xl mx-auto px-4 mt-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex justify-between items-center">
            <p className="text-red-700 text-sm">{error}</p>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">✕</button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-6">

        {/* ── Ľavý panel: zoznam ── */}
        <div className="w-full max-w-md flex-shrink-0">
          {/* Filtre */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4 flex gap-3">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
              className="flex-1 text-sm px-3 py-2 border border-gray-300 rounded-lg bg-white">
              <option value="ALL">Všetky stavy</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={filterType} onChange={e => setFilterType(e.target.value as any)}
              className="flex-1 text-sm px-3 py-2 border border-gray-300 rounded-lg bg-white">
              <option value="ALL">Všetky typy</option>
              {Object.entries(FORM_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          {/* Zoznam */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-gray-500">Načítavam...</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-gray-500">Žiadne žiadosti</div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {filtered.map(b => (
                  <li key={b.id}
                    onClick={() => openDetail(b.id)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${selected?.id === b.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{b.companyName}</p>
                        <p className="text-xs text-gray-500">{b.applicantName} · IČO: {b.ico}</p>
                        <p className="text-xs text-gray-400 mt-1">{formatDate(b.createdAt)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[b.status]}`}>
                          {STATUS_LABELS[b.status]}
                        </span>
                        <span className="text-xs text-gray-400">{FORM_LABELS[b.formType]}</span>
                        <span className="text-xs text-gray-400">{b._count.attachments} príloh</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="text-xs text-gray-400 mt-2 text-center">
            {filtered.length} z {bundles.length} žiadostí
          </p>
        </div>

        {/* ── Pravý panel: detail ── */}
        <div className="flex-1 min-w-0">
          {detailLoading ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-gray-500">
              Načítavam detail...
            </div>
          ) : !selected ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Vyber žiadosť zo zoznamu
            </div>
          ) : (
            <div className="space-y-4">

              {/* Hlavička detailu */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selected.companyName}</h2>
                    <p className="text-gray-600">{selected.applicantName} · IČO: {selected.ico}</p>
                    <p className="text-sm text-gray-400 mt-1">
                      {FORM_LABELS[selected.formType]} · Podaná: {formatDate(selected.createdAt)}
                    </p>
                    <p className="text-xs text-gray-400 font-mono mt-1">ID: {selected.id}</p>
                  </div>
                  <span className={`text-sm font-semibold px-3 py-1 rounded-full ${STATUS_COLORS[selected.status]}`}>
                    {STATUS_LABELS[selected.status]}
                  </span>
                </div>

                {/* Zmena stavu */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {(Object.keys(STATUS_LABELS) as BundleStatus[]).map(s => (
                    <button key={s}
                      disabled={selected.status === s || saving}
                      onClick={() => updateStatus(selected.id, s)}
                      className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${selected.status === s
                        ? 'bg-gray-200 text-gray-500 cursor-default'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
                      → {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Akcie */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-800 mb-4">Akcie</h3>
                <div className="flex flex-wrap gap-3">
                  <button onClick={generateAndDownloadXml} disabled={xmlGenerating}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    {xmlGenerating ? 'Generujem...' : 'Generovať XML'}
                  </button>
                  <button onClick={downloadZip}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Stiahnuť ZIP (XML + prílohy)
                  </button>
                </div>
                {selected.xmlContent && (
                  <p className="text-xs text-green-600 mt-2">✓ XML už bolo vygenerované</p>
                )}
              </div>

              {/* Prílohy */}
              {selected.attachments.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="font-semibold text-gray-800 mb-4">Prílohy ({selected.attachments.length})</h3>
                  <ul className="space-y-2">
                    {selected.attachments.map(att => (
                      <li key={att.id} className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <svg className="h-5 w-5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                          </svg>
                          <div>
                            <p className="text-sm font-medium text-gray-800">{att.fileName}</p>
                            <p className="text-xs text-gray-500">
                              {ATTACHMENT_TYPE_LABELS[att.attachmentType] || att.attachmentType} · {formatSize(att.sizeBytes)}
                            </p>
                          </div>
                        </div>
                        <a href={`/api/attachments/${att.id}`} download={att.fileName}
                          className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                          Stiahnuť
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Poznámka správcu */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-800 mb-3">Poznámka správcu</h3>
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  rows={3}
                  placeholder="Pridaj poznámku ku tejto žiadosti..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button onClick={saveNote} disabled={saving}
                  className="mt-2 px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
                  {saving ? 'Ukladám...' : 'Uložiť poznámku'}
                </button>
              </div>

              {/* Dáta formulára */}
              <details className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <summary className="font-semibold text-gray-800 cursor-pointer">Dáta formulára (JSON)</summary>
                <pre className="mt-3 text-xs bg-gray-50 p-3 rounded-lg overflow-auto max-h-96 text-gray-700">
                  {JSON.stringify(selected.formData, null, 2)}
                </pre>
              </details>

            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Mount
const root = document.getElementById('admin-root');
if (root) ReactDOM.createRoot(root).render(<AdminApp />);

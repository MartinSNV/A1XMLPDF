import React, { useRef, useState } from 'react';
import CameraCapture from './CameraCapture';

export interface AttachmentFile {
  file: File;
  attachmentType: string;
  id: string;
}

interface AttachmentDef {
  type: string;
  label: string;
  required: boolean;
}

export const ATTACHMENTS_PD_A1: AttachmentDef[] = [
  { type: 'zivnostenskyList', label: 'Živnostenský list / Výpis zo živnostenského registra', required: true },
  { type: 'dokladPobytu', label: 'Doklad o pobyte (OP alebo pas)', required: true },
  { type: 'zmluva', label: 'Zmluva / objednávka s prijímateľom v zahraničí', required: false },
  { type: 'ine', label: 'Iný doklad', required: false },
];

export const ATTACHMENTS_UPLATNITELNA: AttachmentDef[] = [
  { type: 'zivnostenskyList', label: 'Živnostenský list / Výpis zo živnostenského registra', required: true },
  { type: 'dokladPobytu', label: 'Doklad o pobyte (OP alebo pas)', required: true },
  { type: 'dokladPrijmov', label: 'Doklad o príjmoch (daňové priznanie / faktúry)', required: false },
  { type: 'ine', label: 'Iný doklad', required: false },
];

const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg', 'image/jpg', 'image/png',
  'image/heic', 'image/heif', 'image/webp',
];
const ALLOWED_ACCEPT = '.pdf,.jpg,.jpeg,.png,.heic,.heif,.webp';
const MAX_SIZE_MB = 20;

interface Props {
  attachments: AttachmentFile[];
  setAttachments: React.Dispatch<React.SetStateAction<AttachmentFile[]>>;
  formType: 'PD_A1' | 'UPLATNITELNA_LEGISLATIVA';
}

const FileIcon: React.FC<{ mimeType: string }> = ({ mimeType }) => {
  if (mimeType === 'application/pdf') {
    return (
      <svg className="h-5 w-5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
      </svg>
    );
  }
  return (
    <svg className="h-5 w-5 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
    </svg>
  );
};

const AttachmentUpload: React.FC<Props> = ({ attachments, setAttachments, formType }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [selectedType, setSelectedType] = React.useState('ine');
  const [error, setError] = React.useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  const handleCameraDone = (photos: File[]) => {
    setCameraOpen(false);
    if (photos.length > 0) processFiles(photos);
  };

  const defs = formType === 'PD_A1' ? ATTACHMENTS_PD_A1 : ATTACHMENTS_UPLATNITELNA;

  const processFiles = (files: File[]) => {
    setError(null);
    const invalid = files.filter(f =>
      !ALLOWED_TYPES.includes(f.type) &&
      !f.name.toLowerCase().endsWith('.heic') &&
      !f.name.toLowerCase().endsWith('.heif')
    );
    if (invalid.length > 0) {
      setError(`Nepodporovaný formát: ${invalid.map(f => f.name).join(', ')}. Povolené: PDF, JPG, PNG, HEIC, WebP`);
      return;
    }
    const tooBig = files.filter(f => f.size > MAX_SIZE_MB * 1024 * 1024);
    if (tooBig.length > 0) {
      setError(`Súbor je príliš veľký. Maximum je ${MAX_SIZE_MB} MB.`);
      return;
    }
    const newFiles: AttachmentFile[] = files.map(f => ({
      file: f,
      attachmentType: selectedType,
      id: `${Date.now()}-${Math.random()}`,
    }));
    setAttachments(prev => [...prev, ...newFiles]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length) processFiles(files);
    e.target.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const getLabel = (type: string) => defs.find(d => d.type === type)?.label || 'Iný doklad';

  const getFileTypeLabel = (file: File) => {
    if (file.type === 'application/pdf') return 'PDF';
    if (file.type.startsWith('image/')) return 'Obrázok';
    return file.name.split('.').pop()?.toUpperCase() || 'Súbor';
  };

  const missingRequired = defs
    .filter(d => d.required)
    .filter(d => !attachments.some(a => a.attachmentType === d.type));

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md mb-8">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-4 mb-6">
        Prílohy
      </h2>

      {/* Zoznam požadovaných príloh */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-3">
        {defs.map(def => {
          const uploaded = attachments.filter(a => a.attachmentType === def.type);
          const ok = uploaded.length > 0;
          return (
            <div key={def.type}
              className={`flex items-center gap-3 p-3 rounded-lg border ${ok
                ? 'border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-700'
                : def.required
                  ? 'border-orange-300 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-700'
                  : 'border-gray-200 bg-gray-50 dark:bg-slate-700 dark:border-gray-600'
              }`}>
              {ok ? <span className="text-green-600 dark:text-green-400 text-lg">✓</span>
                : def.required ? <span className="text-orange-500 text-lg">!</span>
                : <span className="text-gray-400 text-lg">○</span>}
              <div>
                <p className={`text-sm font-medium ${ok ? 'text-green-800 dark:text-green-300' : 'text-gray-700 dark:text-gray-300'}`}>
                  {def.label}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {def.required ? 'Povinná' : 'Voliteľná'}{ok ? ` · ${uploaded.length} súbor(ov)` : ''}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Typ prílohy */}
      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Typ prílohy</label>
        <select
          value={selectedType}
          onChange={e => setSelectedType(e.target.value)}
          className="w-full sm:w-auto px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm">
          {defs.map(d => <option key={d.type} value={d.type}>{d.label}</option>)}
        </select>
      </div>

      {/* Tlačidlá */}
      <div className="flex flex-wrap gap-3 mb-2">
        <button type="button" onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Nahrať súbor
        </button>

        <button type="button" onClick={() => setCameraOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Odfotiť dokument
        </button>

        <input ref={fileInputRef} type="file" accept={ALLOWED_ACCEPT} multiple className="hidden" onChange={handleFileChange} />

        {/* Camera modal */}
        {cameraOpen && (
          <CameraCapture
            onDone={handleCameraDone}
            onClose={() => setCameraOpen(false)}
          />
        )}
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
        Povolené: PDF, JPG, PNG, HEIC, WebP · Max. {MAX_SIZE_MB} MB na súbor
      </p>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 mb-3 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">{error}</p>
      )}

      {/* Zoznam súborov */}
      {attachments.length > 0 && (
        <ul className="space-y-2">
          {attachments.map(att => (
            <li key={att.id}
              className="flex items-center justify-between gap-3 p-3 bg-gray-50 dark:bg-slate-700 rounded-lg border border-gray-200 dark:border-gray-600">
              <div className="flex items-center gap-3 min-w-0">
                <FileIcon mimeType={att.file.type} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{att.file.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {getLabel(att.attachmentType)} · {getFileTypeLabel(att.file)} · {formatSize(att.file.size)}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => removeAttachment(att.id)}
                className="text-red-500 hover:text-red-700 flex-shrink-0 p-1">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      {missingRequired.length > 0 && (
        <p className="mt-3 text-xs text-orange-600 dark:text-orange-400">
          Chýbajú povinné prílohy: {missingRequired.map(d => d.label).join(', ')}
        </p>
      )}
    </div>
  );
};

export default AttachmentUpload;

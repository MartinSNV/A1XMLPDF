import React, { useRef, useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';

interface CapturedPhoto {
  id: string;
  dataUrl: string;
  file: File;
}

interface Props {
  onDone: (photos: File[]) => void;
  onClose: () => void;
}

const CameraCapture: React.FC<Props> = ({ onDone, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  // Spusti kameru
  useEffect(() => {
    let active = true;
    const startCamera = async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (!active) { s.getTracks().forEach(t => t.stop()); return; }
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.onloadedmetadata = () => setCameraReady(true);
        }
      } catch {
        setError('Kamera nie je dostupná. Skúste nahrať súbory manuálne.');
      }
    };
    startCamera();
    return () => {
      active = false;
    };
  }, []);

  // Zastav kameru pri unmount
  useEffect(() => {
    return () => {
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [stream]);

  const takePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(blob => {
      if (!blob) return;
      const id = `${Date.now()}-${Math.random()}`;
      const file = new File([blob], `foto-strana-${photos.length + 1}.jpg`, { type: 'image/jpeg' });
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      setPhotos(prev => [...prev, { id, dataUrl, file }]);
    }, 'image/jpeg', 0.92);
  }, [photos.length]);

  const removePhoto = (id: string) => {
    setPhotos(prev => prev.filter(p => p.id !== id));
  };

  const handleDone = () => {
    stream?.getTracks().forEach(t => t.stop());
    onDone(photos.map(p => p.file));
  };

  const handleClose = () => {
    stream?.getTracks().forEach(t => t.stop());
    onClose();
  };

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-50 bg-black flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 text-white flex-shrink-0">
        <button onClick={handleClose} className="flex items-center gap-2 text-sm text-gray-300 hover:text-white">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Zrušiť
        </button>
        <span className="text-sm font-medium">
          {photos.length === 0 ? 'Odfotografujte dokument' : `${photos.length} strana(y) nafotená(é)`}
        </span>
        <button
          onClick={handleDone}
          disabled={photos.length === 0}
          className={`text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors ${photos.length > 0
            ? 'bg-green-500 hover:bg-green-400 text-white'
            : 'text-gray-500 cursor-default'}`}>
          Hotovo {photos.length > 0 ? `(${photos.length})` : ''}
        </button>
      </div>

      {/* Video stream */}
      <div className="flex-1 relative overflow-hidden">
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white px-6">
              <svg className="h-12 w-12 mx-auto mb-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              </svg>
              <p className="text-red-400 font-medium mb-2">{error}</p>
              <button onClick={handleClose} className="mt-3 px-4 py-2 bg-white text-black rounded-lg text-sm font-medium">
                Zavrieť
              </button>
            </div>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-black">
                <p className="text-white text-sm">Spúšťam kameru...</p>
              </div>
            )}
            {/* Rámček pre dokument */}
            {cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="border-2 border-white/60 rounded-lg w-4/5 aspect-[3/4] shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
              </div>
            )}
          </>
        )}
      </div>

      {/* Canvas skrytý */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Náhľady nafotených strán */}
      {photos.length > 0 && (
        <div className="bg-black/90 px-4 py-3 flex-shrink-0">
          <p className="text-xs text-gray-400 mb-2">Nafotené strany (klikni pre odstránenie):</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {photos.map((p, i) => (
              <div key={p.id} className="relative flex-shrink-0">
                <img src={p.dataUrl} alt={`Strana ${i + 1}`}
                  className="h-16 w-12 object-cover rounded border-2 border-white/30" />
                <button
                  onClick={() => removePhoto(p.id)}
                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs leading-none">
                  ×
                </button>
                <span className="absolute bottom-0 left-0 right-0 text-center text-white text-xs bg-black/60 rounded-b">
                  {i + 1}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tlačidlo Fotiť */}
      {!error && (
        <div className="bg-black flex-shrink-0 flex items-center justify-center py-6">
          <button
            onClick={takePhoto}
            disabled={!cameraReady}
            className={`w-16 h-16 rounded-full border-4 border-white flex items-center justify-center transition-all active:scale-90 ${cameraReady ? 'bg-white/20 hover:bg-white/30' : 'opacity-40 cursor-default'}`}>
            <div className="w-10 h-10 rounded-full bg-white" />
          </button>
        </div>
      )}
    </div>,
    document.body
  );
};

export default CameraCapture;

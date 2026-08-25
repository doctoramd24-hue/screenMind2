import React, { useState, useRef } from 'react';
// Added useNavigate to enable programmatic navigation
import { useNavigate } from 'react-router-dom';
import { useNotes } from '../contexts/NotesContext.tsx';
import { Loader2, ScanLine, FileText, CheckCircle2, Files, Upload, X, AlertCircle } from 'lucide-react';
import * as ai from '../utils/aiAdapter.ts';

const OcrPage: React.FC = () => {
  // Initialized the navigate function using the useNavigate hook
  const navigate = useNavigate();
  const { addNote, settings, addLog } = useNotes();
  const [isProcessing, setIsProcessing] = useState(false);
  const [queue, setQueue] = useState<number>(0);
  const [results, setResults] = useState<{name: string, text: string}[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter((f: File) => f.type.startsWith('image/')) as File[];
    if (files.length > 0) processFiles(files);
  };

  const processFiles = async (files: File[]) => {
    setIsProcessing(true);
    setError(null);
    setQueue(files.length);
    addLog('info', `Запуск OCR для ${files.length} файлов`);
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setQueue(files.length - i);
      try {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        
        const text = await ai.performOCR(base64, file.type, settings);
        await addNote(text, `Скан: ${file.name}`, 'ocr', true);
        setResults(prev => [{ name: file.name, text }, ...prev]);
        addLog('success', `OCR ${file.name} OK`);
      } catch (err: any) {
        setError(err.message);
        addLog('error', `OCR Error (${file.name}): ${err.message}`);
        break; // Stop batch on error to prevent cascading 429
      }
    }
    
    setIsProcessing(false);
    setQueue(0);
  };

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f: File) => f.type.startsWith('image/')) as File[];
    if (files.length > 0) processFiles(files);
  };

  return (
    <div className="p-12 max-w-5xl mx-auto min-h-screen animate-in fade-in duration-500 pb-32">
      <header className="mb-16 flex justify-between items-end">
        <div>
          <div className="flex items-center gap-3 text-blue-600 font-black text-[11px] uppercase tracking-[0.4em]">
            <ScanLine size={16} /> Vision Intelligence
          </div>
          <h2 className="text-6xl font-black dark:text-white mt-2 tracking-tighter">Скан-центр</h2>
          <p className="text-gray-500 mt-4 text-lg max-w-xl">
            Движок: <span className="text-blue-600 font-black">{settings.ocrProvider} {settings.ocrModel}</span>
          </p>
        </div>
        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
          className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 hover:bg-blue-700 shadow-xl transition-all disabled:opacity-50"
        >
          <Upload size={18}/> Выбрать файлы
        </button>
      </header>

      <div 
        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-blue-500', 'bg-blue-50/50'); }}
        onDragLeave={(e) => { e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50/50'); }}
        onDrop={(e) => { e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50/50'); handleDrop(e); }}
        className={`relative h-[300px] border-4 border-dashed rounded-[4rem] flex flex-col items-center justify-center transition-all group overflow-hidden ${
          isProcessing ? 'bg-blue-50 border-blue-400 dark:bg-blue-950/20' : 'bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800'
        }`}
      >
        <input ref={fileInputRef} type="file" multiple className="hidden" accept="image/*" onChange={onFileInput} />
        
        {isProcessing ? (
          <div className="flex flex-col items-center gap-8">
            <Loader2 className="animate-spin text-blue-600" size={60} />
            <p className="text-xl font-black text-blue-600 uppercase tracking-widest">Осталось: {queue}</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-4 text-red-500 px-12 text-center">
            <AlertCircle size={48} />
            <p className="font-black uppercase text-sm tracking-widest">{error}</p>
            <button onClick={() => setError(null)} className="text-[10px] font-black underline">Попробовать снова</button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="p-8 bg-blue-50 dark:bg-blue-900/20 rounded-[2rem] text-blue-600">
              <Files size={48} />
            </div>
            <p className="text-2xl font-black dark:text-white uppercase tracking-tighter">Перетащите скрины сюда</p>
          </div>
        )}
      </div>

      {results.length > 0 && (
        <div className="mt-16 space-y-4 animate-in slide-in-from-bottom">
          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-4">Распознано ({results.length})</h4>
          {results.map((res, i) => (
            <div key={i} className="p-6 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-[2.5rem] flex items-center gap-6 shadow-sm">
               <CheckCircle2 className="text-green-500 shrink-0" size={24}/>
               <div className="flex-1 overflow-hidden">
                  <p className="font-black text-sm dark:text-white truncate uppercase mb-1">{res.name}</p>
                  <p className="text-xs text-gray-400 truncate italic">"{res.text.slice(0, 100)}..."</p>
               </div>
               {/* Fixed missing 'navigate' by using the initialized useNavigate hook */}
               <button onClick={() => navigate('/')} className="p-3 bg-gray-50 dark:bg-slate-800 rounded-xl text-gray-400 hover:text-blue-500 transition-colors">
                  <FileText size={18}/>
               </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OcrPage;
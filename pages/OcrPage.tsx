import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotes } from '../contexts/NotesContext.tsx';
import { 
  Loader2, ScanLine, FileText, CheckCircle2, Files, Upload, AlertCircle, 
  Cpu, Cloud, ShieldCheck, Zap, ArrowRight, Sparkles, Check
} from 'lucide-react';
import * as ai from '../utils/aiAdapter.ts';
import { localOcr } from '../utils/localOcr.ts';

const OcrPage: React.FC = () => {
  const navigate = useNavigate();
  const { addNote, settings, addLog, notes } = useNotes();
  const [ocrMode, setOcrMode] = useState<'wasm_local' | 'cloud_ai'>('wasm_local');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentProgressStatus, setCurrentProgressStatus] = useState<string>('');
  const [currentProgressPercent, setCurrentProgressPercent] = useState<number>(0);
  const [queue, setQueue] = useState<number>(0);
  const [results, setResults] = useState<{
    name: string; 
    rawText: string; 
    cleanedText: string; 
    durationMs: number; 
    noteTitle?: string;
    isLocal: boolean;
  }[]>([]);
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
    addLog('info', `Запуск OCR (${ocrMode === 'wasm_local' ? 'Локальный WASM Tesseract' : 'Облачный Vision'}) для ${files.length} файлов`);
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setQueue(files.length - i);
      const startTime = performance.now();

      try {
        let extractedText = '';
        let cleanedText = '';
        let durationMs = 0;

        if (ocrMode === 'wasm_local') {
          // 1. 100% Local WebAssembly Tesseract.js (Russian + English)
          setCurrentProgressStatus(`Локальный OCR [${file.name}]...`);
          const ocrResult = await localOcr.recognize(file, (status, progress) => {
            setCurrentProgressStatus(`Tesseract WASM: ${status}`);
            setCurrentProgressPercent(Math.round(progress * 100));
          });
          extractedText = ocrResult.text;
          cleanedText = ocrResult.cleanedText;
          durationMs = ocrResult.durationMs;
        } else {
          // 2. Cloud AI Vision API
          setCurrentProgressStatus(`Отправка в ${settings.ocrProvider}...`);
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
          extractedText = await ai.performOCR(base64, file.type, settings);
          cleanedText = extractedText;
          durationMs = Math.round(performance.now() - startTime);
        }

        if (!cleanedText.trim()) {
          throw new Error('Текст на изображении не обнаружен или изображение слишком темное.');
        }

        // Auto-tag & summarize note using AI adapter (with semantic cache check)
        setCurrentProgressStatus('AI-тегирование и структурирование...');
        const newNote = await addNote(cleanedText, `Скриншот: ${file.name.replace(/\.[^/.]+$/, '')}`, 'ocr', true);
        
        setResults(prev => [{
          name: file.name,
          rawText: extractedText,
          cleanedText,
          durationMs,
          noteTitle: newNote.title,
          isLocal: ocrMode === 'wasm_local'
        }, ...prev]);

        addLog('success', `OCR (${file.name}): Распознано ${cleanedText.length} символов за ${durationMs} мс`);
      } catch (err: any) {
        setError(err.message || 'Ошибка распознавания');
        addLog('error', `OCR Error (${file.name}): ${err.message}`);
        break;
      }
    }
    
    setIsProcessing(false);
    setQueue(0);
    setCurrentProgressStatus('');
    setCurrentProgressPercent(0);
  };

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f: File) => f.type.startsWith('image/')) as File[];
    if (files.length > 0) processFiles(files);
  };

  return (
    <div className="p-6 md:p-12 max-w-5xl mx-auto min-h-screen animate-in fade-in duration-500 pb-32">
      {/* Header */}
      <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400 font-black text-[11px] uppercase tracking-[0.4em]">
            <ScanLine size={16} /> Autonomous OCR Engine
          </div>
          <h2 className="text-4xl md:text-5xl font-black dark:text-white mt-2 tracking-tight">Локальный Скан-центр</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm max-w-xl">
            Распознавание русского и английского текста прямо в браузере и PWA с автоматической очисткой системных логов и шума.
          </p>
        </div>

        {/* Engine Switcher */}
        <div className="flex flex-col gap-2">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setOcrMode('wasm_local')}
              className={`px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                ocrMode === 'wasm_local'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-md'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              <Cpu size={15} /> 100% Локально (WASM)
            </button>
            <button
              onClick={() => setOcrMode('cloud_ai')}
              className={`px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                ocrMode === 'cloud_ai'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-md'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              <Cloud size={15} /> Облачный Vision API
            </button>
          </div>
          <div className="text-[10px] text-slate-400 text-center font-medium">
            {ocrMode === 'wasm_local' ? '⚡ Tesseract.js (без интернета, CPU Snapdragon)' : `🌐 ${settings.ocrProvider} Vision`}
          </div>
        </div>
      </header>

      {/* Upload Box */}
      <div 
        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-indigo-500', 'bg-indigo-50/50'); }}
        onDragLeave={(e) => { e.currentTarget.classList.remove('border-indigo-500', 'bg-indigo-50/50'); }}
        onDrop={(e) => { e.currentTarget.classList.remove('border-indigo-500', 'bg-indigo-50/50'); handleDrop(e); }}
        className={`relative h-[280px] border-3 border-dashed rounded-3xl flex flex-col items-center justify-center transition-all group overflow-hidden ${
          isProcessing 
            ? 'bg-indigo-50/60 border-indigo-400 dark:bg-indigo-950/20' 
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-400'
        }`}
      >
        <input ref={fileInputRef} type="file" multiple className="hidden" accept="image/*" onChange={onFileInput} />
        
        {isProcessing ? (
          <div className="flex flex-col items-center gap-4 text-center px-6">
            <Loader2 className="animate-spin text-indigo-600" size={50} />
            <div className="space-y-1">
              <p className="text-base font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                Обработка {queue > 1 ? `(Осталось: ${queue})` : ''}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                {currentProgressStatus || 'Извлечение текста...'} {currentProgressPercent > 0 ? `(${currentProgressPercent}%)` : ''}
              </p>
            </div>
            {currentProgressPercent > 0 && (
              <div className="w-48 bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-indigo-600 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${currentProgressPercent}%` }}
                />
              </div>
            )}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 text-rose-500 px-6 text-center">
            <AlertCircle size={40} />
            <p className="font-bold text-sm">{error}</p>
            <button 
              onClick={() => setError(null)} 
              className="text-xs font-black underline hover:text-rose-600 cursor-pointer"
            >
              Попробовать снова
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 text-center px-6">
            <div className="p-5 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
              <Files size={36} />
            </div>
            <div>
              <p className="text-lg font-black dark:text-white tracking-tight">
                Перетащите скриншоты или нажмите для выбора
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Поддерживаются PNG, JPG, WEBP • Авто-очистка батареи, часов и статус-бара
              </p>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer mt-2"
            >
              <Upload size={16} /> Выбрать скриншоты
            </button>
          </div>
        )}
      </div>

      {/* Autonomous Cleaning Features Badge Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6">
        <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center gap-3">
          <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <ShieldCheck size={18} />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-800 dark:text-white">OCR-клининг шума</div>
            <div className="text-[10px] text-slate-400">Удаляет батарею, часы и LTE</div>
          </div>
        </div>

        <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center gap-3">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Zap size={18} />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-800 dark:text-white">Семантический кэш 0 мс</div>
            <div className="text-[10px] text-slate-400">Jaccard сходство &gt; 80%</div>
          </div>
        </div>

        <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center gap-3">
          <div className="p-2 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-xl">
            <Sparkles size={18} />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-800 dark:text-white">Авто-векторизация 384-D</div>
            <div className="text-[10px] text-slate-400">Мгновенный Offline RAG</div>
          </div>
        </div>
      </div>

      {/* Results Stream */}
      {results.length > 0 && (
        <div className="mt-12 space-y-4 animate-in slide-in-from-bottom">
          <div className="flex items-center justify-between px-2">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
              Распознано в этой сессии ({results.length})
            </h4>
            <button
              onClick={() => navigate('/')}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline"
            >
              Перейти ко всем заметкам <ArrowRight size={14} />
            </button>
          </div>

          <div className="space-y-3">
            {results.map((res, i) => (
              <div 
                key={i} 
                className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
              >
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0 mt-1">
                    <CheckCircle2 size={20} />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-800 dark:text-white">
                        {res.noteTitle || res.name}
                      </span>
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                        {res.isLocal ? 'WASM Local' : 'Cloud'} • {res.durationMs} мс
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 italic">
                      "{res.cleanedText}"
                    </p>
                  </div>
                </div>

                <button 
                  onClick={() => navigate('/')} 
                  className="px-4 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-600 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                >
                  <FileText size={15} /> Открыть в базе
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default OcrPage;

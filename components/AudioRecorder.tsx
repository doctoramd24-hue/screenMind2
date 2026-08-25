
import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, Save, X, RotateCcw, Volume2, Sparkles, AlertCircle, Play, Pause, Headphones } from 'lucide-react';
import { useNotes } from '../contexts/NotesContext.tsx';
import * as ai from '../utils/aiAdapter.ts';

const AudioRecorder: React.FC<{ onComplete?: () => void }> = ({ onComplete }) => {
  const { addNote, addLog, settings } = useNotes();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const startRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const chunks: BlobPart[] = [];
      
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      addLog('info', 'Микрофон активирован. Идет запись...');
      visualize();
    } catch (err: any) {
      setError("Микрофон недоступен. Проверьте разрешения в браузере.");
      addLog('error', 'Ошибка доступа к микрофону');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    setIsRecording(false);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
  };

  const visualize = () => {
    const canvas = canvasRef.current;
    if (!canvas || !analyserRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyserRef.current!.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        // Отрисовка сглаженных баров
        const barHeight = (dataArray[i] / 255) * canvas.height * 0.8;
        
        // Красивый градиент
        const hue = 210 + (i / bufferLength) * 40;
        ctx.fillStyle = `hsla(${hue}, 90%, 60%, ${0.3 + (dataArray[i]/255) * 0.7})`;
        
        // Рисуем бары симметрично от центральной оси
        const yPos = (canvas.height - barHeight) / 2;
        
        // Закругленные края баров (имитация)
        ctx.fillRect(x, yPos, barWidth - 2, barHeight);
        x += barWidth;
      }
    };
    draw();
  };

  const handleTranscribe = async () => {
    if (!audioBlob) return;
    setIsProcessing(true);
    addLog('info', 'ИИ расшифровывает голос...');
    try {
      const result = await ai.transcribeAudio(audioBlob, settings);
      setTranscript(result);
      addLog('success', 'Голос успешно преобразован в текст');
    } catch (e: any) {
      setError(e.message);
      addLog('error', 'Транскрибация не удалась: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = async () => {
    if (!audioBlob) return;
    const reader = new FileReader();
    const base64: string = await new Promise((resolve) => {
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(audioBlob);
    });
    
    const finalContent = transcript || "[Голосовая заметка]";
    await addNote(finalContent, `Запись ${new Date().toLocaleTimeString()}`, 'audio', !!transcript, undefined, base64);
    onComplete?.();
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-10 rounded-[4rem] border border-gray-100 dark:border-white/10 shadow-2xl space-y-8 animate-in zoom-in duration-300">
      <div className="flex items-center justify-between px-2">
        <h3 className="font-black text-xs uppercase tracking-widest text-blue-500 flex items-center gap-3">
            <Volume2 size={24} className={isRecording ? 'animate-pulse' : ''} /> 
            Neural Voice Recorder
        </h3>
        <button 
          onClick={() => { setAudioBlob(null); setTranscript(''); setError(null); }} 
          className="text-gray-400 hover:text-red-500 transition-colors p-2"
        >
            <RotateCcw size={22}/>
        </button>
      </div>

      <div className="h-56 bg-gray-50 dark:bg-slate-950 rounded-[3rem] flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-100 dark:border-white/5 relative shadow-inner">
        {isRecording ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-6">
             <canvas ref={canvasRef} width={400} height={160} className="w-full h-full" />
             <div className="absolute top-4 right-6 flex items-center gap-2 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-[9px] font-black text-red-500 uppercase tracking-widest">Live Capture</span>
             </div>
          </div>
        ) : audioBlob ? (
          <div className="flex flex-col items-center gap-6">
             <button 
                onClick={() => { if(isPlaying) audioRef.current?.pause(); else audioRef.current?.play(); setIsPlaying(!isPlaying); }}
                className="w-24 h-24 bg-blue-600 text-white rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-xl shadow-blue-500/30"
             >
                {isPlaying ? <Pause size={36}/> : <Play size={36} className="ml-1" />}
             </button>
             <p className="text-[10px] font-black uppercase tracking-widest text-blue-500 flex items-center gap-2">
                <Headphones size={16}/> Прослушать запись
             </p>
             <audio ref={audioRef} src={URL.createObjectURL(audioBlob)} onEnded={() => setIsPlaying(false)} className="hidden" />
          </div>
        ) : error ? (
           <div className="flex flex-col items-center gap-6 text-red-500 px-10 text-center">
              <AlertCircle size={48} />
              <p className="text-sm font-black uppercase tracking-widest leading-relaxed">{error}</p>
           </div>
        ) : (
          <div className="flex flex-col items-center gap-6 opacity-10">
            <Mic size={80} className="animate-pulse" />
            <p className="text-[10px] font-black uppercase tracking-[0.4em]">Ожидание активации</p>
          </div>
        )}
      </div>

      <div className="flex gap-4">
        {!isRecording && !audioBlob && (
          <button onClick={startRecording} className="flex-1 py-7 bg-blue-600 text-white rounded-[2.5rem] font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all">
            Начать запись
          </button>
        )}
        {isRecording && (
          <button onClick={stopRecording} className="flex-1 py-7 bg-red-500 text-white rounded-[2.5rem] font-black uppercase text-xs tracking-widest animate-pulse shadow-xl shadow-red-500/20 active:scale-95 transition-all">
            Остановить
          </button>
        )}
        {audioBlob && !transcript && (
          <button 
            onClick={handleTranscribe} 
            disabled={isProcessing} 
            className="flex-1 py-7 bg-purple-600 text-white rounded-[2.5rem] font-black uppercase text-xs tracking-widest shadow-xl flex items-center justify-center gap-4 disabled:opacity-50 active:scale-95 transition-all"
          >
            {isProcessing ? <Loader2 size={22} className="animate-spin"/> : <Sparkles size={22}/>} 
            Расшифровать
          </button>
        )}
      </div>

      {(transcript || (audioBlob && !isRecording)) && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom duration-500">
          {transcript && (
            <textarea 
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              className="w-full h-32 p-6 bg-gray-50 dark:bg-slate-950 border-none rounded-[2.5rem] text-sm font-bold dark:text-white shadow-inner resize-none focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
              placeholder="Текст записи..."
            />
          )}
          <button onClick={handleSave} className="w-full py-7 bg-green-600 text-white rounded-[2.5rem] font-black uppercase text-xs tracking-widest shadow-xl hover:bg-green-700 active:scale-95 transition-all">
            Сохранить заметку
          </button>
        </div>
      )}
    </div>
  );
};

export default AudioRecorder;


import React, { useState } from 'react';
import { useNotes } from '../contexts/NotesContext.tsx';
import { Send, RefreshCw, Plus, Lightbulb, Trash2, Clock, User, MessageCircle, FileText, Sparkles, X, Loader2, Image as ImageIcon, Mic, Headphones, Play, Pause } from 'lucide-react';
import * as ai from '../utils/aiAdapter.ts';

const TelegramPage: React.FC = () => {
  const { telegramMessages, syncTelegram, addNote, settings, deleteTelegramMsg, addLog } = useNotes();
  const [isSyncing, setIsSyncing] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const handleSync = async () => {
    setIsSyncing(true);
    await syncTelegram();
    setIsSyncing(false);
  };

  const handleProcessMedia = async (msg: any, target: 'note' | 'idea') => {
    setProcessingId(msg.id);
    addLog('info', `Начата обработка медиа (${msg.type}) из Telegram...`);
    
    try {
      let finalContent = msg.text || "";
      let audioData = undefined;

      // Если это Фото - делаем OCR
      if (msg.type === 'photo') {
        const text = await ai.performOCR(msg.fileUrl, 'image/jpeg', settings);
        finalContent = (finalContent ? finalContent + "\n\n" : "") + text;
      }
      
      // Если это Голос - делаем Транскрибацию
      if (msg.type === 'voice') {
        const response = await fetch(msg.fileUrl);
        const blob = await response.blob();
        const text = await ai.transcribeAudio(blob, settings);
        finalContent = (finalContent ? finalContent + "\n\n" : "") + text;
        
        // Сохраняем само аудио в базу как base64
        const reader = new FileReader();
        audioData = await new Promise((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }

      await addNote(
        finalContent || (msg.type === 'photo' ? "[Изображение]" : "[Голосовое]"), 
        `Telegram: ${msg.type === 'photo' ? 'Фото' : msg.type === 'voice' ? 'Голос' : 'Текст'}`, 
        'telegram', 
        true, 
        target === 'idea' ? 'Идеи' : undefined,
        audioData as string
      );
      
      deleteTelegramMsg(msg.id);
      addLog('success', 'Сообщение успешно импортировано в базу');
    } catch (e: any) {
      addLog('error', 'Ошибка при обработке Telegram медиа: ' + e.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleSimpleConvert = async (id: number, text: string, category?: string) => {
    setProcessingId(id);
    try {
      await addNote(text || "[Пустое сообщение]", undefined, 'telegram', true, category);
      deleteTelegramMsg(id);
    } finally {
      setProcessingId(null);
    }
  };

  if (!settings.tgToken) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-20 text-center space-y-8 animate-in fade-in duration-700">
        <div className="w-32 h-32 bg-blue-50 dark:bg-blue-900/20 rounded-[3rem] flex items-center justify-center text-blue-600 shadow-inner">
          <Send size={64} className="rotate-12" />
        </div>
        <div className="space-y-4 max-w-lg">
          <h2 className="text-5xl font-extrabold dark:text-white tracking-tighter">Telegram Bridge Off</h2>
          <p className="text-gray-500 text-lg leading-relaxed">Подключите бота для сбора идей, фото-заметок и голосовых сообщений прямо с телефона.</p>
        </div>
        <button 
          onClick={() => window.location.hash = '#/settings'}
          className="px-12 py-6 bg-blue-600 text-white rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-2xl shadow-blue-500/40 hover:bg-blue-700 transition-all active:scale-95"
        >
          Настроить в Системе
        </button>
      </div>
    );
  }

  return (
    <div className="p-16 max-w-6xl mx-auto min-h-screen animate-in fade-in duration-500 pb-32">
      <header className="flex items-center justify-between mb-16 bg-white dark:bg-slate-900 p-10 rounded-[4rem] border border-gray-100 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-3 text-blue-600 font-black text-[11px] uppercase tracking-[0.4em]">
            <Sparkles size={16} /> Neural Inbox
          </div>
          <h2 className="text-5xl font-extrabold dark:text-white mt-2 tracking-tighter">Telegram Входящие</h2>
        </div>
        <button 
          onClick={handleSync}
          disabled={isSyncing}
          className={`px-10 py-5 bg-blue-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest flex items-center gap-4 hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-95 ${isSyncing ? 'opacity-50' : ''}`}
        >
          {isSyncing ? <Loader2 size={20} className="animate-spin" /> : <RefreshCw size={20}/>}
          Синхронизировать
        </button>
      </header>

      {telegramMessages.length === 0 ? (
        <div className="py-48 flex flex-col items-center justify-center opacity-20 text-center space-y-6">
          <MessageCircle size={100} />
          <p className="text-2xl font-extrabold uppercase tracking-widest italic">Поток пуст</p>
          <p className="text-sm font-medium">Отправьте что-нибудь боту, и это появится здесь.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-10">
          {telegramMessages.map((msg) => (
            <div key={msg.id} className="group bg-white dark:bg-slate-900 p-10 rounded-[3.5rem] border border-gray-100 dark:border-slate-800 shadow-sm flex flex-col gap-8 hover:shadow-2xl transition-all relative">
              <button 
                onClick={() => deleteTelegramMsg(msg.id)}
                className="absolute top-8 right-8 p-3 text-gray-300 hover:text-red-500 transition-colors bg-gray-50 dark:bg-slate-800 rounded-full"
              >
                <X size={20}/>
              </button>
              
              <div className="flex items-center justify-between pr-10">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 bg-gray-50 dark:bg-slate-800 rounded-[1.5rem] flex items-center justify-center text-blue-600 shadow-inner group-hover:scale-105 transition-transform">
                    {msg.type === 'photo' ? <ImageIcon size={28}/> : msg.type === 'voice' ? <Mic size={28}/> : <User size={28} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                        <p className="text-lg font-bold dark:text-white tracking-tight">{msg.from}</p>
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-blue-100 text-blue-600 rounded-md tracking-tighter">
                            {msg.type === 'photo' ? 'IMAGE' : msg.type === 'voice' ? 'VOICE' : 'TEXT'}
                        </span>
                    </div>
                    <p className="text-xs text-gray-400 flex items-center gap-2 mt-1 font-medium">
                      <Clock size={12} /> {new Date(msg.date).toLocaleString('ru-RU')}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button 
                    disabled={processingId === msg.id}
                    onClick={() => msg.type === 'text' ? handleSimpleConvert(msg.id, msg.text) : handleProcessMedia(msg, 'note')}
                    className="flex items-center gap-3 px-6 py-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-50 shadow-lg shadow-blue-500/10"
                  >
                    {processingId === msg.id ? <Loader2 size={18} className="animate-spin"/> : <FileText size={18}/>} 
                    {msg.type === 'text' ? 'В базу' : msg.type === 'photo' ? 'OCR в базу' : 'STT в базу'}
                  </button>
                  <button 
                    disabled={processingId === msg.id}
                    onClick={() => msg.type === 'text' ? handleSimpleConvert(msg.id, msg.text, 'Идеи') : handleProcessMedia(msg, 'idea')}
                    className="flex items-center gap-3 px-6 py-4 bg-amber-500 text-white rounded-2xl hover:bg-amber-600 transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-50 shadow-lg shadow-amber-500/10"
                  >
                    {processingId === msg.id ? <Loader2 size={18} className="animate-spin"/> : <Lightbulb size={18}/>} 
                    В идеи
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                {msg.type === 'photo' && (
                    <div className="max-w-md bg-gray-50 dark:bg-slate-950 p-2 rounded-[2rem] shadow-inner border border-gray-100 dark:border-white/5">
                        <img src={msg.fileUrl} alt="TG Photo" className="w-full h-auto rounded-[1.8rem] object-cover" />
                    </div>
                )}

                {msg.type === 'voice' && (
                    <div className="flex items-center gap-6 bg-gray-50 dark:bg-slate-950 p-6 rounded-[2rem] shadow-inner border border-gray-100 dark:border-white/5">
                        <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center">
                            <Headphones size={20} />
                        </div>
                        <audio controls src={msg.fileUrl} className="flex-1" />
                    </div>
                )}

                {msg.text && (
                    <div 
                        className="bg-gray-50/50 dark:bg-slate-950/50 p-10 rounded-[2.5rem] text-xl font-medium leading-relaxed dark:text-slate-200 italic border-l-[6px] border-blue-600 shadow-inner overflow-hidden whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{ __html: ai.linkify(msg.text) }}
                    />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TelegramPage;

import React, { useState, useRef, useEffect } from 'react';
import { useNotes } from '../contexts/NotesContext.tsx';
import { 
  Send, Bot, User, Eraser, AlertCircle, Sparkles, 
  Cpu, ChevronDown, ChevronUp, Copy, Check, Activity, Database, Zap 
} from 'lucide-react';
import * as ai from '../utils/aiAdapter.ts';
import { ChatMessage } from '../types.ts';
import { LLMOpsDrawer } from '../components/LLMOpsDrawer.tsx';
import { motion, AnimatePresence } from 'motion/react';

const ChatPage: React.FC = () => {
  const { notes, settings, setSelectedNoteId } = useNotes();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isLLMOpsOpen, setIsLLMOpsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync vector database on load
  useEffect(() => {
    ai.syncVectorDB(notes);
  }, [notes]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth'
    });
  }, [messages, streamingContent, isTyping]);

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userText = input.trim();
    const userMessage: ChatMessage = { role: 'user', content: userText };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);
    setStreamingContent('');

    try {
      let accumulated = '';
      const response = await ai.chatWithNotes(
        userText, 
        '', 
        settings, 
        notes,
        (_chunk, full) => {
          accumulated = full;
          setStreamingContent(full);
        }
      );

      const finalResponse = response || accumulated || 'Пустой ответ от ИИ.';
      const vectorResults = ai.searchVectorDB(userText, 3);
      const sourceIds = vectorResults.map(r => r.noteId);

      const aiMessage: ChatMessage = { 
        role: 'assistant', 
        content: finalResponse,
        sources: sourceIds.length > 0 ? sourceIds : undefined
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (e: any) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Ошибка: ${e.message || 'Произошла непредвиденная ошибка при обращении к ИИ.'}` 
      }]);
    } finally {
      setIsTyping(false);
      setStreamingContent('');
    }
  };

  const vectorStats = ai.getVectorDBStats();

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Bot size={22} />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight dark:text-white flex items-center gap-2">
              Offline RAG Чат
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                <Cpu size={10} /> {settings.provider} ({settings.model || 'Auto'})
              </span>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded flex items-center gap-1">
                <Database size={10} /> {vectorStats.totalChunks} векторов
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsLLMOpsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-xl hover:bg-indigo-100 transition-colors shadow-2xs"
            title="LLMOps Observability & Tracing"
          >
            <Activity size={15} />
            <span className="hidden sm:inline">LLMOps</span>
          </button>
          <button 
            onClick={() => setMessages([])}
            className="text-gray-400 hover:text-red-500 flex items-center gap-1.5 text-xs font-bold transition-colors p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <Eraser size={16} />
          </button>
        </div>
      </div>

      {/* Message List */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-6 mb-6 px-1 custom-scrollbar">
        {messages.length === 0 && !isTyping && (
          <div className="text-center py-20 text-gray-400 font-medium">
            <div className="w-16 h-16 rounded-3xl bg-blue-50 dark:bg-slate-800 text-blue-600 flex items-center justify-center mx-auto mb-4">
              <Sparkles size={28} />
            </div>
            <p className="font-black text-slate-700 dark:text-slate-200">Локальный Offline RAG поиск и синтез знаний</p>
            <p className="text-xs mt-2 text-gray-400 max-w-sm mx-auto">
              ScreenMind находит точные смысловые фрагменты в ваших заметках без отправки гигабайтов данных в сеть.
            </p>
            <div className="flex flex-wrap justify-center gap-2 mt-6 max-w-md mx-auto">
              {[
                "Какие ключевые идеи у меня записаны?",
                "Составь конспект на основе заметок",
                "Найди информацию по моим проектам"
              ].map(prompt => (
                <button
                  key={prompt}
                  onClick={() => { setInput(prompt); }}
                  className="text-xs font-bold px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-blue-500 transition-all text-slate-600 dark:text-slate-300 shadow-2xs"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {messages.map((m, i) => (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={i} 
            className={`flex gap-3 md:gap-4 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <div className={`w-8 h-8 md:w-9 md:h-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
              m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 text-blue-600 border border-gray-100 dark:border-slate-700'
            }`}>
              {m.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            
            <div className={`max-w-[85%] md:max-w-[80%] rounded-2xl p-4 text-sm font-medium leading-relaxed relative group ${
              m.role === 'user' 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-xs'
            }`}>
              <div className="whitespace-pre-wrap">{m.content}</div>

              {m.role === 'assistant' && m.sources && m.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-800 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-400">
                  <span className="font-black uppercase tracking-wider text-[9px] text-slate-400">Offline RAG Источники:</span>
                  {m.sources.map(sId => {
                    const note = notes.find(n => n.id === sId);
                    return note ? (
                      <button 
                        key={sId}
                        onClick={() => setSelectedNoteId(sId)}
                        className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-md font-bold hover:underline transition-colors"
                      >
                        {note.title}
                      </button>
                    ) : null;
                  })}
                </div>
              )}

              {m.role === 'assistant' && (
                <button
                  onClick={() => handleCopy(m.content, i)}
                  className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-lg hover:text-blue-600"
                >
                  {copiedIndex === i ? <Check size={12} className="text-green-500"/> : <Copy size={12}/>}
                </button>
              )}
            </div>
          </motion.div>
        ))}

        {isTyping && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3 md:gap-4 flex-row"
          >
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-white dark:bg-slate-800 text-blue-600 border border-gray-100 dark:border-slate-700 flex items-center justify-center shrink-0">
              <Bot size={16} />
            </div>
            <div className="max-w-[85%] md:max-w-[80%] rounded-2xl p-4 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-sm font-medium leading-relaxed shadow-xs">
              {streamingContent ? (
                <div>
                  <span className="whitespace-pre-wrap">{streamingContent}</span>
                  <span className="inline-block w-2 h-4 bg-blue-600 ml-1 animate-pulse align-middle" />
                </div>
              ) : (
                <div className="flex items-center gap-2 py-1">
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></span>
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                  <span className="text-xs text-slate-400 font-bold ml-2">Поиск по векторному индексу и генерация...</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* Input */}
      <div className="relative group">
        <input 
          className="w-full pl-5 pr-14 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-blue-500 rounded-2xl text-sm font-bold transition-all shadow-inner outline-none dark:text-white"
          placeholder="Спросите о чем угодно из ваших заметок..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          disabled={isTyping}
        />
        <button 
          onClick={handleSend}
          disabled={!input.trim() || isTyping}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 active:scale-95 transition-all shadow-md shadow-blue-500/20 disabled:opacity-30"
        >
          <Send size={18} />
        </button>
      </div>

      {/* LLMOps Observability Drawer */}
      <LLMOpsDrawer 
        isOpen={isLLMOpsOpen} 
        onClose={() => setIsLLMOpsOpen(false)} 
      />
    </div>
  );
};

export default ChatPage;

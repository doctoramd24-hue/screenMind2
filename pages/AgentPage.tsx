import React, { useState, useRef, useEffect } from 'react';
import { useNotes } from '../contexts/NotesContext.tsx';
import { 
  Bot, Send, ShieldCheck, Zap, Eraser, Sparkles, 
  Cpu, Copy, Check, Terminal, Activity, Layers, Wrench 
} from 'lucide-react';
import * as ai from '../utils/aiAdapter.ts';
import { extractToolCall, executeTool } from '../utils/functionRegistry.ts';
import { GenerativeUIWidgetRenderer } from '../components/GenerativeUIWidgetRenderer.tsx';
import { LLMOpsDrawer } from '../components/LLMOpsDrawer.tsx';
import { ChatMessage, GenerativeUIWidget } from '../types.ts';
import { motion } from 'motion/react';

const AgentPage: React.FC = () => {
  const { notes, goals, setGoals, settings, logs, addNote, exportToMarkdown, setSelectedNoteId } = useNotes();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { 
      role: 'assistant', 
      content: 'Привет! Я ScreenMind Autonomous System Agent с поддержкой Native Function Calling и Offline RAG. Я умею создавать заметки, искать по смыслу в базе знаний, ставить стратегические цели и отслеживать телеметрию системы. Чем я могу помочь?' 
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
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
  }, [messages, streamingText, isLoading]);

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleSend = async (customQuery?: string) => {
    const query = customQuery || input;
    if (!query.trim() || isLoading) return;
    
    setMessages(prev => [...prev, { role: 'user', content: query }]);
    if (!customQuery) setInput('');
    setIsLoading(true);
    setStreamingText('');

    try {
      const appData = {
        notesCount: notes.length,
        goalsCount: goals.length,
        recentLogsCount: logs.length,
        activeTags: Array.from(new Set(notes.flatMap(n => n.tags || []))).length,
        categories: Array.from(new Set(notes.map(n => n.category || 'Общее'))),
        activeProvider: settings.agentProvider,
        activeModel: settings.agentModel,
        vectorDbIndexed: ai.getVectorDBStats().isIndexed
      };

      let accumulated = '';
      const response = await ai.chatWithAgent(
        query, 
        appData, 
        settings, 
        (_chunk, full) => {
          accumulated = full;
          setStreamingText(full);
        }
      );

      const rawText = response || accumulated || 'Пустой ответ.';
      
      // Check for Tool Calling in the agent output
      const { toolCall, cleanText } = extractToolCall(rawText);
      const widgets: GenerativeUIWidget[] = [];

      if (toolCall) {
        // Execute Tool
        const result = await executeTool(toolCall, {
          addNote,
          notes,
          goals,
          setGoals,
          exportToMarkdown
        });

        if (result.uiWidget) {
          widgets.push(result.uiWidget);
        }

        const replyContent = cleanText || (result.success ? `Инструмент **${toolCall.name}** успешно выполнен.` : `Ошибка: ${result.result}`);

        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: replyContent,
          widgets: widgets.length > 0 ? widgets : undefined,
          toolCalls: [toolCall]
        }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: rawText }]);
      }

    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Ошибка агента: ${e.message}` }]);
    } finally {
      setIsLoading(false);
      setStreamingText('');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-main)] overflow-hidden transition-colors duration-500">
      <header className="px-6 md:px-12 py-6 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--card-bg)] backdrop-blur-xl z-10 shrink-0">
        <div className="flex items-center gap-4 md:gap-6">
          <div className="w-12 h-12 md:w-14 md:h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Bot size={28} />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black dark:text-white tracking-tighter uppercase flex items-center gap-2">
              System Agent
            </h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="flex items-center gap-1.5 text-[9px] font-black text-green-500 uppercase tracking-widest bg-green-50 dark:bg-green-950/40 px-2 py-0.5 rounded-md border border-green-200 dark:border-green-900/30">
                <ShieldCheck size={12}/> Online
              </span>
              <span className="text-[9px] font-black uppercase text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                <Cpu size={10} /> {settings.agentProvider}
              </span>
              <span className="text-[9px] font-black uppercase text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                <Wrench size={10} /> Function Calling
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
            <span className="hidden sm:inline">LLMOps Traces</span>
          </button>
          <button 
            onClick={() => setMessages(messages.slice(0, 1))} 
            className="p-2.5 text-gray-400 hover:text-red-500 transition-colors rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20"
            title="Сбросить историю"
          >
            <Eraser size={18} />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden flex">
        <div className="flex-1 flex flex-col p-4 md:p-8 lg:p-12 overflow-y-auto custom-scrollbar" ref={scrollRef}>
          <div className="max-w-4xl mx-auto w-full space-y-6 pb-6">
            {messages.map((m, i) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={i} 
                className={`flex gap-3 md:gap-4 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div className={`w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                  m.role === 'assistant' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-200'
                }`}>
                  {m.role === 'assistant' ? <Bot size={20} /> : <span className="font-black text-xs">Я</span>}
                </div>
                <div className={`max-w-[88%] md:max-w-[85%] px-5 py-4 rounded-2xl text-sm font-medium leading-relaxed relative group ${
                  m.role === 'assistant' 
                  ? 'bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 text-gray-800 dark:text-slate-200 shadow-xs' 
                  : 'bg-blue-600 text-white shadow-md'
                }`}>
                  <div className="whitespace-pre-wrap">{m.content}</div>

                  {/* Render Generative UI Widgets */}
                  {m.widgets && m.widgets.map((w, wIdx) => (
                    <GenerativeUIWidgetRenderer 
                      key={wIdx} 
                      widget={w} 
                      onNavigateToNote={(id) => setSelectedNoteId(id)}
                    />
                  ))}

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

            {/* Realtime Streaming Agent Message */}
            {isLoading && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3 md:gap-4 flex-row"
              >
                <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center shrink-0">
                  <Bot size={20} />
                </div>
                <div className="max-w-[88%] md:max-w-[85%] bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 px-5 py-4 rounded-2xl shadow-xs text-gray-800 dark:text-slate-200 text-sm font-medium leading-relaxed">
                  {streamingText ? (
                    <div>
                      <span className="whitespace-pre-wrap">{streamingText}</span>
                      <span className="inline-block w-2 h-4 bg-blue-600 ml-1 animate-pulse align-middle" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 py-1">
                      <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></span>
                      <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                      <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                      <span className="text-xs text-slate-400 font-bold ml-2">Исполнение логики и анализ базы знаний...</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Sidebar with presets and context */}
        <aside className="w-80 border-l border-gray-100 dark:border-slate-900 bg-gray-50/50 dark:bg-slate-900/40 p-6 hidden xl:block space-y-6 overflow-y-auto custom-scrollbar">
          <section className="space-y-3">
            <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-widest flex items-center gap-2">
              <Zap size={14} className="text-amber-500"/> Быстрые действия (Tools)
            </h4>
            <div className="space-y-2">
               {[
                 'Создай заметку с планом изучения архитектуры ИИ',
                 'Найди через семантический поиск заметки о стартапах',
                 'Поставь стратегическую цель: запустить MVP за 30 дней',
                 'Покажи полную сводку и телеметрию базы знаний',
                 'Экспортируй всю базу заметок в Markdown'
               ].map(q => (
                 <button 
                  key={q} 
                  onClick={() => handleSend(q)}
                  disabled={isLoading}
                  className="w-full text-left p-3 text-[10px] font-bold bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all shadow-2xs disabled:opacity-50 text-slate-700 dark:text-slate-300 leading-snug"
                >
                   {q}
                 </button>
               ))}
            </div>
          </section>

          <div className="p-5 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl text-white space-y-3 shadow-lg shadow-blue-500/20">
            <div className="flex items-center gap-2">
              <Activity size={18}/>
              <h5 className="font-black text-xs uppercase tracking-tight">System Telemetry</h5>
            </div>
            <div className="text-[10px] font-bold space-y-1.5 opacity-90">
              <div className="flex justify-between border-b border-white/10 pb-1">
                <span>Заметок в базе:</span>
                <span className="font-black">{notes.length}</span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-1">
                <span>Активных целей:</span>
                <span className="font-black">{goals.length}</span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-1">
                <span>RAG Векторов:</span>
                <span className="font-black">{ai.getVectorDBStats().totalChunks}</span>
              </div>
              <div className="flex justify-between">
                <span>Провайдер агента:</span>
                <span className="font-black">{settings.agentProvider}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <div className="p-4 md:p-6 border-t border-gray-100 dark:border-slate-900 bg-[var(--card-bg)] shrink-0">
        <div className="max-w-4xl mx-auto relative group">
          <input 
            className="w-full pl-5 pr-14 py-4 bg-gray-50 dark:bg-slate-900 border border-transparent focus:border-blue-500 rounded-2xl text-sm font-bold transition-all shadow-inner outline-none dark:text-white"
            placeholder="Задайте вопрос агенту или дайте команду (создать заметку, цель, найти)..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            disabled={isLoading}
          />
          <button 
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 active:scale-95 transition-all shadow-md shadow-blue-500/20 disabled:opacity-30"
          >
            <Send size={18} />
          </button>
        </div>
      </div>

      {/* LLMOps Observability Drawer */}
      <LLMOpsDrawer 
        isOpen={isLLMOpsOpen} 
        onClose={() => setIsLLMOpsOpen(false)} 
      />
    </div>
  );
};

export default AgentPage;

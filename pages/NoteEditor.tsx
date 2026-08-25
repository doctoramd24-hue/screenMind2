
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useNotes } from '../contexts/NotesContext.tsx';
import { Note } from '../types.ts';
import { 
  ChevronLeft, Save, Loader2, Sparkles, MessageSquare, Send, X, Folder, Globe, Hash, Play, Pause, Headphones, Search, Link2, ArrowRight, Plus, Download, CheckSquare, Square, ExternalLink, Copy, Check, Target, Lightbulb
} from 'lucide-react';
import * as ai from '../utils/aiAdapter.ts';
import { motion, AnimatePresence } from 'motion/react';

const NoteEditor: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { notes, addNote, updateNote, runAIAnalysis, settings, addLog, setFilterTag, addGoal } = useNotes();

  const exportNoteToMarkdown = () => {
    if (!localTitle && !localContent) return;
    let md = `# ${localTitle}\n\n**Category:** ${localCategory}\n**Tags:** ${localTags.join(', ')}\n\n---\n\n${localContent}`;
    
    if (localActionItems.length > 0) {
      md += `\n\n## Action Items\n` + localActionItems.map(item => `- [ ] ${item}`).join('\n');
    }
    if (localExtractedLinks.length > 0) {
      md += `\n\n## Links\n` + localExtractedLinks.map(l => `- [${l}](${l})`).join('\n');
    }
    if (localRelatedNodes.length > 0) {
      md += `\n\n## Concepts\n` + localRelatedNodes.map(c => `\`${c}\``).join(', ');
    }

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${localTitle || 'note'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addLog('success', 'Заметка экспортирована');
  };
  
  const [localTitle, setLocalTitle] = useState('');
  const [localContent, setLocalContent] = useState('');
  const [localTags, setLocalTags] = useState<string[]>([]);
  const [localCategory, setLocalCategory] = useState('Общее');
  const [localActionItems, setLocalActionItems] = useState<string[]>([]);
  const [localExtractedLinks, setLocalExtractedLinks] = useState<string[]>([]);
  const [localRelatedNodes, setLocalRelatedNodes] = useState<string[]>([]);
  
  const [tagInput, setTagInput] = useState('');
  const [actionItemInput, setActionItemInput] = useState('');
  const [linkInput, setLinkInput] = useState('');
  const [conceptInput, setConceptInput] = useState('');

  const [copiedLinkIndex, setCopiedLinkIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [note, setNote] = useState<Note | null>(null);

  const isUserTyping = useRef(false);
  const typingTimeout = useRef<number | null>(null);

  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'assistant', content: string}[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  const [showLinkSearch, setShowLinkSearch] = useState(false);
  const [linkSearchQuery, setLinkSearchQuery] = useState('');

  const relatedNotes = useMemo(() => {
    if (!note || !note.links) return [];
    return notes.filter(n => note.links.includes(n.id));
  }, [note, notes]);

  const searchResults = useMemo(() => {
    if (!linkSearchQuery.trim()) return [];
    return notes.filter(n => 
      n.id !== id && 
      !note?.links.includes(n.id) &&
      (n.title.toLowerCase().includes(linkSearchQuery.toLowerCase()) || 
       n.content.toLowerCase().includes(linkSearchQuery.toLowerCase()))
    ).slice(0, 5);
  }, [linkSearchQuery, notes, id, note]);

  const handleAddLink = async (targetId: string) => {
    if (!note) return;
    const updatedNote = { ...note, links: [...(note.links || []), targetId] };
    await updateNote(updatedNote);
    setShowLinkSearch(false);
    setLinkSearchQuery('');
    addLog('success', 'Заметка связана');
  };

  const handleRemoveLink = async (targetId: string) => {
    if (!note) return;
    const updatedNote = { ...note, links: (note.links || []).filter(lid => lid !== targetId) };
    await updateNote(updatedNote);
    addLog('info', 'Связь удалена');
  };

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (id && id !== 'new' && !isUserTyping.current) {
      const found = notes.find(n => n.id === id);
      if (found) {
        setNote(found);
        setLocalTitle(found.title);
        setLocalContent(found.content);
        setLocalTags(found.tags || found.hashtags || []);
        setLocalCategory(found.category || 'Общее');
        setLocalActionItems(found.action_items || []);
        setLocalExtractedLinks(found.extracted_links || []);
        setLocalRelatedNodes(found.related_nodes || []);
        
        if (found.summary && chatMessages.length === 0) {
            setChatMessages([{ role: 'assistant', content: `Анализ: ${found.summary}` }]);
        }
      }
    }
  }, [id, notes]);

  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    isUserTyping.current = true;
    setLocalContent(e.target.value);
    
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = window.setTimeout(() => {
        isUserTyping.current = false;
    }, 1200);
  }, []);

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    isUserTyping.current = true;
    setLocalTitle(e.target.value);
    
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = window.setTimeout(() => {
        isUserTyping.current = false;
    }, 1200);
  }, []);

  const handleSave = async (useAI = false) => {
    if (!localContent.trim() && !localTitle.trim()) return;
    setIsSaving(true);
    if (useAI) setIsAnalyzing(true);
    try {
        if (id === 'new') {
          await addNote(localContent, localTitle, 'manual', useAI);
        } else if (note) {
          const updatedNote: Note = { 
            ...note, 
            title: localTitle, 
            content: localContent, 
            tags: localTags, 
            hashtags: localTags,
            category: localCategory, 
            action_items: localActionItems,
            extracted_links: localExtractedLinks,
            related_nodes: localRelatedNodes,
            updatedAt: new Date().toISOString() 
          };
          await updateNote(updatedNote);
          if (useAI && navigator.onLine) {
            await runAIAnalysis(note.id);
          }
        }
        navigate('/');
    } catch (e: any) {
      addLog('error', 'Ошибка сохранения: ' + e.message);
    } finally {
        setIsSaving(false);
        setIsAnalyzing(false);
    }
  };

  const handleChatSend = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    const userMsg = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatInput('');
    setIsChatLoading(true);
    try {
      const history = relatedNotes;
      const response = await ai.chatWithNotes(userMsg, note || localContent, settings, history);
      setChatMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (e: any) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `Сбой: ${e.message}` }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleAddTag = () => {
    const val = tagInput.trim().replace(/^#/, '');
    if (val && !localTags.includes(val)) {
      setLocalTags([...localTags, val]);
      setTagInput('');
    }
  };

  const handleAddActionItem = () => {
    const val = actionItemInput.trim();
    if (val && !localActionItems.includes(val)) {
      setLocalActionItems([...localActionItems, val]);
      setActionItemInput('');
    }
  };

  const handleRemoveActionItem = (index: number) => {
    setLocalActionItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleConvertActionToGoal = async (action: string) => {
    await addGoal(action, `Создано из заметки: ${localTitle || 'Без названия'}`);
    addLog('success', `Создана цель: "${action}"`);
  };

  const handleAddLinkItem = () => {
    let val = linkInput.trim();
    if (!val) return;
    if (!val.startsWith('http://') && !val.startsWith('https://')) {
      val = 'https://' + val;
    }
    if (!localExtractedLinks.includes(val)) {
      setLocalExtractedLinks([...localExtractedLinks, val]);
      setLinkInput('');
    }
  };

  const handleRemoveLinkItem = (index: number) => {
    setLocalExtractedLinks(prev => prev.filter((_, i) => i !== index));
  };

  const handleCopyLink = (url: string, index: number) => {
    navigator.clipboard.writeText(url);
    setCopiedLinkIndex(index);
    setTimeout(() => setCopiedLinkIndex(null), 1500);
  };

  const handleAddConcept = () => {
    const val = conceptInput.trim();
    if (val && !localRelatedNodes.includes(val)) {
      setLocalRelatedNodes([...localRelatedNodes, val]);
      setConceptInput('');
    }
  };

  const handleRemoveConcept = (concept: string) => {
    setLocalRelatedNodes(prev => prev.filter(c => c !== concept));
  };

  return (
    <div className="h-screen flex flex-col bg-[var(--bg-main)] overflow-hidden transition-colors duration-500">
      <header className="flex flex-col md:flex-row items-center justify-between px-6 md:px-12 py-4 md:py-8 border-b border-[var(--border-color)] bg-[var(--card-bg)] backdrop-blur-2xl z-20 shrink-0 gap-4">
        <div className="flex items-center gap-4 md:gap-6 flex-1 min-w-0 w-full relative">
          <motion.button 
            whileHover={{ x: -4 }}
            onClick={() => navigate(-1)} 
            className="p-3 md:p-4 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-2xl transition-all shrink-0 ml-12 md:ml-0"
          >
            <ChevronLeft size={24}/>
          </motion.button>
          <div className="flex flex-col flex-1 min-w-0">
              <div className="flex items-center gap-4 md:gap-6 w-full">
                <input 
                  className="text-xl md:text-5xl font-black bg-transparent border-none focus:outline-none text-slate-900 dark:text-white flex-1 tracking-[-0.04em] leading-tight" 
                  value={localTitle} 
                  onChange={handleTitleChange} 
                  placeholder="Заголовок..."
                />
                <motion.button 
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => ai.openInGoogle(localTitle)}
                  className="w-10 h-10 md:w-14 md:h-14 bg-blue-600 text-white rounded-[1.2rem] md:rounded-[1.5rem] hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/40 shrink-0 flex items-center justify-center"
                  title="Найти в Google"
                >
                  <Globe size={24} strokeWidth={2.5} />
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={exportNoteToMarkdown}
                  className="w-10 h-10 md:w-14 md:h-14 bg-emerald-600 text-white rounded-[1.2rem] md:rounded-[1.5rem] hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/40 shrink-0 flex items-center justify-center"
                  title="Экспорт в Markdown"
                >
                  <Download size={24} strokeWidth={2.5} />
                </motion.button>
              </div>
          </div>
        </div>
        <div className="flex items-center gap-3 md:gap-4 w-full md:w-auto overflow-x-auto no-scrollbar">
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleSave(true)} 
            className="px-6 py-4 md:px-8 md:py-5 bg-cyan-600/10 text-cyan-600 rounded-[2rem] font-black uppercase text-[10px] tracking-widest flex items-center gap-3 border border-cyan-500/10 hover:bg-cyan-600/20 shrink-0"
          >
            {isAnalyzing ? <Loader2 size={18} className="animate-spin"/> : <Sparkles size={18}/>} AI Анализ
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleSave(false)} 
            className="px-8 py-4 md:px-10 md:py-5 bg-blue-600 text-white rounded-[2rem] font-black uppercase text-[10px] tracking-widest shadow-xl transition-all hover:bg-blue-700 shrink-0"
          >
            {isSaving ? <Loader2 size={18} className="animate-spin"/> : <Save size={18}/>} Сохранить
          </motion.button>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/30 dark:bg-transparent p-6 md:p-12 lg:p-24 pb-48">
          <textarea 
            ref={textareaRef}
            className="w-full h-auto min-h-[400px] bg-transparent border-none focus:outline-none text-lg md:text-2xl leading-relaxed text-slate-800 dark:text-slate-200 resize-none font-medium placeholder:text-slate-300"
            value={localContent}
            onChange={handleContentChange}
            placeholder="Начните писать..."
          />
        </div>

        <motion.div 
          initial={{ x: 450 }}
          animate={{ x: 0 }}
          className="w-full md:w-[450px] border-t md:border-t-0 md:border-l border-gray-100 dark:border-white/5 bg-white dark:bg-[#080c14] p-6 md:p-8 flex flex-col gap-8 overflow-y-auto custom-scrollbar"
        >
           {/* Cover Image / Screenshot Section */}
           <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[2.5rem] md:rounded-[3rem] border border-gray-100 dark:border-white/5 shadow-sm">
             <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-3 mb-4">
               <Globe size={16} className="text-blue-500"/> Обложка (Screenshot)
             </h4>
             <div className="relative aspect-video rounded-2xl bg-slate-50 dark:bg-slate-950 overflow-hidden group/cover cursor-pointer">
                {note?.screenshot ? (
                    <img src={note.screenshot} className="w-full h-full object-cover" alt="Cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300 font-bold text-[10px] uppercase">Нет превью</div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/cover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                    <label className="p-3 bg-white text-blue-600 rounded-xl cursor-pointer hover:scale-110 active:scale-95 transition-all">
                        <Plus size={20} />
                        <input 
                            type="file" 
                            className="hidden" 
                            accept="image/*" 
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file && note) {
                                    const reader = new FileReader();
                                    reader.onload = async (ev) => {
                                        const res = ev.target?.result as string;
                                        await updateNote({ ...note, screenshot: res });
                                    };
                                    reader.readAsDataURL(file);
                                }
                            }}
                        />
                    </label>
                    {note?.screenshot && (
                        <button 
                            onClick={async () => { if(note) await updateNote({ ...note, screenshot: undefined }); }}
                            className="p-3 bg-red-500 text-white rounded-xl hover:scale-110 active:scale-95 transition-all"
                        >
                            <X size={20} />
                        </button>
                    )}
                </div>
             </div>
           </div>

           {/* Action Items Section */}
           <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[2.5rem] md:rounded-[3rem] border border-gray-100 dark:border-white/5 shadow-sm">
             <div className="flex items-center justify-between mb-4">
               <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                 <CheckSquare size={16} className="text-emerald-500"/> Действия (Action Items)
               </h4>
               <span className="text-[9px] font-black bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-md">{localActionItems.length}</span>
             </div>

             <div className="space-y-2 mb-4">
               {localActionItems.map((item, idx) => (
                 <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-950 rounded-2xl group transition-all">
                   <div className="flex items-center gap-2.5 flex-1 min-w-0">
                     <button 
                       onClick={() => handleConvertActionToGoal(item)}
                       title="Превратить в цель" 
                       className="p-1 text-slate-400 hover:text-blue-500 shrink-0"
                     >
                       <Target size={14} />
                     </button>
                     <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{item}</span>
                   </div>
                   <button 
                     onClick={() => handleRemoveActionItem(idx)} 
                     className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                   >
                     <X size={12}/>
                   </button>
                 </div>
               ))}
               {localActionItems.length === 0 && (
                 <p className="text-[9px] text-gray-400 italic text-center py-2">Нет действий. AI извлечет их при анализе.</p>
               )}
             </div>

             <div className="flex gap-2">
               <input 
                 className="flex-1 p-3.5 bg-gray-50 dark:bg-slate-950 rounded-xl text-xs font-bold border-none dark:text-white outline-none" 
                 placeholder="Новое действие..." 
                 value={actionItemInput} 
                 onChange={e => setActionItemInput(e.target.value)} 
                 onKeyDown={e => e.key === 'Enter' && handleAddActionItem()} 
               />
               <button onClick={handleAddActionItem} className="p-3.5 bg-emerald-600 text-white rounded-xl shadow-md hover:bg-emerald-700 active:scale-95 transition-all">
                 <Plus size={16}/>
               </button>
             </div>
           </div>

           {/* Extracted Links Section */}
           <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[2.5rem] md:rounded-[3rem] border border-gray-100 dark:border-white/5 shadow-sm">
             <div className="flex items-center justify-between mb-4">
               <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                 <ExternalLink size={16} className="text-cyan-500"/> Ссылки (Extracted Links)
               </h4>
               <span className="text-[9px] font-black bg-cyan-500/10 text-cyan-600 px-2 py-0.5 rounded-md">{localExtractedLinks.length}</span>
             </div>

             <div className="space-y-2 mb-4">
               {localExtractedLinks.map((url, idx) => (
                 <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-950 rounded-2xl group transition-all">
                   <a 
                     href={url} 
                     target="_blank" 
                     rel="noreferrer" 
                     className="text-xs font-bold text-blue-600 dark:text-blue-400 truncate flex-1 hover:underline"
                   >
                     {url}
                   </a>
                   <div className="flex items-center gap-1 shrink-0 ml-2">
                     <button 
                       onClick={() => handleCopyLink(url, idx)} 
                       title="Копировать ссылку"
                       className="p-1 text-slate-400 hover:text-blue-500 rounded-md"
                     >
                       {copiedLinkIndex === idx ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                     </button>
                     <button 
                       onClick={() => handleRemoveLinkItem(idx)} 
                       className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                     >
                       <X size={12}/>
                     </button>
                   </div>
                 </div>
               ))}
               {localExtractedLinks.length === 0 && (
                 <p className="text-[9px] text-gray-400 italic text-center py-2">Нет ссылок</p>
               )}
             </div>

             <div className="flex gap-2">
               <input 
                 className="flex-1 p-3.5 bg-gray-50 dark:bg-slate-950 rounded-xl text-xs font-bold border-none dark:text-white outline-none" 
                 placeholder="https://..." 
                 value={linkInput} 
                 onChange={e => setLinkInput(e.target.value)} 
                 onKeyDown={e => e.key === 'Enter' && handleAddLinkItem()} 
               />
               <button onClick={handleAddLinkItem} className="p-3.5 bg-cyan-600 text-white rounded-xl shadow-md hover:bg-cyan-700 active:scale-95 transition-all">
                 <Plus size={16}/>
               </button>
             </div>
           </div>

           {/* Related Concepts Section */}
           <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[2.5rem] md:rounded-[3rem] border border-gray-100 dark:border-white/5 shadow-sm">
             <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-4">
               <Lightbulb size={16} className="text-amber-500"/> Ключевые концепции (Related Nodes)
             </h4>
             <div className="flex flex-wrap gap-2 mb-4">
               {localRelatedNodes.map((concept, idx) => (
                 <span 
                   key={idx} 
                   className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-700 dark:text-amber-300 rounded-xl text-[10px] font-black uppercase tracking-tight border border-amber-500/20"
                 >
                   <Sparkles size={10} className="text-amber-500" />
                   {concept}
                   <button 
                     onClick={() => handleRemoveConcept(concept)} 
                     className="hover:text-red-500 transition-colors ml-0.5"
                   >
                     <X size={10}/>
                   </button>
                 </span>
               ))}
               {localRelatedNodes.length === 0 && (
                 <p className="text-[9px] text-gray-400 italic py-1">Нет концепций. Создаются ИИ при анализе.</p>
               )}
             </div>
             <div className="flex gap-2">
               <input 
                 className="flex-1 p-3.5 bg-gray-50 dark:bg-slate-950 rounded-xl text-xs font-bold border-none dark:text-white outline-none" 
                 placeholder="Концепция..." 
                 value={conceptInput} 
                 onChange={e => setConceptInput(e.target.value)} 
                 onKeyDown={e => e.key === 'Enter' && handleAddConcept()} 
               />
               <button onClick={handleAddConcept} className="p-3.5 bg-amber-600 text-white rounded-xl shadow-md hover:bg-amber-700 active:scale-95 transition-all">
                 <Plus size={16}/>
               </button>
             </div>
           </div>

           <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[2.5rem] md:rounded-[3rem] border border-gray-100 dark:border-white/5 shadow-sm">
             <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-3 mb-6">
               <Folder size={16} className="text-blue-500"/> Категория
             </h4>
             <select 
               className="w-full p-5 md:p-6 bg-gray-50 dark:bg-slate-950 rounded-[1.5rem] md:rounded-[1.8rem] font-black text-xs border-none dark:text-white cursor-pointer"
               value={localCategory}
               onChange={e => setLocalCategory(e.target.value)}
             >
                {settings.customCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
             </select>
          </div>
          
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] md:rounded-[3.5rem] border border-gray-100 dark:border-white/5 flex flex-col flex-1 shadow-2xl overflow-hidden min-h-[300px] md:min-h-[400px]">
            <header className="p-6 md:p-8 border-b border-gray-50 dark:border-white/5 text-[10px] font-black uppercase text-blue-500 flex items-center gap-4">
              <MessageSquare size={20}/> Neural Assistant
            </header>
            <div className="flex-1 p-6 md:p-8 overflow-y-auto space-y-6 custom-scrollbar text-xs font-bold leading-relaxed dark:text-slate-300">
              <AnimatePresence initial={false}>
                {chatMessages.map((msg, i) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={i} 
                    className={`p-5 rounded-[1.8rem] ${msg.role === 'user' ? 'bg-blue-600 text-white self-end' : 'bg-gray-50 dark:bg-slate-800'}`}
                  >
                      {msg.content}
                  </motion.div>
                ))}
              </AnimatePresence>
              {isChatLoading && <Loader2 size={16} className="animate-spin text-blue-500" />}
            </div>
            <div className="p-4 md:p-6 border-t border-gray-50 dark:border-white/5 flex gap-3">
              <input className="flex-1 p-4 md:p-5 bg-gray-50 dark:bg-slate-950 rounded-[1.5rem] text-xs font-bold border-none dark:text-white" placeholder="Спросить..." value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleChatSend()} />
              <button onClick={handleChatSend} className="p-4 md:p-5 bg-blue-600 text-white rounded-[1.5rem] active:scale-90 transition-all shadow-xl"><Send size={18}/></button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[2.5rem] md:rounded-[3rem] border border-gray-100 dark:border-white/5 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-3">
                <Link2 size={16} className="text-blue-500"/> Связанные заметки
              </h4>
              <button 
                onClick={() => setShowLinkSearch(true)}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <Plus size={16}/>
              </button>
            </div>
            
            <div className="space-y-3">
              {relatedNotes.map(rn => (
                <div key={rn.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-950 rounded-xl group/link">
                  <span 
                    onClick={() => navigate(`/editor/${rn.id}`)}
                    className="text-[10px] font-bold truncate flex-1 cursor-pointer hover:text-blue-600 dark:text-slate-300"
                  >
                    {rn.title || 'Untitled'}
                  </span>
                  <button 
                    onClick={() => handleRemoveLink(rn.id)}
                    className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover/link:opacity-100 transition-all"
                  >
                    <X size={12}/>
                  </button>
                </div>
              ))}
              {relatedNotes.length === 0 && (
                <p className="text-[9px] text-gray-400 italic text-center py-2">Нет связей</p>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[2.5rem] md:rounded-[3rem] border border-gray-100 dark:border-white/5 shadow-sm">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-3 mb-6">
              <Hash size={16} className="text-blue-500"/> Теги
            </h4>
            <div className="flex flex-wrap gap-2.5 mb-6">
              {localTags.map(t => (
                <motion.button 
                  layout
                  key={t} 
                  className="px-4 py-2 bg-blue-50 text-blue-600 dark:bg-blue-900/20 rounded-xl text-[10px] font-black flex items-center gap-3 border border-blue-100"
                >
                  #{t} <span onClick={(e) => { e.stopPropagation(); setLocalTags(localTags.filter(x => x !== t)); }} className="hover:text-red-500 transition-colors ml-1"><X size={10}/></span>
                </motion.button>
              ))}
            </div>
            <div className="flex gap-2">
              <input className="flex-1 p-4 md:p-5 bg-gray-50 dark:bg-slate-950 rounded-2xl text-xs font-bold border-none dark:text-white" placeholder="Добавить..." value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAddTag(); }} />
              <button onClick={handleAddTag} className="p-4 md:p-5 bg-blue-600 text-white rounded-2xl shadow-xl active:scale-95 transition-all"><Plus size={18}/></button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Link Search Modal */}
      <AnimatePresence>
        {showLinkSearch && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/40 dark:bg-slate-950/80 backdrop-blur-xl z-[100] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[3rem] p-8 shadow-2xl border border-white/10"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black dark:text-white uppercase tracking-tighter">Связать заметку</h3>
                <button onClick={() => setShowLinkSearch(false)} className="p-2 text-gray-400 hover:text-red-500"><X size={20}/></button>
              </div>
              <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                <input 
                  autoFocus
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-slate-950 border-none rounded-2xl font-bold text-sm dark:text-white shadow-inner"
                  placeholder="Поиск по названию..."
                  value={linkSearchQuery}
                  onChange={e => setLinkSearchQuery(e.target.value)}
                />
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                {searchResults.map(rn => (
                  <button 
                    key={rn.id}
                    onClick={() => handleAddLink(rn.id)}
                    className="w-full text-left p-4 bg-gray-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-2xl transition-all flex items-center justify-between group"
                  >
                    <span className="text-xs font-bold truncate flex-1 dark:text-slate-200">{rn.title || 'Untitled'}</span>
                    <ArrowRight size={14} className="text-blue-500 opacity-0 group-hover:opacity-100 transition-all"/>
                  </button>
                ))}
                {linkSearchQuery && searchResults.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4 italic">Ничего не найдено</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NoteEditor;

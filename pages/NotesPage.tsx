
import React, { useState, useMemo, useRef } from 'react';
import { useNotes } from '../contexts/NotesContext.tsx';
import { NoteStatus, Note } from '../types.ts';
import { getTagColor } from '../utils/tagColors.ts';
import { 
  Search, Trash2, Sparkles, Circle, PlayCircle, Eye, CheckCircle2, 
  FileText, Globe, Folder, Plus, LayoutGrid, List, ScanLine, Lightbulb, Send, Mic, Split, X, Loader2, AlertCircle, Bookmark, Headphones, ChevronLeft, ChevronRight, Hash, Scissors, ChevronDown, CheckSquare, ExternalLink, Link2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as ai from '../utils/aiAdapter.ts';
import { motion, AnimatePresence } from 'motion/react';

const StatusIcon = ({ status, className }: { status: NoteStatus, className?: string }) => {
  switch (status) {
    case 'new': return <Circle className={`${className} text-amber-500 fill-amber-500`} size={10} />;
    case 'in-work': return <PlayCircle className={`${className} text-blue-500`} size={16} />;
    case 'read': return <Eye className={`${className} text-slate-400`} size={16} />;
    case 'finished': return <CheckCircle2 className={`${className} text-green-500`} size={16} />;
    default: return null;
  }
};

const SourceBadge = ({ type, hasAudio }: { type?: Note['sourceType'], hasAudio?: boolean }) => {
    return (
      <div className="flex items-center gap-2">
        {hasAudio && <span title="Аудиозапись"><Headphones size={12} className="text-red-500" /></span>}
        {(() => {
          switch (type) {
              case 'ocr': return <span title="OCR"><ScanLine size={12} className="text-cyan-500" /></span>;
              case 'split': return <span title="Split"><Split size={12} className="text-purple-500" /></span>;
              case 'telegram': return <span title="TG"><Send size={12} className="text-blue-400" /></span>;
              case 'audio': return <span title="Audio"><Mic size={12} className="text-red-400" /></span>;
              default: return <span title="Manual"><FileText size={12} className="text-gray-400" /></span>;
          }
        })()}
      </div>
    )
}

const NotesPage: React.FC = () => {
  const { notes, moveToTrash, filterTag, setFilterTag, filterCategory, setFilterCategory, setNoteStatus, settings, addCategory, deleteCategory, processLargeText } = useNotes();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [showSplitter, setShowSplitter] = useState(false);
  const [splitText, setSplitText] = useState('');
  const [isSplitting, setIsSplitting] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Pagination State
  const [page, setPage] = useState(1);
  const [semanticQuery, setSemanticQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [semanticResults, setSemanticResults] = useState<{id: string, relevance: number}[]>([]);
  const [filterDate, setFilterDate] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const NOTES_PER_PAGE = 24;

  const filteredNotes = useMemo(() => {
    let result = notes.filter(n => n.status !== 'trash');

    // 1. Semantic Search Filter
    if (semanticResults.length > 0) {
        const ids = new Set(semanticResults.map(r => r.id));
        result = result.filter(n => ids.has(n.id));
    } else {
        // 2. Keyword Search
        const query = search.toLowerCase();
        if (query) {
            result = result.filter(n => n.title.toLowerCase().includes(query) || n.content.toLowerCase().includes(query));
        }
    }

    // 3. Tag Filter
    if (filterTag) {
        result = result.filter(n => n.tags.includes(filterTag));
    }

    // 4. Category Filter
    if (filterCategory) {
        result = result.filter(n => n.category === filterCategory);
    }

    // 5. Date Filter
    if (filterDate !== 'all') {
        const now = new Date();
        result = result.filter(n => {
            const date = new Date(n.createdAt);
            if (filterDate === 'today') return date.toDateString() === now.toDateString();
            if (filterDate === 'week') return (now.getTime() - date.getTime()) < 7 * 24 * 60 * 60 * 1000;
            if (filterDate === 'month') return (now.getTime() - date.getTime()) < 30 * 24 * 60 * 60 * 1000;
            return true;
        });
    }

    return result;
  }, [notes, search, filterTag, filterCategory, filterDate, semanticResults]);

  const displayedNotes = useMemo(() => filteredNotes.slice(0, page * NOTES_PER_PAGE), [filteredNotes, page]);
  const hasMore = displayedNotes.length < filteredNotes.length;

  const handleSemanticSearch = async () => {
    if (!semanticQuery.trim()) {
        setSemanticResults([]);
        return;
    }
    setIsSearching(true);
    try {
        const res = await ai.semanticSearch(semanticQuery, notes.filter(n => n.status !== 'trash'), settings);
        if (res && res.results) {
            setSemanticResults(res.results);
        }
    } catch (e) {
        console.error("Semantic search failed", e);
    } finally {
        setIsSearching(false);
    }
  };

  const handleScroll = (dir: 'l' | 'r') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir === 'l' ? -250 : 250, behavior: 'smooth' });
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    await addCategory(newGroupName);
    setNewGroupName('');
    setShowAddGroup(false);
  };

  const handleSplitSubmit = async () => {
    if (!splitText.trim()) return;
    setIsSplitting(true);
    await processLargeText(splitText);
    setIsSplitting(false);
    setSplitText('');
    setShowSplitter(false);
  };

  const cycleStatus = (e: React.MouseEvent, note: Note) => {
    e.stopPropagation();
    const statuses: NoteStatus[] = ['new', 'in-work', 'read', 'finished'];
    const currentIndex = statuses.indexOf(note.status);
    const nextIndex = (currentIndex + 1) % statuses.length;
    setNoteStatus(note.id, statuses[nextIndex]);
  };

  const handleTagClick = (e: React.MouseEvent, tag: string) => {
    e.stopPropagation();
    setFilterTag(tag);
  };

  return (
    <div className="p-6 md:p-12 max-w-7xl mx-auto min-h-screen relative pb-32">
      <header className="flex flex-col gap-4 mb-10 mt-16 md:mt-0">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <motion.h2 
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="text-xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight select-none leading-none"
          >
            Библиотека<span className="text-blue-600">.</span>
          </motion.h2>
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowSplitter(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-purple-600/10 text-purple-600 dark:text-purple-400 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-purple-500/20 hover:bg-purple-600 hover:text-white transition-all"
            >
              <Scissors size={14}/> Split
            </motion.button>
            <AnimatePresence>
              {filterTag && (
                <motion.button 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  onClick={() => setFilterTag(null)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg"
                >
                  #{filterTag} <X size={14}/>
                </motion.button>
              )}
            </AnimatePresence>
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-white/5">
               <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-400'}`} title="Галерея"><LayoutGrid size={16}/></button>
               <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-400'}`} title="Список"><List size={16}/></button>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-3 w-full">
          <div className="relative group flex-1 w-full">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18}/>
            <input
              type="text"
              placeholder="Поиск по заметкам..."
              className="w-full pl-14 pr-6 py-3.5 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-4 focus:ring-blue-500/10 font-bold text-sm shadow-sm transition-all dark:text-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="relative group flex-1 w-full">
            <Sparkles className="absolute left-6 top-1/2 -translate-y-1/2 text-purple-400" size={18}/>
            <input
              type="text"
              placeholder="Смысловой поиск (AI Insight)..."
              className="w-full pl-14 pr-16 py-3.5 bg-purple-50/50 dark:bg-purple-950/10 border border-purple-100 dark:border-purple-500/10 rounded-2xl focus:ring-4 focus:ring-purple-500/10 font-bold text-sm shadow-sm transition-all dark:text-white"
              value={semanticQuery}
              onChange={(e) => setSemanticQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSemanticSearch()}
            />
            <button 
                onClick={handleSemanticSearch}
                disabled={isSearching}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-all disabled:opacity-50"
            >
                {isSearching ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={14} />}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 px-4 py-2 border-b border-[var(--border-color)] pb-6 mb-8">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">Фильтры:</span>
            <select 
                value={filterDate} 
                onChange={(e: any) => setFilterDate(e.target.value)}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-[11px] font-black uppercase text-slate-600 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500/20"
            >
                <option value="all">Все время</option>
                <option value="today">Сегодня</option>
                <option value="week">За неделю</option>
                <option value="month">За месяц</option>
            </select>
            
            {semanticResults.length > 0 && (
                <button 
                    onClick={() => { setSemanticResults([]); setSemanticQuery(''); }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-xl text-[10px] font-black shadow-lg shadow-purple-500/20 flex items-center gap-2"
                >
                    Сбросить AI поиск <X size={12} />
                </button>
            )}
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between px-4">
             <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
               <Folder size={12} className="text-blue-500"/> Группы Знаний
             </h4>
             <div className="flex items-center gap-4">
                <button onClick={() => handleScroll('l')} className="p-2 text-gray-400 hover:text-blue-500 transition-colors"><ChevronLeft size={20}/></button>
                <button onClick={() => handleScroll('r')} className="p-2 text-gray-400 hover:text-blue-500 transition-colors"><ChevronRight size={20}/></button>
                <div className="w-px h-4 bg-gray-200 dark:bg-slate-800 mx-2" />
                <button onClick={() => setShowAddGroup(true)} className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-2 hover:opacity-70 transition-opacity">
                    <Plus size={12}/> Новая Группа
                </button>
             </div>
          </div>
          <div ref={scrollRef} className="flex items-center gap-4 overflow-x-auto pb-4 no-scrollbar pr-10">
             {settings.customCategories.map(cat => {
               const count = notes.filter(n => n.category === cat && n.status !== 'trash').length;
               const isActive = filterCategory === cat;
               const colors = getTagColor(cat);
               return (
                 <motion.div 
                   layout
                   key={cat} 
                   className="relative group shrink-0"
                 >
                    <button 
                      onClick={() => setFilterCategory(isActive ? null : cat)}
                      style={{ backgroundColor: isActive ? colors.border : undefined, borderColor: colors.border }}
                      className={`px-6 py-5 rounded-2xl border-2 transition-all flex flex-col gap-2 min-w-[160px] text-left relative overflow-hidden shadow-sm ${
                        isActive ? 'text-white shadow-lg scale-105' : 'bg-white dark:bg-slate-900 text-gray-900 dark:text-white hover:border-blue-500'
                      }`}
                    >
                        <Folder size={24} className={isActive ? 'text-white' : 'text-blue-500'} />
                        <span className="text-sm font-black uppercase tracking-tight truncate mt-2">{cat}</span>
                        <span className={`absolute top-4 right-4 text-[10px] font-black px-2 py-1 rounded-lg ${isActive ? 'bg-white/20' : 'bg-gray-100 dark:bg-slate-800'}`}>{count}</span>
                    </button>
                    {cat !== 'Общее' && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); if(confirm(`Удалить группу "${cat}"? Заметки вернутся в "Общее"`)) deleteCategory(cat); }}
                          className="absolute bottom-4 right-4 p-2 bg-red-500 text-white rounded-xl opacity-0 group-hover:opacity-100 transition-all shadow-lg hover:scale-110 active:scale-90"
                        >
                            <Trash2 size={12}/>
                        </button>
                    )}
                  </motion.div>
                );
              })}
          </div>
        </div>
      </header>

      <AnimatePresence mode="popLayout">
        {viewMode === 'grid' ? (
          <motion.div 
            layout
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            {displayedNotes.map((note) => {
              const colors = getTagColor(note.category);
              const semanticMatch = semanticResults.find(r => r.id === note.id);
              return (
                <motion.div 
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileHover={{ y: -5 }}
                  key={note.id}
                  onClick={() => navigate(`/editor/${note.id}`)}
                  style={{ borderColor: colors.border }}
                  className="group bg-white dark:bg-slate-900/60 rounded-[1.5rem] border border-slate-200 dark:border-white/5 transition-all cursor-pointer h-auto flex flex-col shadow-sm hover:shadow-xl relative overflow-hidden backdrop-blur-sm"
                >
                  {/* Screenshot/Preview Area */}
                  {note.screenshot && note.screenshot.startsWith('data:image') && (
                    <div className="h-40 bg-slate-100 dark:bg-slate-800 relative overflow-hidden flex items-center justify-center">
                        <img src={note.screenshot} className="w-full h-full object-cover" alt={note.title} referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  )}

                  <div className="p-5 flex flex-col flex-1 relative">
                    <div className="absolute top-4 right-4 flex gap-1.5 z-10">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            const query = [note.title, note.category, ...(note.tags || []).slice(0, 2)].filter(Boolean).join(' ');
                            ai.openInGoogle(query || note.title || 'заметка');
                          }} 
                          title="Искать тему в Google" 
                          className="p-1.5 bg-white/90 dark:bg-slate-900/90 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl shadow-lg border border-slate-200 dark:border-white/10 hover:scale-110 transition-transform"
                        >
                            <Globe size={13} />
                        </button>
                        <button onClick={(e) => cycleStatus(e, note)} className="p-1.5 bg-white/90 dark:bg-slate-900/90 rounded-xl shadow-lg border border-slate-200 dark:border-white/10 hover:scale-110 transition-transform">
                            <StatusIcon status={note.status} />
                        </button>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <SourceBadge type={note.sourceType} hasAudio={!!note.audioData} />
                            {note.category && (
                                <span 
                                    className="px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tight"
                                    style={{ backgroundColor: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
                                >
                                    {note.category}
                                </span>
                            )}
                        </div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                            {new Date(note.createdAt).toLocaleDateString()}
                        </span>
                    </div>

                    <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2 line-clamp-1 tracking-tight leading-tight">
                        {note.title || "Без названия"}
                    </h3>
                    
                    <div className="flex-1 overflow-hidden">
                        {semanticMatch && (
                            <div className="mb-2 px-2 py-1 bg-purple-500/10 rounded-lg border border-purple-500/20">
                                <p className="text-[9px] font-black text-purple-600 uppercase">Match: {Math.round(semanticMatch.relevance * 100)}%</p>
                            </div>
                        )}
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2 font-medium mb-3">
                            {note.summary || note.content}
                        </p>
                        {/* Structured Output Meta Badges */}
                        <div className="flex flex-wrap items-center gap-1.5 mb-2">
                          {(note.action_items && note.action_items.length > 0) && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[8px] font-black rounded-md border border-emerald-500/20" title={`${note.action_items.length} действий`}>
                              <CheckSquare size={10} /> {note.action_items.length}
                            </span>
                          )}
                          {(note.extracted_links && note.extracted_links.length > 0) && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-[8px] font-black rounded-md border border-cyan-500/20" title={`${note.extracted_links.length} ссылок`}>
                              <ExternalLink size={10} /> {note.extracted_links.length}
                            </span>
                          )}
                          {(note.related_nodes && note.related_nodes.length > 0) && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[8px] font-black rounded-md border border-amber-500/20" title={`${note.related_nodes.length} концепций`}>
                              <Sparkles size={10} /> {note.related_nodes.length}
                            </span>
                          )}
                        </div>
                    </div>

                    <div className="mt-auto pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                        <div className="flex flex-wrap gap-1">
                            {(note.tags || note.hashtags || []).slice(0, 3).map(tag => (
                                <span 
                                    key={tag}
                                    className="px-2 py-0.5 bg-blue-500/5 text-[8px] font-black uppercase tracking-tight text-blue-600 dark:text-blue-400 border border-blue-500/10 rounded-md"
                                >
                                    #{tag}
                                </span>
                            ))}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const query = [note.title, note.category].filter(Boolean).join(' ');
                            ai.openInGoogle(query || note.title || 'заметка');
                          }}
                          title="Искать в Google по теме карточки"
                          className="flex items-center gap-1 text-[9px] font-bold text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 px-2 py-1 rounded-lg transition-colors shrink-0"
                        >
                          <Globe size={11} />
                          <span>Google</span>
                        </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        ) : (
          <motion.div 
            layout
            className="space-y-3"
          >
            {displayedNotes.map(note => {
               const colors = getTagColor(note.category);
               return (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    key={note.id} 
                    onClick={() => navigate(`/editor/${note.id}`)} 
                    style={{ borderColor: colors.border }} 
                    className="bg-white dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-100 dark:border-white/5 flex items-center gap-6 group cursor-pointer transition-all shadow-sm hover:shadow-md backdrop-blur-sm"
                  >
                    <button onClick={(e) => cycleStatus(e, note)} className="shrink-0 scale-75"><StatusIcon status={note.status}/></button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                         <h3 className="text-base font-black text-slate-800 dark:text-white truncate">{note.title || "Без названия"}</h3>
                         <SourceBadge type={note.sourceType} hasAudio={!!note.audioData} />
                         {note.category && (
                            <span 
                                className="px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tight"
                                style={{ backgroundColor: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
                            >
                                {note.category}
                            </span>
                         )}
                      </div>
                      <p className="text-xs text-slate-400 truncate mt-0.5 font-medium">{note.summary || note.content.slice(0, 100)}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="hidden md:flex items-center gap-1.5">
                          {(note.action_items && note.action_items.length > 0) && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[8px] font-black rounded-md border border-emerald-500/20" title={`${note.action_items.length} действий`}>
                              <CheckSquare size={10} /> {note.action_items.length}
                            </span>
                          )}
                          {(note.extracted_links && note.extracted_links.length > 0) && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-[8px] font-black rounded-md border border-cyan-500/20" title={`${note.extracted_links.length} ссылок`}>
                              <ExternalLink size={10} /> {note.extracted_links.length}
                            </span>
                          )}
                          {(note.tags || note.hashtags || []).slice(0, 3).map(tag => (
                              <span key={tag} className="text-[9px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">#{tag}</span>
                          ))}
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          const query = [note.title, note.category].filter(Boolean).join(' ');
                          ai.openInGoogle(query || note.title || 'заметка');
                        }}
                        title="Искать в Google по теме"
                        className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-bold"
                      >
                        <Globe size={14} />
                        <span className="hidden sm:inline">Google</span>
                      </button>
                      <span className="text-[9px] font-black text-slate-400 uppercase w-20 text-right">{new Date(note.createdAt).toLocaleDateString()}</span>
                      <button onClick={(e) => { e.stopPropagation(); moveToTrash(note.id); }} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                    </div>
                  </motion.div>
               );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {hasMore && (
        <div className="mt-12 flex justify-center">
            <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setPage(p => p + 1)}
                className="px-10 py-5 bg-gray-100 dark:bg-slate-800 rounded-3xl text-sm font-black uppercase tracking-widest flex items-center gap-3 hover:bg-blue-100 hover:text-blue-600 transition-all shadow-sm"
            >
                <ChevronDown size={18}/> Показать еще ({filteredNotes.length - displayedNotes.length})
            </motion.button>
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {showAddGroup && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/40 dark:bg-slate-950/70 backdrop-blur-xl z-[150] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[3rem] p-10 shadow-2xl border border-white/10"
            >
              <h3 className="text-3xl font-black dark:text-white uppercase mb-6 flex items-center gap-3 tracking-tighter">Новая Группа</h3>
              <input 
                autoFocus className="w-full p-6 bg-gray-50 dark:bg-slate-950 border-none rounded-2xl font-black text-xl dark:text-white shadow-inner"
                placeholder="Название..."
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateGroup()}
              />
              <div className="flex gap-4 mt-8">
                 <button onClick={() => setShowAddGroup(false)} className="flex-1 py-5 bg-gray-100 dark:bg-slate-800 rounded-2xl font-black uppercase text-[10px] tracking-widest dark:text-white">Отмена</button>
                 <button onClick={handleCreateGroup} className="flex-1 py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all">Создать</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showSplitter && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/40 dark:bg-slate-950/80 backdrop-blur-2xl z-[150] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[4rem] p-8 md:p-16 shadow-2xl border border-white/10 relative"
            >
              <button onClick={() => setShowSplitter(false)} className="absolute top-6 right-6 md:top-10 md:right-10 p-3 text-gray-400 hover:text-red-500 bg-gray-100 dark:bg-slate-800 rounded-full"><X size={24}/></button>
              <h3 className="text-2xl md:text-4xl font-black dark:text-white uppercase mb-4 tracking-tighter flex items-center gap-4">
                <Scissors size={32} className="text-purple-500"/> Smart Text Splitter
              </h3>
              <p className="text-gray-400 font-bold text-sm mb-10 leading-relaxed max-w-2xl hidden md:block">
                Вставьте лонгрид, книгу или длинную статью. ИИ проанализирует контекст и разделит его на серию осмысленных карточек с заголовками и категориями.
              </p>
              <textarea 
                className="w-full h-[250px] md:h-[350px] p-8 bg-gray-50 dark:bg-slate-950 border-none rounded-[2.5rem] font-medium text-lg dark:text-white shadow-inner resize-none focus:ring-4 focus:ring-purple-500/10 transition-all outline-none"
                placeholder="Вставьте ваш огромный текст здесь..."
                value={splitText}
                onChange={e => setSplitText(e.target.value)}
              />
              <div className="flex gap-4 mt-8 md:mt-12">
                 <button 
                  onClick={handleSplitSubmit}
                  disabled={isSplitting || !splitText.trim()}
                  className="flex-1 py-5 md:py-7 bg-purple-600 text-white rounded-[2.5rem] font-black uppercase text-xs tracking-widest shadow-xl shadow-purple-500/20 active:scale-95 transition-all flex items-center justify-center gap-4 disabled:opacity-30"
                 >
                   {isSplitting ? <Loader2 size={22} className="animate-spin"/> : <Sparkles size={22}/>}
                   Разрезать и импортировать
                 </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotesPage;


import React, { useState, useMemo } from 'react';
import { useNotes } from '../contexts/NotesContext.tsx';
import GraphView from '../components/GraphView.tsx';
import { Share2, Network, Sparkles, LayoutGrid, List as ListIcon, Calendar, Tag, ChevronRight, Search, FolderTree, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';

const GraphPage: React.FC = () => {
    const { notes } = useNotes();
    const navigate = useNavigate();
    const [viewMode, setViewMode] = useState<'graph' | 'list'>('graph');
    const [searchTerm, setSearchTerm] = useState('');
    const activeNotes = useMemo(() => notes.filter(n => n.status !== 'trash'), [notes]);
    const filteredNotes = useMemo(() => activeNotes.filter(n => {
        if (!searchTerm) return true;
        const searchLower = searchTerm.toLowerCase();
        return n.title.toLowerCase().includes(searchLower) || 
               n.content.toLowerCase().includes(searchLower) ||
               n.tags.some(t => t.toLowerCase().includes(searchLower)) ||
               n.category.toLowerCase().includes(searchLower);
    }), [activeNotes, searchTerm]);

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950 relative overflow-hidden">
            <div className="absolute top-6 left-6 right-6 z-30 pointer-events-none flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <motion.div 
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    className="flex flex-col gap-1 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-white/20 shadow-2xl pointer-events-auto"
                >
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-none">
                            База Знаний<span className="text-blue-500">.</span>
                        </h2>
                        <div className="flex items-center bg-slate-100/50 dark:bg-white/5 p-1 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm">
                            <button 
                                onClick={() => setViewMode('graph')}
                                className={`p-1.5 rounded-lg transition-all ${viewMode === 'graph' ? 'bg-white dark:bg-white/10 text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                title="Граф связей"
                            >
                                <Network size={16} />
                            </button>
                            <button 
                                onClick={() => setViewMode('list')}
                                className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white dark:bg-white/10 text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                title="Список заметок"
                            >
                                <ListIcon size={16} />
                            </button>
                        </div>
                    </div>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                        {viewMode === 'graph' ? 'Ментальный граф связей' : 'Интеллектуальный реестр базы'}
                    </p>
                </motion.div>

                <motion.div 
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    className="flex items-center gap-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-2 rounded-2xl border border-white/20 shadow-2xl pointer-events-auto w-full md:w-auto"
                >
                    <div className="relative group w-full md:w-64">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="Поиск в базе..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-11 pr-10 py-2.5 bg-transparent border-none focus:outline-none text-xs font-bold dark:text-white"
                        />
                        {searchTerm && (
                            <button 
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </motion.div>
            </div>

            <div className="flex-1 relative min-h-0 bg-transparent flex flex-col">
                <AnimatePresence mode="wait">
                    {viewMode === 'graph' ? (
                        <motion.div 
                            key="graph"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="w-full h-full"
                        >
                            <GraphView notes={activeNotes} searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
                        </motion.div>
                    ) : (
                        <motion.div 
                            key="list"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            className="w-full h-full overflow-y-auto p-6 pt-32 max-w-5xl mx-auto"
                        >
                            <div className="flex flex-col gap-4 pb-32">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">
                                        Найдено: {filteredNotes.length} объектов
                                    </h3>
                                </div>
                                
                                {filteredNotes.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200 dark:border-white/10 rounded-[3rem]">
                                        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 mb-4">
                                            <Sparkles size={32} />
                                        </div>
                                        <p className="text-slate-400 font-bold">Ничего не найдено</p>
                                    </div>
                                ) : (
                                    filteredNotes.map((note) => (
                                        <motion.div
                                            key={note.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            onClick={() => navigate(`/editor/${note.id}`)}
                                            className="group bg-white dark:bg-slate-900/60 p-5 rounded-[2.5rem] border border-slate-200 dark:border-white/5 hover:border-blue-500/50 transition-all cursor-pointer shadow-sm hover:shadow-2xl flex items-center justify-between gap-4 backdrop-blur-sm"
                                        >
                                            <div className="flex items-center gap-5 overflow-hidden">
                                                <div className={`w-14 h-14 rounded-3xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${note.status === 'new' ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/10' : 'bg-slate-100 text-slate-500 dark:bg-white/5'}`}>
                                                    <Share2 size={24} />
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className="font-black text-slate-900 dark:text-white text-lg truncate group-hover:text-blue-500 transition-colors leading-tight">
                                                        {note.title || 'Без названия'}
                                                    </h4>
                                                    <div className="flex flex-wrap items-center gap-3 mt-2">
                                                        <span className="flex items-center gap-1.5 text-[9px] font-black uppercase text-slate-400 tracking-wider">
                                                            <Calendar size={10} /> {new Date(note.createdAt).toLocaleDateString()}
                                                        </span>
                                                        {note.tags.length > 0 && (
                                                            <span className="flex items-center gap-1.5 text-[9px] font-black uppercase text-emerald-500 tracking-wider bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                                                                <Tag size={10} /> {note.tags.length} тегов
                                                            </span>
                                                        )}
                                                        <span className="flex items-center gap-1.5 text-[9px] font-black uppercase text-blue-500 tracking-wider bg-blue-50 dark:bg-blue-500/10 px-2 py-1 rounded-lg border border-blue-500/20">
                                                            <FolderTree size={10} /> {note.category}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4 shrink-0">
                                                <div className="text-right hidden sm:block">
                                                    <div className="text-[10px] font-black uppercase text-slate-300">Состояние</div>
                                                    <div className="text-[11px] font-black text-slate-500 dark:text-slate-400">{note.status}</div>
                                                </div>
                                                <div className="w-10 h-10 rounded-full border border-slate-200 dark:border-white/10 flex items-center justify-center group-hover:bg-blue-500 group-hover:border-blue-500 transition-all text-slate-300 group-hover:text-white">
                                                    <ChevronRight size={20} />
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
                
                <div className="absolute bottom-8 left-8 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl p-5 rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-2xl min-w-[200px] pointer-events-auto z-20">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-1.5 bg-blue-500 rounded-lg">
                            <Sparkles size={14} className="text-white" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white">База в цифрах</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="text-[9px] font-black uppercase text-slate-400 mb-1">Заметок</div>
                            <div className="text-lg font-black text-slate-900 dark:text-white tabular-nums">{activeNotes.length}</div>
                        </div>
                        <div>
                            <div className="text-[9px] font-black uppercase text-slate-400 mb-1">Связей</div>
                            <div className="text-lg font-black text-emerald-500 tabular-nums">
                                {activeNotes.reduce((acc, n) => acc + n.tags.length + (n.links?.length || 0), 0)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GraphPage;


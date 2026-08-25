
import React, { useMemo, useState } from 'react';
import { useNotes } from '../contexts/NotesContext.tsx';
import { Lightbulb, Plus, Calendar, ChevronRight, Share2, Target, Zap, FileText, Sparkles, Loader2, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as ai from '../utils/aiAdapter.ts';

const IdeasPage: React.FC = () => {
  const { notes, goals, autoGroupIdeas } = useNotes();
  const navigate = useNavigate();
  const [isClustering, setIsClustering] = useState(false);
  
  const ideas = notes.filter(n => n.category === 'Идеи' && n.status !== 'trash');

  const getRelatedItems = (idea: any) => {
    const text = idea.content.toLowerCase() + idea.title.toLowerCase();
    const keywords = idea.tags.map((t: string) => t.toLowerCase());
    
    return notes.filter(n => {
        if (n.id === idea.id || n.status === 'trash') return false;
        const nText = n.content.toLowerCase() + n.title.toLowerCase();
        const hasKeyword = keywords.some((k: string) => nText.includes(k));
        const hasGoalMatch = idea.links && n.links && idea.links.some((l: string) => n.links.includes(l));
        return hasKeyword || hasGoalMatch;
    }).slice(0, 3);
  };
  
  const handleAutoCluster = async () => {
      if(ideas.length < 3) {
          alert("Need at least 3 ideas to cluster");
          return;
      }
      setIsClustering(true);
      await autoGroupIdeas();
      setIsClustering(false);
  };

  return (
    <div className="p-12 max-w-6xl mx-auto min-h-screen pb-32">
      <div className="flex items-center justify-between mb-12">
        <div>
            <div className="flex items-center gap-2 text-amber-500 font-bold text-[10px] uppercase tracking-[0.3em]">
                <Lightbulb size={14} /> Инкубатор Идей
            </div>
            <h2 className="text-6xl font-black text-gray-900 dark:text-white mt-2 tracking-tighter">Ваши озарения</h2>
        </div>
        <div className="flex gap-4">
            <button 
                onClick={handleAutoCluster}
                disabled={isClustering}
                className="flex items-center gap-3 bg-purple-600/10 text-purple-600 dark:text-purple-400 px-8 py-5 rounded-[2rem] hover:bg-purple-600 hover:text-white transition-all font-black uppercase text-xs tracking-widest disabled:opacity-50"
            >
                {isClustering ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
                AI Кластеризация
            </button>
            <button 
                onClick={() => navigate('/editor/new')}
                className="flex items-center gap-3 bg-amber-500 text-white px-10 py-5 rounded-[2rem] hover:bg-amber-600 shadow-xl shadow-amber-500/20 transition-all font-black uppercase text-xs tracking-widest"
            >
                <Plus size={22} /> Новая идея
            </button>
        </div>
      </div>

      {ideas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-48 text-center opacity-30">
            <Lightbulb size={100} className="mb-8" />
            <p className="text-2xl font-black uppercase tracking-widest">Здесь пока пусто.</p>
            <p className="mt-2 font-bold uppercase text-[10px] tracking-widest">Ваши мысли ждут активации</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-10">
          {ideas.map(idea => {
            const related = getRelatedItems(idea);
            return (
              <div key={idea.id} className="space-y-4 animate-in slide-in-from-bottom duration-500">
                <div 
                    onClick={() => navigate(`/editor/${idea.id}`)}
                    className="bg-white dark:bg-slate-900 p-10 rounded-[3.5rem] border border-gray-100 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-400 transition-all cursor-pointer group shadow-lg flex items-center justify-between"
                >
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="px-3 py-1 bg-amber-500/10 text-amber-600 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                <Zap size={12}/> Инсайт
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                                <Calendar size={12} /> {new Date(idea.createdAt).toLocaleDateString()}
                            </div>
                            {idea.tags.length > 0 && (
                                <div className="flex gap-2">
                                    {idea.tags.slice(0, 3).map(t => (
                                        <span key={t} className="px-2 py-0.5 bg-gray-100 dark:bg-slate-800 text-[9px] font-bold rounded-md text-gray-500">#{t}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                        <h3 className="text-3xl font-black text-gray-900 dark:text-white group-hover:text-amber-500 transition-colors tracking-tight">
                            {idea.title}
                        </h3>
                        <p className="text-sm text-gray-500 leading-relaxed line-clamp-2 max-w-3xl font-medium">{idea.content}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const query = [idea.title, ...(idea.tags || [])].join(' ');
                          ai.openInGoogle(query || idea.title);
                        }}
                        title="Искать тему в Google"
                        className="px-4 py-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 rounded-2xl transition-all flex items-center gap-2 text-xs font-black uppercase tracking-wider shadow-xs"
                      >
                        <Globe size={16} />
                        <span className="hidden sm:inline">Google</span>
                      </button>
                      <div className="p-6 bg-gray-50 dark:bg-slate-950 rounded-[2rem] text-gray-400 group-hover:bg-amber-500 group-hover:text-white transition-all shadow-inner">
                          <ChevronRight size={32} />
                      </div>
                    </div>
                </div>

                {related.length > 0 && (
                    <div className="flex items-center gap-4 pl-10 pr-10 overflow-x-auto no-scrollbar pb-2">
                        <span className="shrink-0 text-[10px] font-black uppercase text-gray-400 flex items-center gap-2">
                            <Share2 size={12} className="text-blue-500"/> Связи:
                        </span>
                        {related.map(r => (
                            <div key={r.id} className="flex items-center gap-1 shrink-0">
                              <button 
                                  onClick={() => navigate(`/editor/${r.id}`)}
                                  className="px-5 py-3 bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-800 rounded-2xl flex items-center gap-2.5 hover:border-blue-500 transition-all"
                              >
                                  <span className="text-[10px] font-black uppercase dark:text-slate-300 truncate max-w-[120px]">{r.title}</span>
                                  {r.category === 'Цели' || (r.links && r.links.length > 0) ? <Target size={12} className="text-blue-500" /> : <FileText size={12} className="text-gray-400" />}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  ai.openInGoogle(r.title);
                                }}
                                title="Искать в Google"
                                className="p-3 bg-gray-50 dark:bg-slate-900/50 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-2xl border border-gray-100 dark:border-slate-800 transition-colors"
                              >
                                <Globe size={12} />
                              </button>
                            </div>
                        ))}
                    </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default IdeasPage;

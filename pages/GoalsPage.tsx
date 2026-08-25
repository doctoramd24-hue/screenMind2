
import React, { useState, useMemo } from 'react';
import { useNotes } from '../contexts/NotesContext.tsx';
import { Target, Plus, X, Sparkles, ChevronRight, Hash, Search, Zap, Trash2, CheckCircle, Circle, Globe, CheckCircle2, Edit3, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import * as ai from '../utils/aiAdapter.ts';

const GoalsPage: React.FC = () => {
  const { goals, addGoal, updateGoal, deleteGoal, toggleGoalStatus, notes, setNoteStatus } = useNotes();
  const navigate = useNavigate();
  const [showAdd, setShowAdd] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    if (isEditing && selectedGoalId) {
      const existing = goals.find(g => g.id === selectedGoalId);
      if (existing) {
        await updateGoal({ ...existing, title: newTitle, description: newDesc });
      }
    } else {
      await addGoal(newTitle, newDesc);
    }
    setNewTitle('');
    setNewDesc('');
    setShowAdd(false);
    setIsEditing(false);
  };

  const handleEdit = (goal: any) => {
    setNewTitle(goal.title);
    setNewDesc(goal.description);
    setIsEditing(true);
    setShowAdd(true);
  };

  const selectedGoal = useMemo(() => goals.find(g => g.id === selectedGoalId), [goals, selectedGoalId]);

  // Улучшенный поиск связей
  const linkedNotes = useMemo(() => {
    if (!selectedGoal) return [];
    // Извлекаем ключевые слова (длиной более 2 символов для русского языка)
    const titleKeywords = selectedGoal.title.toLowerCase().split(/[\s,.]+/).filter(k => k.length > 2);
    const descKeywords = selectedGoal.description.toLowerCase().split(/[\s,.]+/).filter(k => k.length > 2);
    const keywords = [...new Set([...titleKeywords, ...descKeywords])];
    
    return notes.filter(n => {
      if (n.status === 'trash') return false;
      const content = (n.content + ' ' + n.title).toLowerCase();
      const hasKeyword = keywords.some(k => content.includes(k));
      const hasTagMatch = n.tags.some(t => keywords.some(k => t.toLowerCase().includes(k)));
      return hasKeyword || hasTagMatch;
    }).slice(0, 15);
  }, [selectedGoal, notes]);

  const handleMarkAsDone = (e: React.MouseEvent, noteId: string) => {
    e.stopPropagation(); // Чтобы не переходить в редактор при клике на галочку
    setNoteStatus(noteId, 'finished');
  };

  return (
    <div className="p-6 md:p-12 max-w-7xl mx-auto min-h-screen animate-in fade-in duration-500 pb-32">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between mb-12 md:mb-16 bg-[var(--card-bg)] p-8 md:p-14 rounded-[3rem] md:rounded-[4rem] border border-[var(--border-color)] shadow-2xl shadow-blue-500/5 backdrop-blur-3xl overflow-hidden relative mt-16 md:mt-0">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div className="relative z-10 w-full text-left">
          <div className="flex items-center gap-3 text-blue-600 font-black text-[11px] uppercase tracking-[0.4em] mb-4">
            <Target size={18} /> Strategic Brain
          </div>
          <h2 className="text-4xl md:text-7xl font-black dark:text-white tracking-[-0.04em] leading-none">Карта Целей</h2>
        </div>
        <button 
          onClick={() => setShowAdd(true)}
          className="btn-primary flex items-center justify-center gap-4 relative z-10 mt-8 md:mt-0 w-full md:w-auto"
        >
          <Plus size={22}/> Поставить цель
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-4 space-y-6">
           {goals.length === 0 && (
             <div className="p-16 border-4 border-dashed border-gray-100 dark:border-slate-800 rounded-[3rem] text-center opacity-40">
                <Target size={64} className="mx-auto mb-6 text-gray-300" />
                <p className="font-black text-xs uppercase tracking-widest text-gray-400">Никаких целей не обнаружено</p>
             </div>
           )}
           {goals.map(goal => (
             <motion.div 
               layout
               key={goal.id} 
               onClick={() => setSelectedGoalId(goal.id)}
               className={`p-8 rounded-[3rem] border-2 cursor-pointer transition-all group relative ${
                 selectedGoalId === goal.id 
                 ? 'bg-blue-600 border-blue-600 text-white shadow-2xl shadow-blue-600/30 -translate-y-2' 
                 : 'bg-[var(--card-bg)] border-[var(--border-color)] hover:border-blue-400/50'
               }`}
             >
                 <div className="flex items-center justify-between mb-6">
                  <button 
                    onClick={(e) => { e.stopPropagation(); toggleGoalStatus(goal.id); }}
                    className={`p-3 rounded-2xl transition-all ${goal.status === 'completed' ? 'bg-green-500 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-400'}`}
                  >
                    {goal.status === 'completed' ? <CheckCircle size={20}/> : <Circle size={20}/>}
                  </button>
                  <div className="flex gap-1.5">
                    <button 
                      onClick={(e) => { e.stopPropagation(); ai.openInGoogle(goal.title); }} 
                      title="Искать тему цели в Google"
                      className={`p-3 rounded-xl transition-all ${selectedGoalId === goal.id ? 'hover:bg-blue-700 text-white/90' : 'hover:bg-blue-50 text-blue-500'}`}
                    >
                      <Globe size={16}/>
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleEdit(goal); }} 
                      title="Редактировать"
                      className={`p-3 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity ${selectedGoalId === goal.id ? 'hover:bg-blue-700 text-white' : 'hover:bg-blue-50 text-blue-500'}`}
                    >
                      <Edit3 size={18}/>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); deleteGoal(goal.id); }} title="Удалить" className={`p-3 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity ${selectedGoalId === goal.id ? 'hover:bg-blue-700 text-white' : 'hover:bg-red-50 text-red-500'}`}>
                      <Trash2 size={18}/>
                    </button>
                  </div>
                </div>
                <h3 className={`text-2xl font-black tracking-tight leading-tight ${goal.status === 'completed' ? 'line-through opacity-50' : ''}`}>{goal.title}</h3>
                <p className={`text-xs mt-3 line-clamp-2 leading-relaxed ${selectedGoalId === goal.id ? 'text-blue-100' : 'text-gray-400'}`}>{goal.description}</p>
             </motion.div>
           ))}
        </div>

        <div className="lg:col-span-8">
           {selectedGoal ? (
             <div className="space-y-8 animate-in slide-in-from-right duration-500">
                <div className="bg-white dark:bg-slate-900 p-12 rounded-[4rem] border border-gray-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
                   {selectedGoal.status === 'completed' && (
                       <div className="absolute top-10 right-10 text-green-500/20 rotate-12">
                           <CheckCircle2 size={120} />
                       </div>
                   )}
                   <div className="flex items-center gap-4 mb-6 relative z-10">
                      <button onClick={() => ai.openInGoogle(selectedGoal.title)} className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-2xl hover:scale-110 transition-all" title="Найти в Google">
                        <Globe size={24}/>
                      </button>
                      <h3 className="text-4xl font-black dark:text-white tracking-tight leading-tight">{selectedGoal.title}</h3>
                   </div>
                   <p className="text-gray-500 dark:text-slate-400 leading-relaxed text-lg max-w-2xl relative z-10">{selectedGoal.description}</p>
                   <div className="mt-12 flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-blue-500">
                     <Sparkles size={18}/> Связанные знания (поиск по смыслу)
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   {linkedNotes.map(note => (
                     <div 
                       key={note.id} 
                       onClick={() => navigate(`/editor/${note.id}`)}
                       className={`p-8 rounded-[3rem] border transition-all group cursor-pointer relative flex flex-col ${
                         note.status === 'finished' 
                         ? 'bg-green-50/30 dark:bg-green-900/10 border-green-500/30' 
                         : 'bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800 hover:border-blue-400 hover:shadow-xl'
                       }`}
                     >
                        <div className="flex items-center justify-between mb-4">
                            <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-lg ${
                              note.status === 'finished' ? 'bg-green-100 text-green-600' : 'bg-gray-50 dark:bg-slate-800 text-gray-400'
                            }`}>
                                {note.category}
                            </span>
                            
                            <div className="flex items-center gap-2">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const query = [note.title, note.category].filter(Boolean).join(' ');
                                    ai.openInGoogle(query || note.title);
                                  }}
                                  title="Искать тему заметки в Google"
                                  className="p-3 bg-white dark:bg-slate-800 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-2xl transition-all shadow-sm border border-gray-100 dark:border-white/5 active:scale-90"
                                >
                                  <Globe size={18} />
                                </button>
                                {/* Кнопка "Готово" - ЗЕЛЕНАЯ ГАЛОЧКА */}
                                {note.status !== 'finished' ? (
                                    <button 
                                        onClick={(e) => handleMarkAsDone(e, note.id)}
                                        className="p-3 bg-white dark:bg-slate-800 text-gray-300 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-2xl transition-all shadow-sm border border-gray-100 dark:border-white/5 active:scale-90"
                                        title="Пометить как сделанное"
                                    >
                                        <CheckCircle size={22} />
                                    </button>
                                ) : (
                                    <div className="p-3 bg-green-500 text-white rounded-2xl shadow-lg shadow-green-500/20">
                                        <CheckCircle2 size={22} />
                                    </div>
                                )}
                            </div>
                        </div>
                        <h4 className={`font-black text-xl dark:text-white group-hover:text-blue-600 transition-colors line-clamp-2 tracking-tight ${note.status === 'finished' ? 'line-through opacity-50' : ''}`}>
                            {note.title}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-3 line-clamp-3 leading-relaxed flex-1">{note.content}</p>
                        
                        {note.status === 'finished' && (
                          <div className="mt-4 text-[9px] font-black text-green-600 uppercase tracking-widest flex items-center gap-2">
                             <CheckCircle size={12}/> Завершено
                          </div>
                        )}
                     </div>
                   ))}
                   {linkedNotes.length === 0 && (
                     <div className="col-span-2 py-24 bg-gray-50/50 dark:bg-slate-950/50 rounded-[4rem] text-center italic text-gray-400 border-4 border-dashed border-gray-100 dark:border-slate-900">
                       <Search size={32} className="mx-auto mb-4 opacity-20" />
                       Связей пока не обнаружено. Опишите детали цели подробнее.
                     </div>
                   )}
                </div>
             </div>
           ) : (
             <div className="h-full flex flex-col items-center justify-center p-20 text-center space-y-8 opacity-20 grayscale scale-110">
                <Target size={160} className="animate-pulse text-blue-500" />
                <h3 className="text-3xl font-black uppercase tracking-[0.4em]">Выберите цель из списка</h3>
             </div>
           )}
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl z-[150] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[4rem] p-16 shadow-2xl border border-white/10">
            <h3 className="text-4xl font-black dark:text-white uppercase tracking-tighter mb-10">
              {isEditing ? 'Корректировка курса' : 'Новая вершина'}
            </h3>
            <div className="space-y-8">
               <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Как назовем?</label>
                  <input 
                    className="w-full p-6 bg-gray-50 dark:bg-slate-950 border-none rounded-[2rem] font-black text-xl dark:text-white shadow-inner outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                    placeholder="Например: Выучить Rust за 30 дней"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                  />
               </div>
               <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Описание (поможет ИИ найти связи)</label>
                  <textarea 
                    className="w-full h-40 p-6 bg-gray-50 dark:bg-slate-950 border-none rounded-[2rem] font-medium resize-none dark:text-white shadow-inner leading-relaxed outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                    placeholder="Какие шаги нужно предпринять? Какие ключевые слова важны?"
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                  />
               </div>
            </div>
            <div className="flex gap-4 mt-12">
               <button 
                onClick={() => { setShowAdd(false); setIsEditing(false); setNewTitle(''); setNewDesc(''); }} 
                className="flex-1 py-6 bg-gray-100 dark:bg-slate-800 rounded-[2rem] font-black uppercase text-[10px] tracking-widest dark:text-white active:scale-95 transition-all"
               >
                 Отмена
               </button>
               <button onClick={handleAdd} className="flex-1 py-6 bg-blue-600 text-white rounded-[2rem] font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all">
                 {isEditing ? 'Сохранить изменения' : 'Сформулировать'}
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoalsPage;

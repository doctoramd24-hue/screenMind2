import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotes } from '../contexts/NotesContext.tsx';
import { 
  Send, Loader2, Mic, X, Hash, BarChart3, Zap, 
  PlayCircle, Download, Plus, Tag as TagIcon, Folder, Check
} from 'lucide-react';
import { getTagColor } from '../utils/tagColors.ts';
import AudioRecorder from './AudioRecorder.tsx';
import { motion, AnimatePresence } from 'motion/react';

interface QuickIdeasPanelProps {
  className?: string;
}

const QuickIdeasPanel: React.FC<QuickIdeasPanelProps> = ({ className = '' }) => {
  const { addNote, notes, settings, setFilterTag, setFilterCategory, exportToMarkdown } = useNotes();
  const navigate = useNavigate();
  
  const [idea, setIdea] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Идеи');
  const [isSaving, setIsSaving] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const [isTagsDropdownOpen, setIsTagsDropdownOpen] = useState(false);

  const activeNotes = useMemo(() => notes.filter(n => n.status !== 'trash'), [notes]);

  const activeTags = useMemo(() => {
    const counts: Record<string, number> = {};
    activeNotes.forEach(n => n.tags.forEach(t => counts[t] = (counts[t] || 0) + 1));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [activeNotes]);

  const topTags = useMemo(() => activeTags.slice(0, 10), [activeTags]);

  const stats = useMemo(() => ({
    total: activeNotes.length,
    inWork: activeNotes.filter(n => n.status === 'in-work').length,
    finished: activeNotes.filter(n => n.status === 'finished').length,
  }), [activeNotes]);

  const handleAddTag = (rawTag: string) => {
    const cleanTag = rawTag.trim().replace(/^#/, '').toLowerCase();
    if (!cleanTag) return;
    if (!selectedTags.includes(cleanTag)) {
      setSelectedTags(prev => [...prev, cleanTag]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setSelectedTags(prev => prev.filter(t => t !== tagToRemove));
  };

  const toggleTag = (tag: string) => {
    const clean = tag.trim().toLowerCase();
    if (selectedTags.includes(clean)) {
      handleRemoveTag(clean);
    } else {
      setSelectedTags(prev => [...prev, clean]);
    }
  };

  const handleSaveIdea = async () => {
    if (!idea.trim()) return;
    setIsSaving(true);
    try {
      await addNote(
        idea, 
        undefined, 
        'manual', 
        true, 
        selectedCategory, 
        undefined, 
        selectedTags
      );
      setIdea('');
      setSelectedTags([]);
      setTagInput('');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ x: 320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 320, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className={`w-80 bg-white dark:bg-[#080c14] border-l border-gray-100 dark:border-slate-800 h-screen flex flex-col shrink-0 z-10 relative ${className}`}
    >
      {/* Quick Input Section */}
      <div className="p-6 border-b border-gray-50 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-[10px] uppercase tracking-[0.3em] text-gray-400 flex items-center gap-2">
            <Zap size={14} className="text-amber-500" /> Быстрый Ввод
          </h3>
          <div className="flex gap-1.5">
            <button 
              onClick={exportToMarkdown}
              title="Экспорт в Markdown"
              className="p-2.5 text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl hover:scale-110 active:scale-95 transition-all shadow-sm"
            >
              <Download size={16} />
            </button>
            <button 
              onClick={() => setShowRecorder(true)} 
              title="Голосовая заметка"
              className="p-2.5 text-blue-600 bg-blue-50 dark:bg-blue-500/10 rounded-xl hover:scale-110 active:scale-95 transition-all shadow-sm"
            >
              <Mic size={16} />
            </button>
          </div>
        </div>

        {/* Note Textarea */}
        <div className="relative group">
          <textarea 
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="Запишите мысль или озарение..."
            className="w-full h-28 p-4 bg-gray-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-blue-500/10 text-sm font-bold text-gray-700 dark:text-slate-200 placeholder:text-gray-400 dark:placeholder:text-slate-500 resize-none transition-all shadow-inner outline-none"
          />
        </div>

        {/* Category & Tag Selection Area */}
        <div className="space-y-3 pt-1">
          {/* Category Dropdown */}
          <div className="flex items-center gap-2">
            <Folder size={13} className="text-blue-500 shrink-0" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="flex-1 bg-gray-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-[11px] font-bold text-slate-700 dark:text-slate-200 rounded-xl px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="Идеи">💡 Идеи</option>
              <option value="Общее">📁 Общее</option>
              <option value="Цели">🎯 Цели</option>
              {settings.customCategories
                .filter(c => c !== 'Общее' && c !== 'Идеи' && c !== 'Цели')
                .map(cat => (
                  <option key={cat} value={cat}>📂 {cat}</option>
                ))}
            </select>
          </div>

          {/* Tag Input Field */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <TagIcon size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      handleAddTag(tagInput);
                    }
                  }}
                  placeholder="Добавить тег (+ Enter)"
                  className="w-full pl-8 pr-2 py-1.5 bg-gray-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-xl text-[11px] font-bold text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <button
                type="button"
                onClick={() => handleAddTag(tagInput)}
                disabled={!tagInput.trim()}
                className="p-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white rounded-xl transition-all disabled:opacity-40"
                title="Прикрепить тег"
              >
                <Plus size={14} />
              </button>
            </div>

            {/* Selected Tags Chips */}
            {selectedTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto custom-scrollbar p-1">
                {selectedTags.map(tag => {
                  const colors = getTagColor(tag);
                  return (
                    <motion.span
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      key={tag}
                      style={{ backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-tight border shadow-xs"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:opacity-75 p-0.5"
                      >
                        <X size={10} />
                      </button>
                    </motion.span>
                  );
                })}
              </div>
            )}

            {/* Quick-pick Popular Tags */}
            <div className="pt-1">
              <div className="flex items-center justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                <span>Быстрый выбор тегов</span>
                {topTags.length > 0 && (
                  <button 
                    onClick={() => setIsTagsDropdownOpen(!isTagsDropdownOpen)}
                    className="text-blue-500 hover:underline"
                  >
                    {isTagsDropdownOpen ? 'Скрыть' : 'Все'}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto custom-scrollbar">
                {(isTagsDropdownOpen ? activeTags : topTags.slice(0, 6)).map(([tag]) => {
                  const isSelected = selectedTags.includes(tag.toLowerCase());
                  const colors = getTagColor(tag);
                  return (
                    <button
                      type="button"
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      style={{ 
                        backgroundColor: isSelected ? colors.border : undefined,
                        borderColor: colors.border,
                        color: isSelected ? '#ffffff' : colors.text
                      }}
                      className={`px-2 py-0.5 rounded-md text-[9px] font-black tracking-tight border transition-all flex items-center gap-1 ${
                        isSelected 
                          ? 'shadow-sm scale-105' 
                          : 'bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {isSelected ? <Check size={8} /> : <Hash size={8} />}
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <motion.button 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSaveIdea}
          disabled={isSaving || !idea.trim()}
          className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition-all font-black text-xs uppercase tracking-widest disabled:opacity-40"
        >
          {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          <span>Сохранить мысль</span>
        </motion.button>
      </div>

      {/* Popular Nodes Navigation */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
        <section>
          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
            <Hash size={12} className="text-cyan-500" /> Популярные узлы
          </h4>
          <div className="flex flex-wrap gap-2">
            {topTags.map(([tag, count]) => {
              const colors = getTagColor(tag);
              return (
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  key={tag} 
                  onClick={() => { setFilterTag(tag); navigate('/'); }}
                  style={{ color: colors.text, backgroundColor: colors.bg, borderColor: colors.border }} 
                  className="px-3 py-1.5 rounded-xl transition-all flex items-center gap-2 border shadow-xs"
                >
                  <span className="text-[10px] font-black">#{tag}</span>
                  <span className="text-[8px] font-black opacity-60">{count}</span>
                </motion.button>
              );
            })}
          </div>
        </section>
      </div>

      {/* Global Quick Stats */}
      <div className="p-6 bg-gray-50/50 dark:bg-[#06080c] border-t border-gray-100 dark:border-slate-800">
        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
          <BarChart3 size={14} className="text-cyan-500" /> Статистика
        </h4>
        <div className="space-y-2.5">
          <motion.div 
            whileHover={{ x: 4 }} 
            onClick={() => { setFilterCategory(null); setFilterTag(null); navigate('/'); }} 
            className="flex items-center justify-between p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-white/5 cursor-pointer hover:border-blue-500 transition-all shadow-xs"
          >
            <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Всего</span>
            <span className="text-lg font-black dark:text-white tabular-nums">{stats.total}</span>
          </motion.div>
          <motion.div 
            whileHover={{ x: 4 }} 
            onClick={() => { setFilterCategory(null); setFilterTag(null); navigate('/'); }} 
            className="flex items-center justify-between p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-white/5 cursor-pointer hover:border-amber-500 transition-all shadow-xs"
          >
            <div className="flex items-center gap-2">
              <PlayCircle size={14} className="text-amber-500"/>
              <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">В работе</span>
            </div>
            <span className="text-lg font-black dark:text-white tabular-nums">{stats.inWork}</span>
          </motion.div>
          <motion.div 
            whileHover={{ x: 4 }} 
            onClick={() => { setFilterCategory(null); setFilterTag(null); navigate('/'); }} 
            className="flex items-center justify-between p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-white/5 cursor-pointer hover:border-green-500 transition-all shadow-xs"
          >
            <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">Готово</span>
            <span className="text-lg font-black dark:text-white tabular-nums">{stats.finished}</span>
          </motion.div>
        </div>
      </div>

      {/* Voice Recorder Modal */}
      <AnimatePresence>
        {showRecorder && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-slate-950/40 dark:bg-slate-950/70 backdrop-blur-xl flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="relative max-w-xl w-full"
            >
              <button 
                onClick={() => setShowRecorder(false)} 
                className="absolute -top-6 -right-6 bg-white dark:bg-slate-800 p-3 rounded-full text-gray-400 hover:text-red-500 shadow-2xl transition-colors border border-white/10"
              >
                <X size={24}/>
              </button>
              <AudioRecorder onComplete={() => setShowRecorder(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default QuickIdeasPanel;

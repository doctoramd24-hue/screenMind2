
import React, { useState, useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  Plus, Share2, MessageSquare, Settings as SettingsIcon, 
  BookOpen, BrainCircuit, Lightbulb, Sun, Moon, 
  Trash2, X, Hash, Sparkles, Send, ScanLine, Target, Bot, Mic, Menu, FileUp, BarChart3
} from 'lucide-react';
import { useNotes } from '../contexts/NotesContext.tsx';
import { getTagColor } from '../utils/tagColors.ts';
import AudioRecorder from './AudioRecorder.tsx';
import { motion, AnimatePresence } from 'motion/react';

interface SidebarProps {
    collapsed?: boolean;
    onToggle?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const { updateSettings, settings, notes, goals, setFilterTag, telegramMessages, addNote, addLog } = useNotes();
  const [showTags, setShowTags] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const navigate = useNavigate();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsImporting(true);
    try {
      const text = await file.text();
      const title = file.name.split('.')[0];
      await addNote(text, title, 'manual', true);
      addLog('success', `Документ "${file.name}" импортирован`);
      navigate('/');
    } catch (err: any) {
      addLog('error', 'Ошибка импорта', err.message);
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };
  
  const navItems = [
    { to: '/dashboard', icon: BarChart3, label: 'Аналитика' },
    { to: '/', icon: BookOpen, label: 'Библиотека' },
    { to: '/ocr', icon: ScanLine, label: 'OCR Скан' },
    { to: '/goals', icon: Target, label: 'Цели' },
    { to: '/agent', icon: Bot, label: 'Ассистент' },
    { to: '/telegram', icon: Send, label: 'Telegram', count: telegramMessages.length },
    { to: '/ideas', icon: Lightbulb, label: 'Инкубатор' },
    { to: '/graph', icon: Share2, label: 'Граф' },
    { to: '/chat', icon: MessageSquare, label: 'AI Чат' },
    { to: '/trash', icon: Trash2, label: 'Корзина' },
    { to: '/settings', icon: SettingsIcon, label: 'Система' }
  ];

  const trashCount = notes.filter(n => n.status === 'trash').length;

  const toggleTheme = () => {
    updateSettings({ ...settings, theme: settings.theme === 'light' ? 'dark' : 'light' });
  };

  const allTags = useMemo(() => {
    const counts: Record<string, number> = {};
    notes.filter(n => n.status !== 'trash').forEach(n => {
      n.tags.forEach(t => counts[t] = (counts[t] || 0) + 1);
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [notes]);

  const handleTagClick = (tag: string) => {
    setFilterTag(tag);
    setShowTags(false);
    setIsMobileOpen(false);
    navigate('/');
  };

  const sidebarContent = (
    <div className={`h-full flex flex-col bg-[var(--card-bg)] border-r border-[var(--border-color)] transition-all duration-500 ease-in-out ${collapsed ? 'w-24' : 'w-full md:w-80'}`}>
      <div className="md:hidden flex justify-end p-4 border-b border-[var(--border-color)]">
          <button onClick={() => setIsMobileOpen(false)} className="p-3 text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <X size={20} />
          </button>
      </div>
      <div 
        className={`p-8 mb-4 cursor-pointer group active:scale-95 transition-all ${collapsed ? 'px-6' : 'px-8'}`}
        onClick={() => { setShowTags(true); setIsMobileOpen(false); }}
      >
        <div className="flex items-center gap-3">
          <motion.div 
            whileHover={{ rotate: 15 }}
            className={`bg-blue-600 rounded-[1.2rem] flex items-center justify-center text-white shadow-2xl shadow-blue-500/40 transition-all ${collapsed ? 'w-12 h-12' : 'w-10 h-10'}`}
          >
            <BrainCircuit size={collapsed ? 28 : 22} />
          </motion.div>
          {!collapsed && (
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
                <h1 className="text-lg font-black text-slate-900 dark:text-white tracking-tight leading-none">ScreenMind</h1>
                <span className="text-[9px] font-black text-blue-600 uppercase tracking-[0.2em] flex items-center gap-1 mt-1">
                  v1.0 Ultra <Sparkles size={8} className="animate-pulse" />
                </span>
              </motion.div>
          )}
        </div>
      </div>
      
      <div className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => { setFilterTag(null); setIsMobileOpen(false); }}
            className={({ isActive }) =>
              `flex items-center group relative transition-all ${
                collapsed ? 'justify-center py-4' : 'justify-between px-4 py-3'
              } rounded-xl ${
                isActive 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-900/50'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className="flex items-center gap-3">
                  <item.icon size={collapsed ? 22 : 18} className={`${isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-500'} transition-colors`} />
                  {!collapsed && <span className="font-bold text-[11px] uppercase tracking-wider">{item.label}</span>}
                </div>
                {!collapsed && (
                    item.count ? (
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${isActive ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-600'}`}>{item.count}</span>
                    ) : item.to === '/trash' && trashCount > 0 ? (
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${isActive ? 'bg-white/20 text-white' : 'bg-red-100 text-red-500'}`}>{trashCount}</span>
                    ) : null
                )}
                {collapsed && (
                  <div className="absolute left-full ml-4 px-3 py-2 bg-slate-900 text-white text-[10px] font-black uppercase rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[100] shadow-2xl">
                    {item.label}
                  </div>
                )}
              </>
            )}
          </NavLink>
        ))}

        <div className="mt-8 px-4">
           <h4 className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-4">Топ целей</h4>
           <div className="space-y-2">
             {goals.slice(0, 2).map(g => (
               <motion.div 
                 whileHover={{ x: 4 }}
                 key={g.id} 
                 onClick={() => { navigate('/goals'); setIsMobileOpen(false); }} 
                 className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-900 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors"
               >
                  <span className="text-[10px] font-black truncate max-w-[120px] dark:text-slate-300">{g.title}</span>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: g.color }} />
               </motion.div>
             ))}
           </div>
        </div>
      </div>

      <div className="p-6 space-y-3">
        <div className="flex gap-2">
            <input 
              type="file" 
              id="doc-import" 
              className="hidden" 
              accept=".txt,.md,.json" 
              onChange={handleFileUpload} 
            />
            <label 
              htmlFor="doc-import"
              className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl border border-gray-100 dark:border-slate-900 text-gray-500 dark:text-slate-500 hover:bg-gray-50 dark:hover:bg-slate-900 transition-all cursor-pointer"
            >
              <FileUp size={18} className={isImporting ? 'animate-bounce' : ''} />
            </label>
            <button 
              onClick={toggleTheme}
              className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl border border-gray-100 dark:border-slate-900 text-gray-500 dark:text-slate-500 hover:bg-gray-50 dark:hover:bg-slate-900 transition-all"
            >
              {settings.theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button 
              onClick={() => setShowRecorder(true)}
              className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl border border-blue-100 dark:border-blue-900/30 text-blue-600 hover:bg-blue-50 transition-all"
            >
              <Mic size={18} />
            </button>
        </div>
        
        <motion.button 
           whileHover={{ scale: 1.02 }}
           whileTap={{ scale: 0.98 }}
           onClick={() => { navigate('/editor/new'); setIsMobileOpen(false); }}
           className="w-full flex items-center justify-center gap-3 bg-blue-600 text-white py-4 rounded-2xl hover:bg-blue-700 transition-all shadow-xl"
        >
          <Plus size={20} />
          <span className="font-black text-[10px] uppercase tracking-widest">Создать</span>
        </motion.button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Toggle */}
      <button 
        onClick={() => setIsMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-[100] p-3 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-100 dark:border-white/5"
      >
        <Menu size={24} />
      </button>

      {/* Desktop Sidebar */}
      <aside className={`hidden lg:block h-screen shrink-0 z-50 transition-all duration-500 ease-in-out ${collapsed ? 'w-24' : 'w-64 md:w-80'}`}>
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileOpen(false)}
              className="lg:hidden fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[110]"
            />
            <motion.aside 
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="lg:hidden fixed top-0 left-0 w-72 h-screen z-[120] shadow-2xl"
            >
              {sidebarContent}
              <button 
                onClick={() => setIsMobileOpen(false)}
                className="absolute top-4 -right-12 p-2 bg-white dark:bg-slate-800 rounded-full text-gray-500"
              >
                <X size={20} />
              </button>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {showRecorder && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl z-[200] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="relative max-w-xl w-full"
            >
              <button onClick={() => setShowRecorder(false)} className="absolute -top-6 -right-6 p-3 bg-white dark:bg-slate-800 rounded-full shadow-2xl text-gray-400 hover:text-red-500 z-[210] border border-white/10"><X size={24}/></button>
              <AudioRecorder onComplete={() => setShowRecorder(false)} />
            </motion.div>
          </motion.div>
        )}

        {showTags && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl z-[100] flex items-center justify-center p-12"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="max-w-4xl w-full"
            >
              <div className="flex items-center justify-between mb-12">
            <h2 className="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Навигация по тегам</h2>
                <button onClick={() => setShowTags(false)} className="p-3 bg-red-50 text-red-500 rounded-full hover:bg-red-100 transition-all">
                  <X size={32}/>
                </button>
              </div>
              <div className="flex flex-wrap gap-4">
                {allTags.map(([tag, count]) => {
                  const colors = getTagColor(tag);
                  return (
                    <motion.button 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      key={tag}
                      onClick={() => handleTagClick(tag)}
                      style={{ backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }}
                      className="px-8 py-4 rounded-[2rem] text-sm font-black uppercase tracking-widest flex items-center gap-3 border-2 shadow-lg"
                    >
                      <Hash size={16} /> {tag} <span className="opacity-30 ml-2">{count}</span>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;

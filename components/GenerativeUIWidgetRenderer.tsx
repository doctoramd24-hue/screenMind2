import React from 'react';
import { GenerativeUIWidget } from '../types.ts';
import { FileText, Target, CheckCircle2, Search, Database, Tag, ArrowRight, Globe } from 'lucide-react';
import { motion } from 'motion/react';
import * as ai from '../utils/aiAdapter.ts';

interface Props {
  widget: GenerativeUIWidget;
  onNavigateToNote?: (noteId: string) => void;
}

export const GenerativeUIWidgetRenderer: React.FC<Props> = ({ widget, onNavigateToNote }) => {
  const { type, title, data } = widget;

  switch (type) {
    case 'note_card':
      return (
        <motion.div 
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-3 p-4 bg-gradient-to-br from-blue-50/80 to-indigo-50/50 dark:from-slate-800 dark:to-blue-950/30 border border-blue-200/70 dark:border-blue-900/50 rounded-2xl shadow-xs"
        >
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-xs mb-2">
            <FileText size={16} />
            <span>{title || 'Заметка сохранена'}</span>
            <span className="ml-auto text-[10px] px-2 py-0.5 bg-blue-100 dark:bg-blue-900/60 rounded-full font-black uppercase">
              {data.category || 'Общее'}
            </span>
          </div>
          <h4 className="font-extrabold text-sm text-slate-800 dark:text-white mb-1.5">{data.title}</h4>
          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed mb-3 whitespace-pre-wrap">
            {data.content}
          </p>
          {data.tags && data.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {data.tags.map((tag: string, idx: number) => (
                <span key={idx} className="text-[10px] font-semibold text-blue-600 dark:text-blue-300 bg-white/80 dark:bg-slate-900 px-2 py-0.5 rounded-md border border-blue-100 dark:border-slate-800">
                  #{tag}
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between text-[11px] text-green-600 dark:text-green-400 font-bold pt-2 border-t border-blue-100 dark:border-slate-800">
            <span className="flex items-center gap-1">
              <CheckCircle2 size={13} /> Добавлено в базу знаний
            </span>
            <button
              onClick={() => {
                const query = [data.title, data.category, ...(data.tags || []).slice(0, 2)].filter(Boolean).join(' ');
                ai.openInGoogle(query || data.title);
              }}
              title="Поиск в Google по теме"
              className="flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline bg-blue-100/50 dark:bg-blue-900/40 px-2 py-0.5 rounded-md transition-colors"
            >
              <Globe size={11} />
              <span>Google</span>
            </button>
          </div>
        </motion.div>
      );

    case 'search_results':
      return (
        <motion.div 
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-3 p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2.5 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
              <Search size={15} className="text-blue-500" />
              <span>{title || 'Offline RAG результаты'}</span>
            </div>
            <span className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-full border border-blue-100 dark:border-blue-900">
              {data.count} найдено
            </span>
          </div>

          <div className="space-y-2">
            {data.results && data.results.map((res: any, idx: number) => (
              <div 
                key={idx}
                onClick={() => onNavigateToNote && onNavigateToNote(res.id)}
                className="p-3 bg-white dark:bg-slate-800/80 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 border border-slate-100 dark:border-slate-700 rounded-xl transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between text-xs font-bold mb-1">
                  <span className="text-slate-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {res.title}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        ai.openInGoogle(res.title);
                      }}
                      title="Искать в Google"
                      className="p-1 text-slate-400 hover:text-blue-600 rounded"
                    >
                      <Globe size={12} />
                    </button>
                    <span className="text-[10px] text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/40 px-1.5 py-0.5 rounded font-black">
                      {res.score}% совпадение
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                  {res.snippet}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      );

    case 'goal_card':
      return (
        <motion.div 
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-3 p-4 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl shadow-xs"
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs">
              <Target size={16} />
              <span>{title || 'Стратегическая цель добавлена'}</span>
            </div>
            <button
              onClick={() => ai.openInGoogle(data.title)}
              title="Искать в Google"
              className="flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 hover:underline bg-amber-100/50 dark:bg-amber-900/40 px-2 py-0.5 rounded-md"
            >
              <Globe size={11} />
              <span>Google</span>
            </button>
          </div>
          <h4 className="font-extrabold text-sm text-slate-800 dark:text-white">{data.title}</h4>
          {data.description && (
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
              {data.description}
            </p>
          )}
        </motion.div>
      );

    case 'stats_card':
      return (
        <motion.div 
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs"
        >
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500 mb-3">
            <Database size={15} className="text-blue-500"/>
            <span>{title || 'Телеметрия базы знаний'}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl">
              <div className="text-base font-black text-blue-600 dark:text-blue-400">{data.totalNotes}</div>
              <div className="text-[9px] font-bold text-slate-400 uppercase">Заметок</div>
            </div>
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl">
              <div className="text-base font-black text-amber-500">{data.totalGoals}</div>
              <div className="text-[9px] font-bold text-slate-400 uppercase">Целей</div>
            </div>
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl">
              <div className="text-base font-black text-green-500">{data.vectorChunks}</div>
              <div className="text-[9px] font-bold text-slate-400 uppercase">Векторов</div>
            </div>
          </div>
        </motion.div>
      );

    case 'action_confirm':
      return (
        <motion.div 
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-3 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/40 rounded-xl flex items-center gap-2 text-xs font-bold text-green-700 dark:text-green-300"
        >
          <CheckCircle2 size={16} className="text-green-600 shrink-0" />
          <span>{data?.message || title || 'Действие выполнено успешно'}</span>
        </motion.div>
      );

    default:
      return null;
  }
};

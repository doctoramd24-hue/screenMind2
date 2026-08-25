
import React from 'react';
import { useNotes } from '../contexts/NotesContext.tsx';
import { Trash2, RotateCcw, AlertCircle, Calendar } from 'lucide-react';

const TrashPage: React.FC = () => {
  const { notes, restoreNote, hardDelete } = useNotes();
  const deletedNotes = notes.filter(n => n.status === 'trash');

  return (
    <div className="p-12 max-w-5xl mx-auto min-h-screen">
      <header className="mb-12 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-red-500 font-black text-[10px] uppercase tracking-widest">
            <Trash2 size={14} /> Архив удаленного
          </div>
          <h2 className="text-4xl font-black dark:text-white mt-2">Корзина</h2>
        </div>
        {deletedNotes.length > 0 && (
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl flex items-center gap-4 border border-amber-100 dark:border-amber-900/30">
            <AlertCircle className="text-amber-500" size={20} />
            <p className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase leading-relaxed max-w-[200px]">
              Заметки здесь не анализируются ИИ и не попадают в граф.
            </p>
          </div>
        )}
      </header>

      {deletedNotes.length === 0 ? (
        <div className="py-32 flex flex-col items-center justify-center opacity-20 grayscale">
          <Trash2 size={64} className="mb-4" />
          <p className="text-xl font-black uppercase tracking-widest">Корзина пуста</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {deletedNotes.map(note => (
            <div key={note.id} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 flex items-center justify-between shadow-sm">
              <div className="space-y-1">
                <h3 className="font-extrabold text-gray-900 dark:text-white">{note.title}</h3>
                <div className="flex items-center gap-4 text-[10px] font-bold text-gray-400">
                  <span className="flex items-center gap-1"><Calendar size={12}/> {new Date(note.createdAt).toLocaleDateString()}</span>
                  <span className="uppercase tracking-widest">{note.category}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                    onClick={() => restoreNote(note.id)}
                    className="p-3 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 rounded-2xl hover:bg-blue-100 transition-colors flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
                >
                  <RotateCcw size={16}/> Восстановить
                </button>
                <button 
                    onClick={() => { if(confirm("Удалить навсегда? Это действие необратимо.")) hardDelete(note.id); }}
                    className="p-3 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 rounded-2xl hover:bg-red-100 transition-colors flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
                >
                  <Trash2 size={16}/> Очистить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TrashPage;

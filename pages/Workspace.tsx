
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNotes } from '../contexts/NotesContext.tsx';
import { useNavigate } from 'react-router-dom';
import { Maximize2, Move, Clock, Share2, ZoomIn, ZoomOut, Globe } from 'lucide-react';
import { getTagColor } from '../utils/tagColors.ts';
import * as ai from '../utils/aiAdapter.ts';

const Workspace: React.FC = () => {
  const { notes, updateNotePosition, updateNoteSize } = useNotes();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  
  const activeNotes = useMemo(() => notes.filter(n => n.status !== 'trash'), [notes]);
  
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    if ((e.target as HTMLElement).closest('.resize-handle')) {
        setResizingId(id);
        const note = notes.find(n => n.id === id);
        setOffset({ x: e.clientX, y: e.clientY });
        return;
    }
    setDraggingId(id);
    const note = notes.find(n => n.id === id);
    if (note?.position) {
      setOffset({ x: e.clientX - note.position.x * zoom, y: e.clientY - note.position.y * zoom });
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (draggingId) {
      updateNotePosition(draggingId, (e.clientX - offset.x) / zoom, (e.clientY - offset.y) / zoom);
    }
    if (resizingId) {
        const note = notes.find(n => n.id === resizingId);
        if (note?.size) {
            const dx = (e.clientX - offset.x) / zoom;
            const dy = (e.clientY - offset.y) / zoom;
            updateNoteSize(resizingId, Math.max(200, note.size.w + dx), Math.max(150, note.size.h + dy));
            setOffset({ x: e.clientX, y: e.clientY });
        }
    }
  };

  const handleMouseUp = () => {
    setDraggingId(null);
    setResizingId(null);
  };

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingId, resizingId, offset, zoom]);

  // Генерация связей (линий) между карточками
  const links = useMemo(() => {
    const result: { x1: number, y1: number, x2: number, y2: number, color: string }[] = [];
    for (let i = 0; i < activeNotes.length; i++) {
        for (let j = i + 1; j < activeNotes.length; j++) {
            const n1 = activeNotes[i];
            const n2 = activeNotes[j];
            const commonTags = n1.tags.filter(t => n2.tags.includes(t));
            if (commonTags.length > 0 || n1.category === n2.category) {
                if (n1.position && n2.position && n1.size && n2.size) {
                    result.push({
                        x1: n1.position.x + n1.size.w / 2,
                        y1: n1.position.y + n1.size.h / 2,
                        x2: n2.position.x + n2.size.w / 2,
                        y2: n2.position.y + n2.size.h / 2,
                        color: commonTags.length > 0 ? getTagColor(commonTags[0]).text : '#cbd5e1'
                    });
                }
            }
        }
    }
    return result;
  }, [activeNotes]);

  return (
    <div ref={containerRef} className="flex-1 h-screen relative overflow-hidden bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:40px_40px] transition-colors">
      <div className="absolute top-10 left-12 z-20 flex flex-col gap-4">
        <div>
            <h2 className="text-3xl font-black dark:text-white">Нейронное Поле</h2>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-2 flex items-center gap-2">
                <Share2 size={12} className="text-blue-500" /> Связи формируются автоматически
            </p>
        </div>
        <div className="flex gap-2">
            <button onClick={() => setZoom(z => Math.max(0.2, z - 0.1))} className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm hover:text-blue-500"><ZoomOut size={16}/></button>
            <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm hover:text-blue-500"><ZoomIn size={16}/></button>
        </div>
      </div>

      <div className="absolute inset-0 origin-top-left transition-transform duration-75" style={{ transform: `scale(${zoom})` }}>
        {/* SVG Layer for Links */}
        <svg className="absolute inset-0 pointer-events-none w-full h-full overflow-visible">
            {links.map((link, idx) => (
                <line 
                    key={idx}
                    x1={link.x1} y1={link.y1} x2={link.x2} y2={link.y2} 
                    stroke={link.color} strokeWidth="1" strokeOpacity="0.2"
                    strokeDasharray="5,5"
                />
            ))}
        </svg>

        {activeNotes.map(note => {
          const colors = getTagColor(note.category);
          return (
            <div
              key={note.id}
              onMouseDown={(e) => handleMouseDown(e, note.id)}
              style={{
                left: note.position?.x ?? 0,
                top: note.position?.y ?? 0,
                width: note.size?.w ?? 300,
                height: note.size?.h ?? 250,
                zIndex: draggingId === note.id ? 100 : 1
              }}
              className="absolute bg-white dark:bg-slate-900 rounded-[2rem] border border-gray-100 dark:border-slate-800 shadow-xl flex flex-col group cursor-grab active:cursor-grabbing transition-shadow hover:shadow-2xl overflow-hidden"
            >
              <div className="px-6 py-4 flex items-center justify-between border-b border-gray-50 dark:border-slate-800 shrink-0">
                <span style={{ color: colors.text, backgroundColor: colors.bg }} className="text-[8px] font-black uppercase px-2 py-0.5 rounded-md">
                    {note.category}
                </span>
                <div className="flex items-center gap-1">
                  <button 
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      const query = [note.title, note.category, ...(note.tags || []).slice(0, 2)].filter(Boolean).join(' ');
                      ai.openInGoogle(query || note.title || 'заметка');
                    }}
                    title="Искать тему в Google"
                    className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <Globe size={13} />
                  </button>
                  <button 
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => navigate(`/editor/${note.id}`)} 
                    title="Открыть редактор"
                    className="p-1.5 text-gray-300 hover:text-blue-500 rounded-lg transition-colors"
                  >
                    <Maximize2 size={14} />
                  </button>
                </div>
              </div>

              <div className="p-6 flex-1 overflow-hidden pointer-events-none select-none">
                <h3 className="font-extrabold text-sm mb-2 dark:text-white line-clamp-1">{note.title}</h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed line-clamp-4">{note.content}</p>
              </div>

              <div className="px-6 py-4 bg-gray-50/50 dark:bg-slate-800/50 flex items-center justify-between shrink-0">
                <div className="flex gap-1 overflow-hidden">
                    {note.tags.slice(0, 2).map(t => <span key={t} className="text-[8px] text-gray-400 font-bold whitespace-nowrap">#{t}</span>)}
                </div>
                <div className="flex items-center gap-2 text-[8px] font-black text-gray-300 uppercase tracking-widest whitespace-nowrap">
                    <Clock size={10}/> {new Date(note.createdAt).toLocaleDateString()}
                </div>
              </div>
              
              <div className="absolute bottom-1 right-1 cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity p-2 text-gray-300 resize-handle">
                <Maximize2 size={12} className="rotate-90" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Workspace;

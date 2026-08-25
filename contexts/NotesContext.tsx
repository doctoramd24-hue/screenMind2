
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Note, Settings, AIProvider, AppLog, NoteStatus, Goal, AIProfile, AIMetrics } from '../types.ts';
import * as storage from '../utils/storage.ts';
import * as ai from '../utils/aiAdapter.ts';

interface NotesContextType {
  notes: Note[];
  goals: Goal[];
  settings: Settings;
  profiles: AIProfile[];
  metrics: AIMetrics;
  isLoading: boolean;
  isIndexing: boolean;
  indexingProgress: number;
  logs: AppLog[];
  filterTag: string | null;
  filterCategory: string | null;
  telegramMessages: any[]; 
  setFilterTag: (tag: string | null) => void;
  setFilterCategory: (cat: string | null) => void;
  addNote: (content: string, title?: string, sourceType?: Note['sourceType'], useAI?: boolean, category?: string, audioData?: string, initialTags?: string[]) => Promise<void>;
  processLargeText: (text: string) => Promise<void>;
  updateNote: (note: Note) => Promise<void>;
  moveToTrash: (id: string) => Promise<void>;
  restoreNote: (id: string) => Promise<void>;
  hardDelete: (id: string) => Promise<void>;
  setNoteStatus: (id: string, status: NoteStatus) => Promise<void>;
  updateSettings: (s: Settings) => Promise<void>;
  addLog: (level: AppLog['level'], message: string, details?: string) => void;
  runAIAnalysis: (id: string) => Promise<void>;
  reanalyzeAll: () => Promise<void>;
  runSystemCheck: () => Promise<void>;
  updateNotePosition: (id: string, x: number, y: number) => Promise<void>;
  updateNoteSize: (id: string, w: number, h: number) => Promise<void>;
  syncTelegram: () => Promise<void>;
  deleteTelegramMsg: (id: number) => void;
  // Goals
  addGoal: (title: string, description: string) => Promise<void>;
  updateGoal: (goal: Goal) => Promise<void>;
  toggleGoalStatus: (id: string) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  // Categories
  addCategory: (name: string) => Promise<void>;
  deleteCategory: (name: string) => Promise<void>;
  // Ideas Grouping
  autoGroupIdeas: () => Promise<void>;
  // Profiles
  createProfile: (name: string) => Promise<void>;
  switchProfile: (id: string) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  // Cache & Backup
  clearSystemCache: () => void;
  triggerBackup: () => Promise<void>;
  importBackup: (file: File) => Promise<void>;
  exportToMarkdown: () => Promise<void>;
}

const NotesContext = createContext<NotesContextType | undefined>(undefined);

import JSZip from 'jszip';

export const NotesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [settings, setSettings] = useState<Settings>(storage.getDefaultSettings());
  const [profiles, setProfiles] = useState<AIProfile[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexingProgress, setIndexingProgress] = useState(0);
  const [telegramMessages, setTelegramMessages] = useState<any[]>([]);
  const [logs, setLogs] = useState<AppLog[]>([]);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<AIMetrics>(ai.getMetrics());

  const addLog = useCallback((level: AppLog['level'], message: string, details?: string) => {
    const newLog: AppLog = { id: crypto.randomUUID(), timestamp: new Date().toISOString(), level, message, details };
    setLogs(prev => [newLog, ...prev].slice(0, 500));
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const [n, s, g, p] = await Promise.all([
            storage.getNotes(), 
            storage.getSettings(), 
            storage.getGoals(),
            storage.getProfiles()
        ]);
        setNotes(n || []);
        setSettings(s || storage.getDefaultSettings());
        setGoals(g || []);
        setProfiles(p || []);
        const isDark = (s || storage.getDefaultSettings()).theme === 'dark';
        document.documentElement.classList.toggle('dark', isDark);
        document.body.classList.toggle('dark', isDark);
      } catch (err) {
        addLog('error', 'Storage init failed', String(err));
      } finally {
        setIsLoading(false);
      }
    };
    init();

    // Metrics Polling & Auto Backup interval
    const interval = setInterval(() => {
        setMetrics({...ai.getMetrics()});
        // Simple auto-backup check could go here
    }, 2000);

    return () => clearInterval(interval);
  }, [addLog]);

  // --- Profiles Logic ---
  const createProfile = async (name: string) => {
      const newProfile: AIProfile = {
          id: crypto.randomUUID(),
          name,
          settings: { ...settings },
          createdAt: new Date().toISOString()
      };
      const updatedProfiles = [...profiles, newProfile];
      setProfiles(updatedProfiles);
      await storage.saveProfiles(updatedProfiles);
      addLog('success', `Profile "${name}" created`);
  };

  const switchProfile = async (id: string) => {
      const profile = profiles.find(p => p.id === id);
      if(profile) {
          await updateSettings(profile.settings);
          addLog('info', `Switched to profile: ${profile.name}`);
      }
  };

  const deleteProfile = async (id: string) => {
      const updated = profiles.filter(p => p.id !== id);
      setProfiles(updated);
      await storage.saveProfiles(updated);
  };

  const triggerBackup = async () => {
      try {
          await storage.exportData(); // Download File
          addLog('success', `Backup file generated`);
      } catch (e: any) {
          addLog('error', 'Backup failed', e.message);
      }
  };

  const importBackup = async (file: File) => {
      try {
          const success = await storage.importData(file);
          if (success) {
              addLog('success', 'Data restored successfully');
              // Reload state
              const [n, s, g, p] = await Promise.all([storage.getNotes(), storage.getSettings(), storage.getGoals(), storage.getProfiles()]);
              setNotes(n); setSettings(s); setGoals(g); setProfiles(p);
          } else {
              throw new Error("Invalid format");
          }
      } catch (e: any) {
          addLog('error', 'Restore failed', e.message);
      }
  };

  // --- Standard Note Logic ---
  const addNote = async (content: string, title?: string, sourceType: Note['sourceType'] = 'manual', useAI = true, forceCategory?: string, audioData?: string, initialTags?: string[]) => {
    let analysis: any = { 
      tags: [], 
      hashtags: [], 
      category: forceCategory || filterCategory || 'Общее', 
      summary: '', 
      title: title, 
      related_nodes: [], 
      extracted_links: [], 
      action_items: [] 
    };

    if (useAI) {
      try { 
        analysis = await ai.analyzeText(content, settings); 
      } catch (e: any) { 
        addLog('warn', 'AI Analysis skipped', e.message); 
      }
    }

    // Combine initialTags and AI detected hashtags/tags
    const detectedTags = analysis.hashtags?.length ? analysis.hashtags : (analysis.tags || []);
    const combinedTags = Array.from(new Set([...(initialTags || []), ...detectedTags]));

    // Find related notes based on key concepts (related_nodes), hashtags/tags, and title matches
    const keyConcepts = (analysis.related_nodes || analysis.relatedKeywords || []).map((k: string) => k.toLowerCase());
    const tags = combinedTags.map(t => t.toLowerCase());
    
    const relatedIds = notes
      .filter(other => other.status !== 'trash')
      .filter(other => {
        const otherTags = (other.tags || []).map(t => t.toLowerCase());
        const hasCommonTag = otherTags.some(t => tags.includes(t));
        const otherConcepts = (other.related_nodes || []).map(c => c.toLowerCase());
        const hasCommonConcept = otherConcepts.some(c => keyConcepts.includes(c));
        const hasConceptInText = keyConcepts.some(k => 
          other.title.toLowerCase().includes(k) || 
          other.content.toLowerCase().includes(k)
        );
        return hasCommonTag || hasCommonConcept || hasConceptInText;
      })
      .slice(0, 6)
      .map(other => other.id);

    const newNote: Note = {
      id: crypto.randomUUID(),
      title: title || analysis.title || content.slice(0, 40) + "...",
      content,
      tags: combinedTags,
      hashtags: combinedTags,
      category: forceCategory || analysis.category || filterCategory || 'Общее',
      summary: analysis.summary || '',
      extracted_links: analysis.extracted_links || [],
      related_nodes: analysis.related_nodes || [],
      action_items: analysis.action_items || [],
      status: 'new',
      isIndexed: useAI,
      sourceType,
      audioData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      links: relatedIds,
      position: { x: Math.random() * 200 + 50, y: Math.random() * 200 + 50 },
      size: { w: 320, h: 280 }
    };
    setNotes(prev => { 
      const u = [newNote, ...prev]; 
      storage.saveNotes(u).catch(e => addLog('error', 'Save error', e.message)); 
      return u; 
    });
  };

  const processLargeText = async (text: string) => {
    addLog('info', 'Smart Split: Starting text segmentation...');
    try {
      const parts = await ai.splitLargeText(text, settings);
      if (Array.isArray(parts) && parts.length > 0) {
        addLog('success', `Smart Split: Text divided into ${parts.length} cards.`);
        for (const p of parts) {
            if(p.content) await addNote(p.content, p.title || "Untitled Part", 'split', false, p.category);
        }
      } else {
        throw new Error("AI did not return a valid array of cards.");
      }
    } catch (e: any) { 
        addLog('error', 'Smart Split Failed', e.message); 
    }
  };
  
  const autoGroupIdeas = async () => {
      const ideas = notes.filter(n => n.category === 'Идеи' && n.status !== 'trash');
      if(ideas.length < 3) return;
      
      addLog('info', 'Clustering ideas...');
      try {
          const minimalIdeas = ideas.map(n => ({ id: n.id, title: n.title, tags: n.tags }));
          const res = await ai.clusterIdeas(minimalIdeas, settings);
          
          if(res && res.clusters) {
             const newNotes = [...notes];
             for(const cluster of res.clusters) {
                 for(const id of cluster.ids) {
                     const idx = newNotes.findIndex(n => n.id === id);
                     if(idx !== -1) {
                         // Add cluster name as a tag
                         if(!newNotes[idx].tags.includes(cluster.name)) {
                             newNotes[idx].tags = [...newNotes[idx].tags, cluster.name];
                         }
                     }
                 }
             }
             setNotes(newNotes);
             await storage.saveNotes(newNotes);
             addLog('success', `Created ${res.clusters.length} clusters`);
          }
      } catch(e: any) {
          addLog('error', 'Clustering failed', e.message);
      }
  };

  // --- CRUD Wrappers ---
  const addGoal = async (title: string, description: string) => {
    const newGoal: Goal = { id: crypto.randomUUID(), title, description, createdAt: new Date().toISOString(), color: '#3b82f6', status: 'active' };
    setGoals(prev => { const u = [newGoal, ...prev]; storage.saveGoals(u); return u; });
    addLog('success', 'Goal created', title);
  };

  const updateGoal = async (goal: Goal) => {
    setGoals(prev => {
      const u = prev.map(g => g.id === goal.id ? goal : g);
      storage.saveGoals(u);
      return u;
    });
    addLog('info', 'Goal updated', goal.title);
  };

  const toggleGoalStatus = async (id: string) => {
    setGoals(prev => { 
        const u = prev.map(g => g.id === id ? { ...g, status: (g.status === 'active' ? 'completed' : 'active') as 'active' | 'completed' } : g); 
        storage.saveGoals(u); 
        return u; 
    });
  };

  const deleteGoal = async (id: string) => {
    setGoals(prev => { const u = prev.filter(g => g.id !== id); storage.saveGoals(u); return u; });
  };

  const addCategory = async (name: string) => {
     if(settings.customCategories.includes(name)) return;
     await updateSettings({ ...settings, customCategories: [...settings.customCategories, name] });
  };

  const deleteCategory = async (name: string) => {
     await updateSettings({ ...settings, customCategories: settings.customCategories.filter(c => c !== name) });
     setNotes(prev => { const u = prev.map(n => n.category === name ? { ...n, category: 'Общее' } : n); storage.saveNotes(u); return u; });
  };

  const reanalyzeAll = async () => {
    const allNotes = await storage.getNotes();
    const active = allNotes.filter(n => n.status !== 'trash' && n.content.length > 5);
    if (active.length === 0) return;
    setIsIndexing(true); setIndexingProgress(0);
    addLog('info', `Deep Re-index: Started for ${active.length} cards.`);
    let currentBatch = [...allNotes];
    let success = 0;
    for (let i = 0; i < currentBatch.length; i++) {
      const n = currentBatch[i];
      if (n.status === 'trash' || n.content.length <= 5) continue;
      try {
        setIndexingProgress(Math.round((success / active.length) * 100));
        await new Promise(r => setTimeout(r, 1000));
        const res = await ai.analyzeText(n.content, settings);
        if (res) {
          const detectedTags = res.hashtags?.length ? res.hashtags : (res.tags || []);
          const combinedTags = Array.from(new Set([...(n.tags || []), ...detectedTags]));
          
          currentBatch[i] = { 
            ...n, 
            title: res.title || n.title,
            summary: res.summary || n.summary,
            tags: combinedTags,
            hashtags: combinedTags,
            category: res.category || n.category,
            extracted_links: res.extracted_links || n.extracted_links || [],
            related_nodes: res.related_nodes || n.related_nodes || [],
            action_items: res.action_items || n.action_items || [],
            isIndexed: true, 
            updatedAt: new Date().toISOString() 
          };
          success++;
          setNotes([...currentBatch]);
          await storage.saveNotes([...currentBatch]);
        }
      } catch (err: any) { addLog('error', `Re-index error in "${n.title}": ${err.message}`); }
    }
    setIndexingProgress(100);
    setTimeout(() => { setIsIndexing(false); setIndexingProgress(0); }, 2000);
    addLog('success', `Deep Re-index completed. ${success} cards updated.`);
  };

  const updateSettings = async (s: Settings) => {
    setSettings(s);
    await storage.saveSettings(s);
    const isDark = s.theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    document.body.classList.toggle('dark', isDark);
  };

  const updateNote = async (n: Note) => {
    setNotes(prev => { const u = prev.map(x => x.id === n.id ? n : x); storage.saveNotes(u); return u; });
  };

  const setNoteStatus = async (id: string, status: NoteStatus) => {
    setNotes(prev => { const u = prev.map(n => n.id === id ? { ...n, status } : n); storage.saveNotes(u); return u; });
  };

  const runAIAnalysis = async (id: string) => {
    const n = notes.find(x => x.id === id);
    if (!n) return;
    try {
      addLog('info', `Manual AI Analysis: "${n.title}"...`);
      const res = await ai.analyzeText(n.content, settings);
      
      const detectedTags = res.hashtags?.length ? res.hashtags : (res.tags || []);
      const combinedTags = Array.from(new Set([...(n.tags || []), ...detectedTags]));

      // Find related notes based on key concepts, hashtags, and title
      const keyConcepts = (res.related_nodes || res.relatedKeywords || []).map((k: string) => k.toLowerCase());
      const tags = combinedTags.map(t => t.toLowerCase());

      const relatedIds = notes
        .filter(other => other.id !== id && other.status !== 'trash')
        .filter(other => {
          const otherTags = (other.tags || []).map(t => t.toLowerCase());
          const hasCommonTag = otherTags.some(t => tags.includes(t));
          const otherConcepts = (other.related_nodes || []).map(c => c.toLowerCase());
          const hasCommonConcept = otherConcepts.some(c => keyConcepts.includes(c));
          const hasConceptInText = keyConcepts.some(k => 
            other.title.toLowerCase().includes(k) || 
            other.content.toLowerCase().includes(k)
          );
          return hasCommonTag || hasCommonConcept || hasConceptInText;
        })
        .slice(0, 6)
        .map(other => other.id);

      setNotes(prev => { 
        const u = prev.map(x => x.id === id ? { 
          ...x, 
          title: res.title || x.title,
          summary: res.summary || x.summary,
          tags: combinedTags,
          hashtags: combinedTags,
          category: res.category || x.category,
          extracted_links: res.extracted_links || x.extracted_links || [],
          related_nodes: res.related_nodes || x.related_nodes || [],
          action_items: res.action_items || x.action_items || [],
          links: Array.from(new Set([...(x.links || []), ...relatedIds])),
          isIndexed: true, 
          updatedAt: new Date().toISOString() 
        } : x); 
        storage.saveNotes(u); 
        return u; 
      });
      addLog('success', `Analysis complete for "${n.title}". Found ${relatedIds.length} related connections.`);
    } catch (e: any) { addLog('error', `Analysis failed: ${e.message}`); }
  };

  const exportToMarkdown = async () => {
    try {
      const zip = new JSZip();
      const activeNotes = notes.filter(n => n.status !== 'trash');
      
      activeNotes.forEach(note => {
        const safeTitle = (note.title || 'Untitled').replace(/[/\\?%*:|"<>]/g, '-');
        const mdContent = `# ${note.title}\n\n` +
          `**Category:** ${note.category}\n` +
          `**Tags:** ${note.tags.join(', ')}\n` +
          `**Status:** ${note.status}\n` +
          `**Created:** ${note.createdAt}\n\n` +
          `---\n\n` +
          `${note.content}\n\n` +
          `---\n` +
          `*Summary:* ${note.summary}`;
        
        zip.file(`${safeTitle}.md`, mdContent);
      });

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ScreenMind_Export_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addLog('success', `Exported ${activeNotes.length} notes to Markdown ZIP`);
    } catch (e: any) {
      addLog('error', 'Export failed', e.message);
    }
  };

  const syncTelegram = async () => {
    if (!settings.tgToken) {
      addLog('warn', 'Telegram: Token missing in settings');
      return;
    }
    addLog('info', 'Telegram: Checking for new messages...');
    try {
      const url = `https://api.telegram.org/bot${settings.tgToken}/getUpdates?offset=${settings.tgLastUpdateId + 1}`;
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.ok && data.result.length > 0) {
        const newMsgs = await Promise.all(data.result.map(async (update: any) => {
          const msg = update.message || update.channel_post;
          if (!msg) return null;
          
          let type = 'text';
          let fileId = null;
          
          if (msg.photo) {
            type = 'photo';
            fileId = msg.photo[msg.photo.length - 1].file_id;
          } else if (msg.voice) {
            type = 'voice';
            fileId = msg.voice.file_id;
          } else if (msg.document) {
            type = 'document';
            fileId = msg.document.file_id;
          }
          
          let fileUrl = '';
          if (fileId) {
            try {
              const fileRes = await fetch(`https://api.telegram.org/bot${settings.tgToken}/getFile?file_id=${fileId}`);
              const fileData = await fileRes.json();
              if (fileData.ok) {
                fileUrl = `https://api.telegram.org/file/bot${settings.tgToken}/${fileData.result.file_path}`;
              }
            } catch (e) {
              console.error("Failed to get file URL", e);
            }
          }
          
          return {
            id: update.update_id,
            text: msg.text || msg.caption || '',
            date: new Date(msg.date * 1000).toISOString(),
            from: msg.from?.first_name || msg.chat?.title || 'Anonymous',
            type,
            fileUrl
          };
        }));

        const filteredMsgs = newMsgs.filter(Boolean);
        setTelegramMessages(prev => [...filteredMsgs, ...prev]);
        
        const lastId = data.result[data.result.length - 1].update_id;
        await updateSettings({ ...settings, tgLastUpdateId: lastId });
        addLog('success', `Telegram: Received ${filteredMsgs.length} new messages`);
      } else {
        addLog('info', 'Telegram: No new messages');
      }
    } catch (e: any) {
      addLog('error', 'Telegram Sync Failed', e.message);
    }
  };

  const deleteTelegramMsg = (id: number) => {
    setTelegramMessages(prev => prev.filter(m => m.id !== id));
  };

  const contextValue = React.useMemo(() => ({ 
    notes, goals, settings, profiles, metrics, isLoading, isIndexing, indexingProgress, logs, filterTag, filterCategory, telegramMessages,
    setFilterTag, setFilterCategory, addNote, processLargeText, updateNote, 
    moveToTrash: async (id: string) => setNoteStatus(id, 'trash'), 
    restoreNote: async (id: string) => setNoteStatus(id, 'new'), 
    hardDelete: async (id: string) => { setNotes(prev => { const u = prev.filter(x => x.id !== id); storage.saveNotes(u); return u; }); },
    setNoteStatus, updateSettings, addLog, runAIAnalysis, reanalyzeAll, autoGroupIdeas,
    runSystemCheck: async () => { addLog('info', 'Ping test...'); const r = await ai.testConnection(settings); r.success ? addLog('success', r.message) : addLog('error', r.message); },
    updateNotePosition: async (id: string, x: number, y: number) => { setNotes(prev => { const u = prev.map(n => n.id === id ? { ...n, position: { x, y } } : n); storage.saveNotes(u); return u; }); },
    updateNoteSize: async (id: string, w: number, h: number) => { setNotes(prev => { const u = prev.map(n => n.id === id ? { ...n, size: { w, h } } : n); storage.saveNotes(u); return u; }); },
    syncTelegram, deleteTelegramMsg, 
    addGoal, updateGoal, toggleGoalStatus, deleteGoal, addCategory, deleteCategory,
    createProfile, switchProfile, deleteProfile, clearSystemCache: ai.clearCache, triggerBackup, importBackup, exportToMarkdown
  }), [
    notes, goals, settings, profiles, metrics, isLoading, isIndexing, indexingProgress, logs, filterTag, filterCategory, telegramMessages,
    addNote, processLargeText, updateNote, setNoteStatus, updateSettings, addLog, runAIAnalysis, reanalyzeAll, autoGroupIdeas,
    addGoal, updateGoal, toggleGoalStatus, deleteGoal, addCategory, deleteCategory, createProfile, switchProfile, deleteProfile, triggerBackup, importBackup
  ]);

  return (
    <NotesContext.Provider value={contextValue}>
      {children}
    </NotesContext.Provider>
  );
};

export const useNotes = () => {
  const c = useContext(NotesContext);
  if (!c) throw new Error("useNotes error");
  return c;
};

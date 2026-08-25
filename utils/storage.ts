
import { get, set, del } from 'idb-keyval';
import { Note, Settings, AIProvider, Goal, AIProfile, BackupMetadata } from '../types.ts';

const NOTES_KEY = 'screenmind_notes';
const SETTINGS_KEY = 'screenmind_settings';
const PROFILES_KEY = 'screenmind_profiles';
const GOALS_KEY = 'screenmind_goals';
const BACKUPS_PREFIX = 'screenmind_backup_';

export const saveNotes = async (notes: Note[]) => {
  await set(NOTES_KEY, notes);
};

export const getNotes = async (): Promise<Note[]> => {
  const notes = await get(NOTES_KEY);
  return notes || [];
};

export const saveGoals = async (goals: Goal[]) => {
  await set(GOALS_KEY, goals);
};

export const getGoals = async (): Promise<Goal[]> => {
  const goals = await get(GOALS_KEY);
  return goals || [];
};

export const saveSettings = async (settings: Settings) => {
  await set(SETTINGS_KEY, settings);
};

export const getDefaultSettings = (): Settings => ({
  // Основной провайдер
  provider: AIProvider.Ollama,
  url: '/api/ollama', // Используем прокси
  model: 'mistral',
  apiKey: '',
  theme: 'light',
  customCategories: ['Общее', 'Идеи', 'Работа', 'ИИ'],
  
  // OCR (Gemini лучше всего подходит)
  ocrProvider: AIProvider.Gemini,
  ocrModel: 'gemini-2.5-flash-image',
  ocrApiKey: '',
  ocrUrl: '',
  
  // Voice
  transProvider: AIProvider.Gemini,
  transModel: 'gemini-2.5-flash-native-audio-preview-12-2025',
  transApiKey: '',
  transUrl: '',
  
  // Agent
  agentProvider: AIProvider.Gemini,
  agentModel: 'gemini-3-pro-preview',
  agentApiKey: '',
  agentUrl: '',
  
  // Split
  splitProvider: AIProvider.Gemini,
  splitModel: 'gemini-3-flash-preview',
  splitApiKey: '',
  splitUrl: '',
  splitChunkSize: 15000,

  tgToken: '',
  tgChatId: '',
  tgLastUpdateId: 0,
  
  cacheEnabled: true,
  cacheTTL: 60 
});

export const getSettings = async (): Promise<Settings> => {
  const settings = await get(SETTINGS_KEY);
  return { ...getDefaultSettings(), ...settings };
};

// --- PROFILES ---
export const saveProfiles = async (profiles: AIProfile[]) => {
    await set(PROFILES_KEY, profiles);
};

export const getProfiles = async (): Promise<AIProfile[]> => {
    return (await get(PROFILES_KEY)) || [];
};

// --- BACKUPS ---
export const createBackup = async (): Promise<BackupMetadata> => {
    const notes = await getNotes();
    const settings = await getSettings();
    const goals = await getGoals();
    const profiles = await getProfiles();
    
    const backupId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const backupData = { notes, settings, goals, profiles, version: '1.0.0', timestamp };
    
    const blob = new Blob([JSON.stringify(backupData)], { type: 'application/json' });
    await set(`${BACKUPS_PREFIX}${backupId}`, backupData);
    
    return {
        id: backupId,
        date: timestamp,
        version: '1.0.0',
        noteCount: notes.length,
        size: blob.size
    };
};

export const restoreBackup = async (backupId: string) => {
    const data = await get(`${BACKUPS_PREFIX}${backupId}`);
    if (data) {
        if(data.notes) await saveNotes(data.notes);
        if(data.settings) await saveSettings(data.settings);
        if(data.goals) await saveGoals(data.goals);
        if(data.profiles) await saveProfiles(data.profiles);
        return true;
    }
    return false;
};

export const exportData = async () => {
  const notes = await getNotes();
  const settings = await getSettings();
  const goals = await getGoals();
  const profiles = await getProfiles();
  const data = JSON.stringify({ notes, settings, goals, profiles, version: '1.0.0', exportedAt: new Date().toISOString() }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `screenmind_backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

export const importData = async (file: File): Promise<boolean> => {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (data.notes) await saveNotes(data.notes);
    if (data.settings) await saveSettings(data.settings);
    if (data.goals) await saveGoals(data.goals);
    if (data.profiles) await saveProfiles(data.profiles);
    return true;
  } catch (e) {
    console.error("Import failed", e);
    return false;
  }
};

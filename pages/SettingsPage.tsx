
import React, { useState, useCallback, memo, useEffect, useRef } from 'react';
import { useNotes } from '../contexts/NotesContext.tsx';
import { AIProvider } from '../types.ts';
import { 
  Settings as SettingsIcon, Terminal, RefreshCw, Download, Database, Zap, Cpu, KeyRound, Mic, Bot, ScanLine, Send, Info, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, Save, Users, Activity, HardDrive, Trash2, Scissors, UploadCloud, ShieldCheck, FileText, Smartphone
} from 'lucide-react';
import * as storage from '../utils/storage.ts';
import * as ai from '../utils/aiAdapter.ts';
import { motion, AnimatePresence } from 'motion/react';
import { MobileLocalModelsSection } from '../components/MobileLocalModelsSection.tsx';
import { OfflineRAGAndSyncSection } from '../components/OfflineRAGAndSyncSection.tsx';

// Provider Selector Component
const ProviderSelector = memo(({ 
  label, icon: Icon, 
  provider, onProviderChange, 
  url, onUrlChange, 
  model, onModelChange, 
  apiKey, onKeyChange 
}: {
  label: string, icon: any,
  provider: AIProvider, onProviderChange: (v: AIProvider) => void,
  url: string, onUrlChange: (v: string) => void,
  model: string, onModelChange: (v: string) => void,
  apiKey: string, onKeyChange: (v: string) => void
}) => {
  const isGemini = provider === AIProvider.Gemini;
  const isOllama = provider === AIProvider.Ollama;
  const isOpenRouter = provider === AIProvider.OpenRouter;
  
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testMsg, setTestMsg] = useState('');

  // Auto-fill recommended URLs and models when provider changes
  useEffect(() => {
    if (provider === AIProvider.Ollama) {
      if (!url || url.includes('lmstudio') || url.includes('openai') || url.includes('deepseek')) {
        onUrlChange('/api/ollama');
      }
      if (!model || model.startsWith('gpt') || model.startsWith('gemini') || model.startsWith('deepseek')) {
        onModelChange('mistral');
      }
    } else if (provider === AIProvider.LMStudio) {
      if (!url || url.includes('ollama') || url.includes('openai') || url.includes('deepseek')) {
        onUrlChange('/api/lmstudio');
      }
      if (!model || model.startsWith('gpt') || model.startsWith('gemini')) {
        onModelChange('local-model');
      }
    } else if (provider === AIProvider.LlamaCpp) {
      if (!url || url.includes('ollama') || url.includes('lmstudio')) {
        onUrlChange('http://localhost:8080/v1');
      }
      if (!model) onModelChange('default');
    } else if (provider === AIProvider.OpenAI) {
      if (!url || url.includes('ollama') || url.includes('lmstudio')) {
        onUrlChange('https://api.openai.com/v1');
      }
      if (!model || model === 'mistral' || model === 'local-model') {
        onModelChange('gpt-4o-mini');
      }
    } else if (provider === AIProvider.DeepSeek) {
      if (!url || url.includes('ollama') || url.includes('lmstudio')) {
        onUrlChange('https://api.deepseek.com/v1');
      }
      if (!model || model === 'mistral' || model === 'local-model') {
        onModelChange('deepseek-chat');
      }
    } else if (provider === AIProvider.Anthropic) {
      if (!url || url.includes('ollama') || url.includes('lmstudio')) {
        onUrlChange('https://api.anthropic.com/v1');
      }
      if (!model || model === 'mistral' || model === 'local-model') {
        onModelChange('claude-3-5-haiku-20241022');
      }
    } else if (provider === AIProvider.OpenRouter) {
      if (!url || url.includes('ollama') || url.includes('lmstudio')) {
        onUrlChange('https://openrouter.ai/api/v1');
      }
      if (!model || model === 'mistral' || model === 'local-model') {
        onModelChange('google/gemini-2.0-flash-001');
      }
    } else if (provider === AIProvider.Gemini) {
      if (!model) onModelChange('gemini-2.5-flash');
    }
  }, [provider]);

  const handleTest = async () => {
    setTestStatus('loading');
    const testUrl = url === '/api/chat' ? (isOllama ? '/api/ollama' : '/api/lmstudio') : url;
    const res = await ai.testSpecificConnection(provider, testUrl, model, apiKey);
    setTestStatus(res.success ? 'success' : 'error');
    setTestMsg(res.message);
    setTimeout(() => setTestStatus('idle'), 4000);
  };

  const getUrlPlaceholder = () => {
    if (isOllama) return "/api/ollama (Local Ollama)";
    if (provider === AIProvider.LMStudio) return "/api/lmstudio (Local LM Studio)";
    if (provider === AIProvider.LlamaCpp) return "http://localhost:8080/v1 (Local llama.cpp)";
    if (provider === AIProvider.OpenAI) return "https://api.openai.com/v1";
    if (provider === AIProvider.DeepSeek) return "https://api.deepseek.com/v1";
    if (provider === AIProvider.Anthropic) return "https://api.anthropic.com/v1";
    if (isOpenRouter) return "https://openrouter.ai/api/v1";
    return "https://api.example.com/v1";
  };

  const getModelPlaceholder = () => {
    if (isOllama) return "mistral / llama3.3 / deepseek-r1";
    if (provider === AIProvider.LMStudio) return "local-model";
    if (provider === AIProvider.LlamaCpp) return "default";
    if (provider === AIProvider.OpenAI) return "gpt-4o-mini / gpt-4o / o3-mini";
    if (provider === AIProvider.DeepSeek) return "deepseek-chat / deepseek-reasoner";
    if (provider === AIProvider.Anthropic) return "claude-3-5-haiku-20241022 / claude-3-7-sonnet";
    if (isOpenRouter) return "google/gemini-2.0-flash-001 / deepseek/deepseek-r1";
    return "gemini-2.5-flash";
  };

  return (
    <motion.section 
      whileHover={{ y: -5 }}
      className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-gray-100 dark:border-slate-800 shadow-sm transition-all hover:border-blue-500/30 group"
    >
      <div className="flex justify-between items-center mb-8 px-2">
          <div className="flex flex-col gap-1">
            <h3 className="font-black text-[11px] uppercase tracking-widest flex items-center gap-3 text-gray-500 group-hover:text-blue-500 transition-colors">
                <Icon size={18}/> {label}
            </h3>
            {isOpenRouter && <span className="text-[9px] text-blue-500 font-bold ml-8">Universal Gateway</span>}
            {(isOllama || provider === AIProvider.LMStudio) && <span className="text-[9px] text-green-500 font-bold ml-8">Local Network Optimized</span>}
          </div>
          <div className="flex items-center gap-2">
            <AnimatePresence mode="wait">
              {testStatus !== 'idle' && (
                  <motion.span 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className={`text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-2 ${
                      testStatus === 'loading' ? 'bg-gray-100 text-gray-500' :
                      testStatus === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                  }`}>
                      {testStatus === 'loading' && <Loader2 size={10} className="animate-spin"/>}
                      {testStatus === 'success' && <CheckCircle2 size={10}/>}
                      {testStatus === 'error' && <AlertCircle size={10}/>}
                      {testStatus === 'loading' ? 'Testing...' : testStatus === 'success' ? 'Online' : 'Error'}
                  </motion.span>
              )}
            </AnimatePresence>
            <motion.button 
                whileTap={{ scale: 0.95 }}
                onClick={handleTest}
                disabled={testStatus === 'loading'}
                className="text-[10px] font-black uppercase px-4 py-2 bg-gray-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all"
            >
                Test Connection
            </motion.button>
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="space-y-2">
              <label className="text-[9px] font-black text-gray-400 uppercase ml-3 tracking-widest">Provider Type</label>
              <select 
                className="w-full p-4 bg-gray-50 dark:bg-slate-950 rounded-2xl font-bold text-xs border-none dark:text-white shadow-inner cursor-pointer"
                value={provider}
                onChange={e => onProviderChange(e.target.value as AIProvider)}
              >
                {Object.values(AIProvider).map(p => <option key={p} value={p}>{p}</option>)}
              </select>
          </div>
          {!isGemini && (
            <div className="space-y-2">
                <label className="text-[9px] font-black text-gray-400 uppercase ml-3 tracking-widest flex items-center gap-2">
                    Server URL <span title={getUrlPlaceholder()}><Info size={10} className="text-blue-500 cursor-help" /></span>
                </label>
                <input 
                  type="text" 
                  className="w-full p-4 bg-gray-50 dark:bg-slate-950 rounded-2xl font-mono text-[10px] border-none dark:text-white shadow-inner focus:ring-2 focus:ring-blue-500/20"
                  value={url || ''} 
                  onChange={e => onUrlChange(e.target.value)}
                  placeholder={getUrlPlaceholder()}
                />
            </div>
          )}
        </div>
        
        <div className="space-y-4">
          <div className="space-y-2">
              <label className="text-[9px] font-black text-gray-400 uppercase ml-3 tracking-widest flex items-center gap-2">
                  Model ID <span title={getModelPlaceholder()}><Info size={10} className="text-blue-500 cursor-help" /></span>
              </label>
              <input 
                type="text" 
                className="w-full p-4 bg-gray-50 dark:bg-slate-950 rounded-2xl font-bold text-xs border-none dark:text-white shadow-inner focus:ring-2 focus:ring-blue-500/20"
                value={model || ''} 
                onChange={e => onModelChange(e.target.value)}
                placeholder={getModelPlaceholder()}
              />
              {/* Quick Model Badges for Local / Mobile */}
              {isOllama && (
                <div className="flex flex-wrap gap-1.5 pt-1 px-1">
                  {['qwen2.5:0.5b', 'qwen2.5:1.5b', 'llama3.2:1b', 'deepseek-r1:1.5b', 'smollm2:1.7b'].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => onModelChange(m)}
                      className={`text-[9px] font-mono px-2 py-0.5 rounded-md transition-colors ${
                        model === m 
                          ? 'bg-blue-600 text-white font-bold' 
                          : 'bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
          </div>
          {(!isOllama) && (
            <div className="space-y-2 relative">
                <label className="text-[9px] font-black text-gray-400 uppercase ml-3 tracking-widest">API Key</label>
                <div className="relative">
                  <input 
                    type={showKey ? "text" : "password"} 
                    className="w-full p-4 bg-gray-50 dark:bg-slate-950 rounded-2xl font-mono text-[10px] border-none dark:text-white shadow-inner pr-12 focus:ring-2 focus:ring-blue-500/20"
                    value={apiKey || ''} 
                    onChange={e => onKeyChange(e.target.value)}
                    placeholder="sk-..."
                  />
                  <button 
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-500 transition-colors"
                  >
                    {showKey ? <EyeOff size={14}/> : <Eye size={14}/>}
                  </button>
                </div>
            </div>
          )}
          {isGemini && (
            <div className="pt-2">
                 <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={async () => (window as any).aistudio?.openSelectKey()}
                  className="w-full py-3 bg-cyan-50 text-cyan-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-cyan-100 transition-all flex items-center justify-center gap-2"
                >
                  <KeyRound size={14} /> Select Google Key
                </motion.button>
            </div>
          )}
        </div>
      </div>
      {testStatus === 'error' && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl text-[10px] text-red-600 font-medium"
          >
              Error: {testMsg}
          </motion.div>
      )}
    </motion.section>
  );
});

const SettingsPage: React.FC = () => {
  const { notes, settings, updateSettings, reanalyzeAll, logs, addLog, isIndexing, indexingProgress, profiles, createProfile, switchProfile, deleteProfile, metrics, clearSystemCache, triggerBackup, importBackup, exportToMarkdown } = useNotes();
  const [localSettings, setLocalSettings] = useState(settings);
  const [showLogs, setShowLogs] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateLocalField = useCallback((field: string, value: any) => {
    setLocalSettings(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSaveAll = async () => {
      await updateSettings(localSettings);
      addLog('success', 'System settings saved');
  };

  const handleCreateProfile = async () => {
      if(!newProfileName.trim()) return;
      await createProfile(newProfileName);
      setNewProfileName('');
  };

  const handleImportClick = () => {
      fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          if (confirm("Restore will overwrite current data. Continue?")) {
            await importBackup(file);
          }
      }
      // Reset input
      e.target.value = '';
  };

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-12 space-y-8 md:space-y-12 pb-32">
      <motion.header 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row items-center justify-between bg-white dark:bg-slate-900 p-8 md:p-10 rounded-[3rem] md:rounded-[4rem] border border-gray-100 dark:border-slate-800 shadow-xl gap-8"
      >
        <div className="flex items-center gap-6 md:gap-8">
          <div className="p-5 md:p-7 bg-blue-600 text-white rounded-[2rem] md:rounded-[2.5rem] shadow-2xl shadow-blue-500/30"><SettingsIcon size={32} className="md:w-10 md:h-10"/></div>
          <div>
            <h2 className="text-3xl md:text-5xl font-black dark:text-white tracking-tighter leading-none">System Core</h2>
            <p className="text-[10px] md:text-[11px] font-black text-blue-600 uppercase tracking-[0.4em] mt-3 flex items-center gap-2">
                <Zap size={12}/> Configuration v1.0
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 justify-center">
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={async () => { if(confirm("Re-index all notes?")) { try { await reanalyzeAll(); } catch(e) { addLog('error', String(e)); } } }}
            disabled={isIndexing} 
            className={`px-6 py-4 md:px-8 md:py-5 rounded-[2rem] font-black text-[10px] uppercase flex items-center gap-3 transition-all ${
              isIndexing ? 'bg-amber-100 text-amber-600' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
            }`}
          >
            {isIndexing ? <RefreshCw size={16} className="animate-spin" /> : <Database size={16}/>} 
            {isIndexing ? `${indexingProgress}%` : 'Re-index Knowledge'}
          </motion.button>
        </div>
      </motion.header>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="col-span-1 xl:col-span-2 space-y-8">
            {/* Mobile & Local Model Hub */}
            <MobileLocalModelsSection
              localSettings={localSettings}
              onUpdateSetting={updateLocalField}
              onApplyPreset={(updates) => {
                setLocalSettings(prev => ({ ...prev, ...updates }));
              }}
              onLog={(level, msg) => addLog(level, msg)}
            />

            {/* Offline RAG, Graph Resolution & E2EE Sync Section */}
            <OfflineRAGAndSyncSection />

            <h2 className="text-2xl font-black dark:text-white px-4">AI Modules (Распределение задач)</h2>
            
            <ProviderSelector 
                label="Brain (Analyzer & Chat)" icon={Cpu}
                provider={localSettings.provider} onProviderChange={v => updateLocalField('provider', v)}
                url={localSettings.url} onUrlChange={v => updateLocalField('url', v)}
                model={localSettings.model} onModelChange={v => updateLocalField('model', v)}
                apiKey={localSettings.apiKey} onKeyChange={v => updateLocalField('apiKey', v)}
            />

            <ProviderSelector 
                label="Vision (OCR Engine)" icon={ScanLine}
                provider={localSettings.ocrProvider} onProviderChange={v => updateLocalField('ocrProvider', v)}
                url={localSettings.ocrUrl} onUrlChange={v => updateLocalField('ocrUrl', v)}
                model={localSettings.ocrModel} onModelChange={v => updateLocalField('ocrModel', v)}
                apiKey={localSettings.ocrApiKey} onKeyChange={v => updateLocalField('ocrApiKey', v)}
            />

            <ProviderSelector 
                label="Voice Engine (STT)" icon={Mic}
                provider={localSettings.transProvider} onProviderChange={v => updateLocalField('transProvider', v)}
                url={localSettings.transUrl} onUrlChange={v => updateLocalField('transUrl', v)}
                model={localSettings.transModel} onModelChange={v => updateLocalField('transModel', v)}
                apiKey={localSettings.transApiKey} onKeyChange={v => updateLocalField('transApiKey', v)}
            />

            <ProviderSelector 
                label="Neural Assistant" icon={Bot}
                provider={localSettings.agentProvider} onProviderChange={v => updateLocalField('agentProvider', v)}
                url={localSettings.agentUrl} onUrlChange={v => updateLocalField('agentUrl', v)}
                model={localSettings.agentModel} onModelChange={v => updateLocalField('agentModel', v)}
                apiKey={localSettings.agentApiKey} onKeyChange={v => updateLocalField('agentApiKey', v)}
            />
            
            <motion.section 
              whileHover={{ y: -5 }}
              className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-gray-100 dark:border-slate-800 shadow-sm transition-all hover:border-blue-500/30"
            >
                <h3 className="font-black text-[11px] uppercase tracking-widest flex items-center gap-3 text-gray-500 mb-8">
                    <Scissors size={18} className="text-purple-500"/> Smart Split Configuration
                </h3>
                
                <ProviderSelector 
                    label="Split Engine" icon={Scissors}
                    provider={localSettings.splitProvider} onProviderChange={v => updateLocalField('splitProvider', v)}
                    url={localSettings.splitUrl} onUrlChange={v => updateLocalField('splitUrl', v)}
                    model={localSettings.splitModel} onModelChange={v => updateLocalField('splitModel', v)}
                    apiKey={localSettings.splitApiKey} onKeyChange={v => updateLocalField('splitApiKey', v)}
                />
                
                <div className="mt-6 space-y-2 px-2">
                     <label className="text-[9px] font-black text-gray-400 uppercase ml-3 tracking-widest">Max Chunk Size (chars)</label>
                     <input 
                        type="number" 
                        className="w-full p-4 bg-gray-50 dark:bg-slate-950 rounded-2xl font-bold text-xs border-none dark:text-white shadow-inner focus:ring-2 focus:ring-blue-500/20"
                        value={localSettings.splitChunkSize || 15000} 
                        onChange={e => updateLocalField('splitChunkSize', parseInt(e.target.value))}
                    />
                    <p className="text-[9px] text-gray-400 px-4">Maximum characters per slice before sending to AI for processing.</p>
                </div>
            </motion.section>

             <motion.section 
              whileHover={{ y: -5 }}
              className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-gray-100 dark:border-slate-800 shadow-sm transition-all hover:border-blue-500/30"
             >
                <h3 className="font-black text-[11px] uppercase tracking-widest flex items-center gap-3 text-gray-500 mb-8">
                    <Send size={18} className="text-blue-500"/> Telegram Bridge
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-gray-400 uppercase ml-3 tracking-widest">Bot Token (@BotFather)</label>
                        <input 
                            type="password" 
                            className="w-full p-4 bg-gray-50 dark:bg-slate-950 rounded-2xl font-mono text-[10px] border-none dark:text-white shadow-inner focus:ring-2 focus:ring-blue-500/20"
                            value={localSettings.tgToken || ''} 
                            onChange={e => updateLocalField('tgToken', e.target.value)}
                            placeholder="123456:ABC-DEF..."
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-gray-400 uppercase ml-3 tracking-widest">Chat ID</label>
                        <input 
                            type="text" 
                            className="w-full p-4 bg-gray-50 dark:bg-slate-950 rounded-2xl font-bold text-xs border-none dark:text-white shadow-inner focus:ring-2 focus:ring-blue-500/20"
                            value={localSettings.tgChatId || ''} 
                            onChange={e => updateLocalField('tgChatId', e.target.value)}
                            placeholder="Get from bot interactions"
                        />
                    </div>
                </div>
            </motion.section>
          </div>

          <div className="space-y-8">
             <h2 className="text-2xl font-black dark:text-white px-4">Stats & Safety</h2>

             {/* DATA SAFETY (BACKUP) */}
             <motion.section 
              whileHover={{ y: -5 }}
              className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-gray-100 dark:border-slate-800 shadow-sm"
             >
                <h3 className="font-black text-[11px] uppercase tracking-widest flex items-center gap-3 text-gray-500 mb-6">
                    <ShieldCheck size={18} className="text-green-500"/> Data Safety
                </h3>
                <p className="text-[10px] text-gray-400 mb-6 leading-relaxed">
                    All data is stored locally. Export regularly to prevent data loss.
                </p>
                <div className="grid grid-cols-1 gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <motion.button 
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => triggerBackup()} 
                          className="py-4 bg-gray-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-600 dark:text-gray-300 rounded-2xl font-black text-[10px] uppercase flex flex-col items-center gap-2 transition-all"
                      >
                          <Download size={20} className="text-blue-500" /> Export JSON
                      </motion.button>
                      <motion.button 
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={handleImportClick}
                          className="py-4 bg-gray-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-gray-600 dark:text-gray-300 rounded-2xl font-black text-[10px] uppercase flex flex-col items-center gap-2 transition-all"
                      >
                          <UploadCloud size={20} className="text-amber-500" /> Restore JSON
                      </motion.button>
                    </div>
                    <motion.button 
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={exportToMarkdown}
                        className="w-full py-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-3 transition-all border border-emerald-100 dark:border-emerald-800"
                    >
                        <FileText size={20} /> Export All as Markdown (.zip)
                    </motion.button>
                    <input ref={fileInputRef} type="file" className="hidden" accept=".json" onChange={handleFileChange} />
                </div>
             </motion.section>

             {/* GOOGLE QUOTA */}
             <motion.section 
              whileHover={{ y: -5 }}
              className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-gray-100 dark:border-slate-800 shadow-sm"
             >
                 <h3 className="font-black text-[11px] uppercase tracking-widest flex items-center gap-3 text-gray-500 mb-6">
                    <Activity size={18} className="text-purple-500"/> Google Gemini Quota
                </h3>
                <div className="space-y-4">
                    <div className="p-4 bg-gray-50 dark:bg-slate-950 rounded-2xl">
                        <div className="flex justify-between mb-2">
                            <span className="text-[9px] font-black uppercase text-gray-400">Total Tokens Used</span>
                            <span className="text-[10px] font-black text-purple-600">{metrics.tokens.total.toLocaleString()}</span>
                        </div>
                         <div className="w-full bg-gray-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min((metrics.tokens.total / 1000000) * 100, 100)}%` }}
                              className="h-full bg-purple-500" 
                            />
                         </div>
                         <p className="text-[8px] text-gray-400 mt-2 text-right">Session Usage (Est.)</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="p-2 bg-gray-50 dark:bg-slate-950 rounded-xl">
                            <div className="text-[9px] font-black uppercase text-gray-400">Input</div>
                            <div className="text-xs font-black">{metrics.tokens.prompt.toLocaleString()}</div>
                        </div>
                        <div className="p-2 bg-gray-50 dark:bg-slate-950 rounded-xl">
                            <div className="text-[9px] font-black uppercase text-gray-400">Output</div>
                            <div className="text-xs font-black">{metrics.tokens.response.toLocaleString()}</div>
                        </div>
                    </div>
                    <div className="p-3 border border-dashed border-gray-200 dark:border-slate-800 rounded-xl">
                        <p className="text-[8px] font-mono text-gray-400 text-center">
                            Free Tier Limit: <br/> 
                            15 RPM / 1M TPM / 1.5k RPD
                        </p>
                    </div>
                </div>
             </motion.section>

             {/* OFFLINE RAG & SEMANTIC CACHE */}
             <motion.section 
              whileHover={{ y: -5 }}
              className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-gray-100 dark:border-slate-800 shadow-sm"
             >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-black text-[11px] uppercase tracking-widest flex items-center gap-3 text-gray-500">
                      <Database size={18} className="text-emerald-500"/> Offline RAG & Vector DB
                  </h3>
                  <span className="text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-900">
                    100% Local / WASM
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                  <div className="p-3 bg-gray-50 dark:bg-slate-950 rounded-2xl">
                    <div className="text-lg font-black text-emerald-600">{ai.getVectorDBStats().totalChunks}</div>
                    <div className="text-[9px] text-gray-400 uppercase font-bold">Векторов</div>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-slate-950 rounded-2xl">
                    <div className="text-lg font-black text-blue-600">{ai.getSemanticCacheStats().totalHits}</div>
                    <div className="text-[9px] text-gray-400 uppercase font-bold">Хитов Кэша</div>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-slate-950 rounded-2xl">
                    <div className="text-lg font-black text-purple-600">${ai.getSemanticCacheStats().estimatedSavedCostUsd}</div>
                    <div className="text-[9px] text-gray-400 uppercase font-bold">Сэкономлено</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <button 
                    onClick={() => {
                      const res = ai.syncVectorDB(notes);
                      addLog('info', `Индексация RAG завершена: ${res.totalChunks} чанков за ${res.durationMs}ms`);
                    }}
                    className="w-full py-3 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-xl text-[10px] font-black uppercase transition-colors"
                  >
                    Переиндексировать Vector DB
                  </button>
                  <button 
                    onClick={() => {
                      ai.clearSemanticCache();
                      addLog('info', 'Семантический кэш очищен');
                    }}
                    className="w-full py-3 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 text-gray-600 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase transition-colors"
                  >
                    Сбросить Семантический Кэш
                  </button>
                </div>
             </motion.section>

             {/* PROFILES */}
             <motion.section 
              whileHover={{ y: -5 }}
              className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-gray-100 dark:border-slate-800 shadow-sm"
             >
                <h3 className="font-black text-[11px] uppercase tracking-widest flex items-center gap-3 text-gray-500 mb-6">
                    <Users size={18} className="text-blue-500"/> Configuration Profiles
                </h3>
                <div className="space-y-3 mb-6">
                    <AnimatePresence initial={false}>
                      {profiles.map(p => (
                          <motion.div 
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            key={p.id} 
                            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-950 rounded-2xl"
                          >
                              <span className="font-bold text-xs pl-2">{p.name}</span>
                              <div className="flex gap-2">
                                  <button onClick={() => switchProfile(p.id)} className="px-3 py-1 bg-blue-100 text-blue-600 rounded-lg text-[9px] font-black uppercase">Load</button>
                                  <button onClick={() => deleteProfile(p.id)} className="p-1.5 hover:text-red-500 text-gray-400"><Trash2 size={14}/></button>
                              </div>
                          </motion.div>
                      ))}
                    </AnimatePresence>
                </div>
                <div className="flex gap-2">
                    <input className="flex-1 p-3 bg-gray-50 dark:bg-slate-950 rounded-xl text-xs font-bold" placeholder="New Profile Name" value={newProfileName} onChange={e => setNewProfileName(e.target.value)} />
                    <button onClick={handleCreateProfile} className="p-3 bg-blue-600 text-white rounded-xl"><Save size={16}/></button>
                </div>
             </motion.section>

             {/* METRICS & CACHE */}
             <motion.section 
              whileHover={{ y: -5 }}
              className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-gray-100 dark:border-slate-800 shadow-sm"
             >
                <h3 className="font-black text-[11px] uppercase tracking-widest flex items-center gap-3 text-gray-500 mb-6">
                    <Activity size={18} className="text-green-500"/> Performance & Cache
                </h3>
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="p-4 bg-gray-50 dark:bg-slate-950 rounded-2xl text-center">
                        <div className="text-xl font-black">{metrics.totalRequests}</div>
                        <div className="text-[9px] text-gray-400 uppercase">Requests</div>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-slate-950 rounded-2xl text-center">
                        <div className="text-xl font-black">{Math.round(metrics.averageLatency)}ms</div>
                        <div className="text-[9px] text-gray-400 uppercase">Avg Latency</div>
                    </div>
                </div>
                
                <div className="space-y-4 mb-6 bg-gray-50 dark:bg-slate-950 p-4 rounded-2xl">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-gray-500">Enable Caching</span>
                        <input 
                            type="checkbox" 
                            checked={localSettings.cacheEnabled} 
                            onChange={e => updateLocalField('cacheEnabled', e.target.checked)}
                            className="w-4 h-4 accent-blue-600"
                        />
                    </div>
                     <div className="space-y-2">
                        <label className="text-[9px] font-black text-gray-400 uppercase">Cache TTL (minutes)</label>
                        <input 
                            type="number" 
                            className="w-full p-2 bg-white dark:bg-slate-900 rounded-lg font-bold text-xs border border-gray-100 dark:border-slate-800"
                            value={localSettings.cacheTTL} 
                            onChange={e => updateLocalField('cacheTTL', parseInt(e.target.value))}
                        />
                    </div>
                </div>

                <button onClick={clearSystemCache} className="w-full py-3 bg-gray-100 dark:bg-slate-800 text-gray-500 rounded-xl text-[10px] font-black uppercase hover:bg-gray-200 transition-colors">Clear Cache</button>
             </motion.section>
             
             {/* LOGS */}
             <motion.section 
              whileHover={{ y: -5 }}
              className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-gray-100 dark:border-slate-800 shadow-sm h-[300px] flex flex-col"
             >
                <div className="flex justify-between mb-4"><h3 className="font-black text-[11px] uppercase tracking-widest text-gray-500"><Terminal size={14} className="inline mr-2"/>Logs</h3><button onClick={() => setShowLogs(!showLogs)} className="text-[9px] font-bold uppercase text-blue-500">Toggle</button></div>
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-950/50 rounded-2xl p-4 space-y-2">
                    {logs.map(log => (
                        <div key={log.id} className="text-[9px] font-mono border-b border-gray-100 dark:border-slate-800 pb-1 mb-1">
                            <span className={log.level === 'error' ? 'text-red-500' : 'text-blue-500'}>[{log.level}]</span> {log.message}
                        </div>
                    ))}
                </div>
             </motion.section>
          </div>
      </div>
      <div className="flex justify-center pt-8">
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleSaveAll} 
          className="px-12 md:px-24 py-5 md:py-6 bg-blue-600 text-white rounded-[2rem] md:rounded-[2.5rem] font-black uppercase text-xs shadow-2xl transition-all tracking-[0.3em] flex items-center gap-4"
        >
          <Save size={18}/> Save Config
        </motion.button>
      </div>
    </div>
  );
};

export default SettingsPage;

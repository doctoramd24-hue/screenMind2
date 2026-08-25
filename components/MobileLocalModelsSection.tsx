import React, { useState } from 'react';
import { AIProvider, CustomLocalModel, Settings } from '../types.ts';
import { 
  Smartphone, Cpu, Download, RefreshCw, Check, Copy, Zap, 
  ExternalLink, Trash2, Plus, CheckCircle2, AlertCircle, Loader2, 
  Layers, Terminal, HelpCircle, HardDrive, Wifi, Sparkles, ScanLine, Bot, Mic
} from 'lucide-react';
import { 
  RECOMMENDED_MOBILE_MODELS, 
  MobileModelPreset, 
  discoverLocalModels, 
  DiscoveredModel, 
  MOBILE_TERMUX_GUIDE 
} from '../utils/localModelManager.ts';
import * as ai from '../utils/aiAdapter.ts';
import { motion, AnimatePresence } from 'motion/react';

interface MobileLocalModelsSectionProps {
  localSettings: Settings;
  onUpdateSetting: (field: string, value: any) => void;
  onApplyPreset: (updates: Partial<Settings>) => void;
  onLog?: (level: 'info' | 'warn' | 'error' | 'success', message: string) => void;
}

export const MobileLocalModelsSection: React.FC<MobileLocalModelsSectionProps> = ({
  localSettings,
  onUpdateSetting,
  onApplyPreset,
  onLog
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  // Scanner state
  const [scanUrl, setScanUrl] = useState(localSettings.url || 'http://127.0.0.1:11434');
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredList, setDiscoveredList] = useState<DiscoveredModel[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);

  // New custom model form state
  const [newModelName, setNewModelName] = useState('');
  const [newProvider, setNewProvider] = useState<AIProvider>(AIProvider.Ollama);
  const [newUrl, setNewUrl] = useState('http://127.0.0.1:11434');
  const [newModelId, setNewModelId] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newDeviceType, setNewDeviceType] = useState<CustomLocalModel['deviceType']>('phone_termux');

  // Test status for newly drafted or saved model
  const [testingModelId, setTestingModelId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; msg: string; latency?: number }>>({});

  const savedModels: CustomLocalModel[] = localSettings.customLocalModels || [];

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2500);
  };

  // 1. Scan for models on phone or local network
  const handleScan = async () => {
    setIsScanning(true);
    setScanError(null);
    try {
      const res = await discoverLocalModels(scanUrl, newProvider, newApiKey);
      if (res.success && res.models.length > 0) {
        setDiscoveredList(res.models);
        onLog?.('success', `Найдено ${res.models.length} локальных моделей на ${scanUrl}`);
      } else {
        setDiscoveredList([]);
        setScanError(res.error || 'Модели не найдены. Убедитесь, что сервер запущен.');
        onLog?.('warn', res.error || 'Локальные модели не обнаружены');
      }
    } catch (err: any) {
      setScanError(err.message || 'Ошибка подключения к локальному серверу');
      onLog?.('error', `Ошибка сканирования: ${err.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  // 2. Select a preset or discovered model
  const applyModelToTarget = (
    modelConfig: { provider: AIProvider; url: string; model: string; apiKey?: string },
    target: 'brain' | 'vision' | 'voice' | 'agent' | 'all'
  ) => {
    const key = modelConfig.apiKey || '';
    if (target === 'brain' || target === 'all') {
      onUpdateSetting('provider', modelConfig.provider);
      onUpdateSetting('url', modelConfig.url);
      onUpdateSetting('model', modelConfig.model);
      onUpdateSetting('apiKey', key);
    }
    if (target === 'vision' || target === 'all') {
      onUpdateSetting('ocrProvider', modelConfig.provider);
      onUpdateSetting('ocrUrl', modelConfig.url);
      onUpdateSetting('ocrModel', modelConfig.model);
      onUpdateSetting('ocrApiKey', key);
    }
    if (target === 'voice' || target === 'all') {
      onUpdateSetting('transProvider', modelConfig.provider);
      onUpdateSetting('transUrl', modelConfig.url);
      onUpdateSetting('transModel', modelConfig.model);
      onUpdateSetting('transApiKey', key);
    }
    if (target === 'agent' || target === 'all') {
      onUpdateSetting('agentProvider', modelConfig.provider);
      onUpdateSetting('agentUrl', modelConfig.url);
      onUpdateSetting('agentModel', modelConfig.model);
      onUpdateSetting('agentApiKey', key);
    }
    onLog?.('success', `Модель "${modelConfig.model}" назначена для ${target === 'all' ? 'всех модулей' : target}`);
  };

  // 3. Test connection
  const handleTestConnection = async (id: string, provider: AIProvider, url: string, model: string, key?: string) => {
    setTestingModelId(id);
    const start = performance.now();
    const res = await ai.testSpecificConnection(provider, url, model, key || '');
    const latency = Math.round(performance.now() - start);
    
    setTestResults(prev => ({
      ...prev,
      [id]: {
        ok: res.success,
        msg: res.message,
        latency: res.success ? latency : undefined
      }
    }));
    setTestingModelId(null);
  };

  // 4. Save new custom model to library
  const handleSaveCustomModel = () => {
    if (!newModelName.trim() || !newModelId.trim()) return;

    const newModel: CustomLocalModel = {
      id: crypto.randomUUID(),
      name: newModelName.trim(),
      provider: newProvider,
      url: newUrl.trim() || 'http://127.0.0.1:11434',
      model: newModelId.trim(),
      apiKey: newApiKey.trim() || undefined,
      description: newDescription.trim() || undefined,
      deviceType: newDeviceType,
      addedAt: new Date().toISOString()
    };

    const updated = [...savedModels, newModel];
    onUpdateSetting('customLocalModels', updated);

    // Reset form
    setNewModelName('');
    setNewModelId('');
    setNewDescription('');
    setShowAddForm(false);
    onLog?.('success', `Локальная модель "${newModel.name}" сохранена в библиотеку`);
  };

  // 5. Delete saved model
  const handleDeleteSavedModel = (id: string) => {
    const updated = savedModels.filter(m => m.id !== id);
    onUpdateSetting('customLocalModels', updated);
  };

  return (
    <motion.section 
      whileHover={{ y: -2 }}
      className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[2.5rem] md:rounded-[3rem] border border-blue-100 dark:border-slate-800 shadow-sm space-y-8"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100 dark:border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl">
              <Smartphone size={22} />
            </div>
            <div>
              <h3 className="font-black text-sm md:text-base dark:text-white uppercase tracking-wider flex items-center gap-2">
                Мобильные и локальные модели
                <span className="text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">
                  On-Device Phone Hub
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Запуск и выбор локальных нейросетей прямо на смартфоне (через Termux, llama.cpp или локальную Wi-Fi сеть)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="flex-1 md:flex-none text-[10px] font-black uppercase px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-slate-700 dark:text-slate-300 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <Terminal size={14} className="text-blue-500" />
            {showGuide ? 'Скрыть инструкцию' : 'Инструкция для смартфона'}
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex-1 md:flex-none text-[10px] font-black uppercase px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
          >
            <Plus size={14} />
            {showAddForm ? 'Закрыть' : 'Добавить модель'}
          </button>
        </div>
      </div>

      {/* Guide Accordion for Mobile Termux & llama.cpp */}
      <AnimatePresence>
        {showGuide && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-5 bg-slate-50 dark:bg-slate-950/80 rounded-2xl border border-blue-500/20 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-black text-xs text-blue-600 dark:text-blue-400 uppercase">
                  <Terminal size={16} /> {MOBILE_TERMUX_GUIDE.title}
                </div>
                <span className="text-[10px] text-slate-400 font-mono">100% Offline & Free</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {MOBILE_TERMUX_GUIDE.steps.map(step => (
                  <div key={step.step} className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-blue-500 uppercase">Шаг {step.step}: {step.title}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{step.desc}</p>
                    <div className="flex items-center justify-between gap-2 p-2 bg-slate-100 dark:bg-slate-950 rounded-lg font-mono text-[10px] text-slate-800 dark:text-slate-200 break-all">
                      <code>{step.command}</code>
                      <button
                        onClick={() => copyToClipboard(step.command, `step-${step.step}`)}
                        className="shrink-0 p-1 hover:text-blue-500 transition-colors"
                        title="Копировать"
                      >
                        {copiedCmd === `step-${step.step}` ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-900 text-[11px] text-blue-800 dark:text-blue-300 flex items-start gap-2">
                <HelpCircle size={16} className="shrink-0 mt-0.5 text-blue-500" />
                <span>
                  <strong>Совет по CORS:</strong> Чтобы приложение в браузере телефона могло обращаться к Ollama, сервер Ollama обязательно должен быть запущен с флагом <code>OLLAMA_ORIGINS="*"</code>.
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Custom Model Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-5 md:p-6 bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-5">
              <h4 className="font-black text-xs uppercase tracking-wider dark:text-white flex items-center gap-2">
                <Plus size={16} className="text-blue-500" /> Новая локальная модель для смартфона
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Название пресета</label>
                  <input
                    type="text"
                    placeholder="Например: Termux Qwen 1.5B"
                    value={newModelName}
                    onChange={e => setNewModelName(e.target.value)}
                    className="w-full p-3 bg-white dark:bg-slate-900 rounded-xl font-bold text-xs border border-slate-200 dark:border-slate-800 dark:text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Провайдер</label>
                  <select
                    value={newProvider}
                    onChange={e => {
                      const p = e.target.value as AIProvider;
                      setNewProvider(p);
                      if (p === AIProvider.LlamaCpp) setNewUrl('http://127.0.0.1:8080/v1');
                      else if (p === AIProvider.LMStudio) setNewUrl('http://127.0.0.1:1234/v1');
                      else if (p === AIProvider.Ollama) setNewUrl('http://127.0.0.1:11434');
                    }}
                    className="w-full p-3 bg-white dark:bg-slate-900 rounded-xl font-bold text-xs border border-slate-200 dark:border-slate-800 dark:text-white"
                  >
                    <option value={AIProvider.Ollama}>Ollama (Termux / Local)</option>
                    <option value={AIProvider.LlamaCpp}>llama.cpp (Mobile Server)</option>
                    <option value={AIProvider.LMStudio}>LM Studio (Local / Wi-Fi)</option>
                    <option value={AIProvider.OpenAI}>OpenAI-совместимый (LocalAI, vLLM)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Тип устройства</label>
                  <select
                    value={newDeviceType}
                    onChange={e => setNewDeviceType(e.target.value as any)}
                    className="w-full p-3 bg-white dark:bg-slate-900 rounded-xl font-bold text-xs border border-slate-200 dark:border-slate-800 dark:text-white"
                  >
                    <option value="phone_termux">📱 Смартфон (Android Termux)</option>
                    <option value="phone_llamacpp">⚡ llama.cpp ARM64</option>
                    <option value="local_wifi">📡 Компьютер в домашней сети Wi-Fi</option>
                    <option value="custom_api">🌐 Пользовательский локальный сервер</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider">URL сервера</label>
                  <input
                    type="text"
                    placeholder="http://127.0.0.1:11434"
                    value={newUrl}
                    onChange={e => setNewUrl(e.target.value)}
                    className="w-full p-3 bg-white dark:bg-slate-900 rounded-xl font-mono text-xs border border-slate-200 dark:border-slate-800 dark:text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider">ID Модели (Model Name)</label>
                  <input
                    type="text"
                    placeholder="qwen2.5:1.5b / llama3.2:1b"
                    value={newModelId}
                    onChange={e => setNewModelId(e.target.value)}
                    className="w-full p-3 bg-white dark:bg-slate-900 rounded-xl font-bold text-xs border border-slate-200 dark:border-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Описание или комментарий (опционально)</label>
                <input
                  type="text"
                  placeholder="Например: Быстрая модель для анализа на смартфоне"
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  className="w-full p-3 bg-white dark:bg-slate-900 rounded-xl text-xs border border-slate-200 dark:border-slate-800 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSaveCustomModel}
                  disabled={!newModelName.trim() || !newModelId.trim()}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase shadow-lg transition-all"
                >
                  Сохранить модель
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Model Scanner on Phone / Local Network */}
      <div className="p-5 bg-gradient-to-br from-blue-500/5 via-slate-50 to-indigo-500/5 dark:from-slate-950 dark:to-slate-900 rounded-3xl border border-blue-500/10 space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div>
            <h4 className="font-black text-xs uppercase tracking-wider dark:text-white flex items-center gap-2">
              <RefreshCw size={15} className={`text-blue-500 ${isScanning ? 'animate-spin' : ''}`} /> 
              Автоматический сканер моделей на телефоне
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Проверяет запущенный сервер (Ollama / llama.cpp) и показывает установленные на телефоне веса
            </p>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <input
              type="text"
              value={scanUrl}
              onChange={e => setScanUrl(e.target.value)}
              placeholder="http://127.0.0.1:11434"
              className="flex-1 md:w-64 p-2.5 bg-white dark:bg-slate-900 rounded-xl font-mono text-[11px] border border-slate-200 dark:border-slate-800 dark:text-white"
            />
            <button
              onClick={handleScan}
              disabled={isScanning}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[10px] font-black uppercase rounded-xl shadow-md transition-all flex items-center gap-2 shrink-0"
            >
              {isScanning ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
              {isScanning ? 'Сканирую...' : 'Сканировать'}
            </button>
          </div>
        </div>

        {scanError && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900/50 text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0 text-amber-600" />
            <span>{scanError}</span>
          </div>
        )}

        {/* Discovered models list */}
        {discoveredList.length > 0 && (
          <div className="space-y-2 pt-2">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Найдено на устройстве ({discoveredList.length}):
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {discoveredList.map((m, idx) => (
                <div 
                  key={idx}
                  className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3 hover:border-blue-500/40 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs dark:text-white truncate">{m.name}</span>
                      {m.sizeFormatted && (
                        <span className="text-[9px] font-mono bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded font-bold">
                          {m.sizeFormatted}
                        </span>
                      )}
                    </div>
                    {m.details?.family && (
                      <p className="text-[10px] text-slate-400 mt-1">Семейство: {m.details.family} {m.details.quantization_level ? `(${m.details.quantization_level})` : ''}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => applyModelToTarget({ provider: AIProvider.Ollama, url: scanUrl, model: m.name }, 'brain')}
                      className="flex-1 py-1 px-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[9px] font-bold rounded-lg transition-colors"
                      title="Использовать для заметок и чата"
                    >
                      Для Brain
                    </button>
                    <button
                      onClick={() => applyModelToTarget({ provider: AIProvider.Ollama, url: scanUrl, model: m.name }, 'all')}
                      className="py-1 px-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[9px] font-bold rounded-lg transition-colors"
                      title="Использовать везде"
                    >
                      Везде
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Saved Custom Models Library */}
      {savedModels.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-black text-xs uppercase tracking-wider dark:text-white flex items-center gap-2">
              <HardDrive size={15} className="text-purple-500" /> Сохраненные модели в вашей библиотеке ({savedModels.length})
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {savedModels.map(model => {
              const test = testResults[model.id];
              const isTesting = testingModelId === model.id;
              const isCurrentlySelected = localSettings.model === model.model && localSettings.url === model.url;

              return (
                <div
                  key={model.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isCurrentlySelected 
                      ? 'bg-blue-500/5 border-blue-500/40 shadow-sm' 
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-xs dark:text-white">{model.name}</span>
                        {isCurrentlySelected && (
                          <span className="text-[8px] font-black uppercase px-2 py-0.5 bg-blue-500 text-white rounded-full">
                            Активна (Brain)
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-1">
                        {model.model} • {model.provider}
                      </p>
                      <p className="text-[9px] font-mono text-slate-400 truncate max-w-[260px]">{model.url}</p>
                      {model.description && (
                        <p className="text-[10px] text-slate-600 dark:text-slate-300 mt-1.5">{model.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleTestConnection(model.id, model.provider, model.url, model.model, model.apiKey)}
                        disabled={isTesting}
                        className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 rounded-xl transition-colors"
                        title="Проверить соединение"
                      >
                        {isTesting ? <Loader2 size={14} className="animate-spin text-blue-500" /> : <Zap size={14} />}
                      </button>
                      <button
                        onClick={() => handleDeleteSavedModel(model.id)}
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-400 hover:text-red-500 rounded-xl transition-colors"
                        title="Удалить"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {test && (
                    <div className={`mt-2 p-2 rounded-lg text-[9px] font-mono flex items-center gap-1.5 ${
                      test.ok ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400'
                    }`}>
                      {test.ok ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                      <span>{test.ok ? `Online (${test.latency}ms)` : `Error: ${test.msg}`}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-800">
                    <button
                      onClick={() => applyModelToTarget(model, 'brain')}
                      className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[9px] font-black uppercase rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Cpu size={10} /> В Brain
                    </button>
                    <button
                      onClick={() => applyModelToTarget(model, 'vision')}
                      className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-[9px] font-black uppercase rounded-lg transition-colors flex items-center gap-1"
                    >
                      <ScanLine size={10} /> В OCR
                    </button>
                    <button
                      onClick={() => applyModelToTarget(model, 'agent')}
                      className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[9px] font-black uppercase rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Bot size={10} /> В Агент
                    </button>
                    <button
                      onClick={() => applyModelToTarget(model, 'all')}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-black uppercase rounded-lg shadow-sm transition-colors flex items-center gap-1 ml-auto"
                    >
                      <Sparkles size={10} /> Везде
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recommended Mobile Presets Catalog */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-black text-xs uppercase tracking-wider dark:text-white flex items-center gap-2">
              <Sparkles size={15} className="text-amber-500" /> Рекомендуемые модели для смартфонов
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Готовые профили, оптимизированные под железо мобильных процессоров (ARM64)
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {RECOMMENDED_MOBILE_MODELS.map(preset => {
            const isCurrentlySelected = localSettings.model === preset.model && localSettings.url === preset.url;

            return (
              <div 
                key={preset.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                  isCurrentlySelected
                    ? 'bg-blue-500/5 border-blue-500/40 shadow-md ring-1 ring-blue-500/20'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-black text-xs dark:text-white leading-tight">{preset.name}</span>
                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                      preset.speedRating === 'Ultra Fast' ? 'bg-emerald-500/10 text-emerald-600' :
                      preset.speedRating === 'Fast' ? 'bg-blue-500/10 text-blue-600' : 'bg-amber-500/10 text-amber-600'
                    }`}>
                      {preset.speedRating}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[9px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                      {preset.ramUsage}
                    </span>
                    <span className="text-[9px] font-mono text-slate-400 truncate">
                      {preset.model}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 line-clamp-2">
                    {preset.description}
                  </p>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                  {preset.installCommand && (
                    <div className="flex items-center justify-between p-1.5 bg-slate-100 dark:bg-slate-950 rounded-lg text-[9px] font-mono text-slate-700 dark:text-slate-300">
                      <span className="truncate">{preset.installCommand}</span>
                      <button
                        onClick={() => copyToClipboard(preset.installCommand!, preset.id)}
                        className="p-1 text-slate-400 hover:text-blue-500 transition-colors"
                        title="Копировать команду для Termux"
                      >
                        {copiedCmd === preset.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => applyModelToTarget(preset, 'brain')}
                      className={`flex-1 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${
                        isCurrentlySelected 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {isCurrentlySelected ? 'Выбрана' : 'Выбрать'}
                    </button>
                    <button
                      onClick={() => applyModelToTarget(preset, 'all')}
                      className="py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[9px] font-black uppercase rounded-lg transition-colors"
                      title="Применить ко всем модулям"
                    >
                      Везде
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.section>
  );
};

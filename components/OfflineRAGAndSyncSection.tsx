import React, { useState } from 'react';
import { useNotes } from '../contexts/NotesContext.tsx';
import { LocalVectorDB } from '../utils/vectorDb.ts';
import { syncWebDAV, encryptVault, decryptVault } from '../utils/encryptionSync.ts';
import { GraphMergeReport, VectorSearchResult } from '../types.ts';
import { 
  Database, Network, Lock, ShieldCheck, KeyRound, CloudUpload, CloudDownload, 
  RefreshCw, CheckCircle2, AlertCircle, Sparkles, FileText, Search, Sliders, ChevronDown, ChevronUp, Layers, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const OfflineRAGAndSyncSection: React.FC = () => {
  const { 
    notes, goals, settings, updateSettings, runGraphAutoMerge, 
    exportEncryptedVault, importEncryptedVault, addLog 
  } = useNotes();

  // State
  const [activeTab, setActiveTab] = useState<'rag' | 'graph' | 'e2ee'>('rag');

  // RAG Explorer Test State
  const [searchQuery, setSearchQuery] = useState('проблемы с машиной');
  const [searchResults, setSearchResults] = useState<VectorSearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSyncingVector, setIsSyncingVector] = useState(false);

  // Graph Entity Resolution State
  const [isMerging, setIsMerging] = useState(false);
  const [mergeReport, setMergeReport] = useState<GraphMergeReport | null>(null);

  // E2EE Vault & WebDAV State
  const [passphrase, setPassphrase] = useState(settings.e2eePassphrase || '');
  const [showPassword, setShowPassword] = useState(false);
  const [webDavUrl, setWebDavUrl] = useState(settings.e2eeSyncUrl || '');
  const [webDavUser, setWebDavUser] = useState(settings.e2eeSyncUsername || '');
  const [webDavPass, setWebDavPass] = useState(settings.e2eeSyncPassword || '');
  const [isSyncingWebDav, setIsSyncingWebDav] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const vectorDb = LocalVectorDB.getInstance();
  const vectorStats = vectorDb.getStats();

  // Test RAG Search
  const handleTestRAGSearch = () => {
    vectorDb.syncNotes(notes);
    const res = vectorDb.search(searchQuery, 4, 0.35);
    setSearchResults(res);
    setHasSearched(true);
  };

  // Force re-index vectors
  const handleReindexVectors = () => {
    setIsSyncingVector(true);
    setTimeout(() => {
      const stats = vectorDb.syncNotes(notes);
      setIsSyncingVector(false);
      addLog('success', `Векторный индекс обновлен: ${stats.totalChunks} чанков за ${stats.durationMs} мс.`);
    }, 200);
  };

  // Run Graph Auto-Merge
  const handleRunGraphMerge = async () => {
    setIsMerging(true);
    try {
      const report = await runGraphAutoMerge();
      setMergeReport(report);
    } catch (e: any) {
      addLog('error', 'Ошибка слияния графа', e.message);
    } finally {
      setIsMerging(false);
    }
  };

  // Export Encrypted Vault
  const handleExportVault = async () => {
    if (!passphrase) {
      alert('Пожалуйста, введите пароль для шифрования архива.');
      return;
    }
    try {
      await exportEncryptedVault(passphrase);
      setSyncStatusMsg({ type: 'success', text: 'Зашифрованный сейф (.smvault) успешно создан!' });
    } catch (e: any) {
      setSyncStatusMsg({ type: 'error', text: e.message });
    }
  };

  // Import Encrypted Vault
  const handleImportVault = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!passphrase) {
      alert('Введите пароль для расшифровки выбранного архива.');
      return;
    }
    try {
      await importEncryptedVault(file, passphrase);
      setSyncStatusMsg({ type: 'success', text: 'Архив успешно расшифрован и импортирован!' });
    } catch (e: any) {
      setSyncStatusMsg({ type: 'error', text: e.message });
    }
  };

  // WebDAV Sync
  const handleWebDavUpload = async () => {
    if (!passphrase || !webDavUrl) {
      alert('Укажите URL WebDAV и пароль шифрования.');
      return;
    }
    setIsSyncingWebDav(true);
    setSyncStatusMsg(null);
    try {
      const payload = await encryptVault({ notes, settings, goals }, passphrase);
      const res = await syncWebDAV(webDavUrl, webDavUser, webDavPass, 'upload', payload);
      setSyncStatusMsg({ type: 'success', text: res.message || 'Успешно отправлено в WebDAV' });
      await updateSettings({
        ...settings,
        e2eeSyncUrl: webDavUrl,
        e2eeSyncUsername: webDavUser,
        e2eeSyncPassword: webDavPass,
        e2eePassphrase: passphrase,
        lastE2EESync: new Date().toISOString()
      });
      addLog('success', 'WebDAV: Синхронизация завершена');
    } catch (e: any) {
      setSyncStatusMsg({ type: 'error', text: e.message });
      addLog('error', 'WebDAV Upload Error', e.message);
    } finally {
      setIsSyncingWebDav(false);
    }
  };

  const handleWebDavDownload = async () => {
    if (!passphrase || !webDavUrl) {
      alert('Укажите URL WebDAV и пароль шифрования.');
      return;
    }
    setIsSyncingWebDav(true);
    setSyncStatusMsg(null);
    try {
      const res = await syncWebDAV(webDavUrl, webDavUser, webDavPass, 'download');
      if (res.data) {
        const decrypted = await decryptVault(res.data, passphrase);
        if (decrypted.notes) {
          setSyncStatusMsg({ type: 'success', text: `Скачано и расшифровано ${decrypted.notes.length} заметок из WebDAV!` });
        }
      }
    } catch (e: any) {
      setSyncStatusMsg({ type: 'error', text: e.message });
      addLog('error', 'WebDAV Download Error', e.message);
    } finally {
      setIsSyncingWebDav(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h3 className="text-xl font-black dark:text-white flex items-center gap-2">
            <Sparkles className="text-indigo-500" size={22} />
            Продвинутый движок: RAG, Граф и E2EE
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Локальный 384-D векторный поиск, алгоритмическое авто-слияние синонимов графа и конфиденциальный сейф
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
          <button
            onClick={() => setActiveTab('rag')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
              activeTab === 'rag' 
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Database size={14} /> Offline RAG
          </button>
          <button
            onClick={() => setActiveTab('graph')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
              activeTab === 'graph' 
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Network size={14} /> Слияние графа
          </button>
          <button
            onClick={() => setActiveTab('e2ee')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
              activeTab === 'e2ee' 
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Lock size={14} /> E2EE Сейф & Облако
          </button>
        </div>
      </div>

      {/* Tab 1: Offline RAG & Vector Store */}
      {activeTab === 'rag' && (
        <div className="space-y-5">
          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-indigo-50/50 dark:bg-indigo-950/20 p-3 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
              <div className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400">Размерность</div>
              <div className="text-lg font-black text-slate-800 dark:text-white mt-0.5">384 чисел</div>
              <div className="text-[9px] text-slate-400">all-MiniLM-L6-v2 space</div>
            </div>
            <div className="bg-blue-50/50 dark:bg-blue-950/20 p-3 rounded-2xl border border-blue-100 dark:border-blue-900/30">
              <div className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400">Чанков в индексе</div>
              <div className="text-lg font-black text-slate-800 dark:text-white mt-0.5">{vectorStats.totalChunks}</div>
              <div className="text-[9px] text-slate-400">В памяти устройства</div>
            </div>
            <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-3 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
              <div className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">Скорость эмбеддинга</div>
              <div className="text-lg font-black text-slate-800 dark:text-white mt-0.5">&lt; 2 мс</div>
              <div className="text-[9px] text-slate-400">100% Offline ARM64</div>
            </div>
            <div className="bg-purple-50/50 dark:bg-purple-950/20 p-3 rounded-2xl border border-purple-100 dark:border-purple-900/30 flex flex-col justify-between">
              <div className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400">Синхронизация</div>
              <button
                onClick={handleReindexVectors}
                disabled={isSyncingVector}
                className="mt-1 text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw size={12} className={isSyncingVector ? 'animate-spin' : ''} />
                {isSyncingVector ? 'Индексация...' : 'Переиндексировать'}
              </button>
            </div>
          </div>

          {/* Interactive Semantic Search Tester */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Search size={14} className="text-indigo-500" />
                Тестирование семантического сходства RAG
              </span>
              <span className="text-[10px] text-slate-400">Ищет по смыслу, а не по буквам</span>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Например: проблемы с машиной, лечение простуды, инвестиции..."
                className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium dark:text-white outline-none focus:border-indigo-500"
              />
              <button
                onClick={handleTestRAGSearch}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Search size={14} /> Найти
              </button>
            </div>

            {/* Quick test pills */}
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-[10px] text-slate-400 font-bold">Быстрые примеры:</span>
              {['проблемы с машиной', 'повышенное давление', 'биткоин и криптовалюта', 'баг в коде react'].map(p => (
                <button
                  key={p}
                  onClick={() => {
                    setSearchQuery(p);
                    vectorDb.syncNotes(notes);
                    const res = vectorDb.search(p, 4, 0.35);
                    setSearchResults(res);
                    setHasSearched(true);
                  }}
                  className="text-[10px] px-2 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Results Output */}
            {hasSearched && (
              <div className="pt-2 space-y-2">
                <div className="text-[10px] font-black uppercase text-slate-400">
                  Результаты семантического ранжирования ({searchResults.length}):
                </div>
                {searchResults.length === 0 ? (
                  <div className="text-xs text-slate-400 p-3 bg-white dark:bg-slate-900 rounded-xl text-center">
                    В базе пока нет заметок с близким семантическим контекстом. Добавьте заметки со схожей тематикой.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {searchResults.map((res, i) => (
                      <div key={i} className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 dark:text-white truncate max-w-[70%]">
                            {res.title}
                          </span>
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-mono">
                            {Math.round(res.score * 100)}% совпадение
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                          {res.text}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Graph Entity Resolution */}
      {activeTab === 'graph' && (
        <div className="space-y-5">
          <div className="bg-indigo-50/40 dark:bg-indigo-950/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 flex items-start gap-3">
            <Network className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" size={20} />
            <div className="space-y-1">
              <h4 className="text-xs font-black dark:text-white uppercase tracking-wider">
                Graph Entity Resolution (Авто-слияние синонимов)
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Когда локальный ИИ анализирует скриншоты, он создает дубликаты-синонимы вроде <span className="font-mono text-indigo-600 dark:text-indigo-400">[ИИ]</span>, <span className="font-mono text-indigo-600 dark:text-indigo-400">[Нейросети]</span>, <span className="font-mono text-indigo-600 dark:text-indigo-400">[AI]</span>. Этот алгоритм сравнивает нормализованные основы слов, расстояние Левенштейна и объединяет их в единые канонические узлы.
              </p>
            </div>
          </div>

          {/* Action Trigger */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60">
            <div>
              <div className="text-xs font-bold text-slate-800 dark:text-white">
                Запустить очистку и слияние узлов графа
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Проверит все {notes.length} заметок и объединит синонимичные хэштеги и концепции связей
              </div>
            </div>

            <button
              onClick={handleRunGraphMerge}
              disabled={isMerging}
              className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm"
            >
              <RefreshCw size={14} className={isMerging ? 'animate-spin' : ''} />
              {isMerging ? 'Оптимизация графа...' : 'Объединить синонимы'}
            </button>
          </div>

          {/* Merge Report */}
          {mergeReport && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <CheckCircle2 size={16} className="text-emerald-500" />
                  Отчет авто-слияния
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                  Объединено: {mergeReport.totalMerged} дубликатов в {mergeReport.affectedNotesCount} заметках
                </span>
              </div>

              {mergeReport.totalMerged === 0 ? (
                <div className="text-xs text-slate-500 dark:text-slate-400 py-2">
                  Граф уже идеально нормализован, все узлы уникальны.
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Объединенные сущности:</div>
                  <div className="flex flex-wrap gap-2">
                    {[...mergeReport.mergedNodes, ...mergeReport.mergedTags].map((m, idx) => (
                      <div key={idx} className="text-xs px-2.5 py-1 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
                        <span className="line-through text-slate-400">{m.from}</span>
                        <span className="text-slate-400">→</span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">{m.to}</span>
                        <span className="text-[9px] text-slate-400 font-mono">({Math.round(m.similarity * 100)}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>
      )}

      {/* Tab 3: E2EE Encrypted Vault & WebDAV Sync */}
      {activeTab === 'e2ee' && (
        <div className="space-y-5">
          <div className="bg-emerald-50/40 dark:bg-emerald-950/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 flex items-start gap-3">
            <ShieldCheck className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" size={20} />
            <div className="space-y-1">
              <h4 className="text-xs font-black dark:text-white uppercase tracking-wider">
                End-to-End Encryption (AES-GCM 256-bit)
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Все заметки и граф шифруются на телефоне вашим личным паролем перед отправкой в облако или экспортом. Ни один сервер или сторонний провайдер не имеет доступа к содержимому.
              </p>
            </div>
          </div>

          {/* Master Passphrase Input */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-2">
            <label className="text-xs font-black uppercase text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <KeyRound size={14} className="text-indigo-500" />
              Мастер-пароль шифрования
            </label>
            <div className="flex gap-2">
              <input
                type={showPassword ? 'text' : 'password'}
                value={passphrase}
                onChange={e => setPassphrase(e.target.value)}
                placeholder="Введите надежный пароль..."
                className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium dark:text-white outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                {showPassword ? 'Скрыть' : 'Показать'}
              </button>
            </div>
          </div>

          {/* Local File Vault Export / Import */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="text-xs font-bold dark:text-white flex items-center gap-1.5">
                <CloudDownload size={16} className="text-indigo-500" />
                Экспорт зашифрованного сейфа
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Сохраняет защищенный файл <span className="font-mono text-indigo-500">.smvault</span> для безопасного хранения
              </p>
              <button
                onClick={handleExportVault}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Скачать .smvault
              </button>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="text-xs font-bold dark:text-white flex items-center gap-1.5">
                <CloudUpload size={16} className="text-emerald-500" />
                Импорт и расшифровка
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Восстановление заметок и графа из зашифрованного архива
              </p>
              <label className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center">
                Выбрать .smvault
                <input
                  type="file"
                  accept=".smvault,.json,.enc"
                  onChange={handleImportVault}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* WebDAV Confidential Cloud Sync */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-3">
            <div className="text-xs font-black uppercase text-slate-700 dark:text-slate-200 flex items-center justify-between">
              <span>Синхронизация через WebDAV / Nextcloud</span>
              <span className="text-[9px] text-slate-400 font-mono">End-to-End Encrypted</span>
            </div>

            <div className="space-y-2">
              <input
                type="text"
                value={webDavUrl}
                onChange={e => setWebDavUrl(e.target.value)}
                placeholder="WebDAV URL: https://nextcloud.example.com/remote.php/webdav/vault.enc"
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium dark:text-white outline-none focus:border-indigo-500 font-mono text-[11px]"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={webDavUser}
                  onChange={e => setWebDavUser(e.target.value)}
                  placeholder="Логин / Пользователь"
                  className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium dark:text-white outline-none focus:border-indigo-500"
                />
                <input
                  type="password"
                  value={webDavPass}
                  onChange={e => setWebDavPass(e.target.value)}
                  placeholder="Пароль приложения"
                  className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium dark:text-white outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleWebDavUpload}
                disabled={isSyncingWebDav}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <CloudUpload size={14} /> Выгрузить в WebDAV
              </button>
              <button
                onClick={handleWebDavDownload}
                disabled={isSyncingWebDav}
                className="flex-1 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <CloudDownload size={14} /> Скачать из WebDAV
              </button>
            </div>
          </div>

          {/* Status feedback */}
          {syncStatusMsg && (
            <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
              syncStatusMsg.type === 'success' 
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' 
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
            }`}>
              {syncStatusMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              {syncStatusMsg.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

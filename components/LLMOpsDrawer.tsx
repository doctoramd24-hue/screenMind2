import React, { useState, useEffect } from 'react';
import { 
  Activity, Zap, Shield, Database, Sparkles, 
  Trash2, X, RefreshCw, Layers, DollarSign, Clock 
} from 'lucide-react';
import { LLMTrace } from '../types.ts';
import * as ai from '../utils/aiAdapter.ts';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const LLMOpsDrawer: React.FC<Props> = ({ isOpen, onClose }) => {
  const [traces, setTraces] = useState<LLMTrace[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [cacheStats, setCacheStats] = useState<any>(null);
  const [vectorStats, setVectorStats] = useState<any>(null);
  const [selectedTrace, setSelectedTrace] = useState<LLMTrace | null>(null);

  const refresh = () => {
    setTraces(ai.getLLMOpsTraces());
    setSummary(ai.getLLMOpsSummary());
    setCacheStats(ai.getSemanticCacheStats());
    setVectorStats(ai.getVectorDBStats());
  };

  useEffect(() => {
    if (isOpen) {
      refresh();
    }
  }, [isOpen]);

  const handleClear = () => {
    ai.clearLLMOpsTraces();
    ai.clearSemanticCache();
    refresh();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
        <motion.div 
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="w-full max-w-2xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-indigo-500/20">
                <Activity size={22} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-800 dark:text-white tracking-tight">
                  LLMOps & Telemetry Tracing
                </h3>
                <p className="text-xs text-slate-500 font-semibold">
                  Observability, TTFT, Offline RAG & Semantic Cache
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={refresh}
                className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                title="Обновить данные"
              >
                <RefreshCw size={18} />
              </button>
              <button 
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-100/50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                <Clock size={12} className="text-blue-500" /> Avg TTFT
              </div>
              <div className="text-lg font-black text-slate-800 dark:text-white mt-1">
                {summary?.avgTtftMs || 0} ms
              </div>
            </div>

            <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                <Zap size={12} className="text-amber-500" /> Cache Hit Rate
              </div>
              <div className="text-lg font-black text-amber-500 mt-1">
                {summary?.cacheHitRatePercent || 0}%
              </div>
            </div>

            <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                <Database size={12} className="text-emerald-500" /> RAG Vectors
              </div>
              <div className="text-lg font-black text-emerald-500 mt-1">
                {vectorStats?.totalChunks || 0}
              </div>
            </div>

            <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                <DollarSign size={12} className="text-purple-500" /> Est. Cost
              </div>
              <div className="text-lg font-black text-purple-500 mt-1">
                ${summary?.totalCostUsd || '0.00'}
              </div>
            </div>
          </div>

          {/* Trace List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                Недавние трассировки вызовов ({traces.length})
              </span>
              <button 
                onClick={handleClear}
                className="flex items-center gap-1 text-[11px] font-bold text-red-500 hover:text-red-600 transition-colors"
              >
                <Trash2 size={13} /> Очистить телеметрию
              </button>
            </div>

            {traces.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm font-semibold">
                Пока нет записанных трассировок. Задайте вопрос в чате или агенте!
              </div>
            ) : (
              traces.map(trace => (
                <div 
                  key={trace.id}
                  onClick={() => setSelectedTrace(selectedTrace?.id === trace.id ? null : trace)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    selectedTrace?.id === trace.id 
                      ? 'bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-800' 
                      : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-indigo-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-800 dark:text-white">
                        {trace.model}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                        {trace.provider}
                      </span>
                      {trace.cached && (
                        <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                          Semantic Cache
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-bold text-slate-500">
                      {new Date(trace.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Latency</span>
                      {trace.latencyMs} ms
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">TTFT</span>
                      {trace.ttftMs} ms
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Tokens</span>
                      {trace.totalTokens} t
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Cost</span>
                      ${trace.costEstimateUsd.toFixed(6)}
                    </div>
                  </div>

                  {/* Expanded Trace Details */}
                  {selectedTrace?.id === trace.id && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2 text-xs"
                    >
                      {trace.systemInstruction && (
                        <div>
                          <span className="font-bold text-slate-400 block mb-1">System Instruction:</span>
                          <p className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg text-slate-700 dark:text-slate-300 text-[11px]">
                            {trace.systemInstruction}
                          </p>
                        </div>
                      )}

                      {trace.firewallFlags && trace.firewallFlags.length > 0 && (
                        <div className="p-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg text-amber-700 dark:text-amber-300">
                          <span className="font-bold flex items-center gap-1 mb-1">
                            <Shield size={13} /> Prompt Firewall Alerts:
                          </span>
                          <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                            {trace.firewallFlags.map((flag, idx) => (
                              <li key={idx}>{flag}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

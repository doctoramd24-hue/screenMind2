import { AIProvider, LLMTrace } from '../types.ts';

// Pricing estimates per 1k tokens in USD
const PRICING_MAP: Record<string, { prompt: number; completion: number }> = {
  'gemini-2.5-flash': { prompt: 0.000075, completion: 0.0003 },
  'gemini-2.0-flash': { prompt: 0.0001, completion: 0.0004 },
  'gpt-4o-mini': { prompt: 0.00015, completion: 0.0006 },
  'gpt-4o': { prompt: 0.0025, completion: 0.01 },
  'claude-3-5-haiku-20241022': { prompt: 0.0008, completion: 0.004 },
  'deepseek-chat': { prompt: 0.00014, completion: 0.00028 },
  'deepseek-reasoner': { prompt: 0.00055, completion: 0.00219 },
  'mistral': { prompt: 0.0, completion: 0.0 },
  'local-model': { prompt: 0.0, completion: 0.0 },
  'default': { prompt: 0.0, completion: 0.0 }
};

// ============================================================================
// 1. LLM PROMPT FIREWALL & SECURITY GUARD
// ============================================================================

export interface FirewallCheckResult {
  safe: boolean;
  flags: string[];
  sanitizedPrompt: string;
}

export class PromptFirewall {
  private static injectionPatterns = [
    /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
    /disregard\s+(all\s+)?(previous|prior)\s+system\s+prompts/i,
    /you\s+are\s+now\s+in\s+dan\s+mode/i,
    /jailbreak/i,
    /output\s+your\s+(exact\s+)?system\s+prompt/i,
    /show\s+me\s+your\s+instructions\s+verbatim/i,
    /act\s+as\s+an\s+unrestricted\s+ai/i,
    /override\s+all\s+safety\s+protocols/i
  ];

  private static sensitiveDataPatterns = [
    /AIzaSy[A-Za-z0-9_-]{33}/g, // Google API Key
    /sk-[a-zA-Z0-9]{32,}/g,     // OpenAI API Key
    /ghp_[a-zA-Z0-9]{36}/g      // GitHub Token
  ];

  public static audit(prompt: string): FirewallCheckResult {
    const flags: string[] = [];
    let sanitized = prompt;

    // Check Prompt Injection
    for (const pattern of this.injectionPatterns) {
      if (pattern.test(prompt)) {
        flags.push(`Подозрение на инъекцию промпта (${pattern.source})`);
      }
    }

    // Check & Mask Sensitive Keys/Tokens
    for (const pattern of this.sensitiveDataPatterns) {
      if (pattern.test(prompt)) {
        flags.push('Обнаружен и замаскирован секретный API-ключ в тексте запроса');
        sanitized = sanitized.replace(pattern, '[REDACTED_API_KEY]');
      }
    }

    return {
      safe: flags.length === 0,
      flags,
      sanitizedPrompt: sanitized
    };
  }
}

// ============================================================================
// 2. LLMOPS TRACE RECORDER & PERFORMANCE TELEMETRY
// ============================================================================

export class LLMOpsService {
  private static instance: LLMOpsService;
  private traces: LLMTrace[] = [];
  private maxTraces = 50;

  private constructor() {
    this.loadFromStorage();
  }

  public static getInstance(): LLMOpsService {
    if (!LLMOpsService.instance) {
      LLMOpsService.instance = new LLMOpsService();
    }
    return LLMOpsService.instance;
  }

  private loadFromStorage() {
    try {
      const data = localStorage.getItem('screenmind_llm_traces');
      if (data) {
        this.traces = JSON.parse(data);
      }
    } catch (_) {}
  }

  private persist() {
    try {
      localStorage.setItem('screenmind_llm_traces', JSON.stringify(this.traces.slice(-50)));
    } catch (_) {}
  }

  public recordTrace(trace: Omit<LLMTrace, 'id' | 'costEstimateUsd'>): LLMTrace {
    const id = `trace_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    
    // Estimate cost
    const pricing = PRICING_MAP[trace.model] || { prompt: 0.0001, completion: 0.0004 };
    const cost = (trace.promptTokens / 1000) * pricing.prompt + (trace.completionTokens / 1000) * pricing.completion;

    const fullTrace: LLMTrace = {
      ...trace,
      id,
      costEstimateUsd: Math.round(cost * 1000000) / 1000000
    };

    this.traces.unshift(fullTrace);
    if (this.traces.length > this.maxTraces) {
      this.traces.pop();
    }

    this.persist();
    return fullTrace;
  }

  public getTraces(): LLMTrace[] {
    return [...this.traces];
  }

  public getSummary() {
    const total = this.traces.length;
    if (total === 0) {
      return {
        totalCalls: 0,
        avgLatencyMs: 0,
        avgTtftMs: 0,
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        totalCostUsd: 0,
        cacheHitRatePercent: 0
      };
    }

    const avgLatency = Math.round(this.traces.reduce((acc, t) => acc + t.latencyMs, 0) / total);
    const validTtft = this.traces.filter(t => t.ttftMs > 0);
    const avgTtft = validTtft.length > 0 
      ? Math.round(validTtft.reduce((acc, t) => acc + t.ttftMs, 0) / validTtft.length) 
      : 0;

    const totalPrompt = this.traces.reduce((acc, t) => acc + t.promptTokens, 0);
    const totalCompletion = this.traces.reduce((acc, t) => acc + t.completionTokens, 0);
    const totalCost = this.traces.reduce((acc, t) => acc + t.costEstimateUsd, 0);
    const cachedCount = this.traces.filter(t => t.cached).length;

    return {
      totalCalls: total,
      avgLatencyMs: avgLatency,
      avgTtftMs: avgTtft,
      totalPromptTokens: totalPrompt,
      totalCompletionTokens: totalCompletion,
      totalCostUsd: Number(totalCost.toFixed(5)),
      cacheHitRatePercent: Math.round((cachedCount / total) * 100)
    };
  }

  public clear(): void {
    this.traces = [];
    try {
      localStorage.removeItem('screenmind_llm_traces');
    } catch (_) {}
  }
}

import { 
  Settings, AIProvider, AIMetrics, Note, 
  LLMMessage, LLMRequest, LLMResponse, LLMProviderConfig, LLMTrace,
  StructuredKnowledgeOutput
} from '../types.ts';
import { GoogleGenAI } from "@google/genai";
import { LocalVectorDB } from './vectorDb.ts';
import { SemanticCache } from './semanticCache.ts';
import { LLMOpsService, PromptFirewall } from './llmOps.ts';
import { getSystemToolsPrompt } from './functionRegistry.ts';
import { cleanOcrText, getExistingTagsAndNodes } from './textCleaner.ts';

// ============================================================================
// 1. SYSTEM METRICS & CACHE SERVICES (SINGLETONS)
// ============================================================================

class MetricsService {
  private static instance: MetricsService;
  private metrics: AIMetrics = {
    totalRequests: 0,
    successRequests: 0,
    failedRequests: 0,
    averageLatency: 0,
    lastRequestTime: '',
    providerUsage: {},
    tokens: { prompt: 0, response: 0, total: 0 }
  };

  private constructor() {}

  public static getInstance(): MetricsService {
    if (!MetricsService.instance) {
      MetricsService.instance = new MetricsService();
    }
    return MetricsService.instance;
  }

  public getMetrics(): AIMetrics {
    return { ...this.metrics };
  }

  public record(
    latency: number, 
    success: boolean, 
    provider: string, 
    usage?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number }
  ): void {
    this.metrics.totalRequests++;
    if (success) this.metrics.successRequests++;
    else this.metrics.failedRequests++;

    this.metrics.averageLatency = 
      (this.metrics.averageLatency * (this.metrics.totalRequests - 1) + latency) / this.metrics.totalRequests;
    this.metrics.lastRequestTime = new Date().toISOString();
    this.metrics.providerUsage[provider] = (this.metrics.providerUsage[provider] || 0) + 1;

    if (usage) {
      this.metrics.tokens.prompt += usage.promptTokenCount || 0;
      this.metrics.tokens.response += usage.candidatesTokenCount || 0;
      this.metrics.tokens.total += usage.totalTokenCount || 0;
    }
  }

  public reset(): void {
    this.metrics = {
      totalRequests: 0,
      successRequests: 0,
      failedRequests: 0,
      averageLatency: 0,
      lastRequestTime: '',
      providerUsage: {},
      tokens: { prompt: 0, response: 0, total: 0 }
    };
  }
}

class CacheService {
  private static instance: CacheService;
  private cache = new Map<string, { response: any; timestamp: number }>();

  private constructor() {}

  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  private hashKey(prompt: string, model: string, provider: string): string {
    let hash = 0;
    const str = `${provider}:${model}:${prompt.slice(0, 300)}`;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString();
  }

  public get(prompt: string, model: string, provider: string, ttlMinutes: number): any | null {
    const key = this.hashKey(prompt, model, provider);
    const cached = this.cache.get(key);
    if (!cached) return null;

    const isExpired = (Date.now() - cached.timestamp) > (ttlMinutes * 60 * 1000);
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }
    return cached.response;
  }

  public set(prompt: string, model: string, provider: string, response: any): void {
    const key = this.hashKey(prompt, model, provider);
    this.cache.set(key, { response, timestamp: Date.now() });
  }

  public clear(): void {
    this.cache.clear();
  }
}

export const getMetrics = () => MetricsService.getInstance().getMetrics();
export const clearCache = () => CacheService.getInstance().clear();

// ============================================================================
// 2. MARKDOWN & XML CONTEXT HELPERS & STRUCTURED OUTPUT REPAIR
// ============================================================================

import { safeParseJSON } from './jsonRepair.ts';

export const extractJSON = (str: string): any => {
  if (!str) return {};
  const result = safeParseJSON(str);
  if (result.success && result.data) {
    return result.data;
  }
  console.warn("AI Adapter: Failed to parse JSON even with jsonrepair", str.slice(0, 100));
  return {};
};

/**
 * Format prompt with XML-like semantic tags inside pure Markdown.
 * Highly recognized by modern LLMs (Claude, GPT, DeepSeek, Gemini).
 */
export const wrapInXmlTag = (tagName: string, content: string): string => {
  return `<${tagName}>\n${content.trim()}\n</${tagName}>`;
};

// ============================================================================
// 3. ADAPTER PATTERN: UNIFIED LLM PROVIDER INTERFACES & ADAPTERS
// ============================================================================

export interface ILLMAdapter {
  readonly id: AIProvider;
  readonly name: string;
  readonly isLocal: boolean;
  call(req: LLMRequest, config: LLMProviderConfig): Promise<LLMResponse>;
  callStream?(
    req: LLMRequest, 
    config: LLMProviderConfig, 
    onChunk: (token: string, fullText: string) => void
  ): Promise<LLMResponse>;
}

// ----------------------------------------------------------------------------
// 3.1 Google Gemini Adapter
// ----------------------------------------------------------------------------
class GeminiAdapter implements ILLMAdapter {
  readonly id = AIProvider.Gemini;
  readonly name = "Google Gemini";
  readonly isLocal = false;

  async call(req: LLMRequest, config: LLMProviderConfig): Promise<LLMResponse> {
    const key = process.env.GEMINI_API_KEY || config.apiKey;
    if (!key) throw new Error("Gemini API Key missing. Please set it in Settings.");

    const ai = new GoogleGenAI({ apiKey: key });
    
    // Construct user prompt and content parts
    const lastUserMsg = [...req.messages].reverse().find(m => m.role === 'user')?.content || '';
    const parts: any[] = [{ text: lastUserMsg }];

    if (req.mediaPart) {
      parts.unshift({
        inlineData: {
          data: req.mediaPart.data,
          mimeType: req.mediaPart.mimeType
        }
      });
    }

    const modelName = config.model || 'gemini-2.5-flash';

    const response = await ai.models.generateContent({
      model: modelName,
      contents: [{ parts }],
      config: {
        systemInstruction: req.systemInstruction,
        responseMimeType: req.isJson ? "application/json" : undefined,
        temperature: config.temperature ?? req.temperature
      }
    });

    if (!response.text) {
      throw new Error("Gemini returned an empty response.");
    }

    return {
      text: response.text,
      usage: response.usageMetadata,
      model: modelName,
      provider: AIProvider.Gemini
    };
  }

  async callStream(
    req: LLMRequest, 
    config: LLMProviderConfig, 
    onChunk: (token: string, fullText: string) => void
  ): Promise<LLMResponse> {
    const key = process.env.GEMINI_API_KEY || config.apiKey;
    if (!key) throw new Error("Gemini API Key missing. Please set it in Settings.");

    const ai = new GoogleGenAI({ apiKey: key });
    const lastUserMsg = [...req.messages].reverse().find(m => m.role === 'user')?.content || '';
    const parts: any[] = [{ text: lastUserMsg }];

    if (req.mediaPart) {
      parts.unshift({
        inlineData: {
          data: req.mediaPart.data,
          mimeType: req.mediaPart.mimeType
        }
      });
    }

    const modelName = config.model || 'gemini-2.5-flash';
    const responseStream = await ai.models.generateContentStream({
      model: modelName,
      contents: [{ parts }],
      config: {
        systemInstruction: req.systemInstruction,
        responseMimeType: req.isJson ? "application/json" : undefined,
        temperature: config.temperature ?? req.temperature
      }
    });

    let fullText = '';
    for await (const chunk of responseStream) {
      const chunkText = chunk.text || '';
      fullText += chunkText;
      onChunk(chunkText, fullText);
    }

    return {
      text: fullText,
      model: modelName,
      provider: AIProvider.Gemini
    };
  }
}

// ----------------------------------------------------------------------------
// 3.2 OpenAI-Compatible Generic Adapter (OpenAI, DeepSeek, OpenRouter, LM Studio, llama.cpp, Ollama)
// ----------------------------------------------------------------------------
class OpenAICompatibleAdapter implements ILLMAdapter {
  constructor(
    public readonly id: AIProvider,
    public readonly name: string,
    public readonly isLocal: boolean,
    private readonly defaultUrl: string,
    private readonly defaultModel: string
  ) {}

  private resolveEndpoint(config: LLMProviderConfig): { url: string; headers: Record<string, string> } {
    let url = (config.url || '').trim().replace(/\/$/, '');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    switch (this.id) {
      case AIProvider.OpenAI:
        url = url || 'https://api.openai.com/v1';
        if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;
        if (!url.endsWith('/chat/completions')) url += '/chat/completions';
        break;

      case AIProvider.DeepSeek:
        url = url || 'https://api.deepseek.com/v1';
        if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;
        if (!url.endsWith('/chat/completions')) url += '/chat/completions';
        break;

      case AIProvider.Anthropic:
        // When using Anthropic directly or via OpenAI-compatible gateway
        url = url || 'https://api.anthropic.com/v1';
        if (config.apiKey) {
          headers['x-api-key'] = config.apiKey;
          headers['anthropic-version'] = '2023-06-01';
          headers['Authorization'] = `Bearer ${config.apiKey}`;
        }
        if (!url.endsWith('/messages') && !url.endsWith('/chat/completions')) {
          url += '/chat/completions';
        }
        break;

      case AIProvider.OpenRouter:
        url = url || 'https://openrouter.ai/api/v1';
        headers['HTTP-Referer'] = typeof window !== 'undefined' ? window.location.origin : 'https://screenmind.ai';
        headers['X-Title'] = 'ScreenMind2 Ultra';
        if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;
        if (!url.endsWith('/chat/completions')) url += '/chat/completions';
        break;

      case AIProvider.LMStudio:
        if (!url) url = '/api/lmstudio';
        if (url.startsWith('/api/lmstudio')) {
          if (!url.endsWith('/v1/chat/completions')) url += '/v1/chat/completions';
        } else {
          url = url || 'http://localhost:1234';
          if (!url.includes('/v1/') && !url.includes('/chat') && !url.includes('/completions')) {
            url += '/v1/chat/completions';
          }
        }
        if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;
        break;

      case AIProvider.LlamaCpp:
        if (!url) url = 'http://localhost:8080/v1';
        if (!url.endsWith('/chat/completions')) url += '/chat/completions';
        if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;
        break;

      case AIProvider.Ollama:
        if (!url) url = '/api/ollama';
        if (url.startsWith('/api/ollama')) {
          if (!url.endsWith('/api/chat')) url += '/api/chat';
        } else {
          url = url || 'http://localhost:11434';
          if (!url.includes('/api/')) url += '/api/chat';
        }
        break;

      default:
        url = url || this.defaultUrl;
        if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;
        if (!url.endsWith('/chat/completions')) url += '/chat/completions';
    }

    return { url, headers };
  }

  private buildMessages(req: LLMRequest): any[] {
    const formatted: any[] = [];
    if (req.systemInstruction) {
      formatted.push({ role: 'system', content: req.systemInstruction });
    }
    for (const msg of req.messages) {
      formatted.push({ role: msg.role, content: msg.content });
    }
    return formatted;
  }

  async call(req: LLMRequest, config: LLMProviderConfig): Promise<LLMResponse> {
    const { url, headers } = this.resolveEndpoint(config);
    const model = config.model || this.defaultModel;

    let body: any = {
      model,
      messages: this.buildMessages(req),
      temperature: config.temperature ?? req.temperature ?? 0.7,
      stream: false
    };

    if (this.id === AIProvider.Ollama) {
      body.format = req.isJson ? 'json' : undefined;
    } else {
      if (req.isJson) {
        body.response_format = { type: 'json_object' };
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.isLocal ? 45000 : 30000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: req.signal || controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`${this.name} Error (${res.status}): ${errText.slice(0, 250)}`);
      }

      const data = await res.json();
      if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));

      const content =
        data.choices?.[0]?.message?.content ||
        data.message?.content ||
        data.response ||
        data.content ||
        data.choices?.[0]?.text;

      if (typeof content === 'string') {
        const usage = data.usage ? {
          promptTokenCount: data.usage.prompt_tokens,
          candidatesTokenCount: data.usage.completion_tokens,
          totalTokenCount: data.usage.total_tokens
        } : undefined;

        return {
          text: content,
          usage,
          model,
          provider: this.id,
          reasoningText: data.choices?.[0]?.message?.reasoning_content
        };
      }

      throw new Error(`Unexpected response format from ${this.name}`);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error(`${this.name} timed out. Model may be loading weights.`);
      }
      if (error.message.includes('Failed to fetch')) {
        throw new Error(`Connection to ${this.name} failed at ${url}. Check CORS and ensure service is active.`);
      }
      throw error;
    }
  }

  async callStream(
    req: LLMRequest, 
    config: LLMProviderConfig, 
    onChunk: (token: string, fullText: string) => void
  ): Promise<LLMResponse> {
    const { url, headers } = this.resolveEndpoint(config);
    const model = config.model || this.defaultModel;

    const body: any = {
      model,
      messages: this.buildMessages(req),
      temperature: config.temperature ?? req.temperature ?? 0.7,
      stream: true
    };

    if (this.id === AIProvider.Ollama) {
      body.format = req.isJson ? 'json' : undefined;
    } else if (req.isJson) {
      body.response_format = { type: 'json_object' };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: req.signal
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`${this.name} Stream Error (${res.status}): ${errText.slice(0, 250)}`);
    }

    if (!res.body) {
      throw new Error(`ReadableStream not supported by ${this.name} response`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;

        if (this.id === AIProvider.Ollama) {
          try {
            const parsed = JSON.parse(trimmed);
            const token = parsed.message?.content || parsed.response || '';
            if (token) {
              fullText += token;
              onChunk(token, fullText);
            }
          } catch (_) {}
        } else {
          // SSE format: data: {"choices":[{"delta":{"content":"..."}}]}
          if (trimmed.startsWith('data: ')) {
            try {
              const jsonStr = trimmed.replace(/^data:\s*/, '');
              const parsed = JSON.parse(jsonStr);
              const token = parsed.choices?.[0]?.delta?.content || '';
              if (token) {
                fullText += token;
                onChunk(token, fullText);
              }
            } catch (_) {}
          }
        }
      }
    }

    return {
      text: fullText,
      model,
      provider: this.id
    };
  }
}

// ============================================================================
// 4. DYNAMIC PROVIDER FACTORY (ProviderFactory)
// ============================================================================

export class ProviderFactory {
  private static registry = new Map<AIProvider, ILLMAdapter>([
    [AIProvider.Gemini, new GeminiAdapter()],
    [AIProvider.OpenAI, new OpenAICompatibleAdapter(AIProvider.OpenAI, "OpenAI", false, "https://api.openai.com/v1", "gpt-4o-mini")],
    [AIProvider.Anthropic, new OpenAICompatibleAdapter(AIProvider.Anthropic, "Anthropic Claude", false, "https://api.anthropic.com/v1", "claude-3-5-haiku-20241022")],
    [AIProvider.DeepSeek, new OpenAICompatibleAdapter(AIProvider.DeepSeek, "DeepSeek", false, "https://api.deepseek.com/v1", "deepseek-chat")],
    [AIProvider.OpenRouter, new OpenAICompatibleAdapter(AIProvider.OpenRouter, "OpenRouter", false, "https://openrouter.ai/api/v1", "google/gemini-2.0-flash-001")],
    [AIProvider.Ollama, new OpenAICompatibleAdapter(AIProvider.Ollama, "Ollama Local", true, "/api/ollama", "mistral")],
    [AIProvider.LMStudio, new OpenAICompatibleAdapter(AIProvider.LMStudio, "LM Studio Local", true, "/api/lmstudio", "local-model")],
    [AIProvider.LlamaCpp, new OpenAICompatibleAdapter(AIProvider.LlamaCpp, "llama.cpp Local", true, "http://localhost:8080/v1", "default")]
  ]);

  public static getAdapter(provider: AIProvider): ILLMAdapter {
    const adapter = this.registry.get(provider);
    if (!adapter) {
      // Fallback to OpenRouter or Gemini
      return this.registry.get(AIProvider.Gemini)!;
    }
    return adapter;
  }

  public static getAllAdapters(): ILLMAdapter[] {
    return Array.from(this.registry.values());
  }

  public static registerCustomAdapter(provider: AIProvider, adapter: ILLMAdapter): void {
    this.registry.set(provider, adapter);
  }
}

// ============================================================================
// 5. DEPENDENCY INJECTION: LLM SERVICE & SCOPED SESSIONS
// ============================================================================

export class LLMService {
  private static instance: LLMService;
  private metrics = MetricsService.getInstance();
  private cache = CacheService.getInstance();
  private semanticCache = SemanticCache.getInstance();
  private llmOps = LLMOpsService.getInstance();

  private constructor() {}

  public static getInstance(): LLMService {
    if (!LLMService.instance) {
      LLMService.instance = new LLMService();
    }
    return LLMService.instance;
  }

  private async withRetry<T>(fn: () => Promise<T>, retries = 2, delay = 1000): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      if (retries <= 0) throw error;
      const msg = (error.message || '').toLowerCase();
      if (msg.includes('fetch') || msg.includes('network') || msg.includes('429') || msg.includes('503') || msg.includes('502')) {
        console.warn(`[LLMService] Retrying request (${retries} attempts left)...`);
        await new Promise(r => setTimeout(r, delay));
        return this.withRetry(fn, retries - 1, delay * 2);
      }
      throw error;
    }
  }

  public async execute(
    req: LLMRequest, 
    config: LLMProviderConfig, 
    settingsContext?: Settings
  ): Promise<LLMResponse> {
    const startTime = performance.now();
    const adapter = ProviderFactory.getAdapter(config.provider);
    const lastUserMsg = [...req.messages].reverse().find(m => m.role === 'user')?.content || '';

    // 1. LLM Firewall Security Audit
    const firewallResult = PromptFirewall.audit(lastUserMsg);
    if (!firewallResult.safe) {
      console.warn('[PromptFirewall] Flagged request:', firewallResult.flags);
    }

    // 2. Semantic Cache Check (Cosine similarity > 0.88)
    if (settingsContext?.cacheEnabled !== false && !req.stream) {
      const semanticMatch = this.semanticCache.get(lastUserMsg, config.provider, config.model);
      if (semanticMatch) {
        const trace = this.llmOps.recordTrace({
          timestamp: new Date().toISOString(),
          provider: config.provider,
          model: config.model,
          latencyMs: 1,
          ttftMs: 1,
          promptTokens: Math.round(lastUserMsg.length / 4),
          completionTokens: Math.round(semanticMatch.entry.response.length / 4),
          totalTokens: Math.round((lastUserMsg.length + semanticMatch.entry.response.length) / 4),
          cached: true,
          systemInstruction: req.systemInstruction,
          firewallBlocked: false,
          firewallFlags: firewallResult.flags
        });

        return {
          text: semanticMatch.entry.response,
          model: config.model,
          provider: config.provider
        };
      }
    }

    try {
      const response = await this.withRetry(() => adapter.call(req, config));
      const latency = Math.round(performance.now() - startTime);
      
      this.metrics.record(latency, true, config.provider, response.usage);

      // Save to Semantic Cache
      if (settingsContext?.cacheEnabled !== false && !req.stream && response.text) {
        this.semanticCache.set(lastUserMsg, response.text, config.provider, config.model);
      }

      // Record LLMOps Trace
      const promptTokens = response.usage?.promptTokenCount || Math.round(lastUserMsg.length / 4);
      const compTokens = response.usage?.candidatesTokenCount || Math.round(response.text.length / 4);

      this.llmOps.recordTrace({
        timestamp: new Date().toISOString(),
        provider: config.provider,
        model: config.model,
        latencyMs: latency,
        ttftMs: latency,
        promptTokens,
        completionTokens: compTokens,
        totalTokens: promptTokens + compTokens,
        cached: false,
        systemInstruction: req.systemInstruction,
        firewallBlocked: false,
        firewallFlags: firewallResult.flags
      });

      return response;
    } catch (error: any) {
      const latency = Math.round(performance.now() - startTime);
      this.metrics.record(latency, false, config.provider);
      throw error;
    }
  }

  public async executeStream(
    req: LLMRequest, 
    config: LLMProviderConfig, 
    onChunk: (token: string, fullText: string) => void,
    settingsContext?: Settings
  ): Promise<LLMResponse> {
    const startTime = performance.now();
    const adapter = ProviderFactory.getAdapter(config.provider);
    const lastUserMsg = [...req.messages].reverse().find(m => m.role === 'user')?.content || '';

    // 1. LLM Firewall Security Audit
    const firewallResult = PromptFirewall.audit(lastUserMsg);

    // 2. Semantic Cache Check for Instant Stream
    if (settingsContext?.cacheEnabled !== false) {
      const semanticMatch = this.semanticCache.get(lastUserMsg, config.provider, config.model);
      if (semanticMatch) {
        onChunk(semanticMatch.entry.response, semanticMatch.entry.response);
        this.llmOps.recordTrace({
          timestamp: new Date().toISOString(),
          provider: config.provider,
          model: config.model,
          latencyMs: 2,
          ttftMs: 1,
          promptTokens: Math.round(lastUserMsg.length / 4),
          completionTokens: Math.round(semanticMatch.entry.response.length / 4),
          totalTokens: Math.round((lastUserMsg.length + semanticMatch.entry.response.length) / 4),
          cached: true,
          systemInstruction: req.systemInstruction,
          firewallBlocked: false,
          firewallFlags: firewallResult.flags
        });

        return {
          text: semanticMatch.entry.response,
          model: config.model,
          provider: config.provider
        };
      }
    }

    let firstTokenTime = 0;

    try {
      let response: LLMResponse;
      const wrappedChunkHandler = (token: string, fullText: string) => {
        if (!firstTokenTime) {
          firstTokenTime = performance.now();
        }
        onChunk(token, fullText);
      };

      if (adapter.callStream) {
        response = await adapter.callStream(req, config, wrappedChunkHandler);
      } else {
        response = await adapter.call(req, config);
        wrappedChunkHandler(response.text, response.text);
      }

      const totalLatency = Math.round(performance.now() - startTime);
      const ttftMs = firstTokenTime ? Math.round(firstTokenTime - startTime) : totalLatency;

      this.metrics.record(totalLatency, true, config.provider, response.usage);

      // Save to Semantic Cache
      if (response.text) {
        this.semanticCache.set(lastUserMsg, response.text, config.provider, config.model);
      }

      // Record LLMOps Trace
      const promptTokens = response.usage?.promptTokenCount || Math.round(lastUserMsg.length / 4);
      const compTokens = response.usage?.candidatesTokenCount || Math.round(response.text.length / 4);

      this.llmOps.recordTrace({
        timestamp: new Date().toISOString(),
        provider: config.provider,
        model: config.model,
        latencyMs: totalLatency,
        ttftMs,
        promptTokens,
        completionTokens: compTokens,
        totalTokens: promptTokens + compTokens,
        cached: false,
        systemInstruction: req.systemInstruction,
        firewallBlocked: false,
        firewallFlags: firewallResult.flags
      });

      return response;
    } catch (error: any) {
      const latency = Math.round(performance.now() - startTime);
      this.metrics.record(latency, false, config.provider);
      throw error;
    }
  }
}

/**
 * Scoped Chat Session: Transient stateful session for interactive UI dialogs
 */
export class ChatSession {
  private history: LLMMessage[] = [];
  private llmService = LLMService.getInstance();
  private abortController: AbortController | null = null;

  constructor(
    private config: LLMProviderConfig,
    private systemPrompt?: string
  ) {}

  public getHistory(): LLMMessage[] {
    return [...this.history];
  }

  public clear(): void {
    this.history = [];
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  public async send(
    userMessage: string, 
    onToken?: (token: string, fullText: string) => void
  ): Promise<string> {
    this.history.push({ role: 'user', content: userMessage });

    this.abortController = new AbortController();
    const req: LLMRequest = {
      messages: this.history,
      systemInstruction: this.systemPrompt,
      signal: this.abortController.signal
    };

    try {
      let responseText = '';
      if (onToken) {
        const res = await this.llmService.executeStream(req, this.config, (token, full) => {
          responseText = full;
          onToken(token, full);
        });
        responseText = res.text;
      } else {
        const res = await this.llmService.execute(req, this.config);
        responseText = res.text;
      }

      this.history.push({ role: 'assistant', content: responseText });
      return responseText;
    } catch (err) {
      this.history.pop(); // Remove user message on failure
      throw err;
    } finally {
      this.abortController = null;
    }
  }
}

// ============================================================================
// 6. HIGH-LEVEL DOMAIN OPERATIONS (Knowledge Base, Split, OCR, Audio)
// ============================================================================

async function callAI(
  prompt: string,
  provider: AIProvider,
  model: string,
  apiKey: string,
  baseUrl: string,
  isJson: boolean,
  systemInstruction?: string,
  mediaPart?: { data: string; mimeType: string },
  settingsContext?: Settings
): Promise<any> {
  const llmService = LLMService.getInstance();
  const config: LLMProviderConfig = {
    provider: provider || AIProvider.Gemini,
    model: model || (provider === AIProvider.Gemini ? 'gemini-2.5-flash' : 'gpt-4o-mini'),
    apiKey,
    url: baseUrl
  };

  const req: LLMRequest = {
    messages: [{ role: 'user', content: prompt }],
    systemInstruction,
    isJson,
    mediaPart
  };

  const response = await llmService.execute(req, config, settingsContext);
  if (!isJson) return response.text;

  const parsed = safeParseJSON(response.text);
  if (parsed.success && parsed.data) {
    return parsed.data;
  }

  // LLMOps Retry Mechanism: Auto retry with micro-prompt if JSON is broken and cannot be repaired
  try {
    const repairPrompt = `Ты вернул некорректный синтаксис JSON. Исправь его и верни ТОЛЬКО строго валидный JSON без markdown:\n\n${response.text.slice(0, 3000)}`;
    const retryReq: LLMRequest = {
      messages: [{ role: 'user', content: repairPrompt }],
      systemInstruction: 'You are a JSON repair validator. Return only pure raw JSON.',
      isJson: true
    };
    const retryRes = await llmService.execute(retryReq, config, settingsContext);
    const secondAttempt = safeParseJSON(retryRes.text);
    if (secondAttempt.success && secondAttempt.data) {
      return secondAttempt.data;
    }
  } catch (_) {}

  return parsed.data || {};
}

export const analyzeText = async (text: string, settings: Settings, existingNotes?: Note[]): Promise<StructuredKnowledgeOutput> => {
  const cleanedText = cleanOcrText(text);
  const meta = getExistingTagsAndNodes(existingNotes || [], 100);
  const metaTagsStr = meta.tags.length > 0 ? meta.tags.join(', ') : 'нет';
  const metaNodesStr = meta.nodes.length > 0 ? meta.nodes.join(', ') : 'нет';

  const systemInstruction = `Вы — ядро базы знаний ScreenMind. Ваша задача — проанализировать входящий текст (или OCR-текст скриншота) и превратить его в структурированную единицу знаний для графа.

Пытайся связать запись с уже СУЩЕСТВУЮЩИМИ узлами и тегами, если они подходят по смыслу (не создавай лишних синонимов).
Существующие теги: [${metaTagsStr}]
Существующие узлы графа: [${metaNodesStr}]

Вы должны вернуть ответ строго в формате JSON, без какого-либо лишнего текста, без markdown-разметки типа \`\`\`json.

Схема JSON:
{
  "title": "Короткий, емкий заголовок (до 5-7 слов)",
  "summary": "Главная суть текста в 1-2 предложениях",
  "hashtags": ["тег1", "тег2"],
  "extracted_links": ["https://ссылка1"],
  "related_nodes": ["Ключевая концепция 1", "Ключевая концепция 2"],
  "action_items": ["Действие 1, если есть"]
}`;

  const prompt = `Проанализируйте входящий текст и верните строго JSON по указанной схеме:
${wrapInXmlTag('input_text', cleanedText.slice(0, 8000))}

Строгий JSON-ответ:`;

  const raw = await callAI(
    prompt,
    settings.provider,
    settings.model,
    settings.apiKey,
    settings.url,
    true,
    systemInstruction,
    undefined,
    settings
  );

  // Normalize structure and ensure consistent types
  const hashtags = Array.isArray(raw?.hashtags) 
    ? raw.hashtags.map(String).filter((t: string) => t.trim()) 
    : (Array.isArray(raw?.tags) ? raw.tags.map(String).filter((t: string) => t.trim()) : []);

  const relatedNodes = Array.isArray(raw?.related_nodes) 
    ? raw.related_nodes.map(String).filter((n: string) => n.trim()) 
    : (Array.isArray(raw?.relatedKeywords) ? raw.relatedKeywords.map(String).filter((n: string) => n.trim()) : []);

  const extractedLinks = Array.isArray(raw?.extracted_links) 
    ? raw.extracted_links.map(String).filter((l: string) => l.trim()) 
    : (Array.isArray(raw?.links) ? raw.links.map(String).filter((l: string) => l.trim()) : []);

  const actionItems = Array.isArray(raw?.action_items) 
    ? raw.action_items.map(String).filter((a: string) => a.trim()) 
    : [];

  return {
    title: (typeof raw?.title === 'string' && raw.title.trim()) ? raw.title.trim() : 'Заметка',
    summary: typeof raw?.summary === 'string' ? raw.summary.trim() : '',
    hashtags,
    tags: hashtags,
    extracted_links: extractedLinks,
    related_nodes: relatedNodes,
    relatedKeywords: relatedNodes,
    action_items: actionItems,
    category: raw?.category || 'Общее'
  };
};

export const splitLargeText = async (text: string, settings: Settings) => {
  const limit = settings.splitChunkSize || 15000;
  const prompt = `Split this large longform text into logical, standalone atomic knowledge cards.
${wrapInXmlTag('source_text', text.slice(0, limit))}

RETURN JSON ARRAY:
[
  {
    "title": "Card Title",
    "content": "Card Content formatted in clean Markdown",
    "category": "Suggested Category"
  }
]`;

  return await callAI(
    prompt,
    settings.splitProvider,
    settings.splitModel,
    settings.splitApiKey,
    settings.splitUrl,
    true,
    "Expert Editor & Knowledge Decomposer",
    undefined,
    settings
  );
};

export const clusterIdeas = async (
  ideas: { id: string; title: string; tags: string[] }[], 
  settings: Settings
) => {
  const input = JSON.stringify(ideas, null, 2);
  const prompt = `Analyze these ideas and organize them into thematic clusters.
${wrapInXmlTag('ideas_dataset', input)}

RETURN JSON:
{
  "clusters": [
    {
      "name": "Cluster Name",
      "ids": ["id1", "id2"]
    }
  ]
}`;

  return await callAI(
    prompt,
    settings.agentProvider,
    settings.agentModel,
    settings.agentApiKey,
    settings.agentUrl,
    true,
    "Senior Knowledge Graph & Clustering Specialist",
    undefined,
    settings
  );
};

export const transcribeAudio = async (blob: Blob, settings: Settings) => {
  const reader = new FileReader();
  const base64: string = await new Promise((resolve) => {
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(blob);
  });

  return await callAI(
    "Transcribe this speech accurately into clear text.",
    settings.transProvider,
    settings.transModel,
    settings.transApiKey,
    settings.transUrl,
    false,
    "Expert Audio Transcriber",
    { data: base64, mimeType: blob.type },
    settings
  );
};

export const chatWithNotes = async (
  query: string, 
  note: any, 
  settings: Settings, 
  historicalContext?: Note[],
  onChunk?: (token: string, fullText: string) => void
) => {
  let contextBlock = "";

  // 1. Offline RAG Semantic Search for top relevant notes/chunks
  const vectorDb = LocalVectorDB.getInstance();
  const relevantChunks = vectorDb.search(query, 5, 0.35);

  if (relevantChunks.length > 0) {
    const ragFormatted = relevantChunks
      .map((c, i) => `[Источник ${i + 1}: "${c.title}" (${c.category}, релевантность: ${Math.round(c.score * 100)}%)]\n${c.text}`)
      .join('\n\n---\n\n');
    contextBlock += wrapInXmlTag('offline_rag_knowledge_context', ragFormatted) + "\n\n";
  } else if (historicalContext && historicalContext.length > 0) {
    const relatedNotesFormatted = historicalContext
      .map((h, i) => `${i + 1}. **${h.title}** (${h.category}): ${h.summary || h.content.slice(0, 100)}`)
      .join('\n');
    contextBlock += wrapInXmlTag('related_notes', relatedNotesFormatted) + "\n\n";
  }

  if (note && typeof note !== 'string') {
    const mainNoteContent = `
# ${note.title || 'Untitled Note'}
- **Category**: ${note.category}
- **Tags**: ${note.tags?.join(', ')}
- **Summary**: ${note.summary || 'N/A'}

## Content:
${note.content}
`;
    contextBlock += wrapInXmlTag('selected_note', mainNoteContent);
  } else if (typeof note === 'string' && note.trim()) {
    contextBlock += wrapInXmlTag('additional_context', note);
  }

  const fullPrompt = `${contextBlock}\n\n${wrapInXmlTag('user_query', query)}`;
  const systemInstruction = `You are the ScreenMind Neural Assistant with Offline RAG capability. You synthesize knowledge, uncover hidden connections, cite sources accurately, and provide clear, markdown-formatted answers. Keep answers structured, insightful and concise.`;

  if (onChunk) {
    const config: LLMProviderConfig = {
      provider: settings.provider || AIProvider.Gemini,
      model: settings.model || 'gemini-2.5-flash',
      apiKey: settings.apiKey,
      url: settings.url
    };
    const req: LLMRequest = {
      messages: [{ role: 'user', content: fullPrompt }],
      systemInstruction
    };
    const res = await LLMService.getInstance().executeStream(req, config, onChunk, settings);
    return res.text;
  }

  return await callAI(
    fullPrompt,
    settings.provider,
    settings.model,
    settings.apiKey,
    settings.url,
    false,
    systemInstruction,
    undefined,
    settings
  );
};

export const chatWithAgent = async (
  query: string, 
  appData: any, 
  settings: Settings,
  onChunk?: (token: string, fullText: string) => void
) => {
  const context = wrapInXmlTag('system_telemetry', JSON.stringify(appData, null, 2));
  const toolsSchema = getSystemToolsPrompt();
  const prompt = `${context}\n${toolsSchema}\n\n${wrapInXmlTag('user_request', query)}`;
  const systemInstruction = "You are the ScreenMind Autonomous System Agent with Function Calling capabilities. You oversee database health, goals, logs, and user productivity. Use native tools when appropriate by outputting the JSON tool call block, and explain system features clearly.";

  if (onChunk) {
    const config: LLMProviderConfig = {
      provider: settings.agentProvider || AIProvider.Gemini,
      model: settings.agentModel || 'gemini-2.5-flash',
      apiKey: settings.agentApiKey,
      url: settings.agentUrl
    };
    const req: LLMRequest = {
      messages: [{ role: 'user', content: prompt }],
      systemInstruction
    };
    const res = await LLMService.getInstance().executeStream(req, config, onChunk, settings);
    return res.text;
  }

  return await callAI(
    prompt,
    settings.agentProvider,
    settings.agentModel,
    settings.agentApiKey,
    settings.agentUrl,
    false,
    systemInstruction,
    undefined,
    settings
  );
};

export const performOCR = async (base64Data: string, mimeType: string, settings: Settings) => {
  const dataOnly = base64Data.split(',')[1] || base64Data;
  const rawText = await callAI(
    "Perform optical character recognition (OCR) on this image. Extract all text preserving headings, tables and lists in Markdown format.",
    settings.ocrProvider,
    settings.ocrModel,
    settings.ocrApiKey,
    settings.ocrUrl,
    false,
    "OCR Vision Specialist",
    { data: dataOnly, mimeType },
    settings
  );
  return cleanOcrText(rawText);
};

export const semanticSearch = async (query: string, notes: Note[], settings: Settings) => {
  // Sync notes in offline vector database first
  const vectorDb = LocalVectorDB.getInstance();
  vectorDb.syncNotes(notes);

  // Perform instant offline hybrid vector search
  const localResults = vectorDb.search(query, 10, 0.35);

  if (localResults.length > 0) {
    return {
      results: localResults.map(r => ({
        id: r.noteId,
        relevance: r.score,
        reason: `Локальный семантический векторный матч (${Math.round(r.score * 100)}%) в фрагменте заметки: "${r.title}"`
      }))
    };
  }

  // Fallback to LLM if no local vector matches found
  const notesSummary = notes
    .map(n => ({ id: n.id, title: n.title, summary: n.summary || n.content.slice(0, 100) }))
    .slice(0, 50);

  const prompt = `Perform semantic match for the user query across these notes.
${wrapInXmlTag('user_query', query)}
${wrapInXmlTag('notes_corpus', JSON.stringify(notesSummary))}

RETURN JSON:
{
  "results": [
    {
      "id": "noteId",
      "relevance": 0.95,
      "reason": "Clear explanation of semantic match"
    }
  ]
}`;

  return await callAI(
    prompt,
    settings.agentProvider,
    settings.agentModel,
    settings.agentApiKey,
    settings.agentUrl,
    true,
    "Vector & Semantic Search Specialist",
    undefined,
    settings
  );
};

// ============================================================================
// 7. RAG, CACHE & LLMOPS TELEMETRY ACCESSORS
// ============================================================================

export const getVectorDBStats = () => LocalVectorDB.getInstance().getStats();
export const syncVectorDB = (notes: Note[]) => LocalVectorDB.getInstance().syncNotes(notes);
export const searchVectorDB = (query: string, limit = 5) => LocalVectorDB.getInstance().search(query, limit);

export const getSemanticCacheStats = () => SemanticCache.getInstance().getStats();
export const clearSemanticCache = () => SemanticCache.getInstance().clear();

export const getLLMOpsTraces = () => LLMOpsService.getInstance().getTraces();
export const getLLMOpsSummary = () => LLMOpsService.getInstance().getSummary();
export const clearLLMOpsTraces = () => LLMOpsService.getInstance().clear();

export const testConnection = async (settings: Settings) => {
  try {
    const startTime = performance.now();
    const res = await callAI(
      "Respond with 'OK' and your model name in one word.",
      settings.provider,
      settings.model,
      settings.apiKey,
      settings.url,
      false,
      undefined,
      undefined,
      settings
    );
    const latency = Math.round(performance.now() - startTime);
    return { success: true, message: `Connected (${latency}ms): ${res}` };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
};

export const testSpecificConnection = async (
  provider: AIProvider, 
  url: string, 
  model: string, 
  key: string
) => {
  const mockSettings = { provider, url, model, apiKey: key, cacheEnabled: false } as Settings;
  return testConnection(mockSettings);
};

export const openInGoogle = (query: string) => {
  if (!query) return;
  window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
};

export const linkify = (text: string) => {
  const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
  return text.replace(urlRegex, function(url) {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-500 underline decoration-blue-500/30 hover:text-blue-600 transition-colors break-all">${url}</a>`;
  });
};

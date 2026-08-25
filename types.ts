
export type NoteStatus = 'new' | 'in-work' | 'read' | 'finished' | 'trash' | 'archived';

export interface StructuredKnowledgeOutput {
  title: string;
  summary: string;
  hashtags: string[];
  extracted_links: string[];
  related_nodes: string[];
  action_items: string[];
  category?: string;
  tags?: string[];
  relatedKeywords?: string[];
}

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  hashtags?: string[];
  category: string;
  summary: string;
  links: string[];
  extracted_links?: string[];
  related_nodes?: string[];
  action_items?: string[];
  vector?: number[]; // 384-dimensional dense semantic embedding for Offline RAG
  createdAt: string;
  updatedAt: string;
  status: NoteStatus;
  isIndexed?: boolean;
  sourceType?: 'manual' | 'ocr' | 'audio' | 'telegram' | 'split';
  audioData?: string; 
  screenshot?: string; // Base64 or URL for gallery view
  position?: { x: number; y: number };
  size?: { w: number; h: number };
}

export interface AIProfile {
  id: string;
  name: string;
  settings: Settings;
  createdAt: string;
}

export interface Settings {
  provider: AIProvider;
  url: string;
  model: string;
  apiKey: string;
  theme: 'light' | 'dark';
  customCategories: string[];
  
  // Modules
  ocrProvider: AIProvider;
  ocrModel: string;
  ocrApiKey: string;
  ocrUrl: string;
  
  transProvider: AIProvider;
  transModel: string;
  transApiKey: string;
  transUrl: string;
  
  agentProvider: AIProvider;
  agentModel: string;
  agentApiKey: string;
  agentUrl: string;
  
  tgToken: string;
  tgChatId: string;
  tgLastUpdateId: number;
  
  // Smart Split
  splitProvider: AIProvider;
  splitModel: string;
  splitApiKey: string;
  splitUrl: string;
  splitChunkSize: number; // Characters limit per chunk
  
  // Cache
  cacheEnabled: boolean;
  cacheTTL: number; // in minutes

  // Local & Mobile Custom Models Library
  customLocalModels?: CustomLocalModel[];

  // Graph Entity Resolution (Auto-merging synonyms)
  entityResolutionEnabled?: boolean;
  entityResolutionThreshold?: number; // 0.75 - 0.95

  // E2EE Confidential Cloud Sync (WebDAV / Remote Vault)
  e2eeSyncEnabled?: boolean;
  e2eeSyncUrl?: string; // e.g. https://nextcloud.example.com/remote.php/webdav/screenmind_vault.enc
  e2eeSyncUsername?: string;
  e2eeSyncPassword?: string;
  e2eePassphrase?: string;
  lastE2EESync?: string;
}

export interface GraphMergeReport {
  totalMerged: number;
  mergedNodes: { from: string; to: string; similarity: number }[];
  mergedTags: { from: string; to: string; similarity: number }[];
  affectedNotesCount: number;
}

export interface EncryptedVaultPayload {
  version: string;
  timestamp: string;
  salt: string; // Base64
  iv: string;   // Base64
  ciphertext: string; // Base64 AES-GCM
  noteCount: number;
}

export interface CustomLocalModel {
  id: string;
  name: string;
  provider: AIProvider;
  url: string;
  model: string;
  apiKey?: string;
  description?: string;
  deviceType?: 'phone_termux' | 'phone_llamacpp' | 'local_wifi' | 'custom_api';
  contextSize?: number;
  addedAt?: string;
}

export enum AIProvider {
  Gemini = 'Gemini',
  OpenAI = 'OpenAI',
  Anthropic = 'Anthropic',
  DeepSeek = 'DeepSeek',
  OpenRouter = 'OpenRouter',
  Ollama = 'Ollama',
  LMStudio = 'LM Studio',
  LlamaCpp = 'llama.cpp'
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMContentPart {
  type: 'text' | 'image' | 'audio';
  text?: string;
  media?: {
    data: string; // base64
    mimeType: string;
  };
}

export interface LLMRequest {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  isJson?: boolean;
  jsonSchema?: Record<string, any>;
  systemInstruction?: string;
  mediaPart?: {
    data: string;
    mimeType: string;
  };
  stream?: boolean;
  signal?: AbortSignal;
}

export interface LLMResponse {
  text: string;
  usage?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  model?: string;
  provider?: AIProvider;
  reasoningText?: string;
}

export interface LLMProviderConfig {
  provider: AIProvider;
  model: string;
  apiKey?: string;
  url?: string;
  temperature?: number;
}

export interface AppLog {
  id: string;
  timestamp: string;
  level: 'info' | 'error' | 'warn' | 'success';
  message: string;
  details?: string;
}

export interface AIMetrics {
  totalRequests: number;
  successRequests: number;
  failedRequests: number;
  averageLatency: number;
  lastRequestTime: string;
  providerUsage: Record<string, number>;
  tokens: {
    prompt: number;
    response: number;
    total: number;
  };
}

export interface BackupMetadata {
  id: string;
  date: string;
  version: string;
  noteCount: number;
  size: number;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  color: string;
  status: 'active' | 'completed';
}

export interface TelegramMessage {
  id: number;
  text: string;
  date: string;
  from: string;
  type: 'text' | 'photo' | 'document';
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  widgets?: GenerativeUIWidget[];
  toolCalls?: ToolCall[];
  traceId?: string;
  cached?: boolean;
  cacheSimilarity?: number;
}

export interface VectorDocument {
  id: string;
  noteId: string;
  chunkIndex: number;
  text: string;
  vector: number[];
  metadata: {
    title: string;
    category: string;
    tags: string[];
    updatedAt: string;
  };
}

export interface VectorSearchResult {
  id: string;
  noteId: string;
  text: string;
  score: number;
  title: string;
  category: string;
  tags: string[];
}

export interface SemanticCacheEntry {
  id: string;
  query: string;
  vector: number[];
  response: string;
  timestamp: number;
  hits: number;
  model: string;
  provider: AIProvider;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required?: string[];
  };
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
}

export interface GenerativeUIWidget {
  type: 'note_card' | 'stats_card' | 'action_confirm' | 'goal_card' | 'search_results' | 'tag_cloud' | 'system_status';
  title?: string;
  data: any;
}

export interface ToolExecutionResult {
  callId: string;
  toolName: string;
  success: boolean;
  result: any;
  uiWidget?: GenerativeUIWidget;
}

export interface LLMTrace {
  id: string;
  timestamp: string;
  provider: AIProvider;
  model: string;
  latencyMs: number;
  ttftMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costEstimateUsd: number;
  systemInstruction?: string;
  ragChunks?: { noteId: string; title: string; score: number; textSnippet: string }[];
  toolsCalled?: string[];
  cached?: boolean;
  firewallBlocked?: boolean;
  firewallFlags?: string[];
}

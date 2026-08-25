import { AIProvider, SemanticCacheEntry } from '../types.ts';
import { generateLocalEmbedding, cosineSimilarity } from './vectorDb.ts';

export class SemanticCache {
  private static instance: SemanticCache;
  private entries: Map<string, SemanticCacheEntry> = new Map();
  private totalHits = 0;
  private totalSavedTokens = 0;

  private constructor() {
    // Restore from localStorage if available
    this.loadFromStorage();
  }

  public static getInstance(): SemanticCache {
    if (!SemanticCache.instance) {
      SemanticCache.instance = new SemanticCache();
    }
    return SemanticCache.instance;
  }

  private loadFromStorage() {
    try {
      const data = localStorage.getItem('screenmind_semantic_cache');
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          parsed.forEach((entry: SemanticCacheEntry) => {
            this.entries.set(entry.id, entry);
          });
        }
      }
    } catch (_) {}
  }

  private persistToStorage() {
    try {
      const arr = Array.from(this.entries.values()).slice(-100); // Keep last 100 entries
      localStorage.setItem('screenmind_semantic_cache', JSON.stringify(arr));
    } catch (_) {}
  }

  /**
   * Look up a semantically equivalent query in cache
   * @param query User query text
   * @param provider Current provider
   * @param model Current model
   * @param similarityThreshold Threshold between 0.80 and 0.98 (default 0.88)
   */
  public get(
    query: string,
    provider: AIProvider,
    model: string,
    similarityThreshold = 0.88
  ): { entry: SemanticCacheEntry; similarity: number } | null {
    if (!query.trim() || this.entries.size === 0) return null;

    const queryVector = generateLocalEmbedding(query);
    let bestMatch: SemanticCacheEntry | null = null;
    let bestSimilarity = 0;

    for (const entry of Array.from(this.entries.values())) {
      // Must match provider and model to ensure response style/accuracy
      if (entry.provider === provider && entry.model === model) {
        const sim = cosineSimilarity(queryVector, entry.vector);
        if (sim > bestSimilarity && sim >= similarityThreshold) {
          bestSimilarity = sim;
          bestMatch = entry;
        }
      }
    }

    if (bestMatch) {
      bestMatch.hits++;
      this.totalHits++;
      // Approximate token savings: prompt length / 4 + response length / 4
      const approxSaved = Math.round((query.length + bestMatch.response.length) / 4);
      this.totalSavedTokens += approxSaved;
      this.persistToStorage();
      return { entry: bestMatch, similarity: Math.round(bestSimilarity * 100) / 100 };
    }

    return null;
  }

  /**
   * Store a query and its LLM response in semantic cache
   */
  public set(query: string, response: string, provider: AIProvider, model: string): void {
    if (!query.trim() || !response.trim()) return;

    const id = `sc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const vector = generateLocalEmbedding(query);

    const entry: SemanticCacheEntry = {
      id,
      query,
      vector,
      response,
      timestamp: Date.now(),
      hits: 0,
      model,
      provider
    };

    // If cache exceeds limit, remove oldest
    if (this.entries.size > 200) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey) this.entries.delete(oldestKey);
    }

    this.entries.set(id, entry);
    this.persistToStorage();
  }

  public getStats() {
    return {
      entriesCount: this.entries.size,
      totalHits: this.totalHits,
      totalSavedTokens: this.totalSavedTokens,
      estimatedSavedCostUsd: (this.totalSavedTokens * 0.000003).toFixed(5)
    };
  }

  public clear(): void {
    this.entries.clear();
    this.totalHits = 0;
    this.totalSavedTokens = 0;
    try {
      localStorage.removeItem('screenmind_semantic_cache');
    } catch (_) {}
  }
}

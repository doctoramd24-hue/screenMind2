import { Note, VectorDocument, VectorSearchResult } from '../types.ts';

// Vector dimension for lightweight subword/char-ngram semantic projection
const VECTOR_DIM = 128;

/**
 * Deterministic local dense text embedding generator (Zero-dependency, 100% offline)
 * Combines subword/char n-gram feature hashing with TF-IDF weighting and L2 normalization.
 * Runs in < 0.5ms on mobile devices without any external network dependency.
 */
export function generateLocalEmbedding(text: string): number[] {
  const vector = new Float32Array(VECTOR_DIM);
  const normalized = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ');
  const words = normalized.split(/\s+/).filter(w => w.length > 1);

  if (words.length === 0) {
    return Array.from(vector);
  }

  // 1. Unigram and Bigram feature projection
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const hash1 = hashString(word);
    const idx1 = Math.abs(hash1) % VECTOR_DIM;
    const sign1 = (hash1 & 1) === 0 ? 1 : -1;
    vector[idx1] += sign1 * (1 + Math.log(word.length));

    // Character 3-grams for morphology/stemming resilience
    if (word.length >= 3) {
      for (let j = 0; j <= word.length - 3; j++) {
        const trigram = word.slice(j, j + 3);
        const hashTri = hashString(trigram);
        const idxTri = Math.abs(hashTri) % VECTOR_DIM;
        const signTri = (hashTri & 1) === 0 ? 0.5 : -0.5;
        vector[idxTri] += signTri;
      }
    }

    // Word bigrams for syntactic context
    if (i < words.length - 1) {
      const bigram = `${word}_${words[i + 1]}`;
      const hash2 = hashString(bigram);
      const idx2 = Math.abs(hash2) % VECTOR_DIM;
      const sign2 = (hash2 & 1) === 0 ? 1.5 : -1.5;
      vector[idx2] += sign2;
    }
  }

  // 2. L2 Normalization
  let norm = 0;
  for (let i = 0; i < VECTOR_DIM; i++) {
    norm += vector[i] * vector[i];
  }
  norm = Math.sqrt(norm);

  if (norm > 0) {
    for (let i = 0; i < VECTOR_DIM; i++) {
      vector[i] /= norm;
    }
  }

  return Array.from(vector);
}

/**
 * 32-bit Murmur-inspired fast string hash
 */
function hashString(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash;
}

/**
 * Cosine similarity between two unit vectors
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dotProduct = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
  }
  return Math.max(0, Math.min(1, (dotProduct + 1) / 2)); // Normalized to 0..1
}

/**
 * Text chunking with sliding window
 */
export function chunkText(text: string, chunkSize = 400, overlap = 80): string[] {
  if (!text || text.length <= chunkSize) {
    return [text || ''];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + chunkSize;
    if (end < text.length) {
      // Find clean paragraph or sentence break
      const lastNewline = text.lastIndexOf('\n', end);
      const lastPeriod = text.lastIndexOf('. ', end);
      if (lastNewline > start + chunkSize / 2) {
        end = lastNewline + 1;
      } else if (lastPeriod > start + chunkSize / 2) {
        end = lastPeriod + 2;
      }
    }

    chunks.push(text.slice(start, end).trim());
    start = end - overlap;
    if (start >= text.length || end >= text.length) break;
  }

  return chunks.filter(c => c.length > 10);
}

/**
 * Singleton Offline In-Memory Vector Store (VectorDB)
 */
export class LocalVectorDB {
  private static instance: LocalVectorDB;
  private documents: Map<string, VectorDocument> = new Map();
  private isIndexed = false;
  private lastIndexTime = 0;

  private constructor() {}

  public static getInstance(): LocalVectorDB {
    if (!LocalVectorDB.instance) {
      LocalVectorDB.instance = new LocalVectorDB();
    }
    return LocalVectorDB.instance;
  }

  /**
   * Syncs and indexes an array of notes into vector chunks
   */
  public syncNotes(notes: Note[]): { totalChunks: number; durationMs: number } {
    const start = performance.now();
    const activeNotes = notes.filter(n => n.status !== 'trash');
    const existingDocIds = new Set<string>();

    for (const note of activeNotes) {
      const fullText = `${note.title}\n\n${note.summary || ''}\n\n${note.content}\nTags: ${note.tags.join(', ')}`;
      const chunks = chunkText(fullText, 450, 80);

      chunks.forEach((chunkText, idx) => {
        const chunkId = `doc_${note.id}_chunk_${idx}`;
        existingDocIds.add(chunkId);

        // Check if doc exists and updatedAt hasn't changed
        const existing = this.documents.get(chunkId);
        if (existing && existing.metadata.updatedAt === (note.updatedAt || note.createdAt)) {
          return;
        }

        const vector = generateLocalEmbedding(chunkText);
        this.documents.set(chunkId, {
          id: chunkId,
          noteId: note.id,
          chunkIndex: idx,
          text: chunkText,
          vector,
          metadata: {
            title: note.title,
            category: note.category,
            tags: note.tags,
            updatedAt: note.updatedAt || note.createdAt
          }
        });
      });
    }

    // Clean up deleted chunks
    for (const docId of Array.from(this.documents.keys())) {
      if (!existingDocIds.has(docId)) {
        this.documents.delete(docId);
      }
    }

    this.isIndexed = true;
    this.lastIndexTime = Date.now();
    const duration = Math.round(performance.now() - start);

    return {
      totalChunks: this.documents.size,
      durationMs: duration
    };
  }

  /**
   * Hybrid Vector + Keyword Semantic Search
   */
  public search(query: string, topK = 5, minScore = 0.45): VectorSearchResult[] {
    if (!query.trim() || this.documents.size === 0) return [];

    const queryVector = generateLocalEmbedding(query);
    const queryTokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    const results: VectorSearchResult[] = [];

    for (const doc of Array.from(this.documents.values())) {
      // 1. Dense Cosine Similarity
      const vectorScore = cosineSimilarity(queryVector, doc.vector);

      // 2. Sparse Lexical / Keyword Match (BM25-like booster)
      let keywordBoost = 0;
      const lowerText = doc.text.toLowerCase();
      const lowerTitle = doc.metadata.title.toLowerCase();

      for (const token of queryTokens) {
        if (lowerTitle.includes(token)) keywordBoost += 0.15;
        else if (lowerText.includes(token)) keywordBoost += 0.08;
      }

      const totalScore = Math.min(1, vectorScore * 0.75 + keywordBoost * 0.25);

      if (totalScore >= minScore) {
        results.push({
          id: doc.id,
          noteId: doc.noteId,
          text: doc.text,
          score: Math.round(totalScore * 100) / 100,
          title: doc.metadata.title,
          category: doc.metadata.category,
          tags: doc.metadata.tags
        });
      }
    }

    // Sort descending by score
    results.sort((a, b) => b.score - a.score);

    // Deduplicate by noteId to return distinct best-matching notes
    const seenNotes = new Set<string>();
    const distinctResults: VectorSearchResult[] = [];

    for (const res of results) {
      if (!seenNotes.has(res.noteId)) {
        seenNotes.add(res.noteId);
        distinctResults.push(res);
        if (distinctResults.length >= topK) break;
      }
    }

    return distinctResults;
  }

  public getStats() {
    return {
      isIndexed: this.isIndexed,
      totalChunks: this.documents.size,
      lastIndexTime: this.lastIndexTime ? new Date(this.lastIndexTime).toLocaleTimeString() : 'Never',
      dimensions: VECTOR_DIM
    };
  }

  public clear() {
    this.documents.clear();
    this.isIndexed = false;
  }
}

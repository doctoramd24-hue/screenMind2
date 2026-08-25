import { Note, GraphMergeReport } from '../types.ts';

/**
 * Common synonym clusters for automatic Graph Entity Resolution
 */
const CANONICAL_SYNONYM_GROUPS: { canonical: string; aliases: string[] }[] = [
  {
    canonical: 'ИИ и Нейросети',
    aliases: ['ии', 'нейросеть', 'нейросети', 'нейросетями', 'нейросетях', 'нейросетей', 'ai', 'artificial intelligence', 'artificial_intelligence', 'машинное обучение', 'ml', 'machine learning', 'глубокое обучение', 'deep learning']
  },
  {
    canonical: 'LLM и Промпты',
    aliases: ['llm', 'языковые модели', 'large language models', 'промпт', 'промпты', 'промптинг', 'prompt engineering', 'ollama', 'qwen', 'llama', 'gpt', 'deepseek']
  },
  {
    canonical: 'Криптовалюта и Блокчейн',
    aliases: ['крипта', 'криптовалюта', 'криптовалюты', 'биткоин', 'btc', 'bitcoin', 'eth', 'ethereum', 'эфир', 'блокчейн', 'blockchain', 'crypto', 'defi', 'web3', 'стейкинг']
  },
  {
    canonical: 'Разработка и Кодинг',
    aliases: ['разработка', 'программирование', 'кодинг', 'код', 'dev', 'coding', 'development', 'software', 'софт', 'frontend', 'backend', 'fullstack', 'скрипт']
  },
  {
    canonical: 'Авто и Техобслуживание',
    aliases: ['авто', 'машина', 'автомобиль', 'мотор', 'двигатель', 'техосмотр', 'замена масла', 'ремонт авто', 'сто', 'шиномонтаж', 'car', 'vehicle', 'auto']
  },
  {
    canonical: 'Здоровье и Медицина',
    aliases: ['здоровье', 'медицина', 'врач', 'лекарства', 'таблетки', 'лечение', 'симптом', 'симптомы', 'анализы', 'витамины', 'health', 'medical']
  },
  {
    canonical: 'Финансы и Бюджет',
    aliases: ['финансы', 'деньги', 'бюджет', 'доходы', 'расходы', 'инвестиции', 'акции', 'вклады', 'банк', 'кошелек', 'finance', 'money', 'budget']
  },
  {
    canonical: 'Продуктивность и Задачи',
    aliases: ['продуктивность', 'тайм-менеджмент', 'задачи', 'планирование', 'цели', 'дедлайн', 'дедлайны', 'проект', 'проекты', 'productivity', 'tasks', 'gtd']
  }
];

/**
 * Calculates Levenshtein string distance
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,       // deletion
        dp[i][j - 1] + 1,       // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[m][n];
}

/**
 * Normalized string similarity score (0.0 to 1.0)
 */
export function stringSimilarity(strA: string, strB: string): number {
  const s1 = strA.trim().toLowerCase();
  const s2 = strB.trim().toLowerCase();

  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;

  // Direct substring inclusion for terms > 3 chars
  if (s1.length > 3 && s2.length > 3) {
    if (s1.startsWith(s2) || s2.startsWith(s1) || s1.includes(s2) || s2.includes(s1)) {
      const lenDiff = Math.abs(s1.length - s2.length);
      return Math.max(0.82, 1.0 - (lenDiff / Math.max(s1.length, s2.length)));
    }
  }

  const maxLen = Math.max(s1.length, s2.length);
  const distance = levenshteinDistance(s1, s2);
  return Math.max(0, 1.0 - distance / maxLen);
}

/**
 * Suffix stemmer for Russian/English plurals & case endings
 */
function normalizeStem(text: string): string {
  let s = text.trim().toLowerCase();
  // Strip leading hashtag
  s = s.replace(/^#+/, '');
  // Replace underscores and dashes with space
  s = s.replace(/[-_]/g, ' ');

  // Russian common noun inflections
  s = s.replace(/(?:ями|ами|ями|ях|ах|ов|ев|ей|ий|ья|ье|ия|ии|ы|и|а|у|е|о|я)$/iu, '');
  // English common inflections
  s = s.replace(/(?:ing|ies|es|s|ed)$/iu, '');

  return s.trim();
}

/**
 * Resolves a single candidate entity or tag against an existing pool of concepts.
 * Returns the canonical name if match similarity >= threshold.
 */
export function resolveGraphEntity(
  candidate: string,
  existingPool: string[],
  threshold = 0.85
): { resolved: string; matched: boolean; similarity: number } {
  const raw = candidate.trim();
  if (!raw) return { resolved: candidate, matched: false, similarity: 0 };

  const clean = raw.replace(/^#+/, '').trim();
  const cleanLower = clean.toLowerCase();

  // 1. Check Synonym Knowledge Base first
  for (const group of CANONICAL_SYNONYM_GROUPS) {
    if (group.aliases.some(alias => alias.toLowerCase() === cleanLower || normalizeStem(alias) === normalizeStem(cleanLower))) {
      // Check if canonical or any group alias already exists in pool
      const existingInPool = existingPool.find(p => {
        const pLower = p.replace(/^#+/, '').toLowerCase();
        return pLower === group.canonical.toLowerCase() || group.aliases.some(a => a.toLowerCase() === pLower);
      });

      if (existingInPool) {
        return { resolved: existingInPool, matched: true, similarity: 0.98 };
      }
      return { resolved: group.canonical, matched: true, similarity: 0.95 };
    }
  }

  // 2. Check Stem Matching against existing pool
  const candidateStem = normalizeStem(clean);
  for (const existing of existingPool) {
    const cleanExisting = existing.replace(/^#+/, '').trim();
    if (!cleanExisting) continue;

    if (cleanExisting.toLowerCase() === cleanLower) {
      return { resolved: existing, matched: true, similarity: 1.0 };
    }

    const existingStem = normalizeStem(cleanExisting);
    if (candidateStem.length >= 3 && candidateStem === existingStem) {
      return { resolved: existing, matched: true, similarity: 0.94 };
    }

    const sim = stringSimilarity(clean, cleanExisting);
    if (sim >= threshold) {
      return { resolved: existing, matched: true, similarity: sim };
    }
  }

  // No close existing match found - return original
  return { resolved: candidate, matched: false, similarity: 0 };
}

/**
 * Resolves an array of entities/tags, deduplicating and aligning with the existing graph pool.
 */
export function resolveEntityList(
  candidates: string[],
  existingPool: string[],
  threshold = 0.85
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const item of candidates) {
    const { resolved } = resolveGraphEntity(item, existingPool, threshold);
    const key = resolved.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(resolved);
    }
  }

  return result;
}

/**
 * Performs full database Graph Entity Resolution & Auto-Merging.
 * Merges redundant synonym nodes and tags across all notes.
 */
export function autoMergeGraph(
  notes: Note[],
  threshold = 0.85
): { updatedNotes: Note[]; report: GraphMergeReport } {
  // 1. Collect all unique tags and related_nodes across notes
  const tagFrequency = new Map<string, number>();
  const nodeFrequency = new Map<string, number>();

  for (const note of notes) {
    if (note.status === 'trash') continue;

    (note.tags || []).forEach(t => {
      const clean = t.trim();
      if (clean) tagFrequency.set(clean, (tagFrequency.get(clean) || 0) + 1);
    });

    (note.related_nodes || []).forEach(n => {
      const clean = n.trim();
      if (clean) nodeFrequency.set(clean, (nodeFrequency.get(clean) || 0) + 1);
    });
  }

  // Sort canonical pool by frequency descending (most popular names become canonical)
  const canonicalTags = Array.from(tagFrequency.keys()).sort(
    (a, b) => (tagFrequency.get(b) || 0) - (tagFrequency.get(a) || 0)
  );
  const canonicalNodes = Array.from(nodeFrequency.keys()).sort(
    (a, b) => (nodeFrequency.get(b) || 0) - (nodeFrequency.get(a) || 0)
  );

  const mergedTags: { from: string; to: string; similarity: number }[] = [];
  const mergedNodes: { from: string; to: string; similarity: number }[] = [];
  const tagMapping = new Map<string, string>();
  const nodeMapping = new Map<string, string>();

  // 2. Build Tag Canonical Mapping
  const finalTagsPool: string[] = [];
  for (const tag of canonicalTags) {
    const res = resolveGraphEntity(tag, finalTagsPool, threshold);
    if (res.matched && res.resolved !== tag) {
      tagMapping.set(tag, res.resolved);
      mergedTags.push({ from: tag, to: res.resolved, similarity: res.similarity });
    } else {
      finalTagsPool.push(tag);
      tagMapping.set(tag, tag);
    }
  }

  // 3. Build Node Canonical Mapping
  const finalNodesPool: string[] = [];
  for (const node of canonicalNodes) {
    const res = resolveGraphEntity(node, finalNodesPool, threshold);
    if (res.matched && res.resolved !== node) {
      nodeMapping.set(node, res.resolved);
      mergedNodes.push({ from: node, to: res.resolved, similarity: res.similarity });
    } else {
      finalNodesPool.push(node);
      nodeMapping.set(node, node);
    }
  }

  // 4. Apply Mapping to all notes
  let affectedNotesCount = 0;
  const updatedNotes = notes.map(note => {
    let noteModified = false;

    // Resolve Tags
    const newTags: string[] = [];
    const seenTags = new Set<string>();
    for (const t of note.tags || []) {
      const canonical = tagMapping.get(t) || t;
      if (canonical !== t) noteModified = true;
      const key = canonical.toLowerCase();
      if (!seenTags.has(key)) {
        seenTags.add(key);
        newTags.push(canonical);
      }
    }

    // Resolve Related Nodes
    const newNodes: string[] = [];
    const seenNodes = new Set<string>();
    for (const n of note.related_nodes || []) {
      const canonical = nodeMapping.get(n) || n;
      if (canonical !== n) noteModified = true;
      const key = canonical.toLowerCase();
      if (!seenNodes.has(key)) {
        seenNodes.add(key);
        newNodes.push(canonical);
      }
    }

    if (noteModified) {
      affectedNotesCount++;
      return {
        ...note,
        tags: newTags,
        hashtags: newTags,
        related_nodes: newNodes,
        updatedAt: new Date().toISOString()
      };
    }

    return note;
  });

  const report: GraphMergeReport = {
    totalMerged: mergedTags.length + mergedNodes.length,
    mergedTags,
    mergedNodes,
    affectedNotesCount
  };

  return { updatedNotes, report };
}

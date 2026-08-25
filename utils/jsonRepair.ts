import { jsonrepair } from 'jsonrepair';

/**
 * Robust JSON extraction & repair utility for compact local LLMs (Qwen 1.5B, Llama 1B/3B, etc.)
 */

export interface ParseJSONResult<T = any> {
  success: boolean;
  data: T | null;
  repaired: boolean;
  error?: string;
}

/**
 * Extracts and cleans JSON string from LLM responses, stripping reasoning blocks, markdown fences, and noise.
 */
export function extractCleanJsonString(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';

  // 1. Remove reasoning / thought tags (<think>...</think>, <reasoning>...</reasoning>)
  let clean = raw.replace(/<think>[\s\S]*?<\/think>/gi, '');
  clean = clean.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');

  // 2. Remove markdown code fences
  clean = clean.replace(/```(?:json|javascript|js)?\s*([\s\S]*?)\s*```/gi, '$1');
  clean = clean.replace(/^```[\s\S]*?$/gm, '');

  clean = clean.trim();

  // 3. If there is remaining text outside root JSON object/array, find the outermost boundaries
  const firstBrace = clean.indexOf('{');
  const firstBracket = clean.indexOf('[');

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    const lastBrace = clean.lastIndexOf('}');
    if (lastBrace !== -1 && lastBrace > firstBrace) {
      clean = clean.substring(firstBrace, lastBrace + 1);
    } else {
      clean = clean.substring(firstBrace);
    }
  } else if (firstBracket !== -1) {
    const lastBracket = clean.lastIndexOf(']');
    if (lastBracket !== -1 && lastBracket > firstBracket) {
      clean = clean.substring(firstBracket, lastBracket + 1);
    } else {
      clean = clean.substring(firstBracket);
    }
  }

  return clean.trim();
}

/**
 * Safely parses any potentially malformed JSON string using native JSON.parse with jsonrepair fallback.
 */
export function safeParseJSON<T = any>(input: string): ParseJSONResult<T> {
  const cleaned = extractCleanJsonString(input);
  if (!cleaned) {
    return { success: false, data: null, repaired: false, error: 'Empty JSON input' };
  }

  // 1. Native JSON.parse attempt
  try {
    const parsed = JSON.parse(cleaned);
    return { success: true, data: parsed, repaired: false };
  } catch (initialErr: any) {
    // 2. Fallback to jsonrepair
    try {
      const repairedString = jsonrepair(cleaned);
      const repairedData = JSON.parse(repairedString);
      return {
        success: true,
        data: repairedData,
        repaired: true
      };
    } catch (repairErr: any) {
      // 3. Aggressive custom heuristics (unclosed quotes, trailing commas, single quotes)
      try {
        let heuristicStr = cleaned
          .replace(/,\s*([}\]])/g, '$1') // remove trailing commas
          .replace(/'/g, '"')           // replace single quotes with double quotes
          .replace(/[\u0000-\u001F]+/g, ' '); // remove control chars
        
        // Auto-close missing trailing brace or bracket
        const openBraces = (heuristicStr.match(/\{/g) || []).length;
        const closeBraces = (heuristicStr.match(/\}/g) || []).length;
        if (openBraces > closeBraces) {
          heuristicStr += '}'.repeat(openBraces - closeBraces);
        }

        const openBrackets = (heuristicStr.match(/\[/g) || []).length;
        const closeBrackets = (heuristicStr.match(/\]/g) || []).length;
        if (openBrackets > closeBrackets) {
          heuristicStr += ']'.repeat(openBrackets - closeBrackets);
        }

        const repairedData = JSON.parse(jsonrepair(heuristicStr));
        return {
          success: true,
          data: repairedData,
          repaired: true
        };
      } catch (finalErr: any) {
        return {
          success: false,
          data: null,
          repaired: false,
          error: `JSON parse & repair failed: ${repairErr.message || initialErr.message}`
        };
      }
    }
  }
}

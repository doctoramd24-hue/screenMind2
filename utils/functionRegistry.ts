import React from 'react';
import { ToolDefinition, ToolCall, ToolExecutionResult, GenerativeUIWidget, Note, Goal } from '../types.ts';
import { LocalVectorDB } from './vectorDb.ts';

export const SYSTEM_TOOLS: ToolDefinition[] = [
  {
    name: 'create_note',
    description: 'Создать новую заметку или мысль в базе знаний ScreenMind.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Заголовок заметки' },
        content: { type: 'string', description: 'Основной текст заметки в Markdown' },
        category: { type: 'string', description: 'Категория (Идеи, Общее, Цели, Проекты и т.д.)' },
        tags: { type: 'string', description: 'Список тегов через запятую (например, "ии, архитектура, стартап")' }
      },
      required: ['content']
    }
  },
  {
    name: 'search_notes',
    description: 'Выполнить мгновенный локальный семантический поиск по всем заметкам базы знаний (Offline RAG).',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Поисковый запрос или ключевые смысловые понятия' },
        limit: { type: 'string', description: 'Максимальное количество результатов (по умолчанию 5)' }
      },
      required: ['query']
    }
  },
  {
    name: 'create_goal',
    description: 'Создать новую стратегическую цель или проект в трекере целей.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Название цели' },
        description: { type: 'string', description: 'Подробное описание и критерии выполнения' }
      },
      required: ['title']
    }
  },
  {
    name: 'get_system_stats',
    description: 'Получить полную сводку и телеметрию базы знаний (количество заметок, цели, статус ИИ, векторный индекс).',
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'export_notes_markdown',
    description: 'Экспортировать всю базу знаний в виде ZIP-архива с Markdown-файлами.',
    parameters: {
      type: 'object',
      properties: {}
    }
  }
];

export function getSystemToolsPrompt(): string {
  return `\n## Доступные системные инструменты (Native Function Calling):
Вы можете вызывать следующие системные инструменты для реальных действий в приложении. 
Если действие пользователя требует выполнения одного из этих инструментов, верните JSON-блок вызова инструмента:
\`\`\`json
{
  "tool": "название_инструмента",
  "args": { "параметр1": "значение" }
}
\`\`\`

Инструменты:
${JSON.stringify(SYSTEM_TOOLS, null, 2)}
`;
}

/**
 * Detect and parse tool calls from LLM response
 */
export function extractToolCall(text: string): { toolCall: ToolCall | null; cleanText: string } {
  if (!text) return { toolCall: null, cleanText: text };

  // 1. Check for ```json { "tool": "...", "args": {...} } ```
  const toolJsonRegex = /```json\s*\{\s*"tool"\s*:\s*"([^"]+)"[\s\S]*?\}\s*```/i;
  const match = text.match(toolJsonRegex);

  if (match) {
    try {
      const parsed = JSON.parse(match[0].replace(/^```json\s*/, '').replace(/\s*```$/, ''));
      if (parsed.tool) {
        const clean = text.replace(match[0], '').trim();
        return {
          toolCall: {
            id: `call_${Date.now()}`,
            name: parsed.tool,
            args: parsed.args || {}
          },
          cleanText: clean
        };
      }
    } catch (_) {}
  }

  // 2. Direct JSON check
  try {
    const trimmed = text.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const parsed = JSON.parse(trimmed);
      if (parsed.tool) {
        return {
          toolCall: {
            id: `call_${Date.now()}`,
            name: parsed.tool,
            args: parsed.args || {}
          },
          cleanText: ''
        };
      }
    }
  } catch (_) {}

  return { toolCall: null, cleanText: text };
}

/**
 * Execute tool call with appContext actions
 */
export async function executeTool(
  toolCall: ToolCall,
  contextActions: {
    addNote: (content: string, title?: string, sourceType?: Note['sourceType'], useAI?: boolean, category?: string, audioData?: string, initialTags?: string[]) => Promise<void>;
    notes: Note[];
    goals: Goal[];
    setGoals?: React.Dispatch<React.SetStateAction<Goal[]>>;
    exportToMarkdown?: () => void;
  }
): Promise<ToolExecutionResult> {
  const { name, args } = toolCall;

  switch (name) {
    case 'create_note': {
      const content = args.content || '';
      const title = args.title || 'Новая заметка от Ассистента';
      const category = args.category || 'Общее';
      const tags = typeof args.tags === 'string' 
        ? args.tags.split(',').map((t: string) => t.trim().replace(/^#/, '')) 
        : Array.isArray(args.tags) ? args.tags : ['ai-agent'];

      await contextActions.addNote(content, title, 'manual', false, category, undefined, tags);

      const widget: GenerativeUIWidget = {
        type: 'note_card',
        title: 'Заметка создана',
        data: {
          title,
          content,
          category,
          tags
        }
      };

      return {
        callId: toolCall.id,
        toolName: name,
        success: true,
        result: `Заметка "${title}" успешно сохранена в категорию "${category}".`,
        uiWidget: widget
      };
    }

    case 'search_notes': {
      const query = args.query || '';
      const limit = parseInt(args.limit || '5', 10);
      const vectorDb = LocalVectorDB.getInstance();
      const results = vectorDb.search(query, limit, 0.35);

      const widget: GenerativeUIWidget = {
        type: 'search_results',
        title: `Результаты Offline RAG поиска по запросу "${query}"`,
        data: {
          query,
          count: results.length,
          results: results.map(r => ({
            id: r.noteId,
            title: r.title,
            score: Math.round(r.score * 100),
            category: r.category,
            snippet: r.text.slice(0, 150)
          }))
        }
      };

      return {
        callId: toolCall.id,
        toolName: name,
        success: true,
        result: results,
        uiWidget: widget
      };
    }

    case 'create_goal': {
      const title = args.title || 'Новая цель';
      const description = args.description || '';
      const newGoal: Goal = {
        id: crypto.randomUUID(),
        title,
        description,
        createdAt: new Date().toLocaleDateString('ru-RU'),
        color: '#3b82f6',
        status: 'active'
      };

      if (contextActions.setGoals) {
        contextActions.setGoals(prev => [newGoal, ...prev]);
      }

      const widget: GenerativeUIWidget = {
        type: 'goal_card',
        title: 'Цель добавлена',
        data: newGoal
      };

      return {
        callId: toolCall.id,
        toolName: name,
        success: true,
        result: `Цель "${title}" успешно добавлена.`,
        uiWidget: widget
      };
    }

    case 'get_system_stats': {
      const activeNotes = contextActions.notes.filter(n => n.status !== 'trash');
      const inWork = activeNotes.filter(n => n.status === 'in-work').length;
      const finished = activeNotes.filter(n => n.status === 'finished').length;
      const allTags = Array.from(new Set(activeNotes.flatMap(n => n.tags || [])));
      const vectorStats = LocalVectorDB.getInstance().getStats();

      const widget: GenerativeUIWidget = {
        type: 'stats_card',
        title: 'Сводка системы ScreenMind',
        data: {
          totalNotes: activeNotes.length,
          inWork,
          finished,
          totalGoals: contextActions.goals.length,
          uniqueTags: allTags.length,
          vectorChunks: vectorStats.totalChunks
        }
      };

      return {
        callId: toolCall.id,
        toolName: name,
        success: true,
        result: widget.data,
        uiWidget: widget
      };
    }

    case 'export_notes_markdown': {
      if (contextActions.exportToMarkdown) {
        contextActions.exportToMarkdown();
      }
      return {
        callId: toolCall.id,
        toolName: name,
        success: true,
        result: 'Экспорт всей базы знаний в Markdown запущен.',
        uiWidget: {
          type: 'action_confirm',
          title: 'Экспорт Markdown',
          data: { message: 'Архив Markdown сформирован и загружен.' }
        }
      };
    }

    default:
      return {
        callId: toolCall.id,
        toolName: name,
        success: false,
        result: `Неизвестный инструмент: ${name}`
      };
  }
}

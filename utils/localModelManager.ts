import { AIProvider, CustomLocalModel } from '../types.ts';

export interface MobileModelPreset {
  id: string;
  name: string;
  provider: AIProvider;
  url: string;
  model: string;
  ramUsage: string;
  speedRating: 'Ultra Fast' | 'Fast' | 'Medium' | 'Heavy';
  category: 'text' | 'reasoning' | 'vision';
  description: string;
  recommendedFor: string;
  installCommand?: string;
}

export const RECOMMENDED_MOBILE_MODELS: MobileModelPreset[] = [
  {
    id: 'qwen25-05b',
    name: 'Qwen 2.5 (0.5B) - Ultra Light',
    provider: AIProvider.Ollama,
    url: 'http://127.0.0.1:11434',
    model: 'qwen2.5:0.5b',
    ramUsage: '~390 MB RAM',
    speedRating: 'Ultra Fast',
    category: 'text',
    description: 'Сверхлегкая модель, летает на любом бюджетном телефоне. Идеальна для тегирования и кратких выжимок.',
    recommendedFor: 'Телефоны с 2-4 ГБ RAM, мгновенный отклик',
    installCommand: 'ollama run qwen2.5:0.5b'
  },
  {
    id: 'qwen25-15b',
    name: 'Qwen 2.5 (1.5B) - Balanced',
    provider: AIProvider.Ollama,
    url: 'http://127.0.0.1:11434',
    model: 'qwen2.5:1.5b',
    ramUsage: '~1.1 GB RAM',
    speedRating: 'Fast',
    category: 'text',
    description: 'Лучший баланс скорости и понимания русского языка для заметок, структурирования и графа знаний.',
    recommendedFor: 'Основная рекомендуемая модель для смартфона',
    installCommand: 'ollama run qwen2.5:1.5b'
  },
  {
    id: 'llama32-1b',
    name: 'Llama 3.2 (1B) - Mobile Edge',
    provider: AIProvider.Ollama,
    url: 'http://127.0.0.1:11434',
    model: 'llama3.2:1b',
    ramUsage: '~1.3 GB RAM',
    speedRating: 'Ultra Fast',
    category: 'text',
    description: 'Официальная мобильная модель от Meta. Высокая скорость генерации и низкое энергопотребление.',
    recommendedFor: 'Анализ заметок, списки задач и извлечение ссылок',
    installCommand: 'ollama run llama3.2:1b'
  },
  {
    id: 'deepseek-r1-15b',
    name: 'DeepSeek R1 (1.5B) - Reasoning',
    provider: AIProvider.Ollama,
    url: 'http://127.0.0.1:11434',
    model: 'deepseek-r1:1.5b',
    ramUsage: '~1.2 GB RAM',
    speedRating: 'Fast',
    category: 'reasoning',
    description: 'Модель с цепочкой рассуждений (Chain-of-Thought). Отлично решает сложные логические задачи и структурирует идеи.',
    recommendedFor: 'Глубокий анализ заметок и поиск взаимосвязей в графе',
    installCommand: 'ollama run deepseek-r1:1.5b'
  },
  {
    id: 'llama32-3b',
    name: 'Llama 3.2 (3B) - High Quality',
    provider: AIProvider.Ollama,
    url: 'http://127.0.0.1:11434',
    model: 'llama3.2:3b',
    ramUsage: '~2.2 GB RAM',
    speedRating: 'Medium',
    category: 'text',
    description: 'Высокое качество структурирования и ответов для современных смартфонов с 6+ ГБ RAM.',
    recommendedFor: 'Флагманские смартфоны и планшеты',
    installCommand: 'ollama run llama3.2:3b'
  },
  {
    id: 'gemma2-2b',
    name: 'Gemma 2 (2B) - Google On-Device',
    provider: AIProvider.Ollama,
    url: 'http://127.0.0.1:11434',
    model: 'gemma2:2b',
    ramUsage: '~1.6 GB RAM',
    speedRating: 'Fast',
    category: 'text',
    description: 'Компактная архитектура от Google DeepMind с превосходной общей эрудицией, логикой и структурированием.',
    recommendedFor: 'Глубокая логика, выжимка и синтез сложных знаний',
    installCommand: 'ollama run gemma2:2b'
  },
  {
    id: 'smollm2-17b',
    name: 'SmolLM2 (1.7B) - Compact Expert',
    provider: AIProvider.Ollama,
    url: 'http://127.0.0.1:11434',
    model: 'smollm2:1.7b',
    ramUsage: '~1.2 GB RAM',
    speedRating: 'Fast',
    category: 'text',
    description: 'Компактная специализированная модель для суммаризации и работы с локальными текстами.',
    recommendedFor: 'Быстрый оффлайн-конспектировщик',
    installCommand: 'ollama run smollm2:1.7b'
  },
  {
    id: 'llamacpp-default',
    name: 'llama.cpp Mobile Server (GGUF)',
    provider: AIProvider.LlamaCpp,
    url: 'http://127.0.0.1:8080/v1',
    model: 'default',
    ramUsage: 'Зависит от квантования GGUF',
    speedRating: 'Ultra Fast',
    category: 'text',
    description: 'Сервер на базе llama.cpp в Termux с прямой поддержкой аппаратного ускорения CPU/GPU.',
    recommendedFor: 'Продвинутые пользователи (ARM64 GGUF модели)',
    installCommand: './llama-server -m model.gguf --port 8080 --host 0.0.0.0'
  },
  {
    id: 'moondream-vision',
    name: 'Moondream 2 - Local Vision / OCR',
    provider: AIProvider.Ollama,
    url: 'http://127.0.0.1:11434',
    model: 'moondream',
    ramUsage: '~1.8 GB RAM',
    speedRating: 'Fast',
    category: 'vision',
    description: 'Локальная визуальная модель для распознавания текста и описания скриншотов прямо на телефоне без интернета.',
    recommendedFor: '100% оффлайн OCR и сканирование документов',
    installCommand: 'ollama run moondream'
  }
];

export interface DiscoveredModel {
  name: string;
  sizeFormatted?: string;
  modifiedAt?: string;
  digest?: string;
  details?: {
    format?: string;
    family?: string;
    parameter_size?: string;
    quantization_level?: string;
  };
}

/**
 * Scan a local endpoint (Ollama / LM Studio / llama.cpp / OpenAI-compatible)
 * to automatically discover all models currently downloaded on the phone/server.
 */
export async function discoverLocalModels(url: string, provider: AIProvider, apiKey?: string): Promise<{
  success: boolean;
  models: DiscoveredModel[];
  error?: string;
}> {
  if (!url) {
    return { success: false, models: [], error: 'Не указан URL сервера' };
  }

  const cleanUrl = url.replace(/\/+$/, '');
  const headers: Record<string, string> = {
    'Accept': 'application/json'
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  // 1. Try Ollama tags endpoint: GET /api/tags
  if (provider === AIProvider.Ollama || cleanUrl.includes('11434') || cleanUrl.includes('ollama')) {
    try {
      const target = cleanUrl.endsWith('/api') ? `${cleanUrl}/tags` : (cleanUrl.includes('/api/tags') ? cleanUrl : `${cleanUrl}/api/tags`);
      const res = await fetch(target, { method: 'GET', headers });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.models)) {
          const list: DiscoveredModel[] = data.models.map((m: any) => {
            const sizeGb = m.size ? `${(m.size / (1024 * 1024 * 1024)).toFixed(2)} GB` : undefined;
            return {
              name: m.name || m.model,
              sizeFormatted: sizeGb,
              modifiedAt: m.modified_at,
              digest: m.digest?.slice(0, 12),
              details: m.details
            };
          });
          return { success: true, models: list };
        }
      }
    } catch (_) {}
  }

  // 2. Try OpenAI / LM Studio / llama.cpp models endpoint: GET /v1/models or GET /models
  const candidateEndpoints = [
    `${cleanUrl}/v1/models`,
    `${cleanUrl}/models`,
    cleanUrl.endsWith('/v1') ? `${cleanUrl}/models` : `${cleanUrl}/v1/models`
  ];

  for (const ep of candidateEndpoints) {
    try {
      const res = await fetch(ep, { method: 'GET', headers });
      if (res.ok) {
        const data = await res.json();
        const rawList = data.data || data.models || (Array.isArray(data) ? data : []);
        if (Array.isArray(rawList) && rawList.length > 0) {
          const list: DiscoveredModel[] = rawList.map((m: any) => ({
            name: typeof m === 'string' ? m : (m.id || m.name || 'unknown'),
            details: {
              family: m.owned_by || m.object
            }
          }));
          return { success: true, models: list };
        }
      }
    } catch (_) {}
  }

  return {
    success: false,
    models: [],
    error: `Не удалось автоматически обнаружить модели по адресу ${url}. Убедитесь, что сервер запущен и разрешен CORS (OLLAMA_ORIGINS="*").`
  };
}

/**
 * Mobile Termux Setup Guide Instructions (Russian)
 */
export const MOBILE_TERMUX_GUIDE = {
  title: 'Запуск локальной модели на Android через Termux',
  steps: [
    {
      step: 1,
      title: 'Установите Termux',
      desc: 'Скачайте и установите Termux из F-Droid или GitHub (не из Google Play).',
      command: 'termux-setup-storage'
    },
    {
      step: 2,
      title: 'Установите Ollama в Termux',
      desc: 'Обновите пакеты и установите официальный пакет Ollama для ARM64:',
      command: 'pkg update -y && pkg install -y ollama'
    },
    {
      step: 3,
      title: 'Запустите сервер Ollama с поддержкой Web/PWA',
      desc: 'Переменная OLLAMA_ORIGINS="*" обязательна, чтобы браузер смартфона мог отправлять запросы:',
      command: 'OLLAMA_ORIGINS="*" OLLAMA_HOST="0.0.0.0:11434" ollama serve'
    },
    {
      step: 4,
      title: 'Загрузите быструю модель (в отдельной сессии Termux)',
      desc: 'Qwen 2.5 (1.5B) или Llama 3.2 (1B) работают плавно на смартфонах:',
      command: 'ollama run qwen2.5:1.5b'
    }
  ]
};

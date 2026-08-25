
# 🧠 ScreenMind2 Ultra

ScreenMind2 is a production-grade, local-first Knowledge Management System (KMS) powered by integrated AI modules. It transforms your raw thoughts, voice memos, and images into a structured, interconnected neural archive.

## 🚀 Key Features

*   **Neural Archive**: Automatically analyzes notes for titles, tags, categories, and summaries using LLMs.
*   **Modular AI Core**: Configure separate providers (Ollama, LM Studio, OpenRouter, Gemini) for different tasks (Brain, Vision, Voice, Agent).
*   **Smart Split**: Paste a book or long article, and the AI will slice it into atomic, interconnected knowledge cards.
*   **Vision Intelligence (OCR)**: Extract text from screenshots and images with high accuracy.
*   **Neural Voice (STT)**: Record audio, transcribe it, and save both the audio file and text.
*   **Telegram Bridge**: Forward messages, images, or voice memos to your bot, and they appear in your inbox, processed by AI.
*   **Strategic Goals**: Link daily notes to long-term goals. The AI finds semantic connections between your actions and objectives.
*   **Privacy First**: All data is stored locally in your browser's IndexedDB.

## 🛠 Setup & Installation

1.  **Clone the repo:**
    ```bash
    git clone https://github.com/yourusername/screenmind2.git
    cd screenmind2
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Run locally:**
    ```bash
    npm run dev
    ```

## ⚙️ Configuration Guide

Navigate to the **Settings** page (`/settings`) to configure your AI modules.

### 1. Brain (Analyzer & Chat)
*   **Role**: Text analysis, summarization, chatting with notes.
*   **Recommended**: Gemini 1.5 Flash (Fast & Cheap) or Llama 3 (Local).

### 2. Vision (OCR Engine)
*   **Role**: Extracting text from images.
*   **Recommended**: `gemini-2.0-flash` (Best multimodal performance).

### 3. Voice Engine (STT)
*   **Role**: Transcribing audio recordings.
*   **Recommended**: `gemini-2.0-flash` or OpenAI Whisper (via API).

### 4. Neural Assistant
*   **Role**: System agent that answers questions about your knowledge base stats and content.

### 5. Telegram Bridge
1.  Talk to `@BotFather` on Telegram to create a new bot.
2.  Copy the **Token**.
3.  Send a message to your new bot.
4.  Get your **Chat ID** (you can use `@userinfobot` or check logs).
5.  Enter both in ScreenMind Settings.

## 🏗 Architecture

*   **Frontend**: React 18, Tailwind CSS, Lucide Icons.
*   **State Management**: Context API + Custom Hooks.
*   **Storage**: IndexedDB (`idb-keyval`).
*   **AI Layer**: Custom Adapter Pattern supporting multiple providers with failover and retry logic.

## 🤝 Contributing

We welcome contributions! Please see `CONTRIBUTING.md` for details.

## 📄 License

MIT License.

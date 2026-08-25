
# Contributing to ScreenMind2

Thank you for your interest in contributing to ScreenMind2! We aim to build the best local-first AI knowledge base.

## Development Guidelines

### 1. Code Style
*   **TypeScript**: Strict mode is enabled. No `any` unless absolutely necessary.
*   **Components**: Functional components with Hooks. Use `React.memo` for list items.
*   **Styling**: Tailwind CSS. Follow the existing design tokens (e.g., `rounded-[2rem]`, `font-black`, `uppercase`).

### 2. Project Structure
*   `src/components`: Reusable UI components (Sidebar, AudioRecorder).
*   `src/contexts`: Global state logic (NotesContext).
*   `src/pages`: Main application views.
*   `src/utils`: Helper functions and AI adapters.

### 3. Adding a New AI Provider
1.  Modify `types.ts` to add the new provider enum.
2.  Update `utils/aiAdapter.ts`:
    *   Create a new adapter object implementing the `AIProviderAdapter` interface.
    *   Add it to the `adapters` registry.
3.  Update `pages/SettingsPage.tsx` if specific UI fields are needed (though the generic `ProviderSelector` handles most cases).

### 4. Pull Requests
*   Create a feature branch: `git checkout -b feature/my-new-feature`
*   Commit your changes with clear messages.
*   Push to the branch and open a PR.

## Reporting Issues
Please use the GitHub Issues tracker to report bugs or request features. Provide steps to reproduce and screenshots if possible.

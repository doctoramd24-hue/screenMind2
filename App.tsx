
import React, { useState } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { NotesProvider } from './contexts/NotesContext.tsx';
import Sidebar from './components/Sidebar.tsx';
import QuickIdeasPanel from './components/QuickIdeasPanel.tsx';
import NotesPage from './pages/NotesPage.tsx';
import NoteEditor from './pages/NoteEditor.tsx';
import GraphPage from './pages/GraphPage.tsx';
import ChatPage from './pages/ChatPage.tsx';
import SettingsPage from './pages/SettingsPage.tsx';
import IdeasPage from './pages/IdeasPage.tsx';
import TrashPage from './pages/TrashPage.tsx';
import TelegramPage from './pages/TelegramPage.tsx';
import OcrPage from './pages/OcrPage.tsx';
import GoalsPage from './pages/GoalsPage.tsx';
import AgentPage from './pages/AgentPage.tsx';
import DashboardPage from './pages/DashboardPage.tsx';
import { PanelLeftClose, PanelLeftOpen, PanelRightOpen, PanelRightClose } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const AppContent: React.FC = () => {
    const [showQuickPanel, setShowQuickPanel] = useState(true);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const location = useLocation();
    const isEditor = location.pathname.startsWith('/editor/');

    return (
        <div className="flex h-[100dvh] bg-[var(--bg-main)] overflow-hidden transition-colors duration-500 relative">
          <Sidebar collapsed={isSidebarCollapsed} onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />
          <main className="flex-1 overflow-y-auto relative custom-scrollbar scroll-smooth">
            {!isEditor && (
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 md:top-1/2 md:-translate-y-1/2 md:left-auto md:translate-x-0 z-[60] flex flex-row md:flex-col gap-4 pointer-events-none" style={{ right: showQuickPanel ? 'min(330px, 90vw)' : '20px' }}>
                <motion.button 
                    layout
                    onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    className="w-12 h-12 bg-white dark:bg-slate-900 text-slate-400 rounded-2xl shadow-2xl transition-all hover:scale-110 active:scale-90 flex items-center justify-center border-4 border-[var(--card-bg)] hover:text-blue-500 pointer-events-auto"
                >
                    {isSidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
                </motion.button>
                <motion.button 
                    layout
                    onClick={() => setShowQuickPanel(!showQuickPanel)}
                    className="w-12 h-12 bg-blue-600 text-white rounded-2xl shadow-2xl transition-all hover:scale-110 active:scale-90 flex items-center justify-center border-4 border-[var(--card-bg)] hover:bg-blue-700 pointer-events-auto"
                >
                    {showQuickPanel ? <PanelRightClose size={24}/> : <PanelRightOpen size={24}/>}
                </motion.button>
              </div>
            )}
            
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                <Routes location={location}>
                  <Route path="/" element={<NotesPage />} />
                  <Route path="/ocr" element={<OcrPage />} />
                  <Route path="/goals" element={<GoalsPage />} />
                  <Route path="/agent" element={<AgentPage />} />
                  <Route path="/telegram" element={<TelegramPage />} />
                  <Route path="/ideas" element={<IdeasPage />} />
                  <Route path="/editor/:id" element={<NoteEditor />} />
                  <Route path="/graph" element={<GraphPage />} />
                  <Route path="/chat" element={<ChatPage />} />
                  <Route path="/trash" element={<TrashPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                </Routes>
              </motion.div>
            </AnimatePresence>
          </main>
          <AnimatePresence>
            {showQuickPanel && !isEditor && <QuickIdeasPanel />}
          </AnimatePresence>
        </div>
    );
}

const App: React.FC = () => {
  return (
    <NotesProvider>
      <HashRouter>
        <AppContent />
      </HashRouter>
    </NotesProvider>
  );
};

export default App;

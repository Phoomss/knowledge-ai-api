import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { KnowledgeBasesView } from './components/KnowledgeBasesView';
import { DocumentsView } from './components/DocumentsView';
import { ChatView } from './components/ChatView';
import { AuthModal } from './components/AuthModal';
import { KnowledgeBase, User } from './types';
import { api, setAuthToken } from './api';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<'chat' | 'documents' | 'knowledge-bases'>('chat');
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKbId, setSelectedKbId] = useState<string>('');
  const [user, setUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const loadUser = async () => {
    try {
      const me = await api.getMe();
      setUser(me);
    } catch {
      setUser(null);
    }
  };

  const loadKnowledgeBases = async () => {
    try {
      const kbs = await api.getKnowledgeBases();
      setKnowledgeBases(kbs);
      if (kbs.length > 0 && !selectedKbId) {
        setSelectedKbId(kbs[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadUser();
    loadKnowledgeBases();
  }, []);

  const handleLogout = () => {
    setAuthToken(null);
    setUser(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans">
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        user={user}
        onOpenAuth={() => setShowAuthModal(true)}
        onLogout={handleLogout}
        knowledgeBases={knowledgeBases}
        selectedKbId={selectedKbId}
        onSelectKb={(id) => setSelectedKbId(id)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {currentTab === 'chat' && <ChatView selectedKbId={selectedKbId} />}

        {currentTab === 'documents' && <DocumentsView selectedKbId={selectedKbId} />}

        {currentTab === 'knowledge-bases' && (
          <KnowledgeBasesView
            knowledgeBases={knowledgeBases}
            selectedKbId={selectedKbId}
            onSelectKb={(id) => setSelectedKbId(id)}
            onRefresh={loadKnowledgeBases}
            onNavigateToDocs={(id) => {
              setSelectedKbId(id);
              setCurrentTab('documents');
            }}
            onNavigateToChat={(id) => {
              setSelectedKbId(id);
              setCurrentTab('chat');
            }}
          />
        )}
      </main>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={(u) => {
          setUser(u);
          loadKnowledgeBases();
        }}
      />
    </div>
  );
};

export default App;

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { KnowledgeBasesView } from './components/KnowledgeBasesView';
import { DocumentsView } from './components/DocumentsView';
import { ChatView } from './components/ChatView';
import { RetrievalExplorer } from './components/RetrievalExplorer';
import { SettingsView } from './components/SettingsView';
import { AuthModal } from './components/AuthModal';
import { KnowledgeBase, DocumentItem, ConversationItem, User, AppTab } from './types';
import { api, setAuthToken } from './api';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<AppTab>('overview');
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKbId, setSelectedKbId] = useState<string>('');
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
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

  const loadDocuments = async () => {
    if (!selectedKbId) {
      setDocuments([]);
      return;
    }
    try {
      const docs = await api.getDocuments(selectedKbId);
      setDocuments(docs);
    } catch (err) {
      console.error(err);
    }
  };

  const loadConversations = async () => {
    try {
      const convs = await api.getConversations(selectedKbId || undefined);
      setConversations(convs);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadUser();
    loadKnowledgeBases();
  }, []);

  useEffect(() => {
    loadDocuments();
    loadConversations();
  }, [selectedKbId]);

  const handleLogout = () => {
    setAuthToken(null);
    setUser(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-indigo-500 selection:text-white">
      {/* Shared Application Shell Header */}
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

      {/* Main Workspace View Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 md:p-6 pb-20 lg:pb-8 min-w-0">
        {currentTab === 'overview' && (
          <DashboardView
            user={user}
            knowledgeBases={knowledgeBases}
            selectedKbId={selectedKbId}
            onSelectKb={(id) => setSelectedKbId(id)}
            documents={documents}
            conversations={conversations}
            onNavigate={(tab) => setCurrentTab(tab)}
            onStartChat={(kbId) => {
              if (kbId) setSelectedKbId(kbId);
              setCurrentTab('chat');
            }}
          />
        )}

        {currentTab === 'chat' && (
          <ChatView
            selectedKbId={selectedKbId}
            knowledgeBases={knowledgeBases}
            onSelectKb={(id) => setSelectedKbId(id)}
            onNavigateToKnowledgeBases={() => setCurrentTab('knowledge-bases')}
          />
        )}

        {currentTab === 'knowledge-bases' && (
          <KnowledgeBasesView
            knowledgeBases={knowledgeBases}
            selectedKbId={selectedKbId}
            onSelectKb={(id) => setSelectedKbId(id)}
            onRefresh={() => {
              loadKnowledgeBases();
              loadDocuments();
            }}
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

        {currentTab === 'documents' && (
          <DocumentsView
            selectedKbId={selectedKbId}
            onNavigateToKnowledgeBases={() => setCurrentTab('knowledge-bases')}
          />
        )}

        {currentTab === 'explorer' && (
          <RetrievalExplorer
            knowledgeBases={knowledgeBases}
            selectedKbId={selectedKbId}
            onSelectKb={(id) => setSelectedKbId(id)}
            onNavigateToKnowledgeBases={() => setCurrentTab('knowledge-bases')}
          />
        )}

        {currentTab === 'settings' && (
          <SettingsView
            user={user}
            knowledgeBases={knowledgeBases}
            documents={documents}
          />
        )}
      </main>

      {/* Authentication Modal */}
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

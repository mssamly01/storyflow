
import React, { useState, useEffect } from 'react';
import Home from './components/Home';
import StoryFlow from './components/StoryFlow';
import LiteraryParser from './components/LiteraryParser';
import Settings from './components/Settings';
import { initConfig } from './services/configService';

const App: React.FC = () => {
  const [view, setView] = useState<'home' | 'story-flow' | 'lit-parser' | 'settings'>(() => {
    // Ưu tiên lấy từ URL trước
    const segments = window.location.pathname.split('/').filter(Boolean);
    const path = segments[0];
    if (path === 'story-flow' || path === 'lit-parser' || path === 'settings') return path as any;
    
    return 'home';
  });
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);

  // Add keyboard listener for F5 and Ctrl+F5 reset with confirmation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5' || (e.ctrlKey && e.key === 'F5')) {
        e.preventDefault();
        const confirmed = window.confirm(
          'Bạn có muốn xóa toàn bộ dữ liệu tạm và tải lại trang không?\n\n' +
          '• Nhấn OK để xóa và tải lại\n' +
          '• Nhấn Cancel để chỉ tải lại (giữ dữ liệu)'
        );
        if (confirmed) {
          localStorage.clear();
          sessionStorage.clear();
        }
        window.location.reload();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Initialize view from URL pathname
  useEffect(() => {
    const handlePathChange = () => {
      const segments = window.location.pathname.split('/').filter(Boolean);
      const path = segments[0];
      const targetView = (path === 'story-flow' || path === 'lit-parser' || path === 'settings') ? path : 'home';
      setView(targetView as any);
    };

    handlePathChange();
    window.addEventListener('popstate', handlePathChange);
    return () => window.removeEventListener('popstate', handlePathChange);
  }, []);

  // Update URL pathname when view changes
  useEffect(() => {
    const segments = window.location.pathname.split('/').filter(Boolean);
    const currentPath = segments[0] || 'home';
    
    if (currentPath !== view) {
      const newPath = view === 'home' ? '/' : `/${view}`;
      window.history.pushState(null, '', newPath);
    }
  }, [view]);

  useEffect(() => {
    initConfig().then(() => {
      setIsConfigLoaded(true);
    });
  }, []);

  if (!isConfigLoaded) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <>
      {view === 'home' ? (
        <Home 
          onLaunchStoryFlow={() => setView('story-flow')} 
          onLaunchLitParser={() => setView('lit-parser')}
          onLaunchSettings={() => setView('settings')}
        />
      ) : view === 'story-flow' ? (
        <StoryFlow onBack={() => setView('home')} />
      ) : view === 'lit-parser' ? (
        <LiteraryParser onBack={() => setView('home')} />
      ) : (
        <Settings onBack={() => setView('home')} />
      )}
    </>
  );
};

export default App;

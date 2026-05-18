
import React, { useState, useEffect } from 'react';
import Home from './components/Home';
import StoryFlow from './components/StoryFlow';
import LiteraryParser from './components/LiteraryParser';
import Settings from './components/Settings';
import { initConfig } from './services/configService';

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  declare props: { children: React.ReactNode };
  declare setState: (state: { error: Error | null }) => void;

  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("StoryFlow app crashed:", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-slate-50 p-10 text-slate-900">
        <div className="mx-auto max-w-2xl rounded-3xl border border-rose-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-black uppercase tracking-widest text-rose-500">StoryFlow runtime error</p>
          <h1 className="mt-3 text-2xl font-black text-slate-900">Ứng dụng vừa gặp lỗi khi render dữ liệu.</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Lỗi này thường do dữ liệu tạm trong trình duyệt quá lớn hoặc sai shape. Bạn có thể xóa state tạm mà không xóa file project đã lưu.
          </p>
          <pre className="mt-5 max-h-56 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-rose-100">
            {this.state.error.message || String(this.state.error)}
          </pre>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-2xl bg-indigo-600 px-5 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-indigo-700"
            >
              Reload
            </button>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem('storyflow_temp_state');
                window.location.reload();
              }}
              className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-xs font-black uppercase tracking-widest text-rose-700 hover:bg-rose-100"
            >
              Xóa state tạm
            </button>
          </div>
        </div>
      </div>
    );
  }
}

const App: React.FC = () => {
  const [view, setView] = useState<'home' | 'story-flow' | 'lit-parser' | 'settings'>(() => {
    // Ưu tiên lấy từ URL trước
    const segments = window.location.pathname.split('/').filter(Boolean);
    const path = segments[0];
    if (path === 'story-flow' || path === 'lit-parser' || path === 'settings') return path as any;
    
    return 'home';
  });
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);

  // Add keyboard listener for F5 and Ctrl+F5 reset
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Bấm F5 hoặc Ctrl+F5 đều reset
      if (e.key === 'F5' || (e.ctrlKey && e.key === 'F5')) {
        e.preventDefault(); // Ngăn trình duyệt reload mặc định để thực hiện xóa dữ liệu trước
        localStorage.clear();
        sessionStorage.clear();
        window.location.reload(); // Stay on current page and reload
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
    <AppErrorBoundary>
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
    </AppErrorBoundary>
  );
};

export default App;


import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import Home from './components/Home';
import StoryFlow from './components/StoryFlow';
import LiteraryParser from './components/LiteraryParser';
import Settings from './components/Settings';
import { initConfig } from './services/configService';

const AppRoutes: React.FC = () => {
  const navigate = useNavigate();
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
    <Routes>
      <Route path="/" element={
        <Home 
          onLaunchStoryFlow={() => navigate('/story-flow')} 
          onLaunchLitParser={() => navigate('/lit-parser')}
          onLaunchSettings={() => navigate('/settings')}
        />
      } />
      <Route path="/story-flow" element={<StoryFlow onBack={() => navigate('/')} />} />
      <Route path="/lit-parser" element={<LiteraryParser onBack={() => navigate('/')} />} />
      <Route path="/settings" element={<Settings onBack={() => navigate('/')} />} />
    </Routes>
  );
};

const App: React.FC = () => (
  <BrowserRouter>
    <AppRoutes />
  </BrowserRouter>
);

export default App;

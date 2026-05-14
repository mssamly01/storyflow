
import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  ChevronLeft, 
  Save, 
  Key, 
  Cpu,
  CheckCircle2
} from 'lucide-react';
import { getConfig, saveConfig, AppConfig } from '../services/configService';

interface SettingsProps {
  onBack: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onBack }) => {
  const [config, setConfig] = useState<AppConfig>(getConfig());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (saved) {
      const timer = setTimeout(() => setSaved(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [saved]);

  const handleSave = async () => {
    try {
      await saveConfig(config);
      setSaved(true);
    } catch (e) {
      console.error(e);
      alert('Không thể lưu cài đặt. Vui lòng thử lại.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="p-2 hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-200 text-slate-500 hover:text-indigo-600"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-2 rounded-xl shadow-lg shadow-indigo-100">
                <SettingsIcon className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">Cài đặt hệ thống</h1>
            </div>
          </div>
        </header>

        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
          <div className="p-8 space-y-8">
            {/* Gemini Section */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-50">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <Cpu className="w-5 h-5 text-indigo-600" />
                </div>
                <h2 className="text-lg font-bold text-slate-800">Cấu hình Gemini AI</h2>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    Gemini API Key
                  </label>
                  <input 
                    type="password"
                    value={config.geminiApiKey}
                    onChange={(e) => setConfig({ ...config, geminiApiKey: e.target.value })}
                    placeholder="Nhập API Key của bạn tại đây..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-mono text-sm"
                  />
                  <p className="text-xs text-slate-400">
                    Bạn có thể lấy API key tại <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">Google AI Studio</a>.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Cpu className="w-4 h-4" />
                    Model Name
                  </label>
                  <select 
                    value={config.geminiModel}
                    onChange={(e) => setConfig({ ...config, geminiModel: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-medium text-slate-700"
                  >
                    <option value="">Chọn model...</option>
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                    <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                  </select>
                </div>
              </div>
            </section>
          </div>

          <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Các thay đổi sẽ được lưu vào hệ thống ứng dụng.
            </p>
            <button 
              onClick={handleSave}
              disabled={saved}
              className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold transition-all ${
                saved 
                ? 'bg-emerald-500 text-white cursor-default' 
                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200'
              }`}
            >
              {saved ? (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Đã lưu thành công
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Lưu cài đặt
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;

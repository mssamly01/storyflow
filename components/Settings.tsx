import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, KeyRound, Save, Settings as SettingsIcon, SlidersHorizontal } from 'lucide-react';
import { getConfig, saveConfig } from '../services/configService';

interface SettingsProps {
  onBack: () => void;
}

const MODEL_OPTIONS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-1.5-flash',
  'gemini-1.5-pro'
];

const Settings: React.FC<SettingsProps> = ({ onBack }) => {
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('gemini-2.5-flash');
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const config = getConfig();
    setGeminiApiKey(config.geminiApiKey || '');
    setGeminiModel(config.geminiModel || 'gemini-2.5-flash');
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    const result = await saveConfig({
      geminiApiKey: geminiApiKey.trim(),
      geminiModel: geminiModel.trim() || 'gemini-2.5-flash'
    });

    setIsSaving(false);
    setMessage(
      result.savedToServer
        ? 'Đã lưu cấu hình vào project local.'
        : 'Đã lưu cấu hình vào trình duyệt. API local chưa sẵn sàng để ghi file.'
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="bg-white border-b border-slate-200 px-8 py-4 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500"
              aria-label="Quay lại"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">Settings</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cấu hình Gemini local</p>
            </div>
          </div>
          <div className="bg-indigo-50 p-3 rounded-2xl text-indigo-600">
            <SettingsIcon className="w-6 h-6" />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="bg-white border border-slate-200 rounded-[32px] shadow-sm overflow-hidden">
          <div className="p-8 border-b border-slate-100">
            <h2 className="text-2xl font-black tracking-tight">Gemini API</h2>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
              Khóa API được lưu cục bộ trong thư mục project khi chạy Vite dev. Nếu API local chưa chạy,
              ứng dụng sẽ lưu tạm vào localStorage.
            </p>
          </div>

          <div className="p-8 space-y-6">
            <label className="block">
              <span className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                <KeyRound className="w-4 h-4" />
                Gemini API key
              </span>
              <input
                type="password"
                value={geminiApiKey}
                onChange={(event) => setGeminiApiKey(event.target.value)}
                placeholder="Nhập Gemini API key"
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 text-sm"
              />
            </label>

            <label className="block">
              <span className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                <SlidersHorizontal className="w-4 h-4" />
                Gemini model
              </span>
              <select
                value={geminiModel}
                onChange={(event) => setGeminiModel(event.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 text-sm font-bold text-slate-700"
              >
                {MODEL_OPTIONS.map((model) => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </label>

            {message && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-emerald-50 text-emerald-700 text-sm font-bold border border-emerald-100">
                <CheckCircle2 className="w-5 h-5" />
                {message}
              </div>
            )}
          </div>

          <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex justify-end">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-indigo-600 text-white font-black text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 transition-all"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Đang lưu...' : 'Lưu cấu hình'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Settings;

import React from 'react';
import {
  ArrowRight,
  BookOpen,
  FileText,
  Layout,
  Settings,
  Sparkles,
  Wand2
} from 'lucide-react';

interface HomeProps {
  onLaunchStoryFlow: () => void;
  onLaunchLitParser: () => void;
  onLaunchSettings: () => void;
}

const Home: React.FC<HomeProps> = ({
  onLaunchStoryFlow,
  onLaunchLitParser,
  onLaunchSettings
}) => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="px-6 py-5 border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-200">
              <Layout className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight">StoryFlow AI Studio</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Local production workspace</p>
            </div>
          </div>
          <button
            onClick={onLaunchSettings}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition-all"
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <section className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-8 items-stretch">
          <div className="bg-white border border-slate-200 rounded-[32px] p-8 md:p-10 shadow-sm flex flex-col justify-between min-h-[420px]">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest border border-indigo-100 mb-6">
                <Sparkles className="w-3.5 h-3.5" />
                AI storyboard pipeline
              </div>
              <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-tight text-slate-950">
                Chuyển tiểu thuyết thành storyboard và prompt minh họa.
              </h2>
              <p className="mt-5 text-slate-500 leading-relaxed max-w-2xl">
                Làm việc theo từng bước: phân tích nội dung, dựng hồ sơ nhân vật, phác thảo khung hình,
                tạo prompt và QA tính nhất quán.
              </p>
            </div>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <button
                onClick={onLaunchStoryFlow}
                className="group inline-flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-indigo-600 text-white font-black shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all"
              >
                Mở StoryFlow
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={onLaunchLitParser}
                className="inline-flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-slate-100 text-slate-700 font-black hover:bg-slate-200 transition-all"
              >
                <BookOpen className="w-5 h-5" />
                Mở LitStruct
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <button
              onClick={onLaunchStoryFlow}
              className="text-left bg-slate-900 text-white rounded-[28px] p-7 shadow-xl shadow-slate-200 hover:-translate-y-1 transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="bg-white/10 p-3 rounded-2xl">
                  <Wand2 className="w-7 h-7 text-indigo-200" />
                </div>
                <ArrowRight className="w-5 h-5 text-white/50" />
              </div>
              <h3 className="mt-7 text-2xl font-black">StoryFlow</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Pipeline sản xuất storyboard, prompt hình ảnh và bản QA cuối cùng.
              </p>
            </button>

            <button
              onClick={onLaunchLitParser}
              className="text-left bg-white border border-slate-200 rounded-[28px] p-7 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="bg-purple-50 p-3 rounded-2xl text-purple-600">
                  <FileText className="w-7 h-7" />
                </div>
                <ArrowRight className="w-5 h-5 text-slate-300" />
              </div>
              <h3 className="mt-7 text-2xl font-black">LitStruct Parser</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                Tách văn bản tiểu thuyết thành khối lời thoại, hành động và dẫn chuyện.
              </p>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Home;

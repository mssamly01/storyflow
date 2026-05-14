
import React, { useState, useEffect } from 'react';
import { 
  Layout, 
  Sparkles, 
  ChevronRight, 
  BookOpen, 
  Image as ImageIcon, 
  Zap,
  Star,
  ChevronLeft,
  FileText,
  Settings
} from 'lucide-react';

const STORY_IMAGES = [
  {
    url: 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?q=80&w=2074&auto=format&fit=crop',
    title: 'Thế giới tương lai',
    style: 'Cyberpunk City'
  },
  {
    url: 'https://images.unsplash.com/photo-1614728263952-84ea256f9679?q=80&w=1954&auto=format&fit=crop',
    title: 'Chiến binh huyền thoại',
    style: 'Fantasy'
  },
  {
    url: 'https://images.unsplash.com/photo-1605142859862-978be7eba909?q=80&w=2070&auto=format&fit=crop',
    title: 'Cung điện cổ đại (Glitched)',
    style: 'Ancient Surrealism'
  },
  {
    url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=2094&auto=format&fit=crop',
    title: 'Khu rừng kỳ bí',
    style: 'Cinematic'
  }
];

interface HomeProps {
  onLaunchStoryFlow: () => void;
  onLaunchLitParser: () => void;
  onLaunchSettings: () => void;
}

const Home: React.FC<HomeProps> = ({ onLaunchStoryFlow, onLaunchLitParser, onLaunchSettings }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % STORY_IMAGES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 overflow-x-hidden">
      {/* Background decoration */}
      <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-3xl -mr-64 -mt-64 pointer-events-none"></div>
      <div className="fixed bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-3xl -ml-64 -mb-64 pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-8 py-16 relative">
        {/* Header */}
        <header className="flex justify-between items-center mb-24">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-3 rounded-2xl shadow-xl shadow-indigo-200">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900">AI Story Studio</h1>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Creative Intelligence</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Version 3.0.0</span>
            <div className="w-px h-6 bg-slate-200"></div>
            <button 
              onClick={onLaunchSettings}
              className="p-2 hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-200 text-slate-500 hover:text-indigo-600 flex items-center gap-2"
            >
              <Settings className="w-5 h-5" />
              <span className="text-sm font-bold">Cài đặt</span>
            </button>
          </div>
        </header>

        {/* Hero Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-32">
          <div className="max-w-2xl">
            <h2 className="text-6xl font-black text-slate-900 tracking-tight leading-[1.1] mb-8">
              Biến ý tưởng thành <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">tác phẩm nghệ thuật</span> với sức mạnh AI.
            </h2>
            <p className="text-xl text-slate-500 font-medium leading-relaxed mb-12">
              Hệ sinh thái công cụ AI chuyên dụng cho việc sáng tạo nội dung, từ phân tích kịch bản đến phác thảo hình ảnh và quản lý nhân vật.
            </p>
            <div className="flex items-center gap-4">
              <button 
                onClick={onLaunchStoryFlow}
                className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-2xl shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-1 transition-all flex items-center gap-3"
              >
                Bắt đầu sáng tạo ngay <ChevronRight className="w-5 h-5" />
              </button>
              <a 
                href="#features" 
                onClick={(e) => {
                  e.preventDefault();
                  document.querySelector('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-3')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-8 py-4 bg-white text-slate-700 border border-slate-200 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-slate-50 transition-all inline-block"
              >
                Tìm hiểu thêm
              </a>
            </div>
          </div>

          {/* Slider Section */}
          <div className="relative group">
            <div className="relative aspect-[4/3] rounded-[40px] overflow-hidden shadow-2xl border-8 border-white group-hover:scale-[1.02] transition-transform duration-500">
              {STORY_IMAGES.map((img, idx) => (
                <div 
                  key={idx}
                  className={`absolute inset-0 transition-opacity duration-1000 ${idx === currentImageIndex ? 'opacity-100' : 'opacity-0'}`}
                >
                  <img 
                    src={img.url} 
                    alt={img.title} 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                  <div className="absolute bottom-8 left-8 text-white">
                    <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-2 block w-fit">
                      {img.style}
                    </span>
                    <h4 className="text-2xl font-black tracking-tight">{img.title}</h4>
                  </div>
                </div>
              ))}

              {/* Slider Controls */}
              <div className="absolute bottom-8 right-8 flex gap-2">
                <button 
                  onClick={() => setCurrentImageIndex((prev) => (prev - 1 + STORY_IMAGES.length) % STORY_IMAGES.length)}
                  className="p-2 bg-white/20 backdrop-blur-md rounded-xl text-white hover:bg-white/40 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setCurrentImageIndex((prev) => (prev + 1) % STORY_IMAGES.length)}
                  className="p-2 bg-white/20 backdrop-blur-md rounded-xl text-white hover:bg-white/40 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Progress Dots */}
              <div className="absolute top-8 left-8 flex gap-2">
                {STORY_IMAGES.map((_, idx) => (
                  <div 
                    key={idx}
                    className={`h-1 rounded-full transition-all duration-500 ${idx === currentImageIndex ? 'w-8 bg-white' : 'w-2 bg-white/40'}`}
                  ></div>
                ))}
              </div>
            </div>

            {/* Decorative Elements */}
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-indigo-600/10 rounded-full blur-2xl -z-10 animate-pulse"></div>
            <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-purple-600/10 rounded-full blur-2xl -z-10 animate-pulse delay-700"></div>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Story Flow Card */}
          <div 
            onClick={onLaunchStoryFlow}
            className="group relative bg-white rounded-[40px] p-10 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 border border-slate-100 cursor-pointer overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-10 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity pointer-events-none">
              <Layout className="w-48 h-48 text-indigo-900" />
            </div>
            
            <div className="bg-indigo-50 w-20 h-20 rounded-3xl flex items-center justify-center mb-8 group-hover:bg-indigo-600 group-hover:scale-110 transition-all duration-500">
              <Layout className="w-10 h-10 text-indigo-600 group-hover:text-white transition-colors" />
            </div>
            
            <div className="flex items-center gap-2 mb-4">
              <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Active Now</span>
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(i => <Star key={i} className="w-3 h-3 text-amber-400 fill-amber-400" />)}
              </div>
            </div>

            <h3 className="text-3xl font-black text-slate-900 mb-4 group-hover:text-indigo-600 transition-colors">Story Flow</h3>
            <p className="text-slate-500 font-medium leading-relaxed mb-8">
              Quy trình sản xuất kịch bản toàn diện: từ phân tích tiểu thuyết, thiết kế nhân vật đến tạo prompt hình ảnh chi tiết.
            </p>

            <div className="flex items-center gap-3 pt-6 border-t border-slate-50">
              <div className="flex -space-x-2">
                <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-bold"><BookOpen className="w-4 h-4 text-slate-400" /></div>
                <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-bold"><ImageIcon className="w-4 h-4 text-slate-400" /></div>
                <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-bold"><Zap className="w-4 h-4 text-slate-400" /></div>
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Multi-stage pipeline</span>
            </div>
          </div>

          {/* LitStruct Parser Card */}
          <div 
            onClick={onLaunchLitParser}
            className="group relative bg-white rounded-[40px] p-10 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 border border-slate-100 cursor-pointer overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-10 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity pointer-events-none">
              <FileText className="w-48 h-48 text-indigo-900" />
            </div>
            
            <div className="bg-purple-50 w-20 h-20 rounded-3xl flex items-center justify-center mb-8 group-hover:bg-purple-600 group-hover:scale-110 transition-all duration-500">
              <FileText className="w-10 h-10 text-purple-600 group-hover:text-white transition-colors" />
            </div>
            
            <div className="flex items-center gap-2 mb-4">
              <span className="bg-purple-100 text-purple-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Advanced AI</span>
            </div>

            <h3 className="text-3xl font-black text-slate-900 mb-4 group-hover:text-purple-600 transition-colors">LitStruct Parser</h3>
            <p className="text-slate-500 font-medium leading-relaxed mb-8">
              Phân tích cấu trúc tiểu thuyết, tách biệt lời thoại, hành động và gộp khối nhân vật thông minh.
            </p>

            <div className="flex items-center gap-3 pt-6 border-t border-slate-50">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Literary Analysis</span>
            </div>
          </div>

          {/* Placeholder Feature */}
          <div className="group bg-slate-100/50 rounded-[40px] p-10 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center opacity-60">
            <div className="bg-slate-200 w-20 h-20 rounded-3xl flex items-center justify-center mb-8">
              <ImageIcon className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-2xl font-black text-slate-400 mb-2 uppercase tracking-tight">Image Studio</h3>
            <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Coming Soon</p>
          </div>
        </div>

        {/* Footer info */}
        <footer className="mt-32 pt-16 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-8">
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">© 2025 AI Story Flow Studio. All rights reserved.</p>
          <div className="flex gap-8">
            <a href="#" className="text-sm font-bold text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-widest">Privacy</a>
            <a href="#" className="text-sm font-bold text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-widest">Terms</a>
            <a href="#" className="text-sm font-bold text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-widest">Support</a>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Home;

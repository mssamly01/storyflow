
import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '../hooks/useToast';
import Toast from './Toast';
import { 
  ArrowLeft, 
  Send, 
  Copy, 
  Download, 
  Layout, 
  Code, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Save,
  Library,
  Trash2,
  FileText,
  Clock,
  ChevronRight,
  Book,
  Hash,
  Type as TypeIcon,
  Plus,
  Edit2,
  X,
  Check,
  ChevronDown
} from 'lucide-react';
import { ParsedBlock, ParsingStatus, LiteraryProject } from '../types/literary';
import { parseLiteraryText } from '../services/literaryService';
import { fetchAllProjects, saveProjectToServer, deleteProjectFromServer } from '../services/projectService';

interface LiteraryParserProps {
  onBack: () => void;
}

const SAMPLE_TEXT = `Đoàng đoàng đoàng!
Tiếng súng vang rền.
"Vẫn chưa tìm thấy sao!?"
Giang Nhiên điên cuồng lục lọi trên giá sách, sắc mặt trắng bệch:
"Vẫn chưa! Cái thư viện này quá lớn!"`;

const LiteraryParser: React.FC<LiteraryParserProps> = ({ onBack }) => {
  const [inputText, setInputText] = useState<string>('');
  const [novelName, setNovelName] = useState<string>('');
  const [chapterNumber, setChapterNumber] = useState<string>('');
  const [chapterTitle, setChapterTitle] = useState<string>('');
  
  const [parsedBlocks, setParsedBlocks] = useState<ParsedBlock[]>([]);
  const [status, setStatus] = useState<ParsingStatus>(ParsingStatus.IDLE);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'visual' | 'json'>('visual');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  const [viewMode, setViewMode] = useState<'editor' | 'library'>('editor');
  const [savedProjects, setSavedProjects] = useState<LiteraryProject[]>([]);
  const { toast, showToast } = useToast();
  const [isLoaded, setIsLoaded] = useState(false);
  const [editingBlockIndex, setEditingBlockIndex] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<ParsedBlock | null>(null);
  const [newlyAddedBlockIndex, setNewlyAddedBlockIndex] = useState<number | null>(null);
  const [showCharSuggestions, setShowCharSuggestions] = useState(false);

  // Load temporary state from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem('litparser_temp_state');
    if (savedState) {
      try {
        const { inputText: savedInput, novelName: savedNovel, chapterNumber: savedChapter, chapterTitle: savedTitle, parsedBlocks: savedBlocks } = JSON.parse(savedState);
        if (savedInput) setInputText(savedInput);
        if (savedNovel) setNovelName(savedNovel);
        if (savedChapter) setChapterNumber(savedChapter);
        if (savedTitle) setChapterTitle(savedTitle);
        if (savedBlocks && savedBlocks.length > 0) {
          setParsedBlocks(savedBlocks);
          setStatus(ParsingStatus.SUCCESS);
        }
      } catch (e) {
        console.error("Failed to parse saved state:", e);
      }
    }
    setIsLoaded(true);
  }, []);

  // Save temporary state to localStorage
  useEffect(() => {
    if (!isLoaded) return;

    const stateToSave = {
      inputText,
      novelName,
      chapterNumber,
      chapterTitle,
      parsedBlocks
    };
    localStorage.setItem('litparser_temp_state', JSON.stringify(stateToSave));
  }, [isLoaded, inputText, novelName, chapterNumber, chapterTitle, parsedBlocks]);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const data = await fetchAllProjects();
      setSavedProjects(data.filter((p: any) => p.type === 'literary'));
    } catch (err) {
      console.error("Failed to load projects:", err);
    }
  };

  const handleAnalyze = async () => {
    if (!inputText.trim()) return;

    setStatus(ParsingStatus.LOADING);
    setErrorMessage(null);
    setParsedBlocks([]);

    try {
      const result = await parseLiteraryText(inputText);
      setParsedBlocks(result);
      setStatus(ParsingStatus.SUCCESS);
    } catch (error) {
      console.error(error);
      setStatus(ParsingStatus.ERROR);
      setErrorMessage(
        error instanceof Error 
          ? error.message 
          : "Đã xảy ra lỗi không mong muốn khi kết nối với Gemini."
      );
    }
  };

  const saveProject = async () => {
    if (!novelName || !chapterNumber || parsedBlocks.length === 0) {
      showToast("Vui lòng nhập Tên tiểu thuyết, Chương và phân tích kết quả trước khi lưu!");
      return;
    }

    const projectData: LiteraryProject = {
      id: Date.now(),
      type: 'literary',
      title: novelName,
      chapters: [
        {
          id: Date.now(),
          chapter: chapterNumber,
          chapterTitle: chapterTitle,
          script: inputText,
          blocks: parsedBlocks,
          timestamp: new Date().toISOString()
        }
      ],
      lastUpdated: new Date().toISOString()
    };

    try {
      await saveProjectToServer(projectData);
      showToast(`Đã lưu chương ${chapterNumber} vào bộ truyện ${novelName}!`);
      fetchProjects();
    } catch (err) {
      console.error(err);
      showToast("Lỗi khi lưu dự án");
    }
  };

  const deleteProject = async (id: number) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa toàn bộ bộ truyện này không?")) return;
    try {
      await deleteProjectFromServer(id);
      setSavedProjects(prev => prev.filter(p => p.id !== id));
      showToast("Đã xóa bộ truyện khỏi thư viện");
    } catch (err) {
      console.error(err);
      showToast("Lỗi khi xóa dự án");
    }
  };

  const loadChapter = (project: LiteraryProject, chapterId: number) => {
    if (!project.chapters) return;
    const chapter = project.chapters.find(c => c.id === chapterId);
    if (!chapter) return;

    setNovelName(project.title);
    setChapterNumber(chapter.chapter);
    setChapterTitle(chapter.chapterTitle || '');
    setInputText(chapter.script);
    setParsedBlocks(chapter.blocks);
    setStatus(ParsingStatus.SUCCESS);
    setViewMode('editor');
  };

  const handleNextChapter = () => {
    // Trích xuất số từ chapterNumber (ví dụ: "Chương 1" -> 1)
    const match = chapterNumber.match(/\d+/);
    const currentNum = match ? parseInt(match[0]) : parseInt(chapterNumber);
    const nextNum = !isNaN(currentNum) ? currentNum + 1 : 1;
    
    // Nếu chapterNumber có định dạng "Chương X", giữ nguyên định dạng
    let nextChapter = nextNum.toString();
    if (chapterNumber.includes('Chương')) {
      nextChapter = `Chương ${nextNum}`;
    }
    
    // Xóa dữ liệu cũ nhưng giữ lại tên tiểu thuyết
    setInputText('');
    setChapterNumber(nextChapter);
    setChapterTitle('');
    setParsedBlocks([]);
    setStatus(ParsingStatus.IDLE);
    setErrorMessage(null);
    
    showToast(`Đã chuẩn bị cho chương ${nextChapter}!`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDownloadTxt = () => {
    if (parsedBlocks.length === 0) return;
    const textContent = parsedBlocks.map(block => block.content).join('\n\n');
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ban_gop_hoan_chinh.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyText = async () => {
    if (parsedBlocks.length === 0) return;
    const textContent = parsedBlocks.map(block => block.content).join('\n\n');
    try {
      await navigator.clipboard.writeText(textContent);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleDeleteBlock = (index: number) => {
    if (!window.confirm("Bạn có chắc muốn xóa khối này?")) return;
    const newBlocks = [...parsedBlocks];
    newBlocks.splice(index, 1);
    setParsedBlocks(newBlocks);
  };

  const handleStartEdit = (index: number) => {
    setEditingBlockIndex(index);
    setEditValues({ ...parsedBlocks[index] });
  };

  const handleSaveEdit = () => {
    if (editingBlockIndex === null || !editValues) return;
    const newBlocks = [...parsedBlocks];
    newBlocks[editingBlockIndex] = editValues;
    setParsedBlocks(newBlocks);
    setEditingBlockIndex(null);
    setEditValues(null);
    setNewlyAddedBlockIndex(null);
    setShowCharSuggestions(false);
  };

  const handleCancelEdit = () => {
    if (newlyAddedBlockIndex !== null && editingBlockIndex === newlyAddedBlockIndex) {
      const newBlocks = [...parsedBlocks];
      newBlocks.splice(newlyAddedBlockIndex, 1);
      setParsedBlocks(newBlocks);
    }
    setEditingBlockIndex(null);
    setEditValues(null);
    setNewlyAddedBlockIndex(null);
    setShowCharSuggestions(false);
  };

  const handleAddBlock = (index: number) => {
    const newBlock: ParsedBlock = {
      character: '',
      type: 'Tương tác',
      content: 'Nội dung mới...'
    };
    const newBlocks = [...parsedBlocks];
    // Insert after the index. If index is -1, insert at start (though typically we use index of previous block)
    // To insert at very beginning, we might need a special button or handle index -1 logic carefully.
    // Here let's assume index is the position AFTER which we insert.
    newBlocks.splice(index + 1, 0, newBlock);
    setParsedBlocks(newBlocks);
    
    // Automatically start editing the new block
    setEditingBlockIndex(index + 1);
    setEditValues(newBlock);
    setNewlyAddedBlockIndex(index + 1);
  };

  const uniqueCharacters = Array.from(new Set(parsedBlocks
    .map(b => b.character)
    .filter(c => c && c !== 'Người dẫn chuyện' && c !== 'Nhân vật mới')
  ));

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">LitStruct Parser</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Phân tích cấu trúc văn học thông minh</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setViewMode(viewMode === 'editor' ? 'library' : 'editor')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
              viewMode === 'library' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            {viewMode === 'editor' ? <Library className="w-4 h-4" /> : <Code className="w-4 h-4" />}
            {viewMode === 'editor' ? 'Thư viện' : 'Trình phân tích'}
          </button>

          {viewMode === 'editor' && (
            <>
              {parsedBlocks.length > 0 && (
                <>
                  <button
                    onClick={handleNextChapter}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all border border-indigo-100"
                  >
                    <ChevronRight className="w-4 h-4" />
                    Chương tiếp theo
                  </button>
                  <button
                    onClick={saveProject}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-all border border-emerald-100"
                  >
                    <Save className="w-4 h-4" />
                    Lưu kết quả
                  </button>
                </>
              )}
              <button
                onClick={handleAnalyze}
                disabled={status === ParsingStatus.LOADING || !inputText.trim()}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg ${
                  status === ParsingStatus.LOADING ? 'bg-slate-100 text-slate-400' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
                }`}
              >
                {status === ParsingStatus.LOADING ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {status === ParsingStatus.LOADING ? 'Đang phân tích...' : 'Phân tích cấu trúc'}
              </button>
            </>
          )}
        </div>
      </header>

      <main className="flex-1 p-8 max-w-7xl mx-auto w-full overflow-hidden">
        {viewMode === 'library' ? (
          /* Library View */
          <div className="h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                <Library className="w-8 h-8 text-indigo-600" />
                Thư viện phân tích
              </h2>
              <div className="text-sm font-bold text-slate-400 bg-slate-100 px-4 py-2 rounded-xl">
                {savedProjects.length} bản ghi đã lưu
              </div>
            </div>

            {savedProjects.length === 0 ? (
              <div className="bg-white rounded-[40px] border-2 border-dashed border-slate-200 p-20 text-center">
                <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <FileText className="w-10 h-10 text-slate-300" />
                </div>
                <h4 className="text-lg font-bold text-slate-900 mb-2">Chưa có bản phân tích nào</h4>
                <p className="text-slate-500 mb-8 max-w-xs mx-auto text-sm">Hãy thực hiện phân tích và lưu lại để xây dựng thư viện của bạn.</p>
                <button 
                  onClick={() => setViewMode('editor')}
                  className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                >
                  Bắt đầu ngay
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto max-h-[calc(100vh-250px)] pr-2 custom-scrollbar">
                {savedProjects.map((project) => (
                  <div 
                    key={project.id} 
                    className="group bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col"
                  >
                    <div className="p-6 flex-1">
                      <div className="flex items-start justify-between mb-4">
                        <div className="bg-indigo-50 p-3 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                          <Book className="w-6 h-6" />
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteProject(project.id);
                          }}
                          className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                      
                      <h3 className="font-black text-slate-800 text-lg mb-1 line-clamp-1">{project.title}</h3>
                      <div className="text-slate-400 text-xs font-bold mb-4 uppercase tracking-widest">
                        {(project.chapters || []).length} chương đã phân tích
                      </div>
                      
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                        {(project.chapters || []).map((chapter) => (
                          <button
                            key={chapter.id}
                            onClick={() => loadChapter(project, chapter.id)}
                            className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 transition-all border border-transparent hover:border-indigo-100 group/chapter"
                          >
                            <div className="flex flex-col items-start">
                              <span className="font-bold text-xs">Chương {chapter.chapter}</span>
                              {chapter.chapterTitle && (
                                <span className="text-[10px] opacity-70 line-clamp-1">{chapter.chapterTitle}</span>
                              )}
                            </div>
                            <ChevronRight className="w-4 h-4 opacity-0 group-hover/chapter:opacity-100 transition-all" />
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <Clock className="w-3.5 h-3.5" />
                        Cập nhật: {new Date(project.lastUpdated).toLocaleDateString('vi-VN')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Editor View */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full overflow-hidden">
            {/* Input Column */}
            <div className="flex flex-col h-[calc(100vh-160px)] space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Code className="w-4 h-4" /> Thông tin & Văn bản
                </h2>
                <button 
                  onClick={() => {
                    setNovelName('Thần Đạo Đan Tôn');
                    setChapterNumber('1');
                    setChapterTitle('Sống Lại');
                    setInputText(SAMPLE_TEXT);
                  }}
                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded"
                >
                  Dùng mẫu thử
                </button>
              </div>

              {/* Novel Metadata Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative group">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                    <Book className="w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                  </div>
                  <input
                    type="text"
                    value={novelName}
                    onChange={(e) => setNovelName(e.target.value)}
                    placeholder="Tên tiểu thuyết..."
                    className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                  />
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                    <Hash className="w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                  </div>
                  <input
                    type="text"
                    value={chapterNumber}
                    onChange={(e) => setChapterNumber(e.target.value)}
                    placeholder="Số chương..."
                    className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                  />
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                    <TypeIcon className="w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                  </div>
                  <input
                    type="text"
                    value={chapterTitle}
                    onChange={(e) => setChapterTitle(e.target.value)}
                    placeholder="Tên chương (tùy chọn)..."
                    className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="flex-1 bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm focus-within:border-indigo-300 focus-within:shadow-md transition-all relative overflow-hidden">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Dán nội dung tiểu thuyết vào đây để phân tích lời thoại và hành động..."
                  className="w-full h-full bg-transparent border-none focus:ring-0 text-sm text-slate-700 placeholder:text-slate-300 resize-none font-medium leading-relaxed"
                />
                <div className="absolute bottom-6 right-6 text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                  {inputText.length} ký tự
                </div>
              </div>
            </div>

            {/* Output Column */}
            <div className="flex flex-col h-[calc(100vh-160px)] space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Layout className="w-4 h-4" /> Kết quả cấu trúc
                </h2>
                
                {parsedBlocks.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="flex bg-slate-200 rounded-lg p-1 text-[9px] font-black uppercase tracking-widest">
                      <button
                        onClick={() => setActiveTab('visual')}
                        className={`px-3 py-1 rounded-md transition-colors ${
                          activeTab === 'visual' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Trực quan
                      </button>
                      <button
                        onClick={() => setActiveTab('json')}
                        className={`px-3 py-1 rounded-md transition-colors ${
                          activeTab === 'json' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        JSON
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex-1 bg-slate-900 rounded-[32px] shadow-2xl border border-slate-800 relative flex flex-col overflow-hidden">
                {status === ParsingStatus.LOADING ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                    <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
                    <p className="text-indigo-100 font-bold uppercase tracking-widest text-sm animate-pulse">Gemini đang phân tích cấu trúc...</p>
                  </div>
                ) : status === ParsingStatus.ERROR ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                    <div className="bg-red-500/10 p-4 rounded-3xl mb-4">
                      <AlertCircle className="w-12 h-12 text-red-500" />
                    </div>
                    <h3 className="text-red-400 font-bold uppercase tracking-widest text-sm mb-2">Phân tích thất bại</h3>
                    <p className="text-slate-500 text-xs max-w-xs leading-relaxed">{errorMessage}</p>
                    <button 
                      onClick={handleAnalyze}
                      className="mt-6 px-6 py-2 bg-slate-800 text-white hover:bg-slate-700 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all"
                    >
                      Thử lại
                    </button>
                  </div>
                ) : parsedBlocks.length > 0 ? (
                  <>
                    <div className="p-6 border-b border-white/5 flex justify-end gap-3">
                      <button
                        onClick={handleDownloadTxt}
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-[10px] font-bold transition-all uppercase tracking-widest border border-white/5"
                      >
                        <Download className="w-3.5 h-3.5" /> Xuất TXT
                      </button>
                      <button
                        onClick={handleCopyText}
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-indigo-300 rounded-xl text-[10px] font-bold transition-all uppercase tracking-widest border border-white/5"
                      >
                        {copyStatus === 'idle' ? (
                          <><Copy className="w-3.5 h-3.5" /> Copy kết quả</>
                        ) : (
                          <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Đã copy</>
                        )}
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-8 scroll-smooth custom-scrollbar">
                      {activeTab === 'visual' ? (
                        <div className="space-y-6 max-w-2xl mx-auto pb-20">
                          {/* Add block at start if list is not empty */}
                          {parsedBlocks.length > 0 && (
                             <div className="flex justify-center opacity-0 hover:opacity-100 transition-opacity -my-3 z-10 relative">
                                <button
                                  onClick={() => handleAddBlock(-1)}
                                  className="bg-indigo-100 text-indigo-600 rounded-full p-1 shadow-sm hover:bg-indigo-200 hover:scale-110 transition-all"
                                  title="Thêm khối mới ở đầu"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                             </div>
                          )}

                          {parsedBlocks.map((block, idx) => {
                            const isEditing = editingBlockIndex === idx;
                            const isNarration = block.type === 'Dẫn chuyện';

                            if (isEditing && editValues) {
                              return (
                                <div key={idx} className="bg-white p-4 rounded-2xl shadow-xl border-2 border-indigo-500 animate-in zoom-in-95 duration-200">
                                  <div className="grid grid-cols-2 gap-4 mb-3">
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Nhân vật</label>
                                      <div className="relative">
                                        <input
                                          type="text"
                                          value={editValues.character}
                                          onChange={(e) => setEditValues({ ...editValues, character: e.target.value })}
                                          placeholder="Nhập tên nhân vật..."
                                          className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                          onFocus={() => setShowCharSuggestions(true)}
                                        />
                                        <button 
                                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-500 p-1"
                                          onClick={() => setShowCharSuggestions(!showCharSuggestions)}
                                          type="button"
                                        >
                                          <ChevronDown size={14} />
                                        </button>
                                        
                                        {showCharSuggestions && (
                                          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto custom-scrollbar">
                                             {uniqueCharacters.length > 0 ? (
                                                uniqueCharacters.map((char, i) => (
                                                   <button 
                                                      key={i}
                                                      className="w-full text-left px-4 py-2 hover:bg-indigo-50 text-sm font-medium text-slate-700 transition-colors border-b border-slate-50 last:border-0"
                                                      onClick={() => {
                                                         setEditValues({ ...editValues, character: char });
                                                         setShowCharSuggestions(false);
                                                      }}
                                                      type="button"
                                                   >
                                                      {char}
                                                   </button>
                                                ))
                                             ) : (
                                                <div className="px-4 py-2 text-xs text-slate-400 italic text-center">Chưa có nhân vật nào</div>
                                             )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Loại</label>
                                      <select
                                        value={editValues.type}
                                        onChange={(e) => setEditValues({ ...editValues, type: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                      >
                                        <option value="Tương tác">Tương tác</option>
                                        <option value="Dẫn chuyện">Dẫn chuyện</option>
                                      </select>
                                    </div>
                                  </div>
                                  <div className="mb-4">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Nội dung</label>
                                    <textarea
                                      value={editValues.content}
                                      onChange={(e) => setEditValues({ ...editValues, content: e.target.value })}
                                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm leading-relaxed text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 min-h-[100px] resize-y"
                                    />
                                  </div>
                                  <div className="flex justify-end gap-2">
                                    <button
                                      onClick={handleCancelEdit}
                                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                                    >
                                      <X className="w-3.5 h-3.5" /> Hủy
                                    </button>
                                    <button
                                      onClick={handleSaveEdit}
                                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                                    >
                                      <Check className="w-3.5 h-3.5" /> Lưu
                                    </button>
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div key={idx} className="group/block relative">
                                <div className={`flex flex-col ${isNarration ? 'items-center' : 'items-start'}`}>
                                  {!isNarration && (
                                    <span className="text-[9px] font-black text-indigo-400 mb-1.5 ml-1 uppercase tracking-[0.2em]">
                                      {block.character}
                                    </span>
                                  )}
                                  
                                  <div className={`
                                    relative p-5 rounded-2xl max-w-full text-sm leading-relaxed border group-hover/block:border-indigo-200 transition-colors
                                    ${isNarration 
                                      ? 'bg-white/5 border-white/5 text-slate-400 italic text-center w-full' 
                                      : 'bg-slate-800 text-indigo-50 border-white/5 rounded-tl-sm shadow-xl'
                                    }
                                  `}>
                                    {block.content}
                                    
                                    <div className={`absolute -top-2.5 -right-2.5 px-2.5 py-1 rounded-lg text-[8px] uppercase tracking-[0.15em] font-black border ${
                                       isNarration 
                                       ? 'bg-slate-900 text-slate-500 border-white/10' 
                                       : 'bg-indigo-600 text-white border-indigo-500 shadow-lg'
                                    }`}>
                                      {block.type}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover/block:opacity-100 transition-opacity bg-slate-900/80 p-1 rounded-lg backdrop-blur-sm">
                                      <button
                                        onClick={() => handleStartEdit(idx)}
                                        className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                                        title="Chỉnh sửa"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteBlock(idx)}
                                        className="p-1.5 text-slate-300 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                                        title="Xóa"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                {/* Add button between blocks */}
                                <div className="flex justify-center opacity-0 group-hover/block:opacity-100 transition-opacity -mb-3 mt-3 z-10 relative h-0">
                                  <button
                                    onClick={() => handleAddBlock(idx)}
                                    className="bg-indigo-100 text-indigo-600 rounded-full p-1 shadow-sm hover:bg-indigo-200 hover:scale-110 transition-all -translate-y-1/2"
                                    title="Thêm khối mới bên dưới"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                          
                          {/* Add button at the very end */}
                          <div className="flex justify-center pt-4">
                             <button
                               onClick={() => handleAddBlock(parsedBlocks.length - 1)}
                               className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-indigo-600 rounded-xl text-xs font-bold transition-all uppercase tracking-widest"
                             >
                               <Plus className="w-4 h-4" /> Thêm khối cuối
                             </button>
                          </div>
                        </div>
                      ) : (
                        <pre className="font-mono text-xs text-emerald-400/80 bg-black/30 p-6 rounded-2xl overflow-x-auto h-full border border-white/5">
                          {JSON.stringify(parsedBlocks, null, 2)}
                        </pre>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                    <div className="bg-white/5 w-24 h-24 rounded-[40px] flex items-center justify-center mb-8">
                      <Layout className="w-10 h-10 text-white/10" />
                    </div>
                    <p className="text-white/20 text-sm font-bold uppercase tracking-widest">Chưa có kết quả phân tích</p>
                    <p className="text-white/10 text-[10px] mt-3 max-w-[240px] leading-relaxed">Vui lòng nhập văn bản và nhấn nút "Phân tích cấu trúc" để bắt đầu.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Toast Notification */}
      <Toast message={toast.message} visible={toast.visible} />
    </div>
  );
};

export default LiteraryParser;

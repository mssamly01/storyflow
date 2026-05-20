
import React, { Component, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ProductionStage, ScriptData, ProductionData, CharacterProfile, LocationProfile, StoryFlowProject, StepStatus, FinalResult, FinalResultPanel } from '../types';
import * as gemini from '../services/geminiService';
import { buildCharacterReferenceSheetPrompt } from '../services/referencePromptService';
import { buildLocationReferenceSheetPrompt } from '../services/locationContinuityService';
import { ScreenStudioView } from './storyflow/ScreenStudioView';
import { ScreenContinuityView } from './storyflow/ScreenContinuityView';
import { getPanelSourceFields, normalizeStoryboardPanels } from '../services/storyboardDataService';
import {
  buildFinalResult,
  createFallbackScreensFromBeats,
  ensureVisualPromptHasNegativePrompt,
  getFinalResultMissingInputs,
  mergeBeatMomentDetailsIntoBeats,
  mergeScreenContinuityIntoScreens,
  normalizeBeats,
  normalizeCharacterLocationLibrary,
  normalizeEngineerPrompts,
  normalizeScreens,
  normalizeScreenContinuity,
  parseJsonSafe
} from '../services/finalResultBuilderService';
import {
  hydrateBeatAnalysisOriginalText,
  segmentSourceText,
  validateBeatRhythm,
  BeatRhythmWarning
} from '../services/sourceTextSegmentService';
import {
  buildFinalResultFromProject,
  createInitialProject,
  hydrateStoryFlowProject,
  lockBeatFields,
  lockCharacterFields,
  lockLocationFields,
  replaceBeats,
  replaceBeatsFromUserEdit,
  replaceCharacterLocationLibrary,
  replaceEngineerPrompts,
  replaceFinalResult,
  replaceScreens,
  replaceStoryboardPanels,
  serializeProjectForStorage,
  syncProjectSource,
  replaceScreenContinuity,
  replaceBeatMomentDetails
} from '../services/storyFlowProjectService';
import {
  buildSrtFromItems,
  buildTxtFromItems,
  buildImagePromptTxtFromFinalResult,
  downloadTextFile,
  extractSubtitleItemsFromBeats,
  extractSubtitleItemsFromFinalResult,
} from '../services/subtitleExportService';
import { FinalResultStudioView } from './storyflow/FinalResultStudioView';
import {
  loadLiteraryProjects,
} from '../services/projectStorageService';
import {
  saveStoryFlowProject,
  loadStoryFlowProjects,
  openStoryFlowProject,
  deleteStoryFlowProject,
  deleteStoryFlowNovel,
  type StoryFlowProjectLibrary
} from '../services/projectFileStorageService';
import {
  BEAT_SOURCE_FIELDS,
  CHARACTER_APPEARANCE_FIELDS,
  LOCATION_CONTINUITY_FIELDS,
  getLockedFields,
  isFieldLocked
} from '../services/fieldLockService';
import { 
  FileText, 
  BarChart2, 
  Users,
  Layout, 
  Zap, 
  ShieldCheck, 
  ChevronRight, 
  Loader2, 
  Copy, 
  RefreshCw,
  Send,
  Eye,
  CheckCircle2,
  FileJson,
  Palette,
  Table,
  Code2,
  Settings2,
  Terminal,
  Save,
  Sparkles,
  Library,
  Trash2,
  History,
  Clock,
  Book,
  AlertCircle,
  ArrowRight,
  Download,
  Home,
  Camera,
  Move,
  Play,
  MapPin,
  Sun,
  Plus,
  Edit2,
  Check,
  X,
  Lock,
  Unlock
} from 'lucide-react';

const STYLE_OPTIONS = [
  {
    id: 'manhua',
    label: 'Manhua (Hiện đại)',
    description: 'Phong cách truyện tranh Trung Quốc hiện đại.',
    prompt: 'Modern Manhua style, Chinese webtoon aesthetic, elegant character designs, vibrant digital coloring, clean line art, beautiful lighting, polished look, contemporary manhua inspired.'
  },
  {
    id: 'manhwa',
    label: 'Manhwa (Hàn Quốc)',
    description: 'Phong cách truyện tranh Hàn Quốc hiện đại, sắc nét, màu sắc rực rỡ.',
    prompt: 'Modern Manhwa style, South Korean webtoon aesthetic, sharp line art, vibrant digital coloring, elegant character designs, beautiful lighting, high contrast, clean and polished look, Solo Leveling inspired.'
  },
  { 
    id: 'anime', 
    label: 'Anime Hiện đại', 
    description: 'Phong cách hoạt hình Nhật Bản hiện đại, hiệu ứng ánh sáng đẹp.',
    prompt: 'Modern high-end anime style, Makoto Shinkai aesthetic, beautiful lighting effects, detailed backgrounds, expressive eyes, vibrant colors, lens flares, soft shadows, cinematic anime composition.'
  },
  { 
    id: 'cinematic', 
    label: 'Điện ảnh (Cinematic)', 
    description: 'Điện ảnh kịch tính, độ chi tiết cực cao, ánh sáng phức tạp.',
    prompt: 'Cinematic thriller style, high-budget Hollywood movie aesthetic, dramatic chiaroscuro lighting, intense shadows, hyper-realistic textures, 8k resolution, shot on 35mm lens, moody atmosphere, deep color grading.'
  },
  {
    id: 'manhua_ancient',
    label: 'Manhua (Cổ trang)',
    description: 'Phong cách tiên hiệp, cổ trang, kiếm hiệp Trung Quốc.',
    prompt: 'Ancient Manhua style, Chinese webtoon aesthetic, ethereal and graceful character designs, soft lighting, detailed traditional Chinese elements, flowing silk garments, long hair, beautiful mountain landscapes, fantasy martial arts (Xianxia/Wuxia) atmosphere.'
  },
  { 
    id: '2d-animated', 
    label: 'Hoạt hình 2D', 
    description: 'Hoạt hình truyền thống, nét vẽ rõ ràng, màu sắc phẳng.',
    prompt: 'Traditional 2D animation style, cel-shaded, clean bold outlines, vibrant flat colors, high-quality hand-drawn aesthetic, Studio Ghibli inspired but sharper, smooth line art, expressive character features.'
  },
  {
    id: 'cyberpunk',
    label: 'Cyberpunk / Viễn tưởng',
    description: 'Tương lai, ánh đèn neon, công nghệ cao nhưng đời sống thấp.',
    prompt: 'Cyberpunk aesthetic, neon-drenched cityscapes, rainy nights, high-tech low-life, glowing accents, cinematic sci-fi lighting, futuristic textures, vibrant purples and blues, Blade Runner inspired.'
  },
  { 
    id: 'horror', 
    label: 'Kinh dị (Horror)', 
    description: 'U tối, rùng rợn, bầu không khí ám ảnh, phong cách cổ điển.',
    prompt: 'Gothic horror style, dark and eerie atmosphere, Victorian aesthetic, muted colors, fog and mist, unsettling shadows, grainy film texture, macabre details, inspired by Guillermo del Toro.'
  },
  { 
    id: 'noir', 
    label: 'Phim đen (Film Noir)', 
    description: 'Trắng đen cổ điển, độ tương phản cực cao, ánh sáng đổ bóng mạnh.',
    prompt: 'Classic Film Noir style, black and white, extreme high contrast, dramatic shadows (venetian blind shadows), rainy urban settings, 1940s aesthetic, moody and cynical atmosphere, sharp focus.'
  }
];

const isLongBeatOriginalText = (originalText?: string) => {
  const wordCount = (originalText || "").trim().split(/\s+/).filter(Boolean).length;
  return wordCount > 80;
};

interface StoryFlowProps {
  onBack: () => void;
}

function hasTextValue(value?: string): boolean {
  return Boolean(value && value.trim().length > 0);
}

function canBuildFinalResult(production: ProductionData): boolean {
  return (
    hasTextValue(production.analysis) &&
    hasTextValue(production.storyboard) &&
    hasTextValue(production.prompts)
  );
}

function isStoryboardProductionComplete(production: ProductionData): boolean {
  if (!production.storyboard?.trim()) return false;

  const beats = normalizeBeats(parseJsonSafe<unknown>(production.analysis, {}));
  const panels = normalizeStoryboardPanels(parseJsonSafe<unknown>(production.storyboard, { panels: [] }));
  if (!beats.length) return panels.length > 0;

  const panelBeatIds = new Set<number>();
  panels.forEach((panel) => {
    const beatId = getStoryboardPanelBeatId(panel);
    if (beatId) panelBeatIds.add(beatId);
  });

  return beats.every((beat) => panelBeatIds.has(Number(beat.beatId)));
}

function requiresManualInput(stage: ProductionStage): boolean {
  return [
    ProductionStage.ANALYSIS,
    ProductionStage.CHARACTER_LOCATION,
    ProductionStage.SCREEN_CONTINUITY,
    ProductionStage.BEAT_MOMENT,
    ProductionStage.STORYBOARD
  ].includes(stage);
}

function chooseFinalBuildItems<T>(
  projectItems: T[],
  productionItems: T[],
  beatCount: number
): T[] {
  if (!productionItems.length) return projectItems;
  if (!projectItems.length) return productionItems;

  const score = (items: T[]) => {
    if (!beatCount) return items.length;
    const exactBonus = items.length === beatCount ? 1_000_000 : 0;
    return exactBonus - Math.abs(items.length - beatCount) + items.length / 10_000;
  };

  return score(productionItems) > score(projectItems) ? productionItems : projectItems;
}

function getStoryboardPanelBeatId(panel: any): number | null {
  const beatId = Number(panel?.beatId ?? panel?.panelNumber);
  return Number.isFinite(beatId) && beatId > 0 ? beatId : null;
}

function mergeStoryboardPanelsByBeatId(existingPanels: any[], incomingPanels: any[]) {
  const map = new Map<number, any>();
  [...existingPanels, ...incomingPanels].forEach((panel) => {
    const beatId = getStoryboardPanelBeatId(panel);
    if (beatId) {
      map.set(beatId, { ...panel, beatId });
    }
  });
  return Array.from(map.values()).sort((left, right) => left.beatId - right.beatId);
}


class StageRenderBoundary extends Component<
  { stage: ProductionStage; resetKey: string; children: React.ReactNode },
  { error: Error | null }
> {
  declare props: { stage: ProductionStage; resetKey: string; children: React.ReactNode };
  declare setState: (state: { error: Error | null }) => void;

  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("Stage render error", error);
  }

  componentDidUpdate(prevProps: { stage: ProductionStage; resetKey: string }) {
    if ((prevProps.stage !== this.props.stage || prevProps.resetKey !== this.props.resetKey) && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    const isPromptStage = this.props.stage === ProductionStage.PROMPTS;
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-900">
        <h3 className="text-sm font-black uppercase tracking-widest">
          {isPromptStage ? "Prompt Engineering render error." : "Stage render error."}
        </h3>
        <p className="mt-2 text-sm leading-relaxed">
          {isPromptStage
            ? "JSON co the sai schema hoac thieu engineerPrompts[]. Hay kiem tra du lieu vua paste."
            : "Du lieu cua stage nay co the sai schema. Hay kiem tra JSON vua paste."}
        </p>
      </div>
    );
  }
}

function getPromptEngineeringMissingInputs(production: ProductionData): string[] {
  const missing: string[] = [];

  if (!production.analysis?.trim()) missing.push("Phân tích nội dung");
  if (!production.characterLocationAnalysis?.trim()) missing.push("Nhân vật & Bối cảnh");
  if (!production.screenContinuity?.trim()) missing.push("Thiết lập bối cảnh");
  if (!production.beatMomentDetails?.trim()) missing.push("Chi tiết hành động");
  if (!production.storyboard?.trim()) missing.push("Phác thảo minh họa");

  return missing;
}

const StoryFlow: React.FC<StoryFlowProps> = ({ onBack }) => {
  const [stage, setStage] = useState<ProductionStage>(ProductionStage.INPUT);
  const [viewMode, setViewMode] = useState<'table' | 'json'>('table');
  const [finalResultViewMode, setFinalResultViewMode] = useState<'panels' | 'json'>('panels');
  const [showAnalysisJson, setShowAnalysisJson] = useState(false);
  const [isManualMode, setIsManualMode] = useState(false);
  const [isGlobalManualMode, setIsGlobalManualMode] = useState(false);
  const [showAnalysisModeModal, setShowAnalysisModeModal] = useState(false);
  const [manualInputValue, setManualInputValue] = useState('');
  const [storyboardBatchIndex, setStoryboardBatchIndex] = useState(0);
  const [storyboardBatchInputs, setStoryboardBatchInputs] = useState<Record<number, string>>({});
  const [showStoryboardPreview, setShowStoryboardPreview] = useState(false);
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [referencePromptModal, setReferencePromptModal] = useState<{
    open: boolean;
    title: string;
    subjectName: string;
    prompt: string;
  }>({ open: false, title: '', subjectName: '', prompt: '' });
  const [toast, setToast] = useState<{ message: string, visible: boolean }>({ message: '', visible: false });

  const [importedFileName, setImportedFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const autoPromptBuildSignatureRef = useRef("");
  const autoFinalResultBuildSignatureRef = useRef("");

  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
  };

  const handleImportTxtFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isTxtFile = file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt');
    if (!isTxtFile) {
      showToast("Chỉ hỗ trợ import file .txt.");
      event.target.value = '';
      return;
    }

    const MAX_TXT_SIZE_MB = 5;
    if (file.size > MAX_TXT_SIZE_MB * 1024 * 1024) {
      showToast(`File quá lớn. Vui lòng chọn file dưới ${MAX_TXT_SIZE_MB}MB.`);
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      setInputData(prev => ({ ...prev, script: text, title: baseName }));
      setImportedFileName(file.name);
      showToast(`Đã nhập thành công từ file: ${file.name}`);
      event.target.value = '';
    };
    reader.onerror = () => {
      showToast("Không thể đọc file .txt. Vui lòng thử lại.");
      event.target.value = '';
    };
    reader.readAsText(file, "utf-8");
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInputData(prev => ({ ...prev, script: text }));
        setImportedFileName("");
        showToast("Đã dán văn bản từ clipboard!");
      } else {
        showToast("Clipboard trống hoặc không chứa văn bản.");
      }
    } catch (err) {
      showToast("Không thể đọc clipboard. Hãy dùng Ctrl+V trực tiếp vào ô nhập.");
    }
  };

  const handleClearText = () => {
    setInputData(prev => ({ ...prev, script: "" }));
    setImportedFileName("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    showToast("Đã xóa nội dung ô nhập.");
  };


  const [inputData, setInputData] = useState<ScriptData>({
    script: '',
    selectedStyle: 'manhua',
    title: '',
    chapter: '',
    chapterTitle: ''
  });
  const [production, setProduction] = useState<ProductionData>({});
  const [project, setProject] = useState<StoryFlowProject>(() => createInitialProject());
  const [unlockedStages, setUnlockedStages] = useState<ProductionStage[]>([ProductionStage.INPUT]);
  const [savedProjectLibrary, setSavedProjectLibrary] = useState<StoryFlowProjectLibrary>({ novels: [] });
  const [isProjectLibraryLoading, setIsProjectLibraryLoading] = useState(false);
  const [previousProject, setPreviousProject] = useState<any>(null);
  const [litProjects, setLitProjects] = useState<any[]>([]);
  const [showLitLibraryModal, setShowLitLibraryModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'danger' | 'info';
  }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'info'
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  function computeUnlockedStages(data: ScriptData, prod: ProductionData, currentStage: ProductionStage) {
    const set = new Set<ProductionStage>([ProductionStage.INPUT]);
    if (prod.analysis) set.add(ProductionStage.ANALYSIS);
    if (prod.characterLocationAnalysis) set.add(ProductionStage.CHARACTER_LOCATION);
    if (prod.screenContinuity) set.add(ProductionStage.SCREEN_CONTINUITY);
    if (prod.beatMomentDetails) set.add(ProductionStage.BEAT_MOMENT);
    if (isStoryboardProductionComplete(prod)) set.add(ProductionStage.STORYBOARD);
    if (prod.prompts) set.add(ProductionStage.PROMPTS);
    if (prod.prompts) set.add(ProductionStage.FINAL);
    if (prod.finalResult) set.add(ProductionStage.FINAL);
    if (currentStage !== ProductionStage.LIBRARY) set.add(currentStage);
    return Array.from(set);
  }



  // States for editing beats in Analysis stage
  const [editingBeatIndex, setEditingBeatIndex] = useState<number | null>(null);
  const [editingBeatData, setEditingBeatData] = useState<any>(null);

  const rhythmWarnings = useMemo<BeatRhythmWarning[]>(() => {
    return validateBeatRhythm(project.beats || []);
  }, [project.beats]);

  // Load temporary state from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem('storyflow_temp_state');
    if (savedState) {
      try {
        const {
          stage: savedStage,
          inputData: savedInputData,
          production: savedProduction,
          project: savedProject,
          unlockedStages: savedUnlockedStages,
          storyboardBatchIndex: savedStoryboardBatchIndex,
          isManualMode: savedManual,
          isGlobalManualMode: savedGlobalManual
        } = JSON.parse(savedState);
        const initialStage = savedStage || ProductionStage.INPUT;
        const initialInputData = savedInputData || { script: '', selectedStyle: 'manhua', title: '', chapter: '', chapterTitle: '' };
        const initialProduction = savedProduction || {};
        setStage(initialStage);
        setInputData(initialInputData);
        setProduction(initialProduction);
        setProject(hydrateStoryFlowProject(initialInputData, initialProduction, savedProject));
        if (Array.isArray(savedUnlockedStages) && savedUnlockedStages.length > 0) {
          setUnlockedStages(savedUnlockedStages);
        } else {
          setUnlockedStages(computeUnlockedStages(initialInputData, initialProduction, initialStage));
        }
        if (Number.isFinite(Number(savedStoryboardBatchIndex))) setStoryboardBatchIndex(Number(savedStoryboardBatchIndex));
        if (savedManual !== undefined) setIsManualMode(Boolean(savedManual));
        if (savedGlobalManual !== undefined) setIsGlobalManualMode(Boolean(savedGlobalManual));
      } catch (e) {
        console.error("Failed to parse saved state:", e);
      }
    }
    setIsLoaded(true);
  }, []);

  // Save temporary state to localStorage
  useEffect(() => {
    if (!isLoaded) return;
    const projectForStorage = serializeProjectForStorage(project);
    const stateToSave = {
      stage,
      inputData,
      production,
      project: projectForStorage,
      unlockedStages,
      storyboardBatchIndex,
      isManualMode,
      isGlobalManualMode
    };

    try {
      localStorage.setItem('storyflow_temp_state', JSON.stringify(stateToSave));
    } catch (error) {
      console.warn("Failed to persist full StoryFlow temp state. Retrying with compact state.", error);
      const compactState = {
        ...stateToSave,
        production: {
          ...production,
          finalResult: undefined
        },
        project: {
          id: projectForStorage.id,
          title: projectForStorage.title,
          sourceText: projectForStorage.sourceText,
          selectedStyleId: projectForStorage.selectedStyleId,
          screenContinuity: projectForStorage.screenContinuity,
          beatMomentDetails: projectForStorage.beatMomentDetails,
          workflow: projectForStorage.workflow,
          createdAt: projectForStorage.createdAt,
          updatedAt: projectForStorage.updatedAt
        }
      };

      try {
        localStorage.setItem('storyflow_temp_state', JSON.stringify(compactState));
      } catch (compactError) {
        console.warn("Failed to persist compact StoryFlow temp state. Skipping temp persistence.", compactError);
      }
    }
  }, [isLoaded, stage, inputData, production, project, unlockedStages, storyboardBatchIndex, isManualMode, isGlobalManualMode]);

  useEffect(() => {
    if (!isLoaded) return;
    setProject(prev => syncProjectSource(prev, inputData));
  }, [isLoaded, inputData.title, inputData.script, inputData.selectedStyle]);

  useEffect(() => {
    if (stage === ProductionStage.LIBRARY) return;
    setUnlockedStages(prev => (prev.includes(stage) ? prev : [...prev, stage]));
  }, [stage]);

  useEffect(() => {
    if (stage === ProductionStage.STORYBOARD) {
      setStoryboardBatchIndex(0);
      setShowStoryboardPreview(false);
    }
  }, [stage, production.analysis]);

  const safeSlug = useCallback((value: string) => {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 100) || "untitled";
  }, []);

  const refreshProjectLibrary = useCallback(async () => {
    setIsProjectLibraryLoading(true);
    try {
      const library = await loadStoryFlowProjects();
      setSavedProjectLibrary(library);
    } catch (error) {
      console.warn("Failed to load StoryFlow project library from disk. Project local server might not be running.", error);
    } finally {
      setIsProjectLibraryLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProjectLibrary();
    setLitProjects(loadLiteraryProjects());
  }, [refreshProjectLibrary]);

  useEffect(() => {
    const fetchPreviousProject = async () => {
      if (!inputData.title || !inputData.chapter || !savedProjectLibrary.novels.length) {
        setPreviousProject(null);
        return;
      }

      const novel = savedProjectLibrary.novels.find(
        n => n.title.toLowerCase().trim() === inputData.title.toLowerCase().trim() ||
             n.folderName === safeSlug(inputData.title)
      );

      if (!novel || !novel.chapters.length) {
        setPreviousProject(null);
        return;
      }

      const currentChapterNum = parseInt(inputData.chapter.replace(/\D/g, '')) || 0;

      const prevChapters = novel.chapters.filter(ch => {
        const chNum = parseInt(ch.chapter.toString().replace(/\D/g, '')) || 0;
        return chNum < currentChapterNum;
      });

      if (prevChapters.length === 0) {
        setPreviousProject(null);
        return;
      }

      prevChapters.sort((a, b) => {
        const aNum = parseInt(a.chapter.toString().replace(/\D/g, '')) || 0;
        const bNum = parseInt(b.chapter.toString().replace(/\D/g, '')) || 0;
        return bNum - aNum;
      });

      const closestPrev = prevChapters[0];
      try {
        const fullProj = await openStoryFlowProject(novel.folderName, closestPrev.fileName);
        setPreviousProject(fullProj);
      } catch (err) {
        console.warn("Could not load previous chapter project for library context:", err);
        setPreviousProject(null);
      }
    };

    void fetchPreviousProject();
  }, [inputData.title, inputData.chapter, savedProjectLibrary, safeSlug]);

  const steps = [
    { id: ProductionStage.INPUT, label: "Nhập tiểu thuyết", icon: FileText },
    { id: ProductionStage.ANALYSIS, label: "Phân tích nội dung", icon: BarChart2 },
    { id: ProductionStage.CHARACTER_LOCATION, label: "Nhân vật & Bối cảnh", icon: Users },
    { id: ProductionStage.SCREEN_CONTINUITY, label: "Thiết lập bối cảnh", icon: Palette },
    { id: ProductionStage.BEAT_MOMENT, label: "Chi tiết hành động", icon: Table },
    { id: ProductionStage.STORYBOARD, label: "Phác thảo minh họa", icon: Layout },
    { id: ProductionStage.PROMPTS, label: "Prompt Engineering", icon: Zap },
    { id: ProductionStage.FINAL, label: "Kết quả cuối cùng", icon: Sparkles }
  ];

  const getSelectedStylePrompt = () => {
    const option = STYLE_OPTIONS.find(s => s.id === inputData.selectedStyle);
    return option ? option.prompt : inputData.selectedStyle;
  };

  const getMasterLibrary = () => {
    const characterMap = new Map<string, any>();
    const locationMap = new Map<string, any>();

    const lastProject = previousProject;
    let lastChapterContext = "";

    if (lastProject) {
      try {
        const getParsedData = (data: any) => {
          if (!data) return null;
          if (typeof data === 'string') {
            try { return JSON.parse(data); } catch(e) { return null; }
          }
          return data;
        };

        const lastBeats = getParsedData(lastProject.production?.analysis);
        const lastCharAnalysis = getParsedData(lastProject.production?.characterLocationAnalysis);
        const lastFinalResultRaw = getParsedData(lastProject.production?.finalResult);
        const lastFinalResult = (lastFinalResultRaw && typeof lastFinalResultRaw === 'object' && Array.isArray(lastFinalResultRaw.panels)) 
          ? lastFinalResultRaw.panels 
          : lastFinalResultRaw;

        const charOutfits = new Map<string, string>();
        const charProfiles = new Map<string, any>();

        if (lastCharAnalysis?.characters) {
          lastCharAnalysis.characters.forEach((c: any) => charProfiles.set(c.name, c));
          const charNames = Array.from(charProfiles.keys());
          
          if (Array.isArray(lastFinalResult)) {
            // Quét ngược từ panel cuối lên đầu
            for (let i = lastFinalResult.length - 1; i >= 0; i--) {
              const panel = lastFinalResult[i];
              const prompt = panel.visualPrompt || "";
              
              charNames.forEach((name: string) => {
                if (!charOutfits.has(name)) {
                  const profile = charProfiles.get(name);
                  if (!profile) return;

                  // Tìm tên nhân vật và nội dung trong ngoặc đơn sau đó
                  // Regex linh hoạt hơn để bắt được các biến thể của ngoặc đơn và dấu phẩy
                  const regex = new RegExp(`${name}\\s*\\(([^)]+)\\)`, 'i');
                  const match = prompt.match(regex);
                  
                  if (match && match[1]) {
                    const profileOutfitsText = profile.outfit || "";
                    // Phân tách các outfit trong profile
                    const outfitParts = profileOutfitsText.split(/Outfit\s*\d+\s*[:\-]\s*/i)
                      .map(s => s.trim())
                      .filter(Boolean);
                    
                    if (outfitParts.length > 0) {
                      const promptContent = match[1].toLowerCase();
                      let matchedIndex = -1;

                      // ƯU TIÊN 1: Tìm nhãn "Outfit X" trực tiếp trong prompt
                      const outfitLabelMatch = promptContent.match(/outfit\s*(\d+)/i);
                      if (outfitLabelMatch && outfitLabelMatch[1]) {
                        const outfitNum = parseInt(outfitLabelMatch[1]);
                        if (outfitNum > 0 && outfitNum <= outfitParts.length) {
                          matchedIndex = outfitNum - 1;
                        }
                      }

                      // ƯU TIÊN 2: Nếu không có nhãn hoặc nhãn không khớp, tìm theo nội dung tương đồng
                      if (matchedIndex === -1) {
                        outfitParts.forEach((part, index) => {
                          if (promptContent.includes(part.toLowerCase()) || 
                              part.toLowerCase().includes(promptContent)) {
                            matchedIndex = index;
                          }
                        });
                      }

                      if (matchedIndex !== -1) {
                        // CHỈ lấy nội dung mô tả, không lấy nhãn "Outfit X"
                        charOutfits.set(name, outfitParts[matchedIndex]);
                      }
                    }
                  }
                }
              });

              if (charOutfits.size === charNames.length) break;
            }
          }

          // Fallback: Nếu không tìm thấy trong prompt, lấy outfit mặc định/đầu tiên từ profile
          charNames.forEach(name => {
            if (!charOutfits.has(name)) {
              const profile = charProfiles.get(name);
              if (profile && profile.outfit) {
                const profileOutfitsText = profile.outfit || "";
                const outfitParts = profileOutfitsText.split(/Outfit\s*\d+\s*[:\-]\s*/i)
                  .map(s => s.trim())
                  .filter(Boolean);
                
                if (outfitParts.length > 0) {
                  // CHỈ lấy nội dung mô tả, không lấy nhãn "Outfit X"
                  charOutfits.set(name, outfitParts[0]);
                } else {
                  charOutfits.set(name, profile.outfit);
                }
              }
            }
          });
        }

        const lastBeat = Array.isArray(lastBeats) && lastBeats.length > 0 ? lastBeats[lastBeats.length - 1] : null;
        
        if (lastBeat || charOutfits.size > 0) {
          lastChapterContext = `
CHƯƠNG TRƯỚC ĐÓ (Chương ${lastProject.inputData.chapter}):
- Kết thúc tại thời điểm: ${lastBeat?.timeOfDay || 'Không rõ'}
- Bối cảnh cuối: ${lastBeat?.actionAnalysis || lastBeat?.analysis || 'Không rõ'}
- Không khí cuối: ${lastBeat?.atmosphere || 'Không rõ'}
- TRANG PHỤC CUỐI CÙNG CỦA NHÂN VẬT (LAST KNOWN OUTFITS):
${Array.from(charOutfits.entries()).map(([name, outfit]) => `  + ${name}: ${outfit}`).join('\n')}
`;
        }
      } catch (e) {
        console.error("Error parsing last project context", e);
      }
    }

    if (lastProject && lastProject.production?.characterLocationAnalysis) {
      try {
        const data = typeof lastProject.production.characterLocationAnalysis === 'string' 
          ? JSON.parse(lastProject.production.characterLocationAnalysis) 
          : lastProject.production.characterLocationAnalysis;
        
        if (data.characters) {
          data.characters.forEach((char: any) => {
            characterMap.set(char.name, char);
          });
        }
        if (data.locations) {
          data.locations.forEach((loc: any) => {
            locationMap.set(loc.name, loc);
          });
        }
      } catch (e) {
        console.error("Error parsing characterLocationAnalysis from saved project", e);
      }
    }

    const characters = Array.from(characterMap.values());
    const locations = Array.from(locationMap.values());

    return characters.length > 0 || locations.length > 0 
      ? JSON.stringify({ characters, locations, lastChapterContext }, null, 2) 
      : undefined;
  };

  const hasData = (s: ProductionStage) => {
    if (s === ProductionStage.INPUT) {
      return !!inputData.script.trim() && !!inputData.title.trim() && !!inputData.chapter.trim();
    }
    if (s === ProductionStage.ANALYSIS) return !!production.analysis;
    if (s === ProductionStage.CHARACTER_LOCATION) {
      return !!production.characterLocationAnalysis;
    }
    if (s === ProductionStage.SCREEN_CONTINUITY) return !!production.screenContinuity;
    if (s === ProductionStage.BEAT_MOMENT) return !!production.beatMomentDetails;
    if (s === ProductionStage.STORYBOARD) return isStoryboardProductionComplete(production);
    if (s === ProductionStage.PROMPTS) return !!production.prompts;
    if (s === ProductionStage.FINAL) return !!production.finalResult;
    return false;
  };

  const getWorkflowStatusForStage = (s: ProductionStage): StepStatus | null => {
    if (s === ProductionStage.ANALYSIS) return project.workflow.beatAnalysis.status;
    if (s === ProductionStage.CHARACTER_LOCATION) return project.workflow.characterLocation.status;
    if (s === ProductionStage.SCREEN_CONTINUITY) return project.workflow.screenContinuity.status;
    if (s === ProductionStage.BEAT_MOMENT) return project.workflow.beatMomentDetails.status;
    if (s === ProductionStage.STORYBOARD) return project.workflow.storyboard.status;
    if (s === ProductionStage.PROMPTS) return project.workflow.promptEngineering.status;
    if (s === ProductionStage.FINAL) return project.workflow.finalResult.status;
    return null;
  };

  const getWorkflowStatusClass = (status: StepStatus) => {
    if (status === "stale" || status === "error") return "bg-amber-500/15 text-amber-300 border-amber-400/20";
    if (status === "approved") return "bg-emerald-500/15 text-emerald-300 border-emerald-400/20";
    if (status === "needs_review") return "bg-sky-500/15 text-sky-300 border-sky-400/20";
    if (status === "generating") return "bg-indigo-500/15 text-indigo-300 border-indigo-400/20";
    return "bg-slate-700/40 text-slate-400 border-slate-600/40";
  };

  const getProjectBeat = (beat: any, index: number) => {
    return project.beats.find(item => item.beatId === beat?.beatId)
      || project.beats.find(item => item.beatId === index + 1)
      || beat;
  };

  const getProjectCharacter = (character: any) => {
    return project.characters.find(item =>
      (character?.characterId && item.characterId === character.characterId) ||
      (character?.name && item.name === character.name)
    ) || character;
  };

  const getProjectLocation = (location: any) => {
    return project.locations.find(item =>
      (location?.locationId && item.locationId === location.locationId) ||
      (location?.name && item.name === location.name)
    ) || location;
  };

  const validateStageJsonShape = (parsed: any, targetStage: ProductionStage): string | null => {
    if (targetStage === ProductionStage.SCREEN_CONTINUITY) {
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !Array.isArray(parsed.screens)) {
        return "Định dạng JSON không hợp lệ cho Screen Continuity. JSON phải là một đối tượng chứa mảng 'screens': { \"screens\": [...] }";
      }
      const invalidScreen = parsed.screens.find((screen: any) => !screen.screenId);
      if (invalidScreen) {
        return "Mỗi screen trong Thiết lập bối cảnh phải có screenId.";
      }
      const missingBeatLinks = parsed.screens.find((screen: any) => {
        const hasBeatIds = Array.isArray(screen.beatIds) && screen.beatIds.length > 0;
        const hasRange = screen.startBeatId != null && screen.endBeatId != null;
        return !hasBeatIds && !hasRange;
      });
      if (missingBeatLinks) {
        return "Mỗi screen trong Thiết lập bối cảnh cần có beatIds hoặc startBeatId/endBeatId để liên kết với beat.";
      }
      const invalidCharacterState = parsed.screens.find((screen: any) =>
        Array.isArray(screen.screenCharacterStates)
          ? screen.screenCharacterStates.some((state: any) => !state.characterName)
          : false
      );
      if (invalidCharacterState) {
        return "Mỗi character state trong Thiết lập bối cảnh phải có characterName.";
      }
    }
    if (targetStage === ProductionStage.BEAT_MOMENT) {
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !Array.isArray(parsed.beatDetails)) {
        return "Định dạng JSON không hợp lệ cho Beat Moment Details. JSON phải là một đối tượng chứa mảng 'beatDetails': { \"beatDetails\": [...] }";
      }
    }
    if (targetStage === ProductionStage.STORYBOARD) {
      if (!normalizeStoryboardPanels(parsed).length) {
        return "Định dạng JSON không hợp lệ cho Phác thảo minh họa. JSON phải có dạng { \"panels\": [...] } hoặc là một mảng panel.";
      }
    }
    return null;
  };

  const renderLockSummary = (entity: any) => {
    const lockedCount = getLockedFields(entity).length;
    if (!lockedCount) return null;
    return (
      <span className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-amber-700">
        <Lock className="w-3 h-3" /> {lockedCount} locked
      </span>
    );
  };

  const normalizeBeatForUi = (beat: any, index: number) => {
    if (!beat || typeof beat !== 'object' || Array.isArray(beat)) return beat;

    const characters = beat.charactersInvolved ?? beat.characters ?? beat.presentCharacters ?? beat.present_characters ?? [];
    const focusCharacters = beat.focusCharacters ?? beat.focus_characters ?? characters;
    const visibleCharacters = beat.visibleCharacters ?? beat.visible_characters ?? focusCharacters;
    const offscreenPresentCharacters = beat.offscreenPresentCharacters ?? beat.offscreen_present_characters ?? [];
    const props = beat.props ?? [];
    const sourceSegmentIds = beat.sourceSegmentIds ?? beat.source_segment_ids ?? [];

    return {
      ...beat,
      beatId: beat.beatId ?? index + 1,
      screenId: beat.screenId || beat.screen_id || 'screen_001',
      originalText: beat.originalText ?? beat.original_text ?? '',
      sourceSegmentIds: Array.isArray(sourceSegmentIds) ? sourceSegmentIds.map(String).filter(Boolean) : [],
      actionAnalysis: beat.actionAnalysis || beat.analysis || beat.action || beat.summary || '',
      charactersInvolved: Array.isArray(characters) ? characters : [characters].filter(Boolean),
      focusCharacters: Array.isArray(focusCharacters) ? focusCharacters : [focusCharacters].filter(Boolean),
      visibleCharacters: Array.isArray(visibleCharacters) ? visibleCharacters : [visibleCharacters].filter(Boolean),
      offscreenPresentCharacters: Array.isArray(offscreenPresentCharacters) ? offscreenPresentCharacters : [offscreenPresentCharacters].filter(Boolean),
      locationName: beat.locationName || beat.location || '',
      locationId: beat.locationId || '',
      locationState: beat.locationState || '',
      props: Array.isArray(props) ? props : [props].filter(Boolean),
      beatType: beat.beatType || 'action',
      mentionedCharacters: Array.isArray(beat.mentionedCharacters) ? beat.mentionedCharacters : [],
      presentCharacters: Array.isArray(beat.presentCharacters) ? beat.presentCharacters : (Array.isArray(characters) ? characters : []),
      enteredCharacters: Array.isArray(beat.enteredCharacters) ? beat.enteredCharacters : [],
      exitedCharacters: Array.isArray(beat.exitedCharacters) ? beat.exitedCharacters : [],
      characterPostures: Array.isArray(beat.characterPostures) ? beat.characterPostures : [],
      characterPositions: Array.isArray(beat.characterPositions) ? beat.characterPositions : [],
      interactionTarget: Array.isArray(beat.interactionTarget) ? beat.interactionTarget : [],
      notes: beat.notes || undefined,
      visualMoment: beat.visualMoment || beat.visual_moment || beat.analysis || beat.summary || beat.action || '',
      mainAction: beat.mainAction || beat.main_action || beat.action || beat.actionAnalysis || '',
      characterVisualStates: Array.isArray(beat.characterVisualStates ?? beat.character_visual_states) ? (beat.characterVisualStates ?? beat.character_visual_states) : [],
      environmentDetails: beat.environmentDetails || beat.environment_details || beat.locationState || '',
      cameraHint: beat.cameraHint || beat.camera_hint || 'unknown',
      compositionHint: beat.compositionHint || beat.composition_hint || '',
      continuityNotes: beat.continuityNotes || beat.continuity_notes || beat.notes || ''
    };
  };

  const getAnalysisBeatsFromParsed = (parsed: any) => {
    const nestedAnalysis = typeof parsed?.analysis === "string"
      ? parseJsonSafe<any>(parsed.analysis, null)
      : parsed?.analysis;
    const source = Array.isArray(parsed) || Array.isArray(parsed?.beats)
      ? parsed
      : nestedAnalysis;
    const rawBeats = Array.isArray(source) ? source : (Array.isArray(source?.beats) ? source.beats : null);
    return rawBeats ? rawBeats.map((beat: any, index: number) => normalizeBeatForUi(beat, index)) : null;
  };

  const hydratePastedAnalysisIfNeeded = (analysisData: any) => {
    const beats = getAnalysisBeatsFromParsed(analysisData);
    if (!beats || beats.length === 0) {
      return analysisData;
    }

    const payload = Array.isArray(analysisData)
      ? { beats: analysisData }
      : analysisData;

    if (!inputData.script.trim()) {
      const warningPayload = {
        ...payload,
        repairNotes: "Cannot hydrate or auto-split originalText because the current project has no source script. Paste the original .txt/source text first, then import this Beat Analysis JSON again."
      };
      return warningPayload;
    }

    const hydrated = hydrateBeatAnalysisOriginalText(
      payload,
      inputData.script,
      segmentSourceText(inputData.script),
      { segmentMode: "auto", repairMissingSegments: true, splitLongBeats: false }
    );

    return hydrated;
  };

  const storyboardBatchInfo = useMemo(() => {
    const beats = normalizeBeats(parseJsonSafe<unknown>(production.analysis, {}));
    const totalBatches = Math.max(1, Math.ceil((beats.length || 1) / gemini.STORYBOARD_BATCH_SIZE));
    const safeBatchIndex = Math.min(Math.max(storyboardBatchIndex, 0), totalBatches - 1);
    const start = safeBatchIndex * gemini.STORYBOARD_BATCH_SIZE;
    const end = Math.min(start + gemini.STORYBOARD_BATCH_SIZE, beats.length);
    const panels = normalizeStoryboardPanels(parseJsonSafe<unknown>(production.storyboard, { panels: [] }));

    return {
      beats,
      totalBeats: beats.length,
      totalBatches,
      batchIndex: safeBatchIndex,
      start,
      end,
      batchBeats: beats.slice(start, end),
      existingPanelCount: panels.length
    };
  }, [production.analysis, production.storyboard, storyboardBatchIndex]);

  const storyboardBatchStatuses = useMemo(() => {
    const existingPanels = normalizeStoryboardPanels(parseJsonSafe<unknown>(production.storyboard, { panels: [] }));
    const savedBeatIds = new Set<number>();

    existingPanels.forEach((panel) => {
      const beatId = getStoryboardPanelBeatId(panel);
      if (beatId) savedBeatIds.add(beatId);
    });

    return Array.from({ length: storyboardBatchInfo.totalBatches }, (_, index) => {
      const start = index * gemini.STORYBOARD_BATCH_SIZE;
      const end = Math.min(start + gemini.STORYBOARD_BATCH_SIZE, storyboardBatchInfo.beats.length);
      const batchBeats = storyboardBatchInfo.beats.slice(start, end);
      const targetBeatIds = batchBeats
        .map((beat) => Number(beat.beatId))
        .filter((beatId) => Number.isFinite(beatId) && beatId > 0);
      const savedCount = targetBeatIds.filter((beatId) => savedBeatIds.has(beatId)).length;

      return {
        index,
        start,
        end,
        batchBeats,
        targetBeatIds,
        savedCount,
        total: targetBeatIds.length,
        complete: targetBeatIds.length > 0 && savedCount >= targetBeatIds.length
      };
    });
  }, [production.storyboard, storyboardBatchInfo.beats, storyboardBatchInfo.totalBatches]);

  const storyboardProgress = useMemo(() => {
    const existingPanels = normalizeStoryboardPanels(parseJsonSafe<unknown>(production.storyboard, { panels: [] }));
    const savedBeatIds = new Set<number>();

    existingPanels.forEach((panel) => {
      const beatId = getStoryboardPanelBeatId(panel);
      if (beatId) savedBeatIds.add(beatId);
    });

    const targetBeatIds = storyboardBatchInfo.beats
      .map((beat) => Number(beat.beatId))
      .filter((beatId) => Number.isFinite(beatId) && beatId > 0);
    const savedCount = targetBeatIds.filter((beatId) => savedBeatIds.has(beatId)).length;
    const firstIncompleteBatch = storyboardBatchStatuses.find((item) => !item.complete);

    return {
      savedCount,
      total: targetBeatIds.length,
      completeBatchCount: storyboardBatchStatuses.filter((item) => item.complete).length,
      firstIncompleteBatchIndex: firstIncompleteBatch?.index ?? -1,
      isComplete: targetBeatIds.length > 0 && savedCount >= targetBeatIds.length
    };
  }, [production.storyboard, storyboardBatchInfo.beats, storyboardBatchStatuses]);

  const getStoryboardPromptForBatch = (batchIndex: number) => {
    return gemini.getStoryboardPrompt(
      production.analysis || '',
      production.characterLocationAnalysis || '',
      getSelectedStylePrompt(),
      production.screenContinuity || '',
      production.beatMomentDetails || '',
      {
        batchIndex,
        batchSize: gemini.STORYBOARD_BATCH_SIZE,
        manualNextMode: false,
        includeAllBeatsForManualNext: true
      }
    );
  };

  const currentStepPrompt = useMemo(() => {
    const stylePrompt = getSelectedStylePrompt();
    switch(stage) {
      case ProductionStage.ANALYSIS:
        return gemini.getBeatAnalysisPrompt(inputData.script, stylePrompt);
      case ProductionStage.CHARACTER_LOCATION:
        const existingLibrary = getMasterLibrary();
        try {
          const parsedAnalysis = production.analysis ? JSON.parse(production.analysis) : [];
          const beats = getAnalysisBeatsFromParsed(parsedAnalysis) || [];
          const screens = normalizeScreens(parsedAnalysis);
          return gemini.getCharacterLocationLibraryPrompt(inputData.script, beats, stylePrompt, existingLibrary, screens.length ? screens : createFallbackScreensFromBeats(normalizeBeats(beats)));
        } catch {
          return gemini.getCharacterLocationLibraryPrompt(inputData.script, [], stylePrompt, existingLibrary);
        }
      case ProductionStage.SCREEN_CONTINUITY:
        return gemini.getScreenContinuityPrompt(production.analysis || '', production.characterLocationAnalysis || '', stylePrompt);
      case ProductionStage.BEAT_MOMENT:
        return gemini.getBeatMomentDetailsPrompt(production.analysis || '', production.characterLocationAnalysis || '', production.screenContinuity || '', stylePrompt);
      case ProductionStage.STORYBOARD: 
        return getStoryboardPromptForBatch(storyboardBatchInfo.batchIndex);
      case ProductionStage.PROMPTS:
        return gemini.getEngineerPromptsPrompt({
          analysisJson: production.analysis || '',
          characterLocationJson: production.characterLocationAnalysis || '',
          screenContinuityJson: production.screenContinuity || '',
          beatMomentDetailsJson: production.beatMomentDetails || '',
          storyboardJson: production.storyboard || '',
          style: stylePrompt,
        });
      case ProductionStage.FINAL:
        return 'Final Result được build local bằng finalResultBuilderService. Không cần gửi prompt cho AI và không cần dán kết quả. Bấm Build Final Result để tạo JSON cuối cùng.';
      default: return '';
    }
  }, [stage, inputData, production, previousProject, storyboardBatchInfo.batchIndex]);

  const finalJsonData = useMemo(() => {
    if (stage === ProductionStage.FINAL && production.finalResult) {
      try { 
        const parsed = JSON.parse(production.finalResult); 
        // Hỗ trợ cả cấu trúc cũ (array) và cấu trúc mới (object { panels: [] })
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.panels)) {
          return parsed.panels.filter((item: any) => item !== null && typeof item === 'object');
        }
        if (!Array.isArray(parsed)) return null;
        return parsed.filter(item => item !== null && typeof item === 'object');
      } catch (e) { return null; }
    }
    return null;
  }, [stage, production.finalResult]);

  const parsedFinalResult = useMemo<FinalResult | null>(() => {
    const parsed = parseJsonSafe<any>(production.finalResult, null);
    if (parsed && Array.isArray(parsed.panels)) return parsed as FinalResult;
    if (Array.isArray(parsed)) {
      return {
        panels: parsed.filter((item) => item && typeof item === "object"),
        metadata: {
          totalPanels: parsed.length,
          generatedAt: "",
          source: "code-builder"
        }
      } as FinalResult;
    }
    return null;
  }, [production.finalResult]);

  const finalResultParseError = useMemo(() => {
    if (!production.finalResult?.trim()) return false;
    return !parsedFinalResult;
  }, [production.finalResult, parsedFinalResult]);

  const finalBuildData = useMemo(() => {
    try {
      const analysisData = parseJsonSafe<unknown>(production.analysis, {});
      const storyboardData = parseJsonSafe<unknown>(production.storyboard, {});
      const promptData = parseJsonSafe<unknown>(production.prompts, {});
      const libraryData = normalizeCharacterLocationLibrary(
        parseJsonSafe<unknown>(production.characterLocationAnalysis, {})
      );
      const parsedScreens = normalizeScreens(analysisData);
      const parsedBeats = normalizeBeats(analysisData);
      const projectBeats = normalizeBeats({ beats: Array.isArray(project.beats) ? project.beats : [] });
      const projectScreens = normalizeScreens({ screens: Array.isArray(project.screens) ? project.screens : [] });
      const projectPanels = normalizeStoryboardPanels({ panels: Array.isArray(project.storyboardPanels) ? project.storyboardPanels : [] });
      const projectPrompts = normalizeEngineerPrompts({ engineerPrompts: Array.isArray(project.engineerPrompts) ? project.engineerPrompts : [] });
      const beats = projectBeats.length ? projectBeats : parsedBeats;
      const baseScreens = projectScreens.length
        ? projectScreens
        : parsedScreens.length
          ? parsedScreens
          : createFallbackScreensFromBeats(beats);
      const screens = mergeScreenContinuityIntoScreens(
        baseScreens,
        production.screenContinuity || project.screenContinuity || ""
      );
      const beatsWithMoments = mergeBeatMomentDetailsIntoBeats(
        beats,
        production.beatMomentDetails || project.beatMomentDetails || ""
      );

      return {
        screens,
        beats: beatsWithMoments,
        panels: projectPanels.length ? projectPanels : normalizeStoryboardPanels(storyboardData),
        engineerPrompts: projectPrompts.length ? projectPrompts : normalizeEngineerPrompts(promptData),
        qaResults: [],
        characters: project.characters?.length ? project.characters : libraryData.characters,
        locations: project.locations?.length ? project.locations : libraryData.locations
      };
    } catch (error) {
      console.error("Failed to prepare Final Result build data:", error);
      return {
        screens: [],
        beats: [],
        panels: [],
        engineerPrompts: [],
        qaResults: [],
        characters: [],
        locations: []
      };
    }
  }, [
    project.beats,
    project.screens,
    project.storyboardPanels,
    project.engineerPrompts,
    project.characters,
    project.locations,
    production.analysis,
    production.storyboard,
    production.prompts,
    production.characterLocationAnalysis,
    production.screenContinuity,
    production.beatMomentDetails,
    project.screenContinuity,
    project.beatMomentDetails
  ]);

  const finalBuildCheck = useMemo(
    () => getFinalResultMissingInputs(finalBuildData),
    [finalBuildData]
  );

  const promptEngineeringAutoBuildSignature = useMemo(() => {
    if (stage !== ProductionStage.PROMPTS || isLoading || production.prompts) return "";
    if (getPromptEngineeringMissingInputs(production).length > 0) return "";

    return [
      inputData.selectedStyle,
      production.analysis || "",
      production.characterLocationAnalysis || "",
      production.screenContinuity || "",
      production.beatMomentDetails || "",
      production.storyboard || ""
    ].join("\u001f");
  }, [
    stage,
    isLoading,
    inputData.selectedStyle,
    production.analysis,
    production.characterLocationAnalysis,
    production.screenContinuity,
    production.beatMomentDetails,
    production.storyboard,
    production.prompts
  ]);

  const finalResultAutoBuildSignature = useMemo(() => {
    if (stage !== ProductionStage.FINAL || isLoading || production.finalResult || !finalBuildCheck.canBuild) return "";

    try {
      return JSON.stringify({
        title: inputData.title,
        chapter: inputData.chapter,
        finalBuildData
      });
    } catch {
      return [
        inputData.title,
        inputData.chapter,
        finalBuildData.beats.length,
        finalBuildData.panels.length,
        finalBuildData.engineerPrompts.length,
        finalBuildData.characters.length,
        finalBuildData.locations.length
      ].join("\u001f");
    }
  }, [
    stage,
    isLoading,
    production.finalResult,
    finalBuildCheck.canBuild,
    inputData.title,
    inputData.chapter,
    finalBuildData
  ]);

  const isFinalResultAutoBuildPending = Boolean(
    finalResultAutoBuildSignature &&
    autoFinalResultBuildSignatureRef.current !== finalResultAutoBuildSignature
  );

  const saveStoryboardBatchResult = (batchIndex: number, rawValue: string) => {
    const value = rawValue.trim();
    if (!value) return false;

    let parsedJson: any = null;
    try {
      parsedJson = JSON.parse(value);
    } catch (e) {
      setError("Dữ liệu storyboard batch không phải là JSON hợp lệ.");
      return false;
    }

    const incomingPanels = normalizeStoryboardPanels(parsedJson);
    if (!incomingPanels.length) {
      setError("JSON batch storyboard phải có dạng { \"panels\": [...] } hoặc là một mảng panel.");
      return false;
    }

    const batch = storyboardBatchStatuses[batchIndex];
    if (!batch || !batch.targetBeatIds.length) {
      setError("Không tìm thấy beat tương ứng với batch storyboard này.");
      return false;
    }

    const targetBeatIds = new Set(batch.targetBeatIds);
    const batchPanels = incomingPanels
      .map((panel) => {
        const beatId = getStoryboardPanelBeatId(panel);
        return beatId ? { ...panel, beatId } : null;
      })
      .filter((panel): panel is any => Boolean(panel && targetBeatIds.has(panel.beatId)));

    if (!batchPanels.length) {
      setError(`Batch ${batchIndex + 1} chỉ nhận beatId: ${batch.targetBeatIds.join(", ")}. JSON vừa dán không có panel nào thuộc batch này.`);
      return false;
    }

    const existingPanels = normalizeStoryboardPanels(parseJsonSafe<unknown>(production.storyboard, { panels: [] }));
    const mergedPanels = mergeStoryboardPanelsByBeatId(existingPanels, batchPanels);
    const storyboardValue = JSON.stringify({ panels: mergedPanels }, null, 2);
    updateProductionDataByStage(storyboardValue, ProductionStage.STORYBOARD);

    const mergedBeatIds = new Set<number>();
    mergedPanels.forEach((panel) => {
      const beatId = getStoryboardPanelBeatId(panel);
      if (beatId) mergedBeatIds.add(beatId);
    });

    const firstMissingIndex = storyboardBatchInfo.beats.findIndex((beat) => !mergedBeatIds.has(Number(beat.beatId)));
    const missingCount = firstMissingIndex >= 0
      ? storyboardBatchInfo.beats.filter((beat) => !mergedBeatIds.has(Number(beat.beatId))).length
      : 0;
    const ignoredCount = incomingPanels.length - batchPanels.length;

    setManualInputValue('');
    setStoryboardBatchInputs((prev) => ({ ...prev, [batchIndex]: '' }));
    setShowStoryboardPreview(false);
    setError(null);

    if (firstMissingIndex < 0 && storyboardBatchInfo.beats.length > 0) {
      showToast(`Đã ghép đủ ${mergedPanels.length}/${storyboardBatchInfo.beats.length} storyboard panels. Bấm nút xem để mở UI.`);
      return true;
    }

    const nextBatchIndex = Math.floor(firstMissingIndex / gemini.STORYBOARD_BATCH_SIZE);
    setStoryboardBatchIndex(nextBatchIndex);
    showToast(
      ignoredCount > 0
        ? `Đã lưu batch ${batchIndex + 1}. Bỏ qua ${ignoredCount} panel ngoài batch. Còn thiếu ${missingCount} panel.`
        : `Đã lưu batch ${batchIndex + 1}. Còn thiếu ${missingCount} panel.`
    );
    return true;
  };

  const handleManualSave = () => {
    if (!manualInputValue.trim()) return;
    setError(null);

    if (stage === ProductionStage.STORYBOARD && manualInputValue.trim().toLowerCase() === "next") {
      setStoryboardBatchIndex((index) => Math.min(index + 1, storyboardBatchInfo.totalBatches - 1));
      setManualInputValue('');
      showToast(`Đã chuyển sang storyboard batch ${Math.min(storyboardBatchIndex + 2, storyboardBatchInfo.totalBatches)}/${storyboardBatchInfo.totalBatches}.`);
      return;
    }
    
    let parsedJson: any = null;
    try {
      parsedJson = JSON.parse(manualInputValue);
    } catch (e) {
      setError("Dữ liệu nhập vào không phải là JSON hợp lệ.");
      return;
    }

    const validationError = validateStageJsonShape(parsedJson, stage);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (parsedJson && (stage === ProductionStage.ANALYSIS || stage === ProductionStage.CHARACTER_LOCATION)) {
      const pastedBeatAnalysis = getAnalysisBeatsFromParsed(parsedJson);
      const isPhaseOneCombinedPayload = parsedJson.analysis !== undefined || parsedJson.characterLocationAnalysis !== undefined;
      if (stage === ProductionStage.ANALYSIS && pastedBeatAnalysis && !isPhaseOneCombinedPayload) {
        const rawAnalysisPayload = Array.isArray(parsedJson)
          ? parsedJson
          : { ...parsedJson, beats: pastedBeatAnalysis };
        const analysisPayload = hydratePastedAnalysisIfNeeded(rawAnalysisPayload);
        setProduction(prev => ({
          ...prev,
          analysis: JSON.stringify(analysisPayload, null, 2)
        }));
        const beats = normalizeBeats(analysisPayload);
        const parsedScreens = normalizeScreens(analysisPayload);
        setProject(prev => replaceScreens(
          replaceBeats(prev, beats),
          parsedScreens.length ? parsedScreens : createFallbackScreensFromBeats(beats)
        ));
        setManualInputValue('');
        setStage(ProductionStage.CHARACTER_LOCATION);
        return;
      }

      if (parsedJson.analysis || parsedJson.characterLocationAnalysis) {
        const formatValue = (val: any) => {
          if (typeof val === 'string') {
            const parsedValue = parseJsonSafe<any>(val, null);
            const beats = getAnalysisBeatsFromParsed(parsedValue);
            if (beats) return JSON.stringify(hydratePastedAnalysisIfNeeded(parsedValue), null, 2);
            return val;
          }
          if (val === undefined || val === null) return '';
          const beats = getAnalysisBeatsFromParsed(val);
          if (beats) return JSON.stringify(hydratePastedAnalysisIfNeeded(val), null, 2);
          return JSON.stringify(val, null, 2);
        };

        const analysisValue = parsedJson.analysis ? formatValue(parsedJson.analysis) : production.analysis || '';
        const characterLocationValue = parsedJson.characterLocationAnalysis ? formatValue(parsedJson.characterLocationAnalysis) : production.characterLocationAnalysis || '';

        setProduction(prev => ({
          ...prev,
          analysis: parsedJson.analysis ? analysisValue : prev.analysis,
          characterLocationAnalysis: parsedJson.characterLocationAnalysis ? characterLocationValue : prev.characterLocationAnalysis
        }));
        if (analysisValue || characterLocationValue) {
          syncPhaseOneProjectData(analysisValue, characterLocationValue);
        }
        setManualInputValue('');
        
        // Nếu nhập dữ liệu ở bước Analysis mà có cả 2 phần, nhảy thẳng tới Storyboard
        if (stage === ProductionStage.ANALYSIS && (parsedJson.analysis && parsedJson.characterLocationAnalysis)) {
          setStage(ProductionStage.STORYBOARD);
        } else {
          const currentIndex = steps.findIndex(s => s.id === stage);
          if (currentIndex < steps.length - 1) {
            setStage(steps[currentIndex + 1].id);
          }
        }
        return;
      }
    }

    if (stage === ProductionStage.STORYBOARD) {
      saveStoryboardBatchResult(storyboardBatchInfo.batchIndex, manualInputValue);
      return;
    }

    const finalValueToSave = parsedJson ? JSON.stringify(parsedJson, null, 2) : manualInputValue;
    updateProductionDataByStage(finalValueToSave, stage);
    setManualInputValue('');

    const nextIndex = steps.findIndex(s => s.id === stage) + 1;
    if (nextIndex < steps.length) {
      setStage(steps[nextIndex].id);
    }
  };

  const syncPhaseOneProjectData = (analysisValue: string, characterLocationValue: string) => {
    const analysisData = hydratePastedAnalysisIfNeeded(parseJsonSafe<unknown>(analysisValue, []));
    const beats = normalizeBeats(analysisData);
    const parsedScreens = normalizeScreens(analysisData);
    const screens = parsedScreens.length ? parsedScreens : createFallbackScreensFromBeats(beats);
    const library = normalizeCharacterLocationLibrary(parseJsonSafe<unknown>(characterLocationValue, {}));
    setProject(prev => replaceCharacterLocationLibrary(
      replaceScreens(replaceBeats(prev, beats), screens),
      library
    ));
  };

  const updateProjectDataByStage = (result: string, targetStage: ProductionStage) => {
    setProject(prev => {
      try {
        if (targetStage === ProductionStage.ANALYSIS) {
          const analysisData = hydratePastedAnalysisIfNeeded(parseJsonSafe<unknown>(result, []));
          const beats = normalizeBeats(analysisData);
          const parsedScreens = normalizeScreens(analysisData);
          return replaceScreens(
            replaceBeats(prev, beats),
            parsedScreens.length ? parsedScreens : createFallbackScreensFromBeats(beats)
          );
        }
        if (targetStage === ProductionStage.CHARACTER_LOCATION) {
          return replaceCharacterLocationLibrary(
            prev,
            normalizeCharacterLocationLibrary(parseJsonSafe<unknown>(result, {}))
          );
        }
        if (targetStage === ProductionStage.SCREEN_CONTINUITY) {
          return replaceScreenContinuity(prev, result);
        }
        if (targetStage === ProductionStage.BEAT_MOMENT) {
          return replaceBeatMomentDetails(prev, result);
        }
        if (targetStage === ProductionStage.STORYBOARD) {
          return replaceStoryboardPanels(prev, normalizeStoryboardPanels(parseJsonSafe<unknown>(result, { panels: [] })));
        }
        if (targetStage === ProductionStage.PROMPTS) {
          return replaceEngineerPrompts(prev, normalizeEngineerPrompts(parseJsonSafe<unknown>(result, [])));
        }
        if (targetStage === ProductionStage.FINAL) {
          const finalResult = parseJsonSafe<FinalResult | null>(result, null);
          return finalResult ? replaceFinalResult(prev, finalResult) : prev;
        }
      } catch (err) {
        console.error("Failed to sync project data:", err);
      }
      return prev;
    });
  };

  const updateProductionDataByStage = (result: string, targetStage: ProductionStage) => {
    setProduction(prev => {
      const updated = { ...prev };
      if (targetStage === ProductionStage.ANALYSIS) updated.analysis = result;
      else if (targetStage === ProductionStage.CHARACTER_LOCATION) updated.characterLocationAnalysis = result;
      else if (targetStage === ProductionStage.SCREEN_CONTINUITY) updated.screenContinuity = result;
      else if (targetStage === ProductionStage.BEAT_MOMENT) updated.beatMomentDetails = result;
      else if (targetStage === ProductionStage.STORYBOARD) updated.storyboard = result;
      else if (targetStage === ProductionStage.PROMPTS) updated.prompts = result;
      else if (targetStage === ProductionStage.FINAL) updated.finalResult = result;
      return updated;
    });
    updateProjectDataByStage(result, targetStage);
  };

  const handleUpdateBeat = (index: number) => {
    if (!production.analysis) return;
    try {
      const parsed = JSON.parse(production.analysis);
      const beats = getAnalysisBeatsFromParsed(parsed) || [];
      beats[index] = normalizeBeatForUi(editingBeatData, index);
      updateProductionDataByStage(JSON.stringify(beats, null, 2), ProductionStage.ANALYSIS);
      const normalizedBeats = normalizeBeats(beats);
      setProject(prev => replaceScreens(
        replaceBeatsFromUserEdit(prev, normalizedBeats),
        createFallbackScreensFromBeats(normalizedBeats)
      ));
      setEditingBeatIndex(null);
      setEditingBeatData(null);
    } catch (e) {
      console.error("Failed to update beat:", e);
    }
  };

  const handleDeleteBeat = (index: number) => {
    if (!production.analysis) return;
    setConfirmModal({
      show: true,
      title: 'Xóa Beat',
      message: `Bạn có chắc chắn muốn xóa Beat ${index + 1} này không? Hành động này không thể hoàn tác.`,
      type: 'danger',
      onConfirm: () => {
        try {
          if (!production.analysis) return;
          const parsed = JSON.parse(production.analysis);
          const beats = getAnalysisBeatsFromParsed(parsed) || [];
          beats.splice(index, 1);
          updateProductionDataByStage(JSON.stringify(beats, null, 2), ProductionStage.ANALYSIS);
          const normalizedBeats = normalizeBeats(beats);
          setProject(prev => replaceScreens(
            replaceBeatsFromUserEdit(prev, normalizedBeats),
            createFallbackScreensFromBeats(normalizedBeats)
          ));
          setConfirmModal(prev => ({ ...prev, show: false }));
        } catch (e) {
          console.error("Failed to delete beat:", e);
        }
      }
    });
  };

  const handleAddBeat = (index: number) => {
    if (!production.analysis) return;
    try {
      const parsed = JSON.parse(production.analysis);
      const beats = getAnalysisBeatsFromParsed(parsed) || [];
      const newBeat = {
        summary: "",
        charactersInvolved: [],
        locationName: "",
        locationId: "",
        locationState: "",
        props: [],
        visualFocus: "",
        interaction: "",
        originalText: "Nội dung văn bản mới...",
        actionAnalysis: "Mô tả bối cảnh và hành động mới...",
        atmosphere: "Cảm xúc chủ đạo",
        posture: "Tư thế",
        timeOfDay: "Thời điểm"
      };
      beats.splice(index + 1, 0, newBeat);
      updateProductionDataByStage(JSON.stringify(beats, null, 2), ProductionStage.ANALYSIS);
      const normalizedBeats = normalizeBeats(beats.map((beat: any, beatIndex: number) => normalizeBeatForUi(beat, beatIndex)));
      setProject(prev => replaceScreens(
        replaceBeatsFromUserEdit(prev, normalizedBeats),
        createFallbackScreensFromBeats(normalizedBeats)
      ));
      setEditingBeatIndex(index + 1);
      setEditingBeatData(newBeat);
    } catch (e) {
      console.error("Failed to add beat:", e);
    }
  };

  const handleProcess = async () => {
    if (isManualMode && stage !== ProductionStage.PROMPTS) return;
    
    const currentIndex = steps.findIndex(s => s.id === stage);
    const nextStep = steps[currentIndex + 1];

    if (nextStep && hasData(nextStep.id)) {
      setStage(nextStep.id);
      return;
    }

    if (stage === ProductionStage.INPUT) {
      setShowAnalysisModeModal(true);
      return;
    }

    if (stage === ProductionStage.FINAL && hasData(ProductionStage.FINAL)) return;

    setIsLoading(true);
    setError(null);
    try {
      let result = '';
      let targetStage = stage;

      if (stage === ProductionStage.ANALYSIS) {
        const resultObj = await gemini.analyzeBeats(inputData.script, getSelectedStylePrompt());
        const hydratedResult = hydratePastedAnalysisIfNeeded(resultObj);
        const analysisValue = JSON.stringify(hydratedResult, null, 2);
        setProduction(prev => ({
          ...prev,
          analysis: analysisValue
        }));
        const beats = normalizeBeats(hydratedResult);
        const parsedScreens = normalizeScreens(hydratedResult);
        const screens = parsedScreens.length ? parsedScreens : createFallbackScreensFromBeats(beats);
        setProject(prev => replaceScreens(replaceBeats(prev, beats), screens));
        
        setStage(ProductionStage.CHARACTER_LOCATION);
        setIsLoading(false);
        return;
      } else if (stage === ProductionStage.CHARACTER_LOCATION) {
        const existingLibrary = getMasterLibrary();
        const analysisData = parseJsonSafe<unknown>(production.analysis, []);
        const beats = normalizeBeats(analysisData);
        const parsedScreens = normalizeScreens(analysisData);
        const screens = parsedScreens.length ? parsedScreens : createFallbackScreensFromBeats(beats);
        
        const libraryObj = await gemini.generateCharacterLocationLibrary(
          inputData.script,
          beats,
          getSelectedStylePrompt(),
          existingLibrary,
          screens
        );
        const characterLocationValue = JSON.stringify(libraryObj, null, 2);
        setProduction(prev => ({
          ...prev,
          characterLocationAnalysis: characterLocationValue
        }));
        setProject(prev => replaceCharacterLocationLibrary(prev, normalizeCharacterLocationLibrary(libraryObj)));
        
        setStage(ProductionStage.SCREEN_CONTINUITY);
        setIsLoading(false);
        return;
      } else if (stage === ProductionStage.SCREEN_CONTINUITY) {
        result = await gemini.generateScreenContinuity(
          production.analysis || '',
          production.characterLocationAnalysis || '',
          getSelectedStylePrompt()
        );
        targetStage = ProductionStage.SCREEN_CONTINUITY;
      } else if (stage === ProductionStage.BEAT_MOMENT) {
        result = await gemini.generateBeatMomentDetails(
          production.analysis || '',
          production.characterLocationAnalysis || '',
          production.screenContinuity || '',
          getSelectedStylePrompt()
        );
        targetStage = ProductionStage.BEAT_MOMENT;
      } else if (stage === ProductionStage.STORYBOARD) {
        result = await gemini.createStoryboard(
          production.analysis || '',
          production.characterLocationAnalysis || '',
          getSelectedStylePrompt(),
          production.screenContinuity || '',
          production.beatMomentDetails || ''
        );
        targetStage = ProductionStage.STORYBOARD;
      } else if (stage === ProductionStage.PROMPTS) {
        result = await gemini.engineerPrompts({
          analysisJson: production.analysis || '',
          characterLocationJson: production.characterLocationAnalysis || '',
          screenContinuityJson: production.screenContinuity || '',
          beatMomentDetailsJson: production.beatMomentDetails || '',
          storyboardJson: production.storyboard || '',
          style: getSelectedStylePrompt(),
        });
        targetStage = ProductionStage.PROMPTS;
      } else if (stage === ProductionStage.FINAL) {
        const analysisData = parseJsonSafe<unknown>(production.analysis, []);
        const storyboardData = parseJsonSafe<unknown>(production.storyboard, { panels: [] });
        const promptData = parseJsonSafe<unknown>(production.prompts, []);
        const libraryData = normalizeCharacterLocationLibrary(
          parseJsonSafe<unknown>(production.characterLocationAnalysis, {})
        );
        const beats = project.beats.length ? project.beats : normalizeBeats(analysisData);
        const parsedScreens = normalizeScreens(analysisData);
        const projectForFinal = {
          ...project,
          screens: project.screens.length ? project.screens : (parsedScreens.length ? parsedScreens : createFallbackScreensFromBeats(beats)),
          beats,
          storyboardPanels: project.storyboardPanels.length ? project.storyboardPanels : normalizeStoryboardPanels(storyboardData),
          engineerPrompts: project.engineerPrompts.length ? project.engineerPrompts : normalizeEngineerPrompts(promptData),
          qaResults: [],
          characters: project.characters.length ? project.characters : libraryData.characters,
          locations: project.locations.length ? project.locations : libraryData.locations,
          screenContinuity: production.screenContinuity || "",
          beatMomentDetails: production.beatMomentDetails || ""
        };
        const finalResult = buildFinalResultFromProject(projectForFinal);
        result = JSON.stringify(finalResult, null, 2);
        targetStage = ProductionStage.FINAL;
      }
      
      updateProductionDataByStage(result, targetStage);
      const nextIndex = steps.findIndex(s => s.id === targetStage) + 1;
      if (nextIndex < steps.length) {
        setStage(steps[nextIndex].id);
      }
    } catch (err: any) {
      setError(err.message || "Lỗi API. Vui lòng thử Chế độ Thủ công.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!promptEngineeringAutoBuildSignature) return;
    if (autoPromptBuildSignatureRef.current === promptEngineeringAutoBuildSignature) return;

    autoPromptBuildSignatureRef.current = promptEngineeringAutoBuildSignature;
    void handleProcess();
  }, [promptEngineeringAutoBuildSignature]);

  const handleAutoAnalysis = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const resultObj = await gemini.analyzeBeats(inputData.script, getSelectedStylePrompt());
      const hydratedResult = hydratePastedAnalysisIfNeeded(resultObj);
      const analysisValue = JSON.stringify(hydratedResult, null, 2);
      setProduction(prev => ({
        ...prev,
        analysis: analysisValue
      }));

      const beats = normalizeBeats(hydratedResult);
      const parsedScreens = normalizeScreens(hydratedResult);
      const screens = parsedScreens.length ? parsedScreens : createFallbackScreensFromBeats(beats);
      setProject(prev => replaceScreens(replaceBeats(prev, beats), screens));
      setStage(ProductionStage.CHARACTER_LOCATION);
    } catch (err: any) {
      setError(err.message || "Lỗi API. Vui lòng thử Chế độ Thủ công.");
    } finally {
      setIsLoading(false);
    }
  };

  const startAnalysis = (mode: 'manual' | 'auto') => {
    setShowAnalysisModeModal(false);
    setStage(ProductionStage.ANALYSIS);

    if (mode === 'manual') {
      setIsManualMode(true);
      setIsGlobalManualMode(true);
      return;
    }

    setIsManualMode(false);
    setIsGlobalManualMode(false);
    void handleAutoAnalysis();
  };

  const saveProject = async () => {
    if (!inputData.title.trim() || !inputData.chapter.trim()) {
      setToast({ message: "Vui lòng nhập Tên tiểu thuyết và Chương để lưu!", visible: true });
      setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
      return;
    }

    const projectData = {
      type: "storyflow.chapter" as const,
      version: 1,
      inputData,
      production: {
        ...production,
        finalResult: production.finalResult
      },
      storyFlowProject: project,
      stage,
      unlockedStages,
      storyboardBatchIndex,
      isManualMode,
      isGlobalManualMode,
      createdAt: undefined,
      updatedAt: new Date().toISOString()
    };

    try {
      await saveStoryFlowProject(projectData);
      await refreshProjectLibrary();
      setToast({ message: "Đã lưu kết quả phân tích vào thư mục projects!", visible: true });
    } catch (err: any) {
      console.error(err);
      setToast({ message: "Lỗi khi lưu dự án: " + (err.message || err), visible: true });
    }
    
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
  };

  const handleOpenSavedChapter = useCallback(
    async (novelFolder: string, chapterFile: string) => {
      try {
        const savedProject = await openStoryFlowProject(novelFolder, chapterFile);

        const restoredInputData = savedProject.inputData || {
          title: '',
          selectedStyle: 'manhua',
          chapter: '',
          chapterTitle: '',
          script: ''
        };
        const restoredProduction = savedProject.production || {};

        setInputData(restoredInputData);
        setProduction(restoredProduction);

        setProject(
          savedProject.storyFlowProject ||
            hydrateStoryFlowProject(
              restoredInputData,
              restoredProduction,
              savedProject.storyFlowProject
            )
        );

        setStage(savedProject.stage || ProductionStage.INPUT);
        setUnlockedStages(savedProject.unlockedStages || [ProductionStage.INPUT]);

        setStoryboardBatchIndex(savedProject.storyboardBatchIndex || 0);
        setIsManualMode(Boolean(savedProject.isManualMode));
        setIsGlobalManualMode(Boolean(savedProject.isGlobalManualMode));

        setShowLibraryModal(false);
        setToast({ message: "Đã tải dự án StoryFlow!", visible: true });
      } catch (error) {
        console.error(error);
        setToast({ message: "Không thể mở chương. Hãy kiểm tra server.", visible: true });
      }
      setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
    },
    []
  );

  const handleDeleteSavedChapter = useCallback(
    async (novelFolder: string, chapterFile: string) => {
      setConfirmModal({
        show: true,
        title: 'Xóa chương',
        message: `Bạn có chắc chắn muốn xóa chương này khỏi thư mục projects? Dữ liệu file trên đĩa sẽ bị xóa hoàn toàn.`,
        type: 'danger',
        onConfirm: async () => {
          try {
            await deleteStoryFlowProject(novelFolder, chapterFile);
            await refreshProjectLibrary();
            setToast({ message: "Đã xóa chương thành công!", visible: true });
          } catch (error) {
            console.error(error);
            setToast({ message: "Không thể xóa chương khỏi thư mục.", visible: true });
          } finally {
            setConfirmModal(prev => ({ ...prev, show: false }));
            setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
          }
        }
      });
    },
    [refreshProjectLibrary]
  );

  const handleNextChapter = () => {
    const currentChapter = parseInt(inputData.chapter);
    const nextChapter = !isNaN(currentChapter) ? (currentChapter + 1).toString() : "";
    
    setProduction({
      analysis: null,
      characterLocationAnalysis: null,
      storyboard: null,
      prompts: null,
      qaReport: null,
      finalResult: null
    });
    setUnlockedStages([ProductionStage.INPUT]);

    setInputData(prev => ({
      ...prev,
      chapter: nextChapter,
      script: ""
    }));

    setStage(ProductionStage.INPUT);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    setToast({ message: "Đã chuẩn bị cho chương mới!", visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
  };

  const getSubtitleItems = () => {
    const finalResult = parseJsonSafe<FinalResult | null>(
      production.finalResult,
      null
    );

    const finalResultItems = extractSubtitleItemsFromFinalResult(finalResult);
    if (finalResultItems.length > 0) {
      return finalResultItems;
    }

    if (project?.beats && project.beats.length > 0) {
      return extractSubtitleItemsFromBeats(project.beats);
    }

    const analysisData = parseJsonSafe<unknown>(production.analysis, {});
    const beats = normalizeBeats(analysisData);

    return extractSubtitleItemsFromBeats(beats);
  };

  const buildFinalResultFromCurrentProject = useCallback(() => {
    if (!finalBuildCheck.canBuild) return null;

    try {
      const finalResult = buildFinalResult(finalBuildData);
      setProduction((prev) => ({
        ...prev,
        finalResult: JSON.stringify(finalResult, null, 2),
      }));
      return finalResult;
    } catch (error: any) {
      console.error("Failed to build Final Result:", error);
      setError(error?.message ? `Không thể build Final Result: ${error.message}` : "Không thể build Final Result.");
      return null;
    }
  }, [finalBuildCheck.canBuild, finalBuildData]);

  const handleExportSRT = () => {
    const subtitleItems = getSubtitleItems();

    if (subtitleItems.length === 0) {
      setError("Không có dữ liệu để xuất SRT. Hãy chạy Beat Analysis hoặc Build Final Result trước.");
      return;
    }

    const srtContent = buildSrtFromItems(subtitleItems, {
      durationPerItemSeconds: 5,
    });

    const fileName = `${inputData.title || 'storyflow'}_Ch${inputData.chapter || ''}.srt`;
    downloadTextFile(fileName, srtContent, "application/x-subrip;charset=utf-8");
    
    setToast({ message: "Đã xuất file SRT thành công!", visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
  };

  const handleExportTXT = () => {
    const subtitleItems = getSubtitleItems();

    if (subtitleItems.length === 0) {
      setError("Không có dữ liệu để xuất TXT. Hãy chạy Beat Analysis hoặc Build Final Result trước.");
      return;
    }

    const txtContent = buildTxtFromItems(subtitleItems);

    const fileName = `${inputData.title || 'storyflow'}_Ch${inputData.chapter || ''}.txt`;
    downloadTextFile(fileName, txtContent, "text/plain;charset=utf-8");

    setToast({ message: "Đã xuất file TXT thành công!", visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
  };

  const handleExportImagePrompts = () => {
    const finalResult = parseJsonSafe<FinalResult | null>(production.finalResult, null);
    const content = buildImagePromptTxtFromFinalResult(finalResult);

    if (!content.trim()) {
      setError("Không có visualPrompt để export.");
      return;
    }

    const fileName = `${inputData.title || 'storyflow'}_Ch${inputData.chapter || ''}_image-prompts.txt`;
    downloadTextFile(fileName, content, "text/plain;charset=utf-8");

    setToast({ message: "Đã xuất file Image Prompts thành công!", visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
  };



  const buildCharacterLocationImagePromptExportContent = (library: {
    characters: CharacterProfile[];
    locations: LocationProfile[];
  }) => {
    const toSingleLine = (prompt: string) => prompt.replace(/\s+/g, " ").trim();
    const characterPrompts = library.characters.map((character) =>
      toSingleLine(buildCharacterReferenceSheetPrompt(character, getSelectedStylePrompt()))
    );
    const locationPrompts = library.locations.map((location) =>
      toSingleLine(buildLocationReferenceSheetPrompt(location, getSelectedStylePrompt()))
    );

    return [...characterPrompts, ...locationPrompts].filter(Boolean).join("\n");
  };

  const handleExportCharacterLocationImagePrompts = () => {
    const library = normalizeCharacterLocationLibrary(
      parseJsonSafe<unknown>(production.characterLocationAnalysis, {})
    );

    if (!library.characters.length && !library.locations.length) {
      setError("Khong co Character hoac Location prompt de export.");
      return;
    }

    const content = buildCharacterLocationImagePromptExportContent(library);
    const fileName = `${inputData.title || 'storyflow'}_Ch${inputData.chapter || ''}_character-location-image-prompts.txt`;
    downloadTextFile(fileName, content, "text/plain;charset=utf-8");

    setToast({ message: "Da xuat Image Prompt cho Characters va Locations!", visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
  };

  const handleExportJSON = () => {
    if (!finalJsonData || finalJsonData.length === 0) return;

    // Helper function to format name: lowercase, no accents, space to underscore
    const formatCharName = (name: string) => {
      return name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "d")
        .toLowerCase()
        .replace(/\s+/g, "_");
    };

    // Lấy danh sách nhân vật từ production.characterLocationAnalysis
    let characterProfiles: { original: string, searchTerms: string[] }[] = [];
    if (production.characterLocationAnalysis) {
      try {
        const charLocData = JSON.parse(production.characterLocationAnalysis);
        if (charLocData.characters && Array.isArray(charLocData.characters)) {
          characterProfiles = charLocData.characters.map((c: any) => {
            const name = c.name || "";
            // Tách tên thành các phần để tìm kiếm linh hoạt hơn
            // Ví dụ: "Wang Yue (Vương Việt)" -> ["Wang Yue (Vương Việt)", "Wang Yue", "Vương Việt"]
            const terms = [name];
            
            // Xử lý trường hợp có ngoặc đơn: Wang Yue (Vương Việt)
            const bracketMatch = name.match(/^(.+?)\s*\((.+?)\)$/);
            if (bracketMatch) {
              terms.push(bracketMatch[1].trim());
              terms.push(bracketMatch[2].trim());
            }

            return { original: name, searchTerms: terms.filter(t => t.length > 2) };
          });
        }
      } catch (e) {
        console.error("Failed to parse characterLocationAnalysis for JSON export:", e);
      }
    }

    // Bỏ trường originalText và thêm trường character
    const allFoundCharacters = new Set<string>();
    
    const panelsData = finalJsonData.map(({ originalText, ...rest }) => {
      const visualPrompt = rest.visualPrompt || "";
      
      // Tìm các nhân vật xuất hiện trong visualPrompt
      const foundMatches = characterProfiles.map(profile => {
        // Tìm vị trí xuất hiện đầu tiên của bất kỳ term nào trong profile
        let firstIndex = -1;
        for (const term of profile.searchTerms) {
          const idx = visualPrompt.indexOf(term);
          if (idx !== -1 && (firstIndex === -1 || idx < firstIndex)) {
            firstIndex = idx;
          }
        }
        return { name: profile.original, index: firstIndex };
      })
      .filter(item => item.index !== -1)
      .sort((a, b) => a.index - b.index)
      .map(item => formatCharName(item.name));

      foundMatches.forEach(name => allFoundCharacters.add(name));

      return {
        ...rest,
        character: foundMatches.join(" ")
      };
    });

    const exportedData = {
      characterName: Array.from(allFoundCharacters),
      panels: panelsData
    };

    const blob = new Blob([JSON.stringify(exportedData, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${inputData.title || 'storyflow'}_Ch${inputData.chapter || ''}_final.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    setToast({ message: "Đã xuất file JSON thành công!", visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
  };

  const handleBuildFinalResult = () => {
    if (!finalBuildCheck.canBuild) {
      setError(`Chưa đủ dữ liệu để build Final Result. Thiếu: ${finalBuildCheck.missingInputs.join(', ')}`);
      return;
    }

    buildFinalResultFromCurrentProject();
    setToast({ message: "Đã build Final Result thành công!", visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
  };

  useEffect(() => {
    if (!finalResultAutoBuildSignature) return;
    if (autoFinalResultBuildSignatureRef.current === finalResultAutoBuildSignature) return;

    autoFinalResultBuildSignatureRef.current = finalResultAutoBuildSignature;
    const finalResult = buildFinalResultFromCurrentProject();
    if (finalResult) {
      setToast({ message: "Đã tự động build Final Result!", visible: true });
      setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
    }
  }, [finalResultAutoBuildSignature, buildFinalResultFromCurrentProject]);

  const handleCopyFinalResult = () => {
    copyToClipboard(production.finalResult);
  };

  const handleExportFinalResultJson = () => {
    if (!production.finalResult) return;
    const blob = new Blob([production.finalResult], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${inputData.title || 'storyflow'}_Ch${inputData.chapter || ''}_final-result.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setToast({ message: "Đã xuất Final Result JSON!", visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
  };

  const copyToClipboard = (text?: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setToast({ message: "Đã sao chép vào bộ nhớ tạm!", visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
  };

  const closeReferencePromptModal = () => {
    setReferencePromptModal({ open: false, title: '', subjectName: '', prompt: '' });
  };

  const handleCopyReferencePrompt = async () => {
    if (!referencePromptModal.prompt) return;

    try {
      await navigator.clipboard.writeText(referencePromptModal.prompt);
      setToast({ message: "Copied prompt!", visible: true });
      setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
      closeReferencePromptModal();
    } catch (error) {
      console.error("Failed to copy reference prompt", error);
      setToast({ message: "Copy prompt failed.", visible: true });
      setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
    }
  };

  const renderStoryboardBatchPasteView = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Save className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Dán kết quả theo batch</h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Đã có {storyboardProgress.savedCount}/{storyboardProgress.total || storyboardBatchInfo.totalBeats} panel, {storyboardProgress.completeBatchCount}/{storyboardBatchInfo.totalBatches} batch đủ dữ liệu.
            </p>
          </div>
        </div>
        <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${storyboardProgress.isComplete ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
          {storyboardProgress.isComplete ? 'Đã ghép đủ' : 'Đang ghép batch'}
        </span>
      </div>

      {storyboardProgress.isComplete && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-emerald-900">Storyboard đã đủ batch</h3>
            <p className="mt-1 text-xs font-semibold text-emerald-700">
              Dữ liệu đã được ghép thành kết quả hoàn chỉnh. Bấm nút bên phải khi muốn mở UI hiển thị Phác thảo minh họa.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setShowStoryboardPreview(true);
                setIsManualMode(false);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-100 transition-colors hover:bg-emerald-700"
            >
              <Eye className="h-4 w-4" /> Xem Phác thảo minh họa
            </button>
            <button
              type="button"
              onClick={() => {
                setShowStoryboardPreview(false);
                setIsManualMode(false);
                setStage(ProductionStage.PROMPTS);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-100 transition-colors hover:bg-indigo-700"
            >
              <Zap className="h-4 w-4" /> Qua Prompt Engineering
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {storyboardBatchStatuses.map((batch) => {
          const value = storyboardBatchInputs[batch.index] || '';
          const isActive = batch.index === storyboardBatchInfo.batchIndex;
          const rangeLabel = batch.total > 0
            ? `Beats ${batch.start + 1}-${batch.end}`
            : 'Chưa có beat';

          return (
            <article
              key={`storyboard-batch-${batch.index}`}
              className={`rounded-2xl border bg-white p-5 shadow-sm transition-all ${isActive ? 'border-indigo-300 ring-2 ring-indigo-50' : 'border-slate-200'}`}
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setStoryboardBatchIndex(batch.index)}
                  className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-colors ${isActive ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'}`}
                >
                  <Layout className="h-3.5 w-3.5" /> Batch {batch.index + 1}
                </button>
                <span className={`rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-widest ${batch.complete ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-50 text-slate-500 border border-slate-100'}`}>
                  {batch.complete ? 'Đã đủ' : `${batch.savedCount}/${batch.total}`}
                </span>
              </div>

              <div className="mb-3 space-y-1 text-xs font-semibold text-slate-500">
                <p>{rangeLabel}</p>
                <p className="font-mono text-[10px] text-slate-400">beatId: {batch.targetBeatIds.join(', ') || 'N/A'}</p>
              </div>

              <textarea
                value={value}
                onChange={(e) => setStoryboardBatchInputs((prev) => ({ ...prev, [batch.index]: e.target.value }))}
                placeholder={`Dán JSON panels cho batch ${batch.index + 1} tại đây...`}
                className="h-56 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setStoryboardBatchIndex(batch.index);
                    copyToClipboard(getStoryboardPromptForBatch(batch.index));
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 transition-colors hover:border-indigo-400 hover:text-indigo-600"
                >
                  <Copy className="h-3.5 w-3.5" /> Copy prompt
                </button>
                <button
                  type="button"
                  onClick={() => saveStoryboardBatchResult(batch.index, value)}
                  disabled={!value.trim()}
                  className="ml-auto inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Lưu batch
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );

  const openCharacterReferenceSheetPrompt = (character: CharacterProfile) => {
    const prompt = buildCharacterReferenceSheetPrompt(character, getSelectedStylePrompt());
    setReferencePromptModal({
      open: true,
      title: 'Character Reference Sheet Prompt',
      subjectName: character.name || 'Character',
      prompt
    });
  };

  const openLocationReferenceSheetPrompt = (location: LocationProfile) => {
    const prompt = buildLocationReferenceSheetPrompt(location, getSelectedStylePrompt());
    setReferencePromptModal({
      open: true,
      title: 'Location Reference Sheet Prompt',
      subjectName: location.name || 'Location',
      prompt
    });
  };

  const formatFinalList = (items?: string[]) => {
    if (!items || items.length === 0) return 'None';
    return items.join(', ');
  };

  const getPanelVisualPrompt = (panel: FinalResultPanel) => {
    const legacy = panel as unknown as { visualPrompt?: string; negative_prompt?: string };
    return ensureVisualPromptHasNegativePrompt(panel.prompt?.visualPrompt || legacy.visualPrompt || '', legacy.negative_prompt);
  };

  const renderToast = () => {
    if (!toast.visible) return null;
    return (
      <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[200] animate-in fade-in slide-in-from-top-4 duration-300">
        <div className="bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/10">
          <div className="bg-emerald-500 p-1 rounded-lg">
            <CheckCircle2 className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-bold tracking-wide">{toast.message}</span>
        </div>
      </div>
    );
  };

  const renderReferencePromptModal = () => {
    if (!referencePromptModal.open) return null;

    return (
      <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden border border-slate-100 animate-in zoom-in duration-200">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">{referencePromptModal.title}</p>
              <h3 className="text-xl font-black text-slate-900 mt-1">{referencePromptModal.subjectName}</h3>
            </div>
            <button
              onClick={closeReferencePromptModal}
              className="p-2 rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6 bg-slate-50">
            <textarea
              value={referencePromptModal.prompt}
              readOnly
              className="w-full h-[58vh] resize-none rounded-2xl border border-slate-200 bg-white p-5 text-xs font-mono leading-relaxed text-slate-700 outline-none"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={handleCopyReferencePrompt}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-indigo-600 transition-colors"
              >
                <Copy className="w-4 h-4" /> Copy Prompt
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderManualView = () => (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
        <div className="bg-slate-800 px-6 py-3 flex flex-wrap justify-between items-center gap-3 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">
              Prompt cho AI bên ngoài
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button onClick={() => copyToClipboard(currentStepPrompt)} className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-400 hover:text-white transition-colors">
              <Copy className="w-3 h-3" /> COPY PROMPT
            </button>
          </div>
        </div>
        <div className="p-6">
          {stage === ProductionStage.STORYBOARD && storyboardBatchInfo.totalBeats > gemini.STORYBOARD_BATCH_SIZE && (
            <div className="mb-4 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-4 text-indigo-100">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Storyboard Batch</p>
                  <p className="mt-1 text-sm font-bold">
                    Batch {storyboardBatchInfo.batchIndex + 1}/{storyboardBatchInfo.totalBatches} · Beats {storyboardBatchInfo.start + 1}-{storyboardBatchInfo.end} / {storyboardBatchInfo.totalBeats}
                  </p>
                  <p className="mt-1 text-xs text-indigo-200">
                    Dán JSON vào đúng ô batch bên dưới. Khi đủ panel, StoryFlow sẽ tự ghép thành storyboard hoàn chỉnh.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStoryboardBatchIndex((index) => Math.max(0, index - 1))}
                    disabled={storyboardBatchInfo.batchIndex <= 0}
                    className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => setStoryboardBatchIndex((index) => Math.min(storyboardBatchInfo.totalBatches - 1, index + 1))}
                    disabled={storyboardBatchInfo.batchIndex >= storyboardBatchInfo.totalBatches - 1}
                    className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
          <pre className="text-xs text-slate-400 whitespace-pre-wrap font-mono leading-relaxed h-48 overflow-y-auto">
            {currentStepPrompt}
          </pre>
        </div>
      </div>

      {stage === ProductionStage.STORYBOARD ? (
        renderStoryboardBatchPasteView()
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-slate-800 font-bold">
              <Save className="w-5 h-5 text-indigo-600" />
              <span>Dán kết quả AI trả về vào đây</span>
            </div>
          </div>
          <textarea
            value={manualInputValue}
            onChange={(e) => setManualInputValue(e.target.value)}
            placeholder="Dán nội dung AI đã phân tích được từ bên ngoài vào đây..."
            className="w-full h-80 p-5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-sm leading-relaxed outline-none"
          />
          <button 
            onClick={handleManualSave}
            disabled={!manualInputValue.trim()}
            className="mt-6 w-full py-4 bg-indigo-600 text-white rounded-xl font-bold uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5" /> Lưu và Tiếp tục
          </button>
        </div>
      )}
    </div>
  );

  const renderFinalPanelCard = (panel: FinalResultPanel) => {
    const source = panel.source;
    const storyboard = panel.storyboard;
    const visualPrompt = getPanelVisualPrompt(panel);

    return (
      <article key={`beat-${panel.beatId || panel.panelNumber || panel.panelId}`} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Final Beat</p>
            <h4 className="mt-1 text-xl font-black text-slate-900">Beat #{panel.beatId || 'N/A'}</h4>
          </div>
        </div>

        <section className="mb-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <h5 className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Source Beat</h5>
          <div className="space-y-2 text-sm text-slate-700">
            <p className="italic leading-relaxed text-slate-800">{source?.originalText || panel.originalText || 'Missing original text.'}</p>
            <div className="grid grid-cols-1 gap-2 pt-2 text-xs md:grid-cols-2">
              <p><span className="font-black text-slate-500">Time:</span> {source?.timeOfDay || 'Unknown'}</p>
              <p><span className="font-black text-slate-500">Location:</span> {source?.location || panel.location_cues || 'Unknown'}</p>
              <p><span className="font-black text-slate-500">Focus:</span> {formatFinalList(source?.focusCharacters)}</p>
              <p><span className="font-black text-slate-500">Visible:</span> {formatFinalList(source?.visibleCharacters)}</p>
              <p><span className="font-black text-slate-500">Offscreen:</span> {formatFinalList(source?.offscreenPresentCharacters)}</p>
              <p><span className="font-black text-slate-500">Props:</span> {formatFinalList(source?.props)}</p>
            </div>
          </div>
        </section>

        {panel.screen && (
          <section className="mb-4 rounded-2xl border border-cyan-100 bg-cyan-50 p-4">
            <h5 className="mb-2 text-[10px] font-black uppercase tracking-widest text-cyan-700">Screen Continuity</h5>
            <div className="space-y-1 text-xs text-cyan-900">
              <p><span className="font-black">Screen:</span> {panel.screen.screenName}</p>
              <p><span className="font-black">Present:</span> {formatFinalList(panel.screen.screenCharacters)}</p>
              <p><span className="font-black">State:</span> {panel.screen.screenState || 'Missing'}</p>
              {panel.screen.continuityNotes && <p><span className="font-black">Continuity:</span> {panel.screen.continuityNotes}</p>}
            </div>
          </section>
        )}

        <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 p-4">
            <h5 className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Story Action</h5>
            <div className="space-y-2 text-xs text-slate-700">
              <p><span className="font-black text-slate-500">Action:</span> {source?.action || panel.action || 'Missing'}</p>
              <p><span className="font-black text-slate-500">Interaction:</span> {source?.interaction || 'Missing'}</p>
              <p><span className="font-black text-slate-500">Posture:</span> {source?.posture || 'Missing'}</p>
              <p><span className="font-black text-slate-500">Atmosphere:</span> {source?.atmosphere || 'Missing'}</p>
              <p><span className="font-black text-slate-500">Visual Focus:</span> {source?.visualFocus || panel.subject || 'Missing'}</p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 p-4">
            <h5 className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Storyboard</h5>
            <div className="space-y-2 text-xs text-slate-700">
              <p><span className="font-black text-slate-500">Shot:</span> {storyboard?.shotType || 'Missing'}</p>
              <p><span className="font-black text-slate-500">Camera:</span> {storyboard?.cameraAngle || panel.cameraAngle || 'Missing'}</p>
              <p><span className="font-black text-slate-500">Composition:</span> {storyboard?.composition || panel.framing || 'Missing'}</p>
              <p><span className="font-black text-slate-500">Foreground:</span> {storyboard?.foreground || 'Missing'}</p>
              <p><span className="font-black text-slate-500">Midground:</span> {storyboard?.midground || 'Missing'}</p>
              <p><span className="font-black text-slate-500">Background:</span> {storyboard?.background || 'Missing'}</p>
            </div>
          </section>
        </div>

        <section className="mb-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h5 className="text-[10px] font-black uppercase tracking-widest text-indigo-700">Visual Prompt</h5>
              <p className="mt-1 text-[10px] font-bold text-indigo-600">Bao gồm cả phần Negative prompt ở cuối.</p>
            </div>
            <button
              onClick={() => copyToClipboard(visualPrompt)}
              disabled={!visualPrompt}
              className="rounded-xl bg-indigo-600 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Copy Prompt
            </button>
          </div>
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-white p-4 text-xs leading-relaxed text-slate-800">
            {visualPrompt || 'No visual prompt found.'}
          </pre>
        </section>

        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <button
            onClick={() => copyToClipboard(visualPrompt)}
            disabled={!visualPrompt}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-600 hover:border-indigo-500 hover:text-indigo-600 disabled:opacity-50"
          >
            Copy Visual Prompt
          </button>
          <button
            onClick={() => copyToClipboard(JSON.stringify(panel, null, 2))}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-600 hover:border-indigo-500 hover:text-indigo-600"
          >
            Copy Beat JSON
          </button>
        </div>
      </article>
    );
  };

  const renderFinalPanelView = () => {
    return (
      <div className="space-y-5">
        <FinalResultStudioView 
          finalResult={parsedFinalResult} 
          onCopyPrompt={(text) => copyToClipboard(text)}
        />
      </div>
    );
  };

  const renderFinalBuilderView = () => {
    const checklist = [
      { label: 'Beat Analysis', ok: finalBuildData.beats.length > 0, count: finalBuildData.beats.length, required: true },
      { label: 'Storyboard Beats', ok: finalBuildData.panels.length > 0, count: finalBuildData.panels.length, required: true },
      { label: 'Prompt Engineering', ok: finalBuildData.engineerPrompts.length > 0, count: finalBuildData.engineerPrompts.length, required: true },
      { label: 'Character Library', ok: finalBuildData.characters.length > 0, count: finalBuildData.characters.length, required: false },
      { label: 'Location Library', ok: finalBuildData.locations.length > 0, count: finalBuildData.locations.length, required: false }
    ];

    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="rounded-3xl border border-indigo-100 bg-indigo-50 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-indigo-600 p-3 text-white shadow-lg shadow-indigo-100">
              <FileJson className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">Final Result được build local</h3>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-indigo-900">
                Final Result is built locally from Beat Analysis, Character/Location Library, Storyboard, and Prompt Engineering. QA is no longer part of the active pipeline.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-1 space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-5">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Input Checklist</h3>
                  <p className="mt-1 text-xs text-slate-500">Các dữ liệu đang có trong project.</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${finalBuildCheck.canBuild ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                  {finalBuildCheck.canBuild ? 'Ready' : 'Missing'}
                </span>
              </div>

              <div className="space-y-3">
                {checklist.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className={`w-4 h-4 ${item.ok ? 'text-emerald-500' : item.required ? 'text-rose-500' : 'text-amber-500'}`} />
                      <div>
                        <p className="text-xs font-black text-slate-700">{item.label}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{item.required ? 'Required' : 'Optional'}</p>
                      </div>
                    </div>
                    <span className="rounded-lg bg-white px-2 py-1 text-[10px] font-black text-slate-500 border border-slate-100">{item.count}</span>
                  </div>
                ))}
              </div>

              {!finalBuildCheck.canBuild && (
                <div className="mt-5 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-xs font-bold text-rose-700">
                  Thiếu: {finalBuildCheck.missingInputs.join(', ')}
                </div>
              )}

              {finalBuildCheck.warnings.length > 0 && (
                <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-xs text-amber-800">
                  <p className="font-black uppercase tracking-widest mb-2">Cảnh báo</p>
                  <div className="space-y-1">
                    {finalBuildCheck.warnings.map((warning) => (
                      <p key={warning}>{warning}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
              <button
                onClick={handleBuildFinalResult}
                disabled={!finalBuildCheck.canBuild || isFinalResultAutoBuildPending}
                className="w-full inline-flex items-center justify-center gap-3 rounded-2xl bg-indigo-600 px-5 py-4 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
              >
                {isFinalResultAutoBuildPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {isFinalResultAutoBuildPending ? 'Đang tự build Final Result' : 'Build Final Result'}
              </button>
              <button
                onClick={handleCopyFinalResult}
                disabled={!production.finalResult}
                className="w-full inline-flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-600 transition-all hover:border-indigo-500 hover:text-indigo-600 disabled:opacity-50"
              >
                <Copy className="w-4 h-4" /> Copy Final JSON
              </button>
              <button
                onClick={handleExportFinalResultJson}
                disabled={!production.finalResult}
                className="w-full inline-flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-600 transition-all hover:border-blue-500 hover:text-blue-600 disabled:opacity-50"
              >
                <Download className="w-4 h-4" /> Export JSON
              </button>
              <button
                onClick={handleExportSRT}
                disabled={!production.finalResult}
                className="w-full inline-flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-600 transition-all hover:border-emerald-500 hover:text-emerald-600 disabled:opacity-50"
              >
                <Download className="w-4 h-4" /> Export SRT
              </button>
              <button
                onClick={handleExportTXT}
                disabled={!production.finalResult}
                className="w-full inline-flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-600 transition-all hover:border-emerald-500 hover:text-emerald-600 disabled:opacity-50"
              >
                <Download className="w-4 h-4" /> Export TXT
              </button>
              <button
                onClick={handleExportImagePrompts}
                disabled={!production.finalResult}
                className="w-full inline-flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-600 transition-all hover:border-sky-500 hover:text-sky-600 disabled:opacity-50"
              >
                <Download className="w-4 h-4" /> Export Image Prompt
              </button>
              <button
                onClick={saveProject}
                className="w-full inline-flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-600 transition-all hover:border-emerald-500 hover:text-emerald-600"
              >
                <Save className="w-4 h-4" /> Save Project
              </button>
            </div>
          </div>

          <div className="xl:col-span-2 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Final Result Preview</h3>
                <p className="mt-1 text-xs text-slate-500">Xem theo từng panel hoặc raw JSON.</p>
              </div>
              <div className="flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
                <button
                  onClick={() => setFinalResultViewMode('panels')}
                  className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest transition-all ${finalResultViewMode === 'panels' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Beat View
                </button>
                <button
                  onClick={() => setFinalResultViewMode('json')}
                  className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest transition-all ${finalResultViewMode === 'json' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Raw JSON
                </button>
              </div>
            </div>
            {finalResultViewMode === 'panels' ? (
              <StageRenderBoundary stage={ProductionStage.FINAL} resetKey={production.finalResult || ''}>
                {renderFinalPanelView()}
              </StageRenderBoundary>
            ) : (
              <textarea
                value={production.finalResult || 'Chưa có Final Result. Bấm "Build Final Result" để tạo JSON cuối cùng.'}
                readOnly
                className="h-[620px] w-full resize-none rounded-2xl border border-slate-200 bg-slate-950 p-5 font-mono text-xs leading-relaxed text-slate-100 outline-none"
              />
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderFinalView = () => {
    if (!finalJsonData || !Array.isArray(finalJsonData) || finalJsonData.length === 0) {
      return (
        <div className="p-10 text-center bg-white rounded-2xl shadow-sm border border-slate-200">
          <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Lỗi định dạng JSON</h3>
          <p className="text-slate-500 max-w-md mx-auto mb-6">Hãy đảm bảo kết quả là một mảng các đối tượng Beat. Kiểm tra lại dấu ngoặc và cấu trúc JSON.</p>
          <button 
            onClick={() => setIsManualMode(true)}
            className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
          >
            Sửa lại thủ công
          </button>
        </div>
      );
    }
    
    return (
      <div className="space-y-8 pb-10">
        <div className="flex items-center justify-between bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-white/20 shadow-sm sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600 p-2 rounded-xl shadow-indigo-200 shadow-lg">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Kết quả sản xuất cuối cùng</h3>
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{finalJsonData.length} Khung hình đã sẵn sàng</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button 
              onClick={handleExportSRT}
              className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100"
            >
              <Download className="w-3.5 h-3.5" /> Xuất SRT
            </button>
            <button 
              onClick={handleExportJSON}
              className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-md shadow-blue-100"
            >
              <Download className="w-3.5 h-3.5" /> Xuất JSON
            </button>
            <button 
              onClick={handleExportTXT}
              className="px-4 py-1.5 bg-slate-600 text-white rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-slate-700 transition-all shadow-md shadow-slate-100"
            >
              <Download className="w-3.5 h-3.5" /> Xuất TXT
            </button>
            <div className="w-px h-4 bg-slate-300 mx-1"></div>
            <button 
              onClick={handleNextChapter}
              className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100"
            >
              <ArrowRight className="w-3.5 h-3.5" /> Phân tích chương tiếp theo
            </button>
            <button onClick={() => setViewMode('table')} className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${viewMode === 'table' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Layout className="w-3.5 h-3.5" /> Thẻ</button>
            <button onClick={() => setViewMode('json')} className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${viewMode === 'json' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Code2 className="w-3.5 h-3.5" /> JSON</button>
          </div>
        </div>

        {viewMode === 'table' ? (
          <div className="grid grid-cols-1 gap-8">
            {finalJsonData.map((item: any, idx: number) => (
              <div key={idx} className="group bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 border border-slate-100 flex flex-col lg:flex-row">
                <div className="lg:w-64 bg-slate-50 p-8 flex flex-col items-center justify-center border-b lg:border-b-0 lg:border-r border-slate-100 group-hover:bg-indigo-50 transition-colors duration-500 relative">
                  <div className="relative">
                    <span className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em] mb-2 block text-center">Beat</span>
                    <span className="text-6xl font-black text-slate-200 group-hover:text-indigo-200 transition-colors duration-500 leading-none">{item?.beatId || item?.panelNumber || idx + 1}</span>
                  </div>
                  {item?.shotName && (
                    <span className="mt-6 px-3 py-1 bg-white border border-slate-200 rounded-full text-[9px] font-bold text-slate-500 uppercase tracking-wider shadow-sm text-center">
                      {item?.shotName}
                    </span>
                  )}
                  <button 
                    onClick={() => {
                      const { originalText, ...dataToCopy } = item || {};
                      copyToClipboard(JSON.stringify(dataToCopy, null, 2));
                    }}
                    className="mt-8 flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold text-slate-600 hover:text-indigo-600 hover:border-indigo-600 hover:shadow-md transition-all uppercase tracking-wider"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy Beat
                  </button>
                </div>

                <div className="flex-1 p-8 space-y-8">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div class="space-y-6">
            <div className="flex items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-indigo-600" />
                <span className="text-sm font-bold text-slate-800">Beat Analysis Export</span>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleExportSRT}
                  className="px-4 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-emerald-100 shadow-sm flex items-center gap-2"
                >
                  <Download className="w-3.5 h-3.5" /> Export SRT
                </button>
                <button 
                  onClick={handleExportTXT}
                  className="px-4 py-2 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-slate-100 shadow-sm flex items-center gap-2"
                >
                  <Download className="w-3.5 h-3.5" /> Export TXT
                </button>
                <button
                  onClick={() => setShowAnalysisJson(prev => !prev)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border shadow-sm flex items-center gap-2 ${showAnalysisJson ? 'bg-slate-900 text-white border-slate-900' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border-indigo-100'}`}
                >
                  <Code2 className="w-3.5 h-3.5" /> {showAnalysisJson ? 'Ẩn JSON' : 'Xem JSON'}
                </button>
              </div>
            </div>
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-4 bg-indigo-500 rounded-full"></div>
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nội dung gốc</h4>
                        </div>
                        <div className="relative">
                          <p className="text-sm text-slate-600 leading-relaxed italic pl-6 border-l-2 border-slate-100 group-hover:border-indigo-100 transition-colors">
                            {item?.originalText}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:bg-white hover:shadow-md transition-all group/info">
                          <div className="flex items-center gap-2 mb-2">
                            <Camera className="w-3.5 h-3.5 text-indigo-400 group-hover/info:text-indigo-600 transition-colors" />
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Góc máy</span>
                          </div>
                          <p className="text-xs font-bold text-slate-700">{item?.cameraAngle || 'Eye level'}</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:bg-white hover:shadow-md transition-all group/info">
                          <div className="flex items-center gap-2 mb-2">
                            <Move className="w-3.5 h-3.5 text-indigo-400 group-hover/info:text-indigo-600 transition-colors" />
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Bố cục</span>
                          </div>
                          <p className="text-xs font-bold text-slate-700">{item?.framing || 'Central'}</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:bg-white hover:shadow-md transition-all group/info">
                          <div className="flex items-center gap-2 mb-1.5">
                            <Users className="w-3.5 h-3.5 text-indigo-400 group-hover/info:text-indigo-600 transition-colors" />
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Chủ thể</span>
                          </div>
                          <p className="text-[11px] font-bold text-slate-700 line-clamp-1">{item?.subject || 'N/A'}</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:bg-white hover:shadow-md transition-all group/info">
                          <div className="flex items-center gap-2 mb-1.5">
                            <Play className="w-3.5 h-3.5 text-indigo-400 group-hover/info:text-indigo-600 transition-colors" />
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Hành động</span>
                          </div>
                          <p className="text-[11px] font-bold text-slate-700 line-clamp-1">{item?.action || 'N/A'}</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:bg-white hover:shadow-md transition-all group/info">
                          <div className="flex items-center gap-2 mb-1.5">
                            <MapPin className="w-3.5 h-3.5 text-indigo-400 group-hover/info:text-indigo-600 transition-colors" />
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Bối cảnh</span>
                          </div>
                          <p className="text-[11px] font-bold text-slate-700 line-clamp-1">{item?.location_cues || 'N/A'}</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:bg-white hover:shadow-md transition-all group/info">
                          <div className="flex items-center gap-2 mb-1.5">
                            <Sun className="w-3.5 h-3.5 text-indigo-400 group-hover/info:text-indigo-600 transition-colors" />
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ánh sáng</span>
                          </div>
                          <p className="text-[11px] font-bold text-slate-700 line-clamp-1">{item?.lighting || 'N/A'}</p>
                        </div>
                      </div>
                    </div>

                    <div class="space-y-6">
            <div className="flex items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-indigo-600" />
                <span className="text-sm font-bold text-slate-800">Beat Analysis Export</span>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleExportSRT}
                  className="px-4 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-emerald-100 shadow-sm flex items-center gap-2"
                >
                  <Download className="w-3.5 h-3.5" /> Export SRT
                </button>
                <button 
                  onClick={handleExportTXT}
                  className="px-4 py-2 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-slate-100 shadow-sm flex items-center gap-2"
                >
                  <Download className="w-3.5 h-3.5" /> Export TXT
                </button>
              </div>
            </div>
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-4 bg-emerald-500 rounded-full"></div>
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Visual Prompt</h4>
                        </div>
                        <div className="bg-slate-900 rounded-2xl p-6 relative group/prompt shadow-lg shadow-slate-200 h-full min-h-[200px]">
                          <p className="text-[11px] font-mono text-indigo-50 leading-relaxed pr-8">{item?.visualPrompt}</p>
                          <button onClick={() => copyToClipboard(item?.visualPrompt)} className="absolute top-4 right-4 text-white/30 hover:text-white transition-colors"><Copy className="w-4 h-4" /></button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-slate-900 rounded-3xl p-8 shadow-2xl border border-slate-800 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Code2 className="w-48 h-48 text-white" />
            </div>
            <pre className="text-emerald-400 text-xs font-mono leading-relaxed overflow-x-auto relative z-0">
              {JSON.stringify(finalJsonData, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  };

  const renderDataView = (data: any, stage: ProductionStage) => {
    if (!data) return null;

    let parsed: any = null;
    try {
      parsed = typeof data === 'string' ? JSON.parse(data) : data;
    } catch (e) {
      return <div className="text-slate-800 text-sm whitespace-pre-wrap font-sans leading-relaxed">{data}</div>;
    }

    switch (stage) {
      case ProductionStage.ANALYSIS: {
        const analysisBeats = getAnalysisBeatsFromParsed(parsed);
        const normalizedBeats = normalizeBeats(parsed);
        const parsedScreens = normalizeScreens(parsed);
        const screens = parsedScreens.length ? parsedScreens : createFallbackScreensFromBeats(normalizedBeats);
        const showLegacyBeatCards = false;
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-indigo-600" />
                <span className="text-sm font-bold text-slate-800">Beat Analysis Export</span>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleExportSRT}
                  className="px-4 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-emerald-100 shadow-sm flex items-center gap-2"
                >
                  <Download className="w-3.5 h-3.5" /> Export SRT
                </button>
                <button 
                  onClick={handleExportTXT}
                  className="px-4 py-2 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-slate-100 shadow-sm flex items-center gap-2"
                >
                  <Download className="w-3.5 h-3.5" /> Export TXT
                </button>
              </div>
            </div>
            {(parsed?.repairNotes || parsed?.sourceSegmenterVersion || parsed?.sourceTextHash) && (
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700">Source Text Repair</span>
                  {parsed?.sourceSegmenterVersion && (
                    <span className="rounded-lg bg-white px-2 py-1 text-[10px] font-bold text-indigo-700">
                      {parsed.sourceSegmenterVersion}
                    </span>
                  )}
                  {parsed?.targetBeatWordMin && parsed?.targetBeatWordMax && (
                    <span className="rounded-lg bg-white px-2 py-1 text-[10px] font-bold text-indigo-700">
                      Target {parsed.targetBeatWordMin}-{parsed.targetBeatWordMax} words
                    </span>
                  )}
                </div>
                {parsed?.repairNotes && (
                  <p className="text-xs font-semibold leading-relaxed text-indigo-900">
                    {parsed.repairNotes}
                  </p>
                )}
                {parsed?.sourceTextHash && (
                  <p className="mt-2 text-[10px] font-mono text-indigo-500">
                    sourceTextHash: {parsed.sourceTextHash}
                  </p>
                )}
              </div>
            )}
            {parsed?.coverageCheck && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Coverage Check</span>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${parsed.coverageCheck.allSourceTextCovered ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'}`}>
                    {parsed.coverageCheck.allSourceTextCovered ? 'Covered' : 'Needs Review'}
                  </span>
                </div>
                {(parsed.coverageCheck.notes || parsed.coverageCheck.missingText || parsed.coverageCheck.duplicatedText) && (
                  <p className="text-xs text-emerald-800 leading-relaxed">
                    {parsed.coverageCheck.notes || parsed.coverageCheck.missingText || parsed.coverageCheck.duplicatedText}
                  </p>
                )}
              </div>
            )}

            <ScreenStudioView screens={screens} beats={normalizedBeats} />

            {showAnalysisJson && (
              <div className="rounded-3xl border border-slate-200 bg-slate-950 p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Debug JSON</p>
                    <h3 className="text-sm font-black text-white">Raw production.analysis</h3>
                  </div>
                  <button
                    onClick={() => copyToClipboard(JSON.stringify(parsed, null, 2))}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/20"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy JSON
                  </button>
                </div>
                <pre className="max-h-[520px] overflow-auto rounded-2xl bg-black/30 p-4 text-xs leading-relaxed text-emerald-300">
                  {JSON.stringify(parsed, null, 2)}
                </pre>
              </div>
            )}

            {showLegacyBeatCards && analysisBeats && (
              <>
                {analysisBeats.map((beat: any, i: number) => {
                  const projectBeat = getProjectBeat(beat, i);
                  const beatId = projectBeat.beatId || beat.beatId || i + 1;
                  const hasLockedSource = isFieldLocked(projectBeat, "originalText");
                  const hasLongOriginalText = isLongBeatOriginalText(beat.originalText || beat.text || "");

                  return (
                  <div key={i} className="relative group">
                    <div className={`bg-white border ${editingBeatIndex === i ? 'border-indigo-500 ring-2 ring-indigo-50 shadow-lg' : 'border-slate-200'} rounded-2xl p-6 transition-all duration-300`}>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <span className="bg-indigo-600 text-white text-[10px] font-black px-3 py-1 rounded-lg uppercase shadow-sm">Beat {i + 1}</span>
                          {renderLockSummary(projectBeat)}
                          {editingBeatIndex === i ? (
                            <input 
                              type="text"
                              value={editingBeatData.atmosphere || ''}
                              onChange={(e) => setEditingBeatData({...editingBeatData, atmosphere: e.target.value})}
                              placeholder="Cảm xúc chủ đạo..."
                              className="text-[10px] font-bold uppercase px-3 py-1 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 outline-none w-48"
                            />
                          ) : beat.atmosphere && (
                            <div className="flex items-center gap-1.5 bg-purple-50 text-purple-600 px-3 py-1 rounded-lg border border-purple-100">
                              <Zap className="w-3 h-3" />
                              <span className="text-[10px] font-bold uppercase">{beat.atmosphere}</span>
                            </div>
                          )}
                          
                          {editingBeatIndex !== i && beat.posture && (
                            <div className="flex items-center gap-1.5 bg-blue-50 text-blue-600 px-3 py-1 rounded-lg border border-blue-100">
                              <Move className="w-3 h-3" />
                              <span className="text-[10px] font-bold uppercase">{beat.posture}</span>
                            </div>
                          )}
                          
                          {editingBeatIndex !== i && beat.timeOfDay && (
                            <div className="flex items-center gap-1.5 bg-amber-50 text-amber-600 px-3 py-1 rounded-lg border border-amber-100">
                              <Clock className="w-3 h-3" />
                              <span className="text-[10px] font-bold uppercase">{beat.timeOfDay}</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {editingBeatIndex === i ? (
                            <>
                              <button 
                                onClick={() => handleUpdateBeat(i)}
                                className="p-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors shadow-sm"
                                title="Lưu thay đổi"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => { setEditingBeatIndex(null); setEditingBeatData(null); }}
                                className="p-2 bg-slate-200 text-slate-600 rounded-xl hover:bg-slate-300 transition-colors shadow-sm"
                                title="Hủy"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button 
                                onClick={() => { setEditingBeatIndex(i); setEditingBeatData(beat); }}
                                className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                                title="Chỉnh sửa"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDeleteBeat(i)}
                                className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                                title="Xóa Beat"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleAddBeat(i)}
                                className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                                title="Thêm Beat sau"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setProject(prev => lockBeatFields(prev, beatId, BEAT_SOURCE_FIELDS))}
                                className={`p-2 rounded-xl transition-all shadow-sm ${hasLockedSource ? 'bg-amber-100 text-amber-700' : 'bg-slate-50 text-slate-500 hover:bg-amber-500 hover:text-white'}`}
                                title="Lock all source fields for this beat"
                              >
                                {hasLockedSource ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {editingBeatIndex === i ? (
                        <div className="space-y-4">
                          <div>
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Văn bản gốc (Original Text)</label>
                            <p className="mb-2 text-[10px] font-semibold text-slate-400">Original Text nên là đoạn gốc ngắn tương ứng với 1 ảnh.</p>
                            <textarea 
                              value={editingBeatData.originalText || ''}
                              onChange={(e) => setEditingBeatData({...editingBeatData, originalText: e.target.value})}
                              className="w-full text-sm text-slate-800 leading-relaxed italic border-l-4 border-indigo-200 pl-4 py-2 bg-slate-50 rounded-r-xl outline-none min-h-[80px]"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Bối cảnh & Hành động (Analysis)</label>
                            <textarea 
                              value={editingBeatData.actionAnalysis || editingBeatData.analysis || editingBeatData.action || editingBeatData.summary || ''}
                              onChange={(e) => setEditingBeatData({...editingBeatData, actionAnalysis: e.target.value})}
                              className="w-full text-xs text-slate-500 leading-relaxed p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none min-h-[60px]"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Tư thế (Posture)</label>
                              <input 
                                type="text"
                                value={editingBeatData.posture || ''}
                                onChange={(e) => setEditingBeatData({...editingBeatData, posture: e.target.value})}
                                placeholder="Đứng, ngồi, chạy..."
                                className="w-full text-xs text-slate-600 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Thời điểm (Time of Day)</label>
                              <input 
                                type="text"
                                value={editingBeatData.timeOfDay || ''}
                                onChange={(e) => setEditingBeatData({...editingBeatData, timeOfDay: e.target.value})}
                                placeholder="Early Morning, Night..."
                                className="w-full text-xs text-slate-600 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {hasLongOriginalText && (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-relaxed text-amber-800">
                              Beat này có originalText vượt 80 từ. Nên regenerate Beat Analysis chi tiết hơn để mỗi beat chỉ là một khoảnh khắc có thể vẽ.
                            </div>
                          )}
                          <p className="text-slate-800 text-sm leading-relaxed italic border-l-4 border-indigo-200 pl-4 mb-4">{beat.originalText || beat.text || beat}</p>
                          {(beat.actionAnalysis || beat.analysis) && (
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                              <p className="text-slate-500 text-xs leading-relaxed">
                                <span className="font-black text-[9px] uppercase tracking-wider text-slate-400 block mb-1">Bối cảnh & Hành động</span>
                                {beat.actionAnalysis || beat.analysis}
                              </p>
                            </div>
                          )}
                          {(beat.summary || beat.locationName || beat.locationId || beat.locationState || beat.charactersInvolved?.length || beat.interaction || beat.props?.length || beat.visualFocus) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {beat.summary && (
                                <div className="bg-white p-3 rounded-xl border border-slate-100">
                                  <span className="font-black text-[9px] uppercase tracking-wider text-slate-400 block mb-1">Summary</span>
                                  <p className="text-xs text-slate-600 leading-relaxed">{beat.summary}</p>
                                </div>
                              )}
                              {beat.locationName && (
                                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                                  <span className="font-black text-[9px] uppercase tracking-wider text-emerald-500 block mb-1">Location</span>
                                  <p className="text-xs font-bold text-emerald-700">{beat.locationName}</p>
                                  {beat.locationId && <p className="text-[10px] text-emerald-600 mt-1">{beat.locationId}</p>}
                                  {beat.locationState && <p className="text-[10px] text-emerald-700 mt-1 leading-relaxed">{beat.locationState}</p>}
                                </div>
                              )}
                              {beat.charactersInvolved?.length > 0 && (
                                <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                                  <span className="font-black text-[9px] uppercase tracking-wider text-indigo-500 block mb-1">Characters</span>
                                  <p className="text-xs font-bold text-indigo-700">{beat.charactersInvolved.join(', ')}</p>
                                </div>
                              )}
                              {beat.interaction && (
                                <div className="bg-amber-50 p-3 rounded-xl border border-amber-100">
                                  <span className="font-black text-[9px] uppercase tracking-wider text-amber-500 block mb-1">Interaction</span>
                                  <p className="text-xs text-amber-800 leading-relaxed">{beat.interaction}</p>
                                </div>
                              )}
                              {beat.props?.length > 0 && (
                                <div className="bg-rose-50 p-3 rounded-xl border border-rose-100">
                                  <span className="font-black text-[9px] uppercase tracking-wider text-rose-500 block mb-1">Props</span>
                                  <p className="text-xs font-bold text-rose-700">{beat.props.join(', ')}</p>
                                </div>
                              )}
                              {beat.visualFocus && (
                                <div className="bg-cyan-50 p-3 rounded-xl border border-cyan-100">
                                  <span className="font-black text-[9px] uppercase tracking-wider text-cyan-500 block mb-1">Visual Focus</span>
                                  <p className="text-xs text-cyan-800 leading-relaxed">{beat.visualFocus}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Add Button between beats */}
                    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleAddBeat(i)}
                        className="bg-emerald-500 text-white p-1.5 rounded-full shadow-lg hover:scale-110 transition-transform flex items-center gap-1 px-3"
                      >
                        <Plus className="w-3 h-3" />
                        <span className="text-[9px] font-black">THÊM BEAT</span>
                      </button>
                    </div>
                  </div>
                );
                })}
                
                {analysisBeats.length === 0 && (
                  <div className="text-center py-12 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                    <p className="text-slate-400 text-sm mb-4">Chưa có nhịp truyện nào được tạo.</p>
                    <button 
                      onClick={() => handleAddBeat(-1)}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black hover:bg-indigo-700 transition-all shadow-md"
                    >
                      <Plus className="w-4 h-4" /> TẠO BEAT ĐẦU TIÊN
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        );
      }

      case ProductionStage.CHARACTER_LOCATION:
        if (!production.characterLocationAnalysis) {
          return (
            <div className="flex flex-col items-center justify-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-400">Chưa có dữ liệu phân tích</h3>
              <p className="text-slate-400 text-sm mt-1 max-w-xs text-center">
                Thông tin nhân vật và bối cảnh sẽ hiển thị tại đây sau khi bạn hoàn thành bước "Phân tích nội dung".
              </p>
            </div>
          );
        }
        return (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                <div>
                  <span className="text-sm font-bold text-slate-800">Character & Location Image Prompts</span>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    Export all reference prompts for Characters and Locations into one TXT file.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleExportCharacterLocationImagePrompts}
                className="inline-flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-600 shadow-sm transition-all hover:bg-indigo-600 hover:text-white"
              >
                <Download className="w-3.5 h-3.5" /> Export Image Prompt
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {parsed.characters && (
              <div className="space-y-4">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Users className="w-4 h-4" /> Characters</h3>
                {parsed.characters.map((char: any, i: number) => {
                  const projectChar = getProjectCharacter(char);
                  const characterKey = projectChar.characterId || char.characterId || char.name;

                  return (
                  <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 px-2 text-[10px] font-black text-indigo-600 ring-1 ring-indigo-100">
                          #{i + 1}
                        </span>
                        <div className="min-w-0">
                          <h4 className="font-bold text-indigo-600">{char.name}</h4>
                          <div className="mt-1">{renderLockSummary(projectChar)}</div>
                        </div>
                      </div>
                      {characterKey && (
                        <button
                          onClick={() => setProject(prev => lockCharacterFields(prev, characterKey, CHARACTER_APPEARANCE_FIELDS))}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-600 hover:text-white transition-colors"
                          title="Lock character appearance fields"
                        >
                          <Lock className="w-3 h-3" /> Lock appearance
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
                      <div className="text-slate-400 uppercase">Gender</div>
                      <div className="text-slate-700 font-medium">{char.gender || 'N/A'}</div>
                      <div className="text-slate-400 uppercase">Age/Height</div>
                      <div className="text-slate-700 font-medium">{char.age || 'N/A'} / {char.height || 'N/A'}</div>
                      <div className="text-slate-400 uppercase">Hair/Eyes</div>
                      <div className="text-slate-700 font-medium">{char.hair || 'N/A'} / {char.eyes || 'N/A'}</div>
                      <div className="text-slate-400 uppercase col-span-2 mt-1">Face Details</div>
                      <div className="text-slate-600 col-span-2 italic">{char.face || 'N/A'}</div>
                      <div className="text-slate-400 uppercase col-span-2 mt-1">Outfit</div>
                      <div className="text-slate-600 col-span-2 italic">{char.outfit || 'N/A'}</div>
                      {Array.isArray(char.accessories) && char.accessories.length > 0 && (
                        <>
                          <div className="text-slate-400 uppercase col-span-2 mt-1">Accessories</div>
                          <div className="text-slate-600 col-span-2 italic">{char.accessories.join(', ')}</div>
                        </>
                      )}
                      {Array.isArray(char.props) && char.props.length > 0 && (
                        <>
                          <div className="text-slate-400 uppercase col-span-2 mt-1">Props</div>
                          <div className="text-slate-600 col-span-2 italic">{char.props.join(', ')}</div>
                        </>
                      )}
                      {Array.isArray(char.colorPalette) && char.colorPalette.length > 0 && (
                        <>
                          <div className="text-slate-400 uppercase col-span-2 mt-1">Color Palette</div>
                          <div className="text-slate-600 col-span-2 italic">{char.colorPalette.join(', ')}</div>
                        </>
                      )}
                    </div>
                    <div className="mt-4 bg-slate-900 rounded-lg p-3 relative group/char">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Generated Reference Prompt</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => copyToClipboard(buildCharacterReferenceSheetPrompt(char, getSelectedStylePrompt()))}
                            className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            title="Copy reference sheet prompt"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => openCharacterReferenceSheetPrompt(char)}
                            className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            title="Open reference sheet prompt"
                          >
                            <Eye className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <p className="text-[10px] font-mono text-indigo-100 leading-tight line-clamp-3">
                        Character reference sheet with turnaround views, expression grid, head details, pose variations, hand gestures, wardrobe/accessory panels, prop reference, and color palette.
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => openCharacterReferenceSheetPrompt(char)}
                          className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-indigo-500 transition-colors"
                        >
                          <Sparkles className="w-3 h-3" /> Generate Reference Sheet Prompt
                        </button>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(buildCharacterReferenceSheetPrompt(char, getSelectedStylePrompt()))}
                          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-100 hover:bg-white/20 hover:text-white transition-colors"
                          title="Copy Character Reference Sheet Prompt"
                        >
                          <Copy className="w-3 h-3" /> Copy
                        </button>
                      </div>
                    </div>
                  </div>
                );
                })}
              </div>
            )}
            {parsed.locations && (
              <div className="space-y-4">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Layout className="w-4 h-4" /> Locations</h3>
                {parsed.locations.map((loc: any, i: number) => {
                  const projectLoc = getProjectLocation(loc);
                  const locationKey = projectLoc.locationId || loc.locationId || loc.name;

                  return (
                  <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 px-2 text-[10px] font-black text-emerald-600 ring-1 ring-emerald-100">
                          #{i + 1}
                        </span>
                        <div className="min-w-0">
                          <h4 className="font-bold text-emerald-600">{loc.name}</h4>
                          <div className="mt-1">{renderLockSummary(projectLoc)}</div>
                        </div>
                      </div>
                      {locationKey && (
                        <button
                          onClick={() => setProject(prev => lockLocationFields(prev, locationKey, LOCATION_CONTINUITY_FIELDS))}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest text-emerald-600 hover:bg-emerald-600 hover:text-white transition-colors"
                          title="Lock location continuity fields"
                        >
                          <Lock className="w-3 h-3" /> Lock continuity
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed mb-3">{loc.description || loc.details || JSON.stringify(loc)}</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] mb-4">
                      {loc.layout && (
                        <>
                          <div className="text-slate-400 uppercase col-span-2 mt-1">Layout</div>
                          <div className="text-slate-600 col-span-2 italic">{loc.layout}</div>
                        </>
                      )}
                      {Array.isArray(loc.keyObjects) && loc.keyObjects.length > 0 && (
                        <>
                          <div className="text-slate-400 uppercase col-span-2 mt-1">Key Objects</div>
                          <div className="text-slate-600 col-span-2 italic">{loc.keyObjects.join(', ')}</div>
                        </>
                      )}
                      {loc.lighting && (
                        <>
                          <div className="text-slate-400 uppercase">Lighting</div>
                          <div className="text-slate-700 font-medium">{loc.lighting}</div>
                        </>
                      )}
                      {Array.isArray(loc.colorPalette) && loc.colorPalette.length > 0 && (
                        <>
                          <div className="text-slate-400 uppercase">Palette</div>
                          <div className="text-slate-700 font-medium">{loc.colorPalette.join(', ')}</div>
                        </>
                      )}
                      {loc.baseState && (
                        <>
                          <div className="text-slate-400 uppercase col-span-2 mt-1">Base State</div>
                          <div className="text-slate-600 col-span-2 italic">{loc.baseState}</div>
                        </>
                      )}
                    </div>
                    <div className="bg-slate-900 rounded-lg p-3 relative group/loc">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">Generated Location Reference Prompt</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => copyToClipboard(buildLocationReferenceSheetPrompt(loc, getSelectedStylePrompt()))}
                            className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            title="Copy location reference sheet prompt"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => openLocationReferenceSheetPrompt(loc)}
                            className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            title="Open location reference sheet prompt"
                          >
                            <Eye className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <p className="text-[10px] font-mono text-emerald-100 leading-tight line-clamp-3">
                        Location reference sheet with establishing view, side views, top-down layout, key object close-ups, lighting reference, and fixed spatial continuity.
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => openLocationReferenceSheetPrompt(loc)}
                          className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-emerald-500 transition-colors"
                        >
                          <Sparkles className="w-3 h-3" /> Generate Location Reference Prompt
                        </button>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(buildLocationReferenceSheetPrompt(loc, getSelectedStylePrompt()))}
                          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-100 hover:bg-white/20 hover:text-white transition-colors"
                          title="Copy Location Reference Sheet Prompt"
                        >
                          <Copy className="w-3 h-3" /> Copy
                        </button>
                      </div>
                    </div>
                  </div>
                );
                })}
              </div>
            )}
            </div>
          </div>
        );

      case ProductionStage.SCREEN_CONTINUITY: {
        const screenContinuityScreens = normalizeScreenContinuity(parsed);
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-indigo-600" />
                <span className="text-sm font-bold text-slate-800">Thiết lập bối cảnh (Screen Continuity)</span>
              </div>
              <button
                onClick={() => setShowAnalysisJson(prev => !prev)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border shadow-sm flex items-center gap-2 ${showAnalysisJson ? 'bg-slate-900 text-white border-slate-900' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border-indigo-100'}`}
              >
                <Code2 className="w-3.5 h-3.5" /> {showAnalysisJson ? 'Ẩn JSON' : 'Xem JSON'}
              </button>
            </div>

            <ScreenContinuityView screens={screenContinuityScreens} />

            {showAnalysisJson && (
              <div className="rounded-3xl border border-slate-200 bg-slate-950 p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Debug JSON</p>
                    <h3 className="text-sm font-black text-white">Raw screenContinuity</h3>
                  </div>
                  <button
                    onClick={() => copyToClipboard(JSON.stringify(parsed, null, 2))}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/20"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy JSON
                  </button>
                </div>
                <pre className="max-h-[520px] overflow-auto rounded-2xl bg-black/30 p-4 text-xs leading-relaxed text-emerald-300 font-mono">
                  {JSON.stringify(parsed, null, 2)}
                </pre>
              </div>
            )}
          </div>
        );
      }

      case ProductionStage.BEAT_MOMENT: {
        const beatDetails = parsed.beatDetails || [];
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2">
                <Table className="w-5 h-5 text-indigo-600" />
                <span className="text-sm font-bold text-slate-800">Chi tiết hành động (Beat Moment Details)</span>
              </div>
              <button
                onClick={() => setShowAnalysisJson(prev => !prev)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border shadow-sm flex items-center gap-2 ${showAnalysisJson ? 'bg-slate-900 text-white border-slate-900' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border-indigo-100'}`}
              >
                <Code2 className="w-3.5 h-3.5" /> {showAnalysisJson ? 'Ẩn JSON' : 'Xem JSON'}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {beatDetails.map((beat: any, i: number) => (
                <div key={beat.beatId || i} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
                  <div className="bg-slate-50 px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <span className="bg-indigo-600 text-white text-[10px] font-black px-3 py-1 rounded-lg uppercase shadow-sm">
                        Beat {beat.beatId || (i + 1)}
                      </span>
                      {beat.screenId && (
                        <span className="bg-sky-50 text-sky-700 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-sky-100">
                          Screen: {beat.screenId}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="p-6 space-y-6">
                    {beat.originalText && (
                      <div className="space-y-1">
                        <span className="font-black text-[9px] uppercase tracking-wider text-slate-400 block">Nội dung gốc</span>
                        <p className="text-sm text-slate-600 italic border-l-2 border-slate-200 pl-4">{beat.originalText}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {beat.posture && (
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <span className="font-black text-[9px] uppercase tracking-wider text-slate-400 block mb-1">Tư thế chung</span>
                          <p className="text-xs text-slate-700 font-semibold">{beat.posture}</p>
                        </div>
                      )}
                      {beat.interaction && (
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 col-span-2">
                          <span className="font-black text-[9px] uppercase tracking-wider text-slate-400 block mb-1">Tương tác</span>
                          <p className="text-xs text-slate-700 font-semibold">{beat.interaction}</p>
                        </div>
                      )}
                    </div>

                    {Array.isArray(beat.props) && beat.props.length > 0 && (
                      <div>
                        <span className="font-black text-[9px] uppercase tracking-wider text-slate-400 block mb-2">Đạo cụ trong cảnh</span>
                        <div className="flex flex-wrap gap-2">
                          {beat.props.map((p: string) => (
                            <span key={p} className="bg-rose-50 text-rose-700 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-rose-100">
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {Array.isArray(beat.characterMomentDetails) && beat.characterMomentDetails.length > 0 && (
                      <div className="space-y-3 pt-3 border-t border-slate-100">
                        <span className="font-black text-[9px] uppercase tracking-wider text-indigo-500 block">Chi tiết nhân vật tại Beat</span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {beat.characterMomentDetails.map((c: any, ci: number) => (
                            <div key={c.characterId || c.characterName || ci} className="bg-slate-50/50 p-4 rounded-xl border border-slate-200/60 hover:bg-white hover:shadow-sm transition-all">
                              <h5 className="font-bold text-indigo-600 text-xs mb-3">{c.characterName || c.characterId}</h5>
                              <div className="space-y-2.5 text-[11px]">
                                {Array.isArray(c.visibleAccessories) && c.visibleAccessories.length > 0 && (
                                  <div className="flex items-start gap-2">
                                    <span className="text-slate-400 uppercase font-black tracking-wider w-24 flex-shrink-0">Phụ kiện hiển thị:</span>
                                    <div className="flex flex-wrap gap-1">
                                      {c.visibleAccessories.map((acc) => (
                                        <span key={acc} className="bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded border border-indigo-100">
                                          {acc}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {Array.isArray(c.handheldItems) && c.handheldItems.length > 0 && (
                                  <div className="flex items-start gap-2">
                                    <span className="text-slate-400 uppercase font-black tracking-wider w-24 flex-shrink-0">Vật cầm tay:</span>
                                    <div className="flex flex-wrap gap-1">
                                      {c.handheldItems.map((item) => (
                                        <span key={item} className="bg-rose-50 text-rose-700 font-semibold px-2 py-0.5 rounded border border-rose-100">
                                          {item}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {((Array.isArray(c.accessoriesChange) && c.accessoriesChange.length > 0) || (typeof c.accessoriesChange === 'string' && c.accessoriesChange.trim())) && (
                                  <div className="flex items-start gap-2">
                                    <span className="text-slate-400 uppercase font-black tracking-wider w-24 flex-shrink-0">Thay đổi phụ kiện:</span>
                                    <div className="flex flex-wrap gap-1">
                                      {Array.isArray(c.accessoriesChange) ? (
                                        c.accessoriesChange.map((change) => (
                                          <span key={change} className="bg-amber-50 text-amber-700 font-semibold px-2 py-0.5 rounded border border-amber-100">
                                            {change}
                                          </span>
                                        ))
                                      ) : (
                                        <span className="text-amber-700 font-semibold">{c.accessoriesChange}</span>
                                      )}
                                    </div>
                                  </div>
                                )}
                                {c.momentNotes && (
                                  <div className="flex items-start gap-2">
                                    <span className="text-slate-400 uppercase font-black tracking-wider w-24 flex-shrink-0">Ghi chú khoảnh khắc:</span>
                                    <span className="text-slate-600 font-medium italic">{c.momentNotes}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {beatDetails.length === 0 && (
                <div className="text-center py-12 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                  <p className="text-slate-400 text-sm">Chưa có thông tin chi tiết hành động nào.</p>
                </div>
              )}
            </div>

            {showAnalysisJson && (
              <div className="rounded-3xl border border-slate-200 bg-slate-950 p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Debug JSON</p>
                    <h3 className="text-sm font-black text-white">Raw beatMomentDetails</h3>
                  </div>
                  <button
                    onClick={() => copyToClipboard(JSON.stringify(parsed, null, 2))}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/20"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy JSON
                  </button>
                </div>
                <pre className="max-h-[520px] overflow-auto rounded-2xl bg-black/30 p-4 text-xs leading-relaxed text-emerald-300 font-mono">
                  {JSON.stringify(parsed, null, 2)}
                </pre>
              </div>
            )}
          </div>
        );
      }

      case ProductionStage.STORYBOARD: {
        const panels = normalizeStoryboardPanels(parsed);
        let sourceBeats: any[] = [];
        try {
          sourceBeats = production.analysis ? (getAnalysisBeatsFromParsed(JSON.parse(production.analysis)) || []) : [];
        } catch {}
        return (
          <div class="space-y-6">
            <div className="flex items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-indigo-600" />
                <span className="text-sm font-bold text-slate-800">Beat Analysis Export</span>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleExportSRT}
                  className="px-4 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-emerald-100 shadow-sm flex items-center gap-2"
                >
                  <Download className="w-3.5 h-3.5" /> Export SRT
                </button>
                <button 
                  onClick={handleExportTXT}
                  className="px-4 py-2 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-slate-100 shadow-sm flex items-center gap-2"
                >
                  <Download className="w-3.5 h-3.5" /> Export TXT
                </button>
              </div>
            </div>
            {panels.length ? panels.map((panel: any, i: number) => {
              const source = getPanelSourceFields(panel, sourceBeats);
              return (
              <div key={i} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col md:flex-row">
                <div className="bg-slate-50 p-6 md:w-48 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-100">
                  <span className="text-[10px] font-black text-slate-400 uppercase mb-1">Beat</span>
                  <span className="text-4xl font-black text-slate-200">{panel.beatId || panel.panelNumber || i + 1}</span>
                </div>
                <div className="p-6 flex-1 space-y-4">
                  <div>
                    <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Original Text</h4>
                    <p className="text-xs text-slate-600 italic">{source.originalText || 'N/A'}</p>
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Approved Beat Source</h4>
                    <p className="text-sm text-slate-800 leading-relaxed">{source.action || source.summary || 'N/A'}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold">
                      <span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-100">{source.timeOfDay}</span>
                      <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">{source.location}</span>
                      {source.visibleCharacters.map((name: string) => (
                        <span key={name} className="px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">{name}</span>
                      ))}
                    </div>
                  </div>
                  {(panel.shotType || panel.cameraAngle || panel.cameraDistance || panel.lensFeel || panel.framing || panel.composition || panel.lightingDirection || panel.lighting) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                      {panel.shotType && <div className="bg-slate-50 rounded-xl p-3"><span className="block text-slate-400 uppercase font-black mb-1">Shot</span>{panel.shotType}</div>}
                      {panel.cameraAngle && <div className="bg-slate-50 rounded-xl p-3"><span className="block text-slate-400 uppercase font-black mb-1">Camera</span>{panel.cameraAngle}</div>}
                      {panel.cameraDistance && <div className="bg-slate-50 rounded-xl p-3"><span className="block text-slate-400 uppercase font-black mb-1">Distance</span>{panel.cameraDistance}</div>}
                      {panel.lensFeel && <div className="bg-slate-50 rounded-xl p-3"><span className="block text-slate-400 uppercase font-black mb-1">Lens</span>{panel.lensFeel}</div>}
                      {panel.framing && <div className="bg-slate-50 rounded-xl p-3"><span className="block text-slate-400 uppercase font-black mb-1">Framing</span>{panel.framing}</div>}
                      {panel.composition && <div className="bg-slate-50 rounded-xl p-3"><span className="block text-slate-400 uppercase font-black mb-1">Composition</span>{panel.composition}</div>}
                      {(panel.lightingDirection || panel.lighting) && <div className="bg-slate-50 rounded-xl p-3"><span className="block text-slate-400 uppercase font-black mb-1">Lighting Direction</span>{panel.lightingDirection || panel.lighting}</div>}
                    </div>
                  )}
                  {(panel.foreground || panel.midground || panel.background || panel.depthAndPerspective || panel.visualEmphasis || panel.cameraNotes) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                      {panel.foreground && <div className="bg-white rounded-xl p-3 border border-slate-100"><span className="block text-slate-400 uppercase font-black mb-1">Foreground</span>{panel.foreground}</div>}
                      {panel.midground && <div className="bg-white rounded-xl p-3 border border-slate-100"><span className="block text-slate-400 uppercase font-black mb-1">Midground</span>{panel.midground}</div>}
                      {panel.background && <div className="bg-white rounded-xl p-3 border border-slate-100"><span className="block text-slate-400 uppercase font-black mb-1">Background</span>{panel.background}</div>}
                      {panel.depthAndPerspective && <div className="bg-white rounded-xl p-3 border border-slate-100"><span className="block text-slate-400 uppercase font-black mb-1">Depth</span>{panel.depthAndPerspective}</div>}
                      {panel.visualEmphasis && <div className="bg-white rounded-xl p-3 border border-slate-100"><span className="block text-slate-400 uppercase font-black mb-1">Emphasis</span>{panel.visualEmphasis}</div>}
                      {panel.cameraNotes && <div className="bg-white rounded-xl p-3 border border-slate-100"><span className="block text-slate-400 uppercase font-black mb-1">Camera Notes</span>{panel.cameraNotes}</div>}
                    </div>
                  )}
                  {Array.isArray(panel.characterBlocking) && panel.characterBlocking.length > 0 && (
                    <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                      <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-3">Character Blocking</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {panel.characterBlocking.map((item: any, blockIndex: number) => (
                          <div key={blockIndex} className="bg-white rounded-lg p-3 text-[11px] text-slate-600 border border-indigo-100">
                            <p className="font-black text-indigo-700 mb-1">{item.characterName || item.characterId || 'Character'}</p>
                            <p>{[item.framePosition, item.bodyPosition, item.facingDirection, item.expression, item.poseRefinement].filter(Boolean).join(', ')}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}) : <div className="text-slate-800 text-sm whitespace-pre-wrap">{JSON.stringify(parsed, null, 2)}</div>}
          </div>
        );
      }

      case ProductionStage.PROMPTS:
        const prompts = normalizeEngineerPrompts(parsed);

        if (prompts.length === 0) {
          return (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
              <h3 className="text-sm font-black uppercase tracking-widest">Khong tim thay engineerPrompts[]</h3>
              <p className="mt-2 text-sm leading-relaxed">
                Prompt Engineering JSON nen co dang object voi engineerPrompts[], hoac mot mang cac object co beatId va visualPrompt.
              </p>
            </div>
          );
        }

        return (
          <div className="grid grid-cols-1 gap-6">
            {prompts.map((item, i) => {
              const beatId = item.beatId || i + 1;
              const visualPrompt = item.visualPrompt || "";

              return (
                <div key={`beat-${beatId}`} className="group bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300">
                  <div className="flex flex-col lg:flex-row">
                    <div className="lg:w-32 bg-slate-50 p-6 flex flex-col items-center justify-center border-b lg:border-b-0 lg:border-r border-slate-100 group-hover:bg-indigo-50 transition-colors">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Beat</span>
                      <span className="text-2xl font-black text-slate-300 group-hover:text-indigo-300 transition-colors">{beatId}</span>
                    </div>
                    <div className="flex-1 p-6">
                      <div className="bg-slate-900 rounded-xl p-6 relative group/inner shadow-2xl">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-3 bg-indigo-500 rounded-full"></div>
                            <h4 className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em]">Visual Prompt</h4>
                          </div>
                          <button
                            onClick={() => copyToClipboard(visualPrompt)}
                            disabled={!visualPrompt}
                            className="opacity-0 group-hover/inner:opacity-100 transition-opacity text-white/50 hover:text-white disabled:opacity-20 disabled:hover:text-white/50 flex items-center gap-2 text-[10px] font-bold"
                          >
                            <Copy className="w-3.5 h-3.5" /> SAO CHEP
                          </button>
                        </div>
                        <p className="text-[11px] font-mono text-indigo-50 leading-relaxed pr-6 whitespace-pre-wrap">
                          {visualPrompt || "No visual prompt found."}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );

        return (
          <div className="grid grid-cols-1 gap-6">
            {Array.isArray(parsed) ? parsed.map((item: any, i: number) => (
              <div key={i} className="group bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300">
                <div className="flex flex-col lg:flex-row">
                  <div className="lg:w-32 bg-slate-50 p-6 flex flex-col items-center justify-center border-b lg:border-b-0 lg:border-r border-slate-100 group-hover:bg-indigo-50 transition-colors">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Beat</span>
                    <span className="text-2xl font-black text-slate-300 group-hover:text-indigo-300 transition-colors">{item.beatId || item.panelNumber || i + 1}</span>
                  </div>
                  <div className="flex-1 p-6 space-y-6">
                    {/* Hiển thị metadata theo hàng ngang nếu có dữ liệu */}
                    {(item.cameraAngle || item.framing || item.subject || item.action) && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {item.cameraAngle && (
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <span className="text-[8px] font-black text-slate-400 uppercase block mb-1">Góc máy</span>
                            <p className="text-[10px] font-bold text-slate-700">{item.cameraAngle}</p>
                          </div>
                        )}
                        {item.framing && (
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <span className="text-[8px] font-black text-slate-400 uppercase block mb-1">Bố cục</span>
                            <p className="text-[10px] font-bold text-slate-700">{item.framing}</p>
                          </div>
                        )}
                        {item.subject && (
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <span className="text-[8px] font-black text-slate-400 uppercase block mb-1">Chủ thể</span>
                            <p className="text-[10px] font-bold text-slate-700 line-clamp-1">{item.subject}</p>
                          </div>
                        )}
                        {item.action && (
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <span className="text-[8px] font-black text-slate-400 uppercase block mb-1">Hành động</span>
                            <p className="text-[10px] font-bold text-slate-700 line-clamp-1">{item.action}</p>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Visual Prompt chiếm hết chiều rộng */}
                    <div className="bg-slate-900 rounded-xl p-6 relative group/inner shadow-2xl">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-3 bg-indigo-500 rounded-full"></div>
                          <h4 className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em]">Visual Prompt</h4>
                        </div>
                        <button onClick={() => copyToClipboard(item.visualPrompt)} className="opacity-0 group-hover/inner:opacity-100 transition-opacity text-white/50 hover:text-white flex items-center gap-2 text-[10px] font-bold">
                          <Copy className="w-3.5 h-3.5" /> SAO CHÉP
                        </button>
                      </div>
                      <p className="text-[11px] font-mono text-indigo-50 leading-relaxed pr-6">{item.visualPrompt}</p>
                    </div>
                  </div>
                </div>
              </div>
            )) : null}
          </div>
        );

      default:
        return <div className="text-slate-800 text-sm whitespace-pre-wrap font-sans leading-relaxed">{JSON.stringify(parsed, null, 2)}</div>;
    }
  };

  const handleImportSavedChapter = useCallback(async (novelFolder: string, chapterFile: string) => {
    const isNextChapterFlow = !!(inputData.title.trim() && inputData.chapter.trim());
    try {
      const savedProject = await openStoryFlowProject(novelFolder, chapterFile);
      if (isNextChapterFlow) {
        const scriptToImport = savedProject.inputData?.script || '';
        setInputData(prev => ({
          ...prev,
          script: scriptToImport
        }));
        setToast({ message: "Đã nhập nội dung chương mới từ thư viện!", visible: true });
      } else {
        const restoredInputData = savedProject.inputData || { title: '', selectedStyle: 'manhua', chapter: '', chapterTitle: '', script: '' };
        const restoredProduction = savedProject.production || {};
        setInputData(restoredInputData);
        setProduction(restoredProduction);
        setProject(savedProject.storyFlowProject || hydrateStoryFlowProject(restoredInputData, restoredProduction, savedProject.storyFlowProject));
        setStage(savedProject.stage || ProductionStage.INPUT);
        setUnlockedStages(savedProject.unlockedStages || [ProductionStage.INPUT]);
        setStoryboardBatchIndex(savedProject.storyboardBatchIndex || 0);
        setIsManualMode(Boolean(savedProject.isManualMode));
        setIsGlobalManualMode(Boolean(savedProject.isGlobalManualMode));
        setToast({ message: "Đã tải dự án StoryFlow!", visible: true });
      }
      setShowLibraryModal(false);
    } catch (error) {
      console.error(error);
      setToast({ message: "Không thể nhập chương. Hãy kiểm tra server.", visible: true });
    }
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
  }, [inputData, stage]);

  const renderLibraryModal = () => {
    if (!showLibraryModal) return null;
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
        <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
          <div className="p-8 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-100 p-2 rounded-xl text-indigo-600"><Library className="w-6 h-6" /></div>
              <div>
                <h3 className="text-xl font-black text-slate-900">Thư viện dự án</h3>
                <p className="text-xs text-slate-500 font-medium">Chọn một dự án để nhập vào StoryFlow</p>
              </div>
            </div>
            <button onClick={() => { void refreshProjectLibrary(); }} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400" title="Làm mới thư viện"><RefreshCw className="w-5 h-5" /></button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-8">
            {isProjectLibraryLoading ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-4"></div>
                <p className="text-slate-500 text-sm">Đang tải thư viện từ thư mục projects...</p>
              </div>
            ) : savedProjectLibrary.novels.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mb-6"><Library className="w-10 h-10 text-slate-200" /></div>
                <h4 className="text-lg font-bold text-slate-900 mb-2">Thư viện trống</h4>
                <p className="text-slate-400 text-sm max-w-xs">Bạn chưa có dự án nào được lưu trong thư mục projects/.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {savedProjectLibrary.novels.map((novel) => {
                  const lastUpdated = novel.chapters.reduce((latest, current) => {
                    const currentTimestamp = new Date(current.updatedAt).getTime();
                    return currentTimestamp > latest ? currentTimestamp : latest;
                  }, 0);

                  return (
                    <div 
                      key={novel.folderName} 
                      className="group flex flex-col p-5 rounded-2xl border border-slate-100 hover:shadow-xl hover:shadow-indigo-50 transition-all text-left bg-white relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 px-3 py-1 text-[8px] font-black uppercase tracking-widest rounded-bl-xl bg-indigo-100 text-indigo-600">
                        STORYFLOW
                      </div>
                      <div className="flex items-start gap-4 mb-4">
                        <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600">
                          <Book className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-slate-900 line-clamp-1">{novel.title}</h4>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                            {novel.chapters.length} chương đã lưu
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar mb-4">
                        {novel.chapters.map((ch) => (
                          <button
                            key={ch.fileName}
                            onClick={() => handleImportSavedChapter(novel.folderName, ch.fileName)}
                            className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 transition-all border border-transparent hover:border-indigo-100 group/chapter"
                          >
                            <div className="flex flex-col items-start">
                              <span className="font-bold text-[11px]">Chương {ch.chapter}</span>
                              {ch.chapterTitle && (
                                <span className="text-[9px] opacity-70 line-clamp-1">{ch.chapterTitle}</span>
                              )}
                            </div>
                            <ChevronRight className="w-3 h-3 opacity-0 group-hover/chapter:opacity-100 transition-all" />
                          </button>
                        ))}
                      </div>

                      <div className="mt-auto flex items-center justify-between pt-3 border-t border-slate-50">
                        <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase">
                          <Clock className="w-3 h-3" />
                          {lastUpdated ? new Date(lastUpdated).toLocaleDateString('vi-VN') : 'Không rõ'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
            <button onClick={() => setShowLibraryModal(false)} className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-100 transition-all">Đóng</button>
          </div>
        </div>
      </div>
    );
  };

  const handleImportProject = (project: any, chapterIndex?: number) => {
    // Kiểm tra xem có phải đang trong luồng "Phân tích chương tiếp theo" không
    // (Đã có tiêu đề và số chương)
    const isNextChapterFlow = !!(inputData.title.trim() && inputData.chapter.trim());

    if (project.type === 'literary') {
      // Handle new multi-chapter structure
      if (project.chapters && Array.isArray(project.chapters) && project.chapters.length > 0) {
        // If a specific chapter index is provided, use it, otherwise use the latest
        const idx = chapterIndex !== undefined ? chapterIndex : project.chapters.length - 1;
        const chapter = project.chapters[idx];
        const scriptFromBlocks = chapter.blocks 
          ? chapter.blocks.map((b: any) => b.content).join('\n\n')
          : chapter.script || '';
        
        setInputData(prev => ({
          ...prev,
          title: isNextChapterFlow ? prev.title : (project.title || ''),
          chapter: isNextChapterFlow ? prev.chapter : (chapter.chapter || ''),
          chapterTitle: isNextChapterFlow ? prev.chapterTitle : (chapter.chapterTitle || ''),
          script: scriptFromBlocks,
        }));
      } else {
        // Handle legacy single-chapter structure
        const scriptFromBlocks = project.blocks 
          ? project.blocks.map((b: any) => b.content).join('\n\n')
          : project.inputData?.script || '';
        
        setInputData(prev => ({
          ...prev,
          title: isNextChapterFlow ? prev.title : (project.inputData?.title || ''),
          chapter: isNextChapterFlow ? prev.chapter : (project.inputData?.chapter || ''),
          chapterTitle: isNextChapterFlow ? prev.chapterTitle : (project.inputData?.chapterTitle || ''),
          script: scriptFromBlocks,
        }));
      }
      setToast({ message: isNextChapterFlow ? "Đã nhập nội dung chương mới từ LitStruct!" : "Đã nhập dữ liệu từ LitStruct Parser!", visible: true });
    } else {
      if (isNextChapterFlow) {
        // Nếu là dự án StoryFlow và đang ở luồng chương tiếp theo, cũng chỉ lấy script
        const scriptToImport = project.inputData?.script || '';
        setInputData(prev => ({
          ...prev,
          script: scriptToImport
        }));
        setToast({ message: "Đã nhập nội dung chương mới từ thư viện!", visible: true });
      } else {
        const nextInputData = project.inputData || { title: '', chapter: '', chapterTitle: '', script: '', selectedStyle: 'standard' };
        const nextProduction = project.production || {};
        const nextProject = hydrateStoryFlowProject(nextInputData, nextProduction, project.storyFlowProject);
        setInputData(nextInputData);
        setProduction(nextProduction);
        setProject(nextProject);
        setUnlockedStages(computeUnlockedStages(nextInputData, nextProduction, stage));
        setToast({ message: "Đã tải dự án StoryFlow!", visible: true });
      }
    }
    setShowLibraryModal(false);
    setShowLitLibraryModal(false);
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
  };

  const renderLitLibraryModal = () => {
    if (!showLitLibraryModal) return null;
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
        <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
          <div className="p-8 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-purple-100 p-2 rounded-xl text-purple-600"><Code2 className="w-6 h-6" /></div>
              <div>
                <h3 className="text-xl font-black text-slate-900">Thư viện LitStruct Parser</h3>
                <p className="text-xs text-slate-500 font-medium">Chọn một bản phân tích văn học để nhập nội dung vào StoryFlow</p>
              </div>
            </div>
            <button onClick={() => setShowLitLibraryModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400"><RefreshCw className="w-5 h-5" /></button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-8">
            {litProjects.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mb-6"><Code2 className="w-10 h-10 text-slate-200" /></div>
                <h4 className="text-lg font-bold text-slate-900 mb-2">Thư viện trống</h4>
                <p className="text-slate-400 text-sm max-w-xs">Bạn chưa có bản phân tích văn học nào được lưu ở LitStruct Parser.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {litProjects.map((project) => (
                  <div 
                    key={project.id} 
                    className="group flex flex-col p-5 rounded-2xl border border-slate-100 hover:shadow-xl hover:shadow-purple-50 transition-all text-left bg-white relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 px-3 py-1 text-[8px] font-black uppercase tracking-widest rounded-bl-xl bg-purple-100 text-purple-600">
                      LITSTRUCT PARSER
                    </div>
                    <div className="flex items-start gap-4 mb-4">
                      <div className="p-3 rounded-xl bg-purple-50 text-purple-600">
                        <Code2 className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-900 line-clamp-1">
                          {project.title || project.inputData?.title || 'Không có tiêu đề'}
                        </h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                          {project.chapters ? (
                            `${(project.chapters || []).length} chương đã phân tích`
                          ) : (
                            `${project.inputData?.chapter || '?'} ${project.inputData?.chapterTitle ? `| ${project.inputData.chapterTitle}` : ''}`
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar mb-4">
                      {project.chapters ? (
                        (project.chapters || []).map((chapter: any, idx: number) => (
                          <button
                            key={chapter.id}
                            onClick={() => handleImportProject(project, idx)}
                            className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-purple-50 text-slate-600 hover:text-purple-600 transition-all border border-transparent hover:border-purple-100 group/chapter"
                          >
                            <div className="flex flex-col items-start">
                              <span className="font-bold text-[11px]">Chương {chapter.chapter}</span>
                              {chapter.chapterTitle && (
                                <span className="text-[9px] opacity-70 line-clamp-1">{chapter.chapterTitle}</span>
                              )}
                            </div>
                            <ArrowRight className="w-3 h-3 opacity-0 group-hover/chapter:opacity-100 transition-all" />
                          </button>
                        ))
                      ) : (
                        <button
                          onClick={() => handleImportProject(project)}
                          className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-purple-50 text-slate-600 hover:text-purple-600 transition-all border border-transparent hover:border-purple-100 group/chapter"
                        >
                          <span className="font-bold text-[11px]">Nhập bản phân tích này</span>
                          <ArrowRight className="w-3 h-3 opacity-0 group-hover/chapter:opacity-100 transition-all" />
                        </button>
                      )}
                    </div>

                    <div className="mt-auto flex items-center justify-between pt-3 border-t border-slate-50">
                      <span className="text-[9px] font-bold text-slate-400">
                        {new Date(project.lastUpdated || project.timestamp).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
            <button onClick={() => setShowLitLibraryModal(false)} className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-100 transition-all">Đóng</button>
          </div>
        </div>
      </div>
    );
  };

  const renderConfirmModal = () => {
    if (!confirmModal.show) return null;
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white rounded-[32px] shadow-2xl max-w-sm w-full p-8 border border-slate-100 animate-in zoom-in duration-300">
          <div className="text-center">
            <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 ${confirmModal.type === 'danger' ? 'bg-rose-50 text-rose-500' : 'bg-indigo-50 text-indigo-500'}`}>
              {confirmModal.type === 'danger' ? <Trash2 className="w-10 h-10" /> : <ShieldCheck className="w-10 h-10" />}
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">{confirmModal.title}</h3>
            <p className="text-slate-500 text-sm leading-relaxed mb-8 px-2 font-medium">
              {confirmModal.message}
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}
                className="flex-1 py-4 px-6 rounded-2xl bg-slate-50 text-slate-500 font-black text-[11px] uppercase tracking-widest hover:bg-slate-100 transition-all border border-slate-100"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={confirmModal.onConfirm}
                className={`flex-1 py-4 px-6 rounded-2xl text-white font-black text-[11px] uppercase tracking-widest shadow-lg transition-all active:scale-95 ${confirmModal.type === 'danger' ? 'bg-rose-500 shadow-rose-200 hover:bg-rose-600' : 'bg-indigo-600 shadow-indigo-200 hover:bg-indigo-700'}`}
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAnalysisModeModal = () => {
    if (!showAnalysisModeModal) return null;
    const isPromptEngineeringStage = stage === ProductionStage.PROMPTS;
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
        <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 animate-in fade-in zoom-in duration-200">
          <div className="text-center mb-8">
            <div className="bg-indigo-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"><Zap className="w-8 h-8 text-indigo-600" /></div>
            <h3 className="text-2xl font-black text-slate-900">Chọn chế độ phân tích</h3>
          </div>
          <div className="space-y-4">
            <button onClick={() => startAnalysis('auto')} className="w-full p-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl transition-all group flex items-center gap-4 text-left shadow-lg shadow-indigo-200">
              <div className="bg-white/20 p-3 rounded-xl group-hover:scale-110 transition-transform"><Sparkles className="w-6 h-6" /></div>
              <div>
                <div className="font-bold text-lg">{isPromptEngineeringStage ? "Build visual prompts" : "Phân tích tự động"}</div>
                <div className="text-indigo-100 text-xs mt-0.5">{isPromptEngineeringStage ? "Local resolver from approved fields" : "Sử dụng Gemini"}</div>
              </div>
            </button>
            {!isPromptEngineeringStage && (
              <button onClick={() => startAnalysis('manual')} className="w-full p-6 bg-white border-2 border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/50 text-slate-700 rounded-2xl transition-all group flex items-center gap-4 text-left">
                <div className="bg-slate-100 p-3 rounded-xl group-hover:bg-indigo-100 group-hover:scale-110 transition-all"><Terminal className="w-6 h-6 text-slate-600 group-hover:text-indigo-600" /></div>
                <div>
                  <div className="font-bold text-lg text-slate-800">Phân tích thủ công</div>
                  <div className="text-slate-500 text-xs mt-0.5">Copy prompt và dán kết quả</div>
                </div>
              </button>
            )}
          </div>
          <button onClick={() => setShowAnalysisModeModal(false)} className="mt-6 w-full py-3 text-slate-400 font-bold hover:text-slate-600 transition-colors text-sm">Hủy bỏ</button>
        </div>
      </div>
    );
  };

  const deleteBook = (novelFolder: string, novelTitle: string) => {
    const novel = savedProjectLibrary.novels.find(n => n.folderName === novelFolder);
    if (!novel) return;

    setConfirmModal({
      show: true,
      title: 'Xóa toàn bộ bộ truyện',
      message: `Bạn có chắc chắn muốn xóa tất cả ${novel.chapters.length} chương và thư mục của bộ truyện "${novelTitle}" không?`,
      type: 'danger',
      onConfirm: async () => {
        try {
          await deleteStoryFlowNovel(novelFolder);
          await refreshProjectLibrary();
          setToast({ message: `Đã xóa bộ truyện "${novelTitle}" thành công!`, visible: true });
        } catch (err) {
          console.error(err);
          setToast({ message: "Lỗi khi xóa bộ truyện khỏi thư mục", visible: true });
        } finally {
          setConfirmModal(prev => ({ ...prev, show: false }));
          setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
        }
      }
    });
  };

  const renderLibraryView = () => (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
          <Library className="w-8 h-8 text-indigo-600" />
          Thư viện dự án
        </h2>
        <div className="text-sm font-bold text-slate-400 bg-slate-100 px-4 py-2 rounded-xl">
          {savedProjectLibrary.novels.length} bộ truyện đã lưu
        </div>
      </div>

      {savedProjectLibrary.novels.length === 0 ? (
        <div className="bg-white rounded-[40px] border-2 border-dashed border-slate-200 p-20 text-center">
          <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"><Library className="w-10 h-10 text-slate-300" /></div>
          <h4 className="text-lg font-bold text-slate-900 mb-2">Thư viện trống</h4>
          <p className="text-slate-500 mb-8 max-w-xs mx-auto text-sm">Hãy thực hiện phân tích và lưu lại để xây dựng thư viện của bạn.</p>
          <button onClick={() => setStage(ProductionStage.INPUT)} className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">Bắt đầu ngay</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto max-h-[calc(100vh-250px)] pr-2 custom-scrollbar">
          {savedProjectLibrary.novels.map((novel) => {
            const lastUpdated = novel.chapters.reduce((latest, current) => {
              const currentTimestamp = new Date(current.updatedAt).getTime();
              return currentTimestamp > latest ? currentTimestamp : latest;
            }, 0);

            return (
              <div 
                key={novel.folderName} 
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
                        deleteBook(novel.folderName, novel.title);
                      }}
                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <h3 className="font-black text-slate-800 text-lg mb-1 line-clamp-1">{novel.title}</h3>
                  <div className="text-slate-400 text-xs font-bold mb-4 uppercase tracking-widest">
                    {novel.chapters.length} chương đã phân tích
                  </div>
                  
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {novel.chapters.map((ch) => (
                      <div key={ch.fileName} className="group/chapter flex items-center gap-2">
                        <button
                          onClick={() => handleOpenSavedChapter(novel.folderName, ch.fileName)}
                          className="flex-1 flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 transition-all border border-transparent hover:border-indigo-100"
                        >
                          <div className="flex flex-col items-start text-left">
                            <span className="font-bold text-xs">Chương {ch.chapter}</span>
                            {ch.chapterTitle && (
                              <span className="text-[10px] opacity-70 line-clamp-1">{ch.chapterTitle}</span>
                            )}
                          </div>
                          <ChevronRight className="w-4 h-4 opacity-0 group-hover/chapter:opacity-100 transition-all" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSavedChapter(novel.folderName, ch.fileName);
                          }}
                          className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover/chapter:opacity-100"
                          title="Xóa chương này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <Clock className="w-3.5 h-3.5" />
                    Cập nhật: {lastUpdated ? new Date(lastUpdated).toLocaleDateString('vi-VN') : 'Không rõ'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderContent = () => {
    if (stage === ProductionStage.LIBRARY) return renderLibraryView();
    if (stage === ProductionStage.INPUT) return (
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Tên tiểu thuyết <span className="text-red-500">*</span></label>
            <input type="text" value={inputData.title} onChange={(e) => setInputData(prev => ({ ...prev, title: e.target.value }))} placeholder="Ví dụ: Tây Du Ký" className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Chương <span className="text-red-500">*</span></label>
            <input type="text" value={inputData.chapter} onChange={(e) => setInputData(prev => ({ ...prev, chapter: e.target.value }))} placeholder="Ví dụ: Chương 1" className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Tên chương</label>
            <input type="text" value={inputData.chapterTitle} onChange={(e) => setInputData(prev => ({ ...prev, chapterTitle: e.target.value }))} placeholder="Ví dụ: Đại náo Thiên cung" className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,text/plain"
            className="hidden"
            onChange={handleImportTxtFile}
          />
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              <label className="text-lg font-bold text-slate-800">Nội dung tiểu thuyết</label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl text-xs font-bold transition-all border border-indigo-100 shadow-sm"
              >
                <Download className="w-3.5 h-3.5" /> IMPORT TXT
              </button>

              <button 
                type="button"
                onClick={handlePasteFromClipboard}
                className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all border border-slate-200 shadow-sm"
              >
                <Copy className="w-3.5 h-3.5" /> PASTE
              </button>

              <button 
                type="button"
                onClick={handleClearText}
                className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl text-xs font-bold transition-all border border-rose-100 shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" /> CLEAR
              </button>

              <div className="h-6 w-[1px] bg-slate-200 mx-1 hidden md:block"></div>

              <button 
                type="button"
                onClick={() => setShowLitLibraryModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-600 hover:bg-purple-100 rounded-xl text-xs font-bold transition-all border border-purple-100 shadow-sm"
              >
                <Library className="w-3.5 h-3.5" /> Nhập từ LitStruct
              </button>
            </div>
          </div>
          <textarea value={inputData.script} onChange={(e) => setInputData(prev => ({ ...prev, script: e.target.value }))} placeholder="Dán đoạn trích tiểu thuyết của bạn vào đây hoặc lấy từ thư viện..." className="w-full h-80 p-5 border border-slate-200 rounded-xl bg-slate-50 text-sm leading-relaxed outline-none" />
          
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2 px-1">
            <div>
              {importedFileName && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full font-medium shadow-sm animate-fade-in">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                  Đã nhập: <strong className="font-bold">{importedFileName}</strong>
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <span>Số ký tự: <strong className="font-bold text-slate-700">{inputData.script.length.toLocaleString('vi-VN')}</strong></span>
              <span>Số từ: <strong className="font-bold text-slate-700">{(inputData.script.trim() ? inputData.script.trim().split(/\s+/).length : 0).toLocaleString('vi-VN')}</strong></span>
            </div>
          </div>
        </div>
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-6 w-full"><Palette className="w-5 h-5 text-indigo-600" /><label className="text-lg font-bold text-slate-800">Phong cách hình ảnh</label></div>
            <div className="w-full">
              <div className="flex flex-wrap justify-center gap-3">
                {STYLE_OPTIONS.map((s) => (
                  <button key={s.id} onClick={() => setInputData(prev => ({ ...prev, selectedStyle: s.id }))} className={`p-4 rounded-xl border-2 transition-all flex items-center justify-center min-h-[64px] w-[calc(50%-0.75rem)] md:w-[calc(33.33%-0.75rem)] lg:w-[calc(25%-0.75rem)] xl:w-[calc(16.66%-0.75rem)] ${inputData.selectedStyle === s.id ? "border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600 shadow-md" : "border-slate-100 hover:border-slate-200 hover:bg-slate-50"}`}>
                    <h4 className={`font-bold text-[13px] text-center leading-tight ${inputData.selectedStyle === s.id ? "text-indigo-700" : "text-slate-700"}`}>{s.label}</h4>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );

    const currentResult = stage === ProductionStage.ANALYSIS ? production.analysis 
                      : stage === ProductionStage.CHARACTER_LOCATION ? production.characterLocationAnalysis
                      : stage === ProductionStage.SCREEN_CONTINUITY ? production.screenContinuity
                      : stage === ProductionStage.BEAT_MOMENT ? production.beatMomentDetails
                      : stage === ProductionStage.STORYBOARD ? production.storyboard
                      : stage === ProductionStage.PROMPTS ? production.prompts
                      : production.finalResult;

    if (stage === ProductionStage.FINAL) return renderFinalBuilderView();

    if (stage === ProductionStage.STORYBOARD) {
      if (isManualMode || (isGlobalManualMode && !showStoryboardPreview)) return renderManualView();
    } else if (stage !== ProductionStage.PROMPTS && (isManualMode || (isGlobalManualMode && !currentResult))) {
      return renderManualView();
    }

    const missingPromptInputs = getPromptEngineeringMissingInputs(production);

    return (
      <div className="max-w-7xl mx-auto space-y-6">
        {stage === ProductionStage.PROMPTS && missingPromptInputs.length > 0 && (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900 shadow-sm flex flex-col gap-2">
            <div className="flex items-center gap-2 text-amber-800">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <p className="font-black uppercase tracking-wider text-[11px]">Cảnh báo thiếu dữ liệu đầu vào</p>
            </div>
            <p className="font-bold">Prompt Engineering chưa đủ dữ liệu nguồn.</p>
            <p className="mt-1">
              Còn thiếu các bước: <span className="font-mono font-bold text-indigo-600">{missingPromptInputs.join(", ")}</span>.
            </p>
            <p className="mt-1 text-xs text-amber-700 leading-relaxed">
              Resolver local cần các dữ liệu này để gom đúng location, character, screen lock, storyboard và beat moment thành visualPrompt cuối.
            </p>
          </div>
        )}
        {!currentResult && !isLoading && (!isGlobalManualMode || stage === ProductionStage.PROMPTS) ? (
          stage === ProductionStage.PROMPTS ? (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-12 text-center h-full flex flex-col items-center justify-center">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <Zap className="h-8 w-8" />
              </div>
              <h3 className="text-2xl font-black text-slate-900">Build visual prompts bằng local resolver</h3>
              <p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-slate-500">
                Bước này không gọi AI, không cần copy prompt và không cần dán JSON. App sẽ gom các field đã duyệt từ những bước trước để tạo `engineerPrompts[]`.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-16 text-center h-full flex flex-col items-center justify-center"><Send className="w-12 h-12 text-indigo-200 mb-6" /><h3 className="text-xl font-bold text-slate-900">Sẵn sàng phân tích</h3></div>
          )
        ) : (
          <div className="bg-slate-50/30 rounded-3xl">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center min-h-[400px] text-indigo-600 gap-4"><Loader2 className="w-12 h-12 animate-spin" /><p className="font-bold animate-pulse">{stage === ProductionStage.PROMPTS ? "Đang gom field bằng local resolver..." : "AI đang làm việc..."}</p></div>
            ) : (
              <StageRenderBoundary stage={stage} resetKey={String(currentResult || '')}>
                {renderDataView(currentResult, stage)}
              </StageRenderBoundary>
            )}
          </div>
        )}
      </div>
    );
  };

  const currentResult = stage === ProductionStage.ANALYSIS ? production.analysis 
                      : stage === ProductionStage.CHARACTER_LOCATION ? production.characterLocationAnalysis
                      : stage === ProductionStage.SCREEN_CONTINUITY ? production.screenContinuity
                      : stage === ProductionStage.BEAT_MOMENT ? production.beatMomentDetails
                      : stage === ProductionStage.STORYBOARD ? production.storyboard
                      : stage === ProductionStage.PROMPTS ? production.prompts
                      : production.finalResult;

  const isStoryboardBatchManualView = stage === ProductionStage.STORYBOARD
    && (isManualMode || (isGlobalManualMode && !showStoryboardPreview));
  const isPromptEngineeringAutoBuildPending = Boolean(
    promptEngineeringAutoBuildSignature &&
    autoPromptBuildSignatureRef.current !== promptEngineeringAutoBuildSignature
  );
  const isShowingManual = stage !== ProductionStage.FINAL
    && stage !== ProductionStage.PROMPTS
    && (
      isStoryboardBatchManualView ||
      (stage !== ProductionStage.STORYBOARD && (isManualMode || (isGlobalManualMode && !currentResult && stage !== ProductionStage.INPUT)))
    );
  const btn = isLoading ? { label: "Đang xử lý...", icon: <Loader2 className="w-5 h-5 animate-spin" />, color: "bg-indigo-600" } 
             : isShowingManual ? { label: "Xác nhận dữ liệu", icon: <CheckCircle2 className="w-5 h-5" />, color: "bg-emerald-600" }
             : stage === ProductionStage.INPUT ? { label: "Bắt đầu phân tích", icon: <Send className="w-5 h-5" />, color: "bg-indigo-600" }
             : stage === ProductionStage.FINAL && hasData(ProductionStage.FINAL) ? { label: "Dự án hoàn tất", icon: <CheckCircle2 className="w-5 h-5" />, color: "bg-emerald-600" }
             : stage === ProductionStage.FINAL ? { label: "Tổng hợp kết quả", icon: <Send className="w-5 h-5" />, color: "bg-indigo-600" }
             : stage === ProductionStage.PROMPTS ? { label: "Build visual prompts", icon: <Zap className="w-5 h-5" />, color: "bg-indigo-600" }
             : { label: isGlobalManualMode ? "Tiếp tục" : "Tiếp tục với AI", icon: <Send className="w-5 h-5" />, color: "bg-indigo-600" };

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
      {renderToast()}
      {renderConfirmModal()}
      {renderLibraryModal()}
      {renderLitLibraryModal()}
      {renderAnalysisModeModal()}
      {renderReferencePromptModal()}
      <div className="w-72 bg-slate-900 text-white h-screen fixed left-0 top-0 flex flex-col shadow-2xl z-50 border-r border-white/5">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-10">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-500/20"><Layout className="w-6 h-6 text-white" /></div>
            <div>
              <h1 className="text-xl font-black tracking-tight">StoryFlow</h1>
              <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div><span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">AI Production</span></div>
            </div>
          </div>
          <nav className="space-y-1.5 pt-4">
            <button onClick={() => {setStage(ProductionStage.LIBRARY); setIsManualMode(false);}} className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all duration-300 group ${stage === ProductionStage.LIBRARY ? "bg-indigo-600 shadow-xl shadow-indigo-600/20 text-white" : "text-slate-500 hover:bg-white/5 hover:text-slate-300"}`}>
              <div className={`p-1.5 rounded-lg transition-colors ${stage === ProductionStage.LIBRARY ? "bg-white/20" : "bg-slate-800 group-hover:bg-slate-700"}`}><Library className="w-4 h-4" /></div>
              <span className="truncate">Thư viện</span>
            </button>
            <div className="py-2"><div className="h-px bg-white/5 mx-4"></div></div>
            {steps.map((s, i) => {
              const isUnlocked = s.id === ProductionStage.INPUT || hasData(s.id) || stage === s.id || unlockedStages.includes(s.id);
              const workflowStatus = getWorkflowStatusForStage(s.id);
              
              return (
                <button 
                  key={s.id} 
                  onClick={() => {setStage(s.id); setIsManualMode(false);}} 
                  disabled={!isUnlocked} 
                  className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all duration-300 group ${stage === s.id ? "bg-indigo-600 shadow-xl shadow-indigo-600/20 text-white" : "text-slate-500 hover:bg-white/5 hover:text-slate-300 disabled:opacity-20 disabled:cursor-not-allowed"}`}
                >
                  <div className={`p-1.5 rounded-lg transition-colors ${stage === s.id ? "bg-white/20" : "bg-slate-800 group-hover:bg-slate-700"}`}><s.icon className="w-4 h-4" /></div>
                  <span className="truncate">{s.label}</span>
                  {workflowStatus && workflowStatus !== "not_started" && (
                    <span className={`ml-auto px-2 py-0.5 rounded-full border text-[8px] uppercase tracking-wide ${getWorkflowStatusClass(workflowStatus)}`}>
                      {workflowStatus.replace("_", " ")}
                    </span>
                  )}
                  {hasData(s.id) && stage !== s.id && <CheckCircle2 className={`w-3.5 h-3.5 text-emerald-500 ${workflowStatus && workflowStatus !== "not_started" ? "" : "ml-auto"}`} />}
                </button>
              );
            })}
          </nav>
        </div>
      </div>
      <main className="flex-1 ml-72 p-12 pb-40">
        <div className="max-w-7xl mx-auto">
          <header className="flex justify-between items-end mb-12">
            <div>
              <button 
                onClick={onBack}
                className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 font-bold text-xs uppercase tracking-widest mb-6 transition-colors group"
              >
                <div className="p-1 rounded-lg bg-slate-100 group-hover:bg-indigo-50 transition-colors">
                  <Home className="w-3.5 h-3.5" />
                </div>
                Về trang chủ
              </button>
              <div className="flex items-center gap-3 mb-3">{stage !== ProductionStage.LIBRARY && <span className="bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-200 shadow-sm">Bước {steps.findIndex(s => s.id === stage) + 1} / {steps.length}</span>}</div>
              <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-tight">{stage === ProductionStage.LIBRARY ? "Thư viện dự án" : steps.find(s => s.id === stage)?.label}</h2>
            </div>
            {stage !== ProductionStage.LIBRARY && (
              <div className="flex items-center gap-3">
                <button 
                  onClick={saveProject} 
                  className="flex items-center gap-3 px-6 py-3 rounded-2xl text-xs font-black transition-all border-2 shadow-sm bg-white border-slate-200 text-slate-600 hover:border-indigo-600 hover:text-indigo-600 hover:shadow-md"
                >
                  <Save className="w-4 h-4" /> LƯU DỰ ÁN
                </button>
                {stage !== ProductionStage.INPUT && stage !== ProductionStage.FINAL && stage !== ProductionStage.PROMPTS && (
                  <button 
                    onClick={() => {
                      const nextManualMode = !isManualMode;
                      setIsManualMode(nextManualMode);
                      if (stage === ProductionStage.STORYBOARD && nextManualMode) {
                        setShowStoryboardPreview(false);
                      }
                    }} 
                    className={`flex items-center gap-3 px-6 py-3 rounded-2xl text-xs font-black transition-all border-2 shadow-sm ${isShowingManual ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-white border-slate-200 text-slate-600 hover:border-indigo-600 hover:text-indigo-600 hover:shadow-md"}`}
                  >
                    <Settings2 className="w-4 h-4" /> {isShowingManual ? "TẮT CHẾ ĐỘ THỦ CÔNG" : "CHẾ ĐỘ THỦ CÔNG"}
                  </button>
                )}
              </div>
            )}
          </header>
          {error && <div className="mb-8 p-6 bg-red-50 text-red-600 rounded-3xl border border-red-100 text-sm font-bold flex items-center gap-4 shadow-sm animate-shake"><div className="bg-red-100 p-2 rounded-xl">⚠️</div>{error}</div>}
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">{renderContent()}</div>
        </div>
        {!isShowingManual && stage !== ProductionStage.FINAL && !isPromptEngineeringAutoBuildPending && (stage === ProductionStage.INPUT || !hasData(stage)) && (
          <div className="fixed bottom-12 right-12 z-30">
            <button onClick={handleProcess} disabled={isLoading || (stage === ProductionStage.INPUT && (!inputData.script.trim() || !inputData.title.trim() || !inputData.chapter.trim())) || (stage === ProductionStage.FINAL && hasData(ProductionStage.FINAL))} className={`group flex items-center gap-4 px-10 py-6 rounded-3xl font-black text-white shadow-2xl transition-all active:scale-95 disabled:opacity-50 ${btn.color} hover:brightness-110 hover:-translate-y-1 shadow-indigo-500/40`}>{btn.icon} <span className="uppercase tracking-[0.2em] text-sm">{btn.label}</span><ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></button>
          </div>
        )}
      </main>
    </div>
  );
};

export default StoryFlow;


import React, { useMemo, useState } from "react";
import { Download, Copy, ChevronDown, ChevronUp, FileJson, AlertCircle, Layout, Sparkles, CheckCircle2, Info, User, MapPin, Clock } from 'lucide-react';
import type { FinalResultPanel, FinalResult } from "../../types";

interface FinalResultStudioViewProps {
  finalResult: FinalResult | null;
  onCopyPrompt?: (text: string) => void;
}

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

interface ChipProps {
  children: React.ReactNode;
  tone?: "slate" | "violet" | "emerald" | "amber" | "rose" | "sky" | "indigo";
  icon?: any;
}

const Chip: React.FC<ChipProps> = ({
  children,
  tone = "slate",
  icon: Icon
}) => {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    violet: "border-violet-200 bg-violet-50 text-violet-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    sky: "border-sky-200 bg-sky-50 text-sky-700",
    indigo: "border-indigo-200 bg-indigo-50 text-indigo-700",
  };

  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest",
        tones[tone]
      )}
    >
      {Icon && <Icon className="w-3 h-3" />}
      {children}
    </span>
  );
};

interface ChipListProps {
  items?: string[];
  tone: "slate" | "violet" | "emerald" | "amber" | "rose" | "sky" | "indigo";
  empty?: string;
  icon?: any;
}

const ChipList: React.FC<ChipListProps> = ({
  items,
  tone,
  empty = "None",
  icon
}) => {
  const safeItems = items?.filter(Boolean) ?? [];

  if (safeItems.length === 0) return <Chip tone="slate">{empty}</Chip>;

  return (
    <div className="flex flex-wrap gap-1.5">
      {safeItems.map((item) => (
        <Chip key={item} tone={tone} icon={icon}>
          {item}
        </Chip>
      ))}
    </div>
  );
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
      {children}
    </p>
  );
}

function PromptBox({
  value,
  onCopy,
}: {
  value: string;
  onCopy?: (text: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <SectionLabel>Visual Prompt</SectionLabel>
        <button
          type="button"
          onClick={() => onCopy?.(value)}
          className="group flex items-center gap-2 rounded-xl bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-white/20"
        >
          <Copy className="w-3 h-3 transition-transform group-hover:scale-110" />
          Copy Prompt
        </button>
      </div>
      <pre className="max-h-[260px] overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-slate-300 scrollbar-thin scrollbar-thumb-white/10">
        {value || "No visualPrompt"}
      </pre>
    </div>
  );
}

interface FinalBeatCardProps {
  item: FinalResultPanel;
  onCopyPrompt?: (text: string) => void;
}

const FinalBeatCard: React.FC<FinalBeatCardProps> = ({
  item,
  onCopyPrompt,
}) => {
  const [expanded, setExpanded] = useState(false);
  const qaStatus = item.qa?.status ?? "unchecked";

  return (
    <article className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-slate-300">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center justify-center w-10 h-10 rounded-2xl bg-indigo-600 text-white font-black text-sm shadow-lg shadow-indigo-100">
              {item.panelNumber}
            </span>
            <Chip tone="violet" icon={Sparkles}>Beat #{item.beatId}</Chip>
            <Chip
              icon={qaStatus === 'pass' ? CheckCircle2 : AlertCircle}
              tone={
                qaStatus === "fail"
                  ? "rose"
                  : qaStatus === "warning"
                    ? "amber"
                    : qaStatus === "pass"
                      ? "emerald"
                      : "slate"
              }
            >
              QA: {qaStatus}
            </Chip>
          </div>

          <h4 className="mt-4 text-base font-black text-slate-900 leading-tight">
            {item.source?.summary || item.source?.visualFocus || "Untitled final beat"}
          </h4>

          {item.source?.originalText && (
            <div className="mt-3 relative">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-100 rounded-full" />
              <p className="pl-4 text-xs italic leading-relaxed text-slate-500 font-medium">
                "{item.source.originalText}"
              </p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-50 hover:border-slate-300"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? "Thu gọn" : "Chi tiết"}
        </button>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-violet-100 bg-violet-50/40 p-4 transition-colors group-hover:bg-violet-50/60">
          <SectionLabel>Focus</SectionLabel>
          <div className="mt-2.5">
            <ChipList items={item.source?.focusCharacters} tone="violet" icon={User} />
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 transition-colors group-hover:bg-emerald-50/60">
          <SectionLabel>Visible</SectionLabel>
          <div className="mt-2.5">
            <ChipList items={item.source?.visibleCharacters} tone="emerald" icon={User} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 transition-colors group-hover:bg-slate-100/60">
          <SectionLabel>Offscreen</SectionLabel>
          <div className="mt-2.5">
            <ChipList items={item.source?.offscreenPresentCharacters} tone="slate" icon={User} />
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 transition-colors group-hover:bg-indigo-50/60">
          <SectionLabel>Action & Posture</SectionLabel>
          <p className="mt-2 text-xs font-bold leading-relaxed text-slate-700">
            {item.source?.action || "No action"}
            {item.source?.posture && <span className="block mt-1 font-medium text-slate-500 italic">Posture: {item.source.posture}</span>}
          </p>
        </div>

        <div className="rounded-2xl border border-sky-100 bg-sky-50/40 p-4 transition-colors group-hover:bg-sky-50/60">
          <SectionLabel>Storyboard</SectionLabel>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold text-slate-700">
            <span className="px-2 py-0.5 bg-white rounded-md border border-sky-100 shadow-sm">{item.storyboard?.shotType || 'Standard Shot'}</span>
            <span className="px-2 py-0.5 bg-white rounded-md border border-sky-100 shadow-sm">{item.storyboard?.cameraAngle || 'Eye Level'}</span>
            <span className="px-2 py-0.5 bg-white rounded-md border border-sky-100 shadow-sm">{item.storyboard?.composition || 'Balanced'}</span>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <PromptBox
          value={item.prompt?.visualPrompt ?? ""}
          onCopy={onCopyPrompt}
        />
      </div>

      {expanded && (
        <div className="mt-6 grid gap-6 border-t border-slate-100 pt-6 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <SectionLabel>Atmosphere & Style</SectionLabel>
              <p className="mt-2 text-xs font-medium leading-relaxed text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">
                {item.source?.atmosphere || "No atmosphere defined"}
              </p>
            </div>

            <div>
              <SectionLabel>Visual Focus</SectionLabel>
              <p className="mt-2 text-xs font-medium leading-relaxed text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">
                {item.source?.visualFocus || "Standard focus"}
              </p>
            </div>
          </div>

          <div>
            <SectionLabel>Scene Depth (F/M/B)</SectionLabel>
            <div className="mt-2 flex items-center gap-3 text-xs font-bold">
              <div className="flex-1 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[9px] text-slate-400 block mb-1">Foreground</span>
                {item.storyboard?.foreground || "-"}
              </div>
              <div className="flex-1 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[9px] text-slate-400 block mb-1">Midground</span>
                {item.storyboard?.midground || "-"}
              </div>
              <div className="flex-1 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[9px] text-slate-400 block mb-1">Background</span>
                {item.storyboard?.background || "-"}
              </div>
            </div>
          </div>

          {item.source?.characterMomentDetails && item.source.characterMomentDetails.length > 0 && (
            <div>
              <SectionLabel>Beat Moment Details</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2 mt-2">
                {item.source.characterMomentDetails.map((moment) => (
                  <div key={moment.characterName} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                    <p className="text-xs font-extrabold text-slate-900">{moment.characterName}</p>
                    {moment.visibleAccessories && moment.visibleAccessories.length > 0 && (
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <span className="text-[9px] font-bold text-slate-400 font-bold">Accessories:</span>
                        <ChipList items={moment.visibleAccessories} tone="amber" />
                      </div>
                    )}
                    {moment.handheldItems && moment.handheldItems.length > 0 && (
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <span className="text-[9px] font-bold text-slate-400 font-bold">Handheld:</span>
                        <ChipList items={moment.handheldItems} tone="sky" />
                      </div>
                    )}
                    {moment.accessoriesChange && moment.accessoriesChange.length > 0 && (
                      <p className="mt-1 text-[9px] text-slate-600 font-medium">
                        <span className="font-bold text-slate-400 font-bold">Change:</span> {moment.accessoriesChange.join(", ")}
                      </p>
                    )}
                    {moment.momentNotes && (
                      <p className="mt-1 text-[9px] text-slate-500 italic">
                        Note: {moment.momentNotes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {qaStatus !== 'pass' && (item.qa?.issues ?? []).length > 0 && (
            <div>
              <SectionLabel>QA Issues & Recommendations</SectionLabel>
              <div className="mt-2 bg-rose-50 border border-rose-100 rounded-xl p-4">
                <ul className="list-disc space-y-1 pl-4 text-xs text-rose-800 font-bold">
                  {item.qa?.issues.map((issue, index) => (
                    <li key={`${issue}-${index}`}>{issue}</li>
                  ))}
                </ul>
                {item.qa?.suggestedPromptPatch && (
                  <div className="mt-3 p-3 bg-white/50 rounded-lg border border-rose-200">
                    <p className="text-[10px] uppercase font-black text-rose-400 mb-1">Suggested Patch</p>
                    <p className="text-xs font-mono text-rose-900">{item.qa.suggestedPromptPatch}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
};

export function FinalResultStudioView({
  finalResult,
  onCopyPrompt,
}: FinalResultStudioViewProps) {
  const items = finalResult?.panels ?? [];

  const grouped = useMemo(() => {
    const map = new Map<string, FinalResultPanel[]>();

    for (const item of items) {
      const screenId = item.screenId ?? item.refs?.screenId ?? "screen_001";
      const list = map.get(screenId) ?? [];
      list.push(item);
      map.set(screenId, list);
    }

    return Array.from(map.entries()).map(([screenId, screenItems]) => ({
      screenId,
      screen: screenItems[0]?.screen,
      items: screenItems,
    }));
  }, [items]);

  if (!finalResult || items.length === 0) {
    return (
      <div className="rounded-[2.5rem] border-2 border-dashed border-slate-200 bg-slate-50/50 p-20 text-center">
        <div className="bg-white w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-slate-100">
          <FileJson className="h-10 w-10 text-slate-300" />
        </div>
        <p className="text-xl font-black text-slate-900">
          Chưa có Final Result
        </p>
        <p className="mt-3 text-sm text-slate-500 max-w-xs mx-auto leading-relaxed">
          Bấm <span className="font-bold text-indigo-600">Build Final Result</span> ở cột bên trái để tổng hợp dữ liệu từ các bước trước.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {grouped.map(({ screenId, screen, items: screenItems }, index) => (
        <section
          key={screenId}
          className="overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md"
        >
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <Layout className="w-40 h-40 rotate-12" />
            </div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-3">
                <span className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-indigo-200 backdrop-blur-sm border border-white/10">
                  Screen #{index + 1}
                </span>
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{screenId}</span>
              </div>
              
              <h3 className="text-3xl font-black tracking-tight leading-tight">
                {screen?.screenName || `Screen ${index + 1}`}
              </h3>
              
              <div className="mt-6 flex flex-wrap gap-2">
                <Chip tone="sky" icon={Layout}>{screenItems.length} panels</Chip>
                {screen?.timeOfDay && <Chip tone="amber" icon={Clock}>{screen.timeOfDay}</Chip>}
                {screen?.location && <Chip tone="emerald" icon={MapPin}>{screen.location}</Chip>}
              </div>
            </div>
          </div>

          {screen && (
            <div className="border-b border-slate-100 bg-slate-50/50 p-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <User className="w-3.5 h-3.5 text-indigo-500" />
                    <SectionLabel>Global Characters</SectionLabel>
                  </div>
                  <ChipList items={screen.screenCharacters} tone="violet" />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                    <SectionLabel>Global Props</SectionLabel>
                  </div>
                  <ChipList items={screen.screenProps} tone="sky" />
                </div>
              </div>

              {screen.screenCharacterStates && screen.screenCharacterStates.length > 0 && (
                <div className="mt-6 rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <User className="w-3.5 h-3.5 text-indigo-500" />
                    <SectionLabel>Screen Character Outfits & Accessories</SectionLabel>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-3">
                    {screen.screenCharacterStates.map((charState) => (
                      <div key={charState.characterName} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                        <p className="text-xs font-extrabold text-slate-900">{charState.characterName}</p>
                        {charState.outfit && (
                          <p className="mt-1 text-[11px] text-slate-700 font-medium">
                            <span className="font-bold text-slate-400 font-bold">Outfit:</span> {charState.outfit}
                          </p>
                        )}
                        {charState.accessories && charState.accessories.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-1">
                            <span className="text-[9px] font-bold text-slate-400 font-bold">Accessories:</span>
                            <ChipList items={charState.accessories} tone="amber" />
                          </div>
                        )}
                        {charState.handheldItems && charState.handheldItems.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-1">
                            <span className="text-[9px] font-bold text-slate-400 font-bold">Handheld:</span>
                            <ChipList items={charState.handheldItems} tone="sky" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(screen.screenState || screen.continuityNotes) && (
                <div className="mt-6 rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <Info className="w-3.5 h-3.5 text-indigo-400" />
                    <SectionLabel>Continuity & State</SectionLabel>
                  </div>
                  <div className="text-xs font-bold leading-relaxed text-slate-600 space-y-2">
                    {screen.screenState && <p className="bg-indigo-50/50 p-2 rounded-lg">{screen.screenState}</p>}
                    {screen.continuityNotes && <p className="bg-slate-50 p-2 rounded-lg italic">Note: {screen.continuityNotes}</p>}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-6 p-8 bg-slate-50/30">
            {screenItems.map((item) => (
              <FinalBeatCard
                key={`beat-${item.beatId}-${item.panelNumber}`}
                item={item}
                onCopyPrompt={onCopyPrompt}
              />
            ))}
          </div>
        </section>
      ))}
      
      <div className="p-10 border-2 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center text-center">
        <div className="bg-indigo-50 p-4 rounded-full mb-4">
          <CheckCircle2 className="w-8 h-8 text-indigo-600" />
        </div>
        <h4 className="text-lg font-black text-slate-900 mb-2">Build Completed</h4>
        <p className="text-sm text-slate-500 max-w-sm">
          Tất cả các screen và panel đã được tổng hợp. Bạn có thể xuất kết quả sang SRT, TXT hoặc JSON để sử dụng cho sản xuất.
        </p>
      </div>
    </div>
  );
}

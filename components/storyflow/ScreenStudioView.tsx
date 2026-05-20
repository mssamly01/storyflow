import { useMemo, useState, type ReactNode } from "react";
import type { StoryBeat, StoryScreen } from "../../types";
import { validateBeatRhythm } from "../../services/sourceTextSegmentService";

interface ScreenStudioViewProps {
  screens: StoryScreen[];
  beats: StoryBeat[];
}

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

type ChipTone = "slate" | "violet" | "emerald" | "amber" | "rose" | "sky" | "orange";

function Chip({ children, tone = "slate" }: { children: ReactNode; tone?: ChipTone }) {
  const tones: Record<ChipTone, string> = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    violet: "border-violet-200 bg-violet-50 text-violet-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    sky: "border-sky-200 bg-sky-50 text-sky-700",
    orange: "border-orange-200 bg-orange-50 text-orange-700"
  };

  return (
    <span className={cx("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold", tones[tone])}>
      {children}
    </span>
  );
}

function ChipList({ items, tone, empty = "None" }: { items?: string[]; tone: ChipTone; empty?: string }) {
  const safeItems = items?.filter(Boolean) ?? [];
  if (!safeItems.length) return <Chip tone="slate">{empty}</Chip>;

  return (
    <div className="flex flex-wrap gap-1.5">
      {safeItems.map((item) => (
        <span key={item} className="contents">
          <Chip tone={tone}>{item}</Chip>
        </span>
      ))}
    </div>
  );
}

function StatBadge({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white px-3 py-2 text-slate-900 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-0.5 truncate text-sm font-extrabold">{value}</p>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">{children}</p>;
}

function countWords(text?: string): number {
  return (text || "").trim().split(/\s+/).filter(Boolean).length;
}

function isOverBeatWordLimit(text?: string): boolean {
  return countWords(text) > 80;
}

function beatBelongsToScreen(beat: StoryBeat, screen: StoryScreen): boolean {
  if (beat.screenId && screen.screenId && beat.screenId === screen.screenId) return true;
  if (Array.isArray(screen.beatIds) && screen.beatIds.includes(beat.beatId)) return true;
  if (
    screen.startBeatId != null &&
    screen.endBeatId != null &&
    beat.beatId >= screen.startBeatId &&
    beat.beatId <= screen.endBeatId
  ) {
    return true;
  }
  return false;
}

function createOrphanScreen(screenId: string, beats: StoryBeat[], screenNumber: number): StoryScreen {
  const first = beats[0];
  return {
    screenId,
    screenNumber,
    screenName: first
      ? `${first.location || first.locationName || "Unknown Location"} - ${first.timeOfDay || "Unknown Time"}`
      : "Unlinked Beats",
    location: first?.location || first?.locationName || "",
    locationId: first?.locationId,
    timeOfDay: first?.timeOfDay || "",
    screenState: first?.locationState || "",
    screenCharacters: Array.from(new Set(beats.flatMap((beat) => [
      ...(beat.focusCharacters || []),
      ...(beat.visibleCharacters || []),
      ...(beat.offscreenPresentCharacters || []),
      ...(beat.characters || []),
      ...(beat.charactersInvolved || [])
    ]).filter(Boolean))),
    screenProps: Array.from(new Set(beats.flatMap((beat) => beat.props || []).filter(Boolean))),
    startBeatId: first?.beatId || 0,
    endBeatId: beats.at(-1)?.beatId || first?.beatId || 0,
    beatIds: beats.map((beat) => beat.beatId),
    summary: `Auto-created display group for unlinked beats ${first?.beatId || "?"}-${beats.at(-1)?.beatId || "?"}`,
    continuityNotes: "Generated only for UI display because these beats were not linked to any provided screen."
  };
}

function BeatCard({ beat, isExpanded, onToggle }: { beat: StoryBeat; isExpanded: boolean; onToggle: () => void }) {
  const focusCharacters = beat.focusCharacters?.length ? beat.focusCharacters : beat.characters || beat.charactersInvolved;
  const visibleCharacters = beat.visibleCharacters?.length ? beat.visibleCharacters : focusCharacters;
  const originalTextWordCount = countWords(beat.originalText);
  const isOriginalTextTooLong = originalTextWordCount > 80;

  return (
    <article className={cx(
      "relative rounded-3xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
      isOriginalTextTooLong ? "border-rose-200 ring-2 ring-rose-50" : "border-slate-200"
    )}>
      <div className="absolute -left-[34px] top-6 flex h-8 w-8 items-center justify-center rounded-full border-4 border-white bg-violet-600 text-xs font-black text-white shadow">
        {beat.beatId}
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="violet">Beat #{beat.beatId}</Chip>
            {beat.atmosphere && <Chip tone="amber">{beat.atmosphere}</Chip>}
            {beat.timeOfDay && <Chip tone="sky">{beat.timeOfDay}</Chip>}
            {beat.originalText && (
              <Chip tone={isOriginalTextTooLong ? "rose" : "slate"}>
                {originalTextWordCount} words
              </Chip>
            )}
          </div>

          <h4 className="mt-3 text-base font-extrabold leading-snug text-slate-950">
            {beat.summary || beat.action || beat.actionAnalysis || "Untitled beat"}
          </h4>

          {beat.originalText && (
            <p className="mt-2 max-h-36 overflow-y-auto rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm italic leading-relaxed text-slate-600">
              {beat.originalText}
            </p>
          )}
          {isOriginalTextTooLong && (
            <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold leading-relaxed text-rose-700">
              originalText vượt 80 từ. Nên tách beat này thành nhiều visual moments nhỏ hơn để mỗi ảnh chỉ thể hiện một khoảnh khắc rõ ràng.
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onToggle}
          className="shrink-0 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-600 hover:bg-slate-50"
        >
          {isExpanded ? "Thu gon" : "Chi tiet"}
        </button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-4">
          <SectionLabel>Focus</SectionLabel>
          <div className="mt-2"><ChipList items={focusCharacters} tone="violet" /></div>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
          <SectionLabel>Visible</SectionLabel>
          <div className="mt-2"><ChipList items={visibleCharacters} tone="emerald" /></div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <SectionLabel>Offscreen Present</SectionLabel>
          <div className="mt-2"><ChipList items={beat.offscreenPresentCharacters} tone="slate" /></div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-orange-100 bg-orange-50/60 p-4">
          <SectionLabel>Action</SectionLabel>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-800">
            {beat.action || beat.actionAnalysis || "No action"}
          </p>
        </div>
        <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4">
          <SectionLabel>Visual Focus</SectionLabel>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-800">
            {beat.visualFocus || "No visual focus"}
          </p>
        </div>
      </div>

      {false && (
      <>
      {/* Visual Shot Details Panel */}
      <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50/50 p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2.5 h-2.5 rounded-full bg-violet-600 animate-pulse" />
          <SectionLabel>Visual Shot Details (AI Analyzed)</SectionLabel>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white bg-white/70 p-4 shadow-sm">
            <SectionLabel>Visual Moment</SectionLabel>
            <p className="mt-2 text-sm font-semibold text-slate-800 leading-relaxed">
              {beat.visualMoment || "No visual moment described"}
            </p>
          </div>
          
          <div className="rounded-2xl border border-white bg-white/70 p-4 shadow-sm">
            <SectionLabel>Main Action</SectionLabel>
            <p className="mt-2 text-sm font-semibold text-slate-800 leading-relaxed">
              {beat.mainAction || "No action described"}
            </p>
          </div>
        </div>

        {(beat.cameraHint || beat.compositionHint || beat.environmentDetails) && (
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {beat.cameraHint && (
              <div className="rounded-2xl border border-white bg-white/70 p-3 shadow-sm">
                <SectionLabel>Camera Shot</SectionLabel>
                <p className="mt-1 text-xs font-bold text-slate-800 capitalize">
                  {beat.cameraHint.replace(/-/g, " ")}
                </p>
              </div>
            )}
            {beat.compositionHint && (
              <div className="rounded-2xl border border-white bg-white/70 p-3 shadow-sm">
                <SectionLabel>Composition</SectionLabel>
                <p className="mt-1 text-xs font-semibold text-slate-700">
                  {beat.compositionHint}
                </p>
              </div>
            )}
            {beat.environmentDetails && (
              <div className="rounded-2xl border border-white bg-white/70 p-3 shadow-sm">
                <SectionLabel>Environment details</SectionLabel>
                <p className="mt-1 text-xs text-slate-700 font-medium leading-relaxed">
                  {beat.environmentDetails}
                </p>
              </div>
            )}
          </div>
        )}

        {beat.characterVisualStates && beat.characterVisualStates.length > 0 && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <SectionLabel>Character Visual States</SectionLabel>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {beat.characterVisualStates.map((vs: any) => (
                <div key={vs.characterName} className="rounded-2xl border border-violet-100 bg-violet-50/20 p-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-extrabold text-slate-900">{vs.characterName}</p>
                    {vs.roleInShot && (
                      <span className={cx(
                        "text-[9px] font-black uppercase px-2 py-0.5 rounded-md",
                        vs.roleInShot === "main" ? "bg-violet-600 text-white shadow-sm" :
                        vs.roleInShot === "supporting" ? "bg-indigo-100 text-indigo-700" :
                        "bg-slate-100 text-slate-600"
                      )}>
                        {vs.roleInShot}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 space-y-1 text-xs leading-relaxed text-slate-700">
                    {vs.facialExpression && (
                      <p><span className="font-semibold text-slate-500">Expression:</span> {vs.facialExpression}</p>
                    )}
                    {vs.bodyLanguage && (
                      <p><span className="font-semibold text-slate-500">Body & Posture:</span> {vs.bodyLanguage}</p>
                    )}
                    {vs.gazeTarget && (
                      <p><span className="font-semibold text-slate-500">Gaze:</span> {vs.gazeTarget}</p>
                    )}
                    {vs.emotionalState && (
                      <p><span className="font-semibold text-slate-500">Emotion:</span> {vs.emotionalState}</p>
                    )}
                    {vs.position && (
                      <p><span className="font-semibold text-slate-500">Position:</span> {vs.position} <span className="text-[9px] text-slate-400">({vs.positionSource})</span></p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      </>
      )}

      {isExpanded && (
        <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 md:grid-cols-2">
          <div>
            <SectionLabel>Interaction</SectionLabel>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">{beat.interaction || "No interaction"}</p>
          </div>
          <div>
            <SectionLabel>Props</SectionLabel>
            <div className="mt-2"><ChipList items={beat.props} tone="sky" /></div>
          </div>
          <div>
            <SectionLabel>Location State</SectionLabel>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">{beat.locationState || "No location state"}</p>
          </div>
          <div>
            <SectionLabel>Time / Location</SectionLabel>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              {beat.timeOfDay || "Unknown time"} / {beat.location || beat.locationName || "Unknown location"}
            </p>
          </div>

          {beat.characterMomentDetails && beat.characterMomentDetails.length > 0 && (
            <div className="col-span-full border-t border-slate-100 pt-4">
              <SectionLabel>Beat Moment Details</SectionLabel>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {beat.characterMomentDetails.map((moment) => (
                  <div key={moment.characterName} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                    <p className="text-xs font-bold text-slate-900">{moment.characterName}</p>
                    {moment.visibleAccessories && moment.visibleAccessories.length > 0 && (
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <span className="text-[9px] font-semibold text-slate-500 font-bold">Accessories:</span>
                        <ChipList items={moment.visibleAccessories} tone="amber" empty="" />
                      </div>
                    )}
                    {moment.handheldItems && moment.handheldItems.length > 0 && (
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <span className="text-[9px] font-semibold text-slate-500 font-bold">Handheld:</span>
                        <ChipList items={moment.handheldItems} tone="sky" empty="" />
                      </div>
                    )}
                    {moment.accessoriesChange && moment.accessoriesChange.length > 0 && (
                      <div className="mt-1 text-[9px] text-slate-600 font-medium">
                        <span className="font-semibold text-slate-500 font-bold">Change:</span> {moment.accessoriesChange.join(", ")}
                      </div>
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
        </div>
      )}
    </article>
  );
}

function ScreenCard({ screen, beats }: { screen: StoryScreen; beats: StoryBeat[] }) {
  const [expandedBeatIds, setExpandedBeatIds] = useState<Set<number>>(() => new Set());
  const allExpanded = beats.length > 0 && expandedBeatIds.size === beats.length;

  const toggleBeat = (beatId: number) => {
    setExpandedBeatIds((prev) => {
      const next = new Set(prev);
      if (next.has(beatId)) next.delete(beatId);
      else next.add(beatId);
      return next;
    });
  };

  const toggleAll = () => {
    setExpandedBeatIds(() => allExpanded ? new Set() : new Set(beats.map((beat) => beat.beatId)));
  };

  return (
    <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950 p-6 text-white">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-violet-200">Screen #{screen.screenNumber}</p>
            <h3 className="mt-2 text-2xl font-black leading-tight">{screen.screenName || "Untitled Screen"}</h3>
            {screen.summary && <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-200">{screen.summary}</p>}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[420px]">
            <StatBadge label="Beats" value={beats.length} />
            <StatBadge label="Characters" value={screen.screenCharacters?.length ?? 0} />
            <StatBadge label="Time" value={screen.timeOfDay || "Unknown"} />
            <StatBadge label="Location" value={screen.location || "Scene"} />
          </div>
        </div>
      </div>

      <div className="border-b border-slate-100 bg-slate-50/80 p-6">
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <SectionLabel>Screen Continuity</SectionLabel>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {screen.location || "Unknown location"} / {screen.timeOfDay || "Unknown time"}
            </p>
            {screen.screenState && <p className="mt-3 text-sm leading-relaxed text-slate-700">{screen.screenState}</p>}
            {(screen.beatIds?.length || screen.startBeatId || screen.endBeatId) && (
              <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 block mb-1">Beat Link</span>
                <p className="text-xs font-bold text-slate-700">
                  {screen.beatIds?.length
                    ? `Applies to beats: ${screen.beatIds.join(", ")}`
                    : `Beat range: ${screen.startBeatId ?? "?"}–${screen.endBeatId ?? "?"}`}
                </p>
              </div>
            )}
            {screen.continuityNotes && (
              <p className="mt-3 rounded-2xl bg-violet-50 p-3 text-sm leading-relaxed text-violet-800">
                {screen.continuityNotes}
              </p>
            )}
          </div>
          <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5">
            <div>
              <SectionLabel>Screen Characters</SectionLabel>
              <div className="mt-2"><ChipList items={screen.screenCharacters} tone="violet" /></div>
            </div>
            <div>
              <SectionLabel>Props</SectionLabel>
              <div className="mt-2"><ChipList items={screen.screenProps} tone="sky" /></div>
            </div>
          </div>
        </div>

        {screen.screenCharacterStates && screen.screenCharacterStates.length > 0 && (
          <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-5">
            <SectionLabel>Screen Character States (Outfit & Accessories)</SectionLabel>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {screen.screenCharacterStates.map((charState) => (
                <div key={charState.characterName} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                  <p className="text-sm font-bold text-slate-900">{charState.characterName}</p>
                  {charState.outfit && (
                    <p className="mt-1 text-xs text-slate-700 font-medium">
                      <span className="font-semibold text-slate-500 font-bold">Outfit:</span> {charState.outfit}
                    </p>
                  )}
                  {charState.accessories && charState.accessories.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-semibold text-slate-500 font-bold">Accessories:</span>
                      <ChipList items={charState.accessories} tone="amber" empty="" />
                    </div>
                  )}
                  {charState.handheldItems && charState.handheldItems.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-semibold text-slate-500 font-bold">Handheld:</span>
                      <ChipList items={charState.handheldItems} tone="sky" empty="" />
                    </div>
                  )}
                  {charState.appearanceNotes && (
                    <p className="mt-2 text-[10px] text-slate-500 italic">
                      Note: {charState.appearanceNotes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 flex items-center justify-between">
          <p className="text-sm font-bold text-slate-700">Beat Timeline / {beats.length} beats</p>
          <button
            type="button"
            onClick={toggleAll}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-600 hover:bg-slate-50"
          >
            {allExpanded ? "Collapse all" : "Expand all"}
          </button>
        </div>
      </div>

      <div className="p-6">
        <div className="relative ml-5 space-y-5 border-l-2 border-violet-200 pl-8">
          {beats.map((beat) => (
            <div key={beat.beatId} className="contents">
              <BeatCard
                beat={beat}
                isExpanded={expandedBeatIds.has(beat.beatId)}
                onToggle={() => toggleBeat(beat.beatId)}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ScreenStudioView({ screens, beats }: ScreenStudioViewProps) {
  const { displayScreens, beatsByScreen } = useMemo(() => {
    const map = new Map<string, StoryBeat[]>();
    const assignedBeatIds = new Set<number>();

    for (const screen of screens) {
      map.set(screen.screenId, []);
    }

    for (const beat of beats) {
      const screen = screens.find((item) => beatBelongsToScreen(beat, item));
      if (!screen) continue;
      map.set(screen.screenId, [...(map.get(screen.screenId) || []), beat]);
      assignedBeatIds.add(beat.beatId);
    }

    const orphanGroups = new Map<string, StoryBeat[]>();
    for (const beat of beats) {
      if (assignedBeatIds.has(beat.beatId)) continue;
      const key = beat.screenId || `${beat.location || beat.locationName || "Unknown"}|${beat.timeOfDay || "Unknown"}`;
      orphanGroups.set(key, [...(orphanGroups.get(key) || []), beat]);
    }

    const orphanScreens = Array.from(orphanGroups.entries()).map(([key, group], index) =>
      createOrphanScreen(key.startsWith("screen_") ? key : `unlinked_screen_${index + 1}`, group, screens.length + index + 1)
    );

    for (const screen of orphanScreens) {
      map.set(screen.screenId, orphanGroups.get(screen.screenId) ?? screen.beatIds!.map((beatId) => beats.find((beat) => beat.beatId === beatId)).filter((beat): beat is StoryBeat => Boolean(beat)));
    }

    return {
      displayScreens: [...screens, ...orphanScreens],
      beatsByScreen: map
    };
  }, [beats, screens]);
  const rhythmWarnings = useMemo(
    () => validateBeatRhythm(beats),
    [beats]
  );

  if (!beats.length) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
        <p className="text-sm font-semibold text-slate-500">Chua co du lieu beat de hien thi.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {rhythmWarnings.length > 0 && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50/70 p-5 text-amber-900 shadow-sm animate-fade-in">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Rhythm & Beat Length Warnings</p>
          <div className="mt-2 space-y-1.5">
            {rhythmWarnings.map((w, index) => (
              <div key={index} className="text-xs font-semibold leading-relaxed flex items-start gap-2">
                <span className={cx(
                  "inline-block w-1.5 h-1.5 rounded-full mt-1.5 shrink-0",
                  w.type === "too_long" ? "bg-rose-500 animate-pulse" : "bg-amber-500"
                )} />
                <span>
                  <strong>[Beat #{w.beatId}]</strong>: {w.message}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] text-amber-600 font-bold uppercase tracking-wider">
            Target mới: 20-60 từ/beat. Hãy regenerate Beat Analysis hoặc sửa thủ công để tối ưu hóa nét vẽ minh họa.
          </p>
        </div>
      )}
      {displayScreens.map((screen) => (
        <div key={screen.screenId} className="contents">
          <ScreenCard screen={screen} beats={beatsByScreen.get(screen.screenId) ?? []} />
        </div>
      ))}
    </div>
  );
}

export function ScreenBeatView(props: ScreenStudioViewProps) {
  return <ScreenStudioView {...props} />;
}

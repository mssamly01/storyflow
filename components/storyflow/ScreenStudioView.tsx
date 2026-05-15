import { useMemo, useState, type ReactNode } from "react";
import type { StoryBeat, StoryScreen } from "../../types";

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

function BeatCard({ beat, isExpanded, onToggle }: { beat: StoryBeat; isExpanded: boolean; onToggle: () => void }) {
  const focusCharacters = beat.focusCharacters?.length ? beat.focusCharacters : beat.characters || beat.charactersInvolved;
  const visibleCharacters = beat.visibleCharacters?.length ? beat.visibleCharacters : focusCharacters;

  return (
    <article className="relative rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="absolute -left-[34px] top-6 flex h-8 w-8 items-center justify-center rounded-full border-4 border-white bg-violet-600 text-xs font-black text-white shadow">
        {beat.beatId}
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="violet">Beat #{beat.beatId}</Chip>
            {beat.atmosphere && <Chip tone="amber">{beat.atmosphere}</Chip>}
            {beat.timeOfDay && <Chip tone="sky">{beat.timeOfDay}</Chip>}
          </div>

          <h4 className="mt-3 text-base font-extrabold leading-snug text-slate-950">
            {beat.summary || beat.action || beat.actionAnalysis || "Untitled beat"}
          </h4>

          {beat.originalText && (
            <p className="mt-2 max-h-36 overflow-y-auto rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm italic leading-relaxed text-slate-600">
              {beat.originalText}
            </p>
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

      <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
        <SectionLabel>Posture / Blocking</SectionLabel>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{beat.posture || "No posture data"}</p>
      </div>

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
  const beatsByScreen = useMemo(() => {
    const map = new Map<string, StoryBeat[]>();
    for (const beat of beats) {
      const screenId = beat.screenId || "screen_001";
      const list = map.get(screenId) ?? [];
      list.push(beat);
      map.set(screenId, list);
    }
    return map;
  }, [beats]);

  if (!beats.length) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
        <p className="text-sm font-semibold text-slate-500">Chua co du lieu beat de hien thi.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {screens.map((screen) => (
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

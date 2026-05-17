import type { ScreenContinuityItem, ScreenCharacterState } from "../../types";
import type { ReactNode } from "react";

interface ScreenContinuityViewProps {
  screens: ScreenContinuityItem[];
}

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
      {children}
    </p>
  );
}

function Chip({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "slate" | "violet" | "emerald" | "amber" | "sky" | "rose";
}) {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    violet: "border-violet-200 bg-violet-50 text-violet-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    sky: "border-sky-200 bg-sky-50 text-sky-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
  };

  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}

function ChipList({
  items,
  tone = "slate",
  empty = "None",
}: {
  items?: string[];
  tone?: "slate" | "violet" | "emerald" | "amber" | "sky" | "rose";
  empty?: string;
}) {
  const safeItems = items?.filter(Boolean) ?? [];

  if (safeItems.length === 0) {
    return <Chip tone="slate">{empty}</Chip>;
  }

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

function getBeatLinkLabel(screen: ScreenContinuityItem): string {
  if (screen.beatIds?.length) {
    return `Applies to beats: ${screen.beatIds.join(", ")}`;
  }

  if (screen.startBeatId != null || screen.endBeatId != null) {
    return `Beat range: ${screen.startBeatId ?? "?"}–${screen.endBeatId ?? "?"}`;
  }

  return "No beat link";
}

function CharacterStateCard({ state }: { state: ScreenCharacterState }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-extrabold text-slate-950">
          {state.characterName || "Unknown character"}
        </h4>
        {state.characterId && <span className="contents"><Chip tone="violet">{state.characterId}</Chip></span>}
      </div>

      <div className="mt-3 space-y-3">
        <div>
          <SectionLabel>Outfit</SectionLabel>
          <p className="mt-1 text-sm leading-relaxed text-slate-700">
            {state.outfit || "No outfit"}
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <SectionLabel>Main Color</SectionLabel>
            <p className="mt-1 text-sm text-slate-700">
              {state.outfitMainColor || "Unknown"}
            </p>
          </div>

          <div>
            <SectionLabel>Accent Color</SectionLabel>
            <p className="mt-1 text-sm text-slate-700">
              {state.outfitAccentColor || "Unknown"}
            </p>
          </div>
        </div>

        <div>
          <SectionLabel>Accessories</SectionLabel>
          <div className="mt-2">
            <ChipList items={state.accessories} tone="amber" />
          </div>
        </div>

        <div>
          <SectionLabel>Handheld Items</SectionLabel>
          <div className="mt-2">
            <ChipList items={state.handheldItems} tone="sky" />
          </div>
        </div>

        {state.appearanceNotes && (
          <div>
            <SectionLabel>Appearance Notes</SectionLabel>
            <p className="mt-1 text-sm leading-relaxed text-slate-700">
              {state.appearanceNotes}
            </p>
          </div>
        )}

        <div>
          <SectionLabel>State Changes</SectionLabel>
          <div className="mt-2">
            <ChipList items={state.stateChanges} tone="rose" empty="No changes" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ScreenContinuityView({ screens }: ScreenContinuityViewProps) {
  if (!screens.length) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
        <p className="text-sm font-semibold text-slate-500">
          Chưa có dữ liệu Thiết lập bối cảnh hoặc JSON chưa đúng schema.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {screens.map((screen, index) => (
        <section
          key={`${screen.screenId}-${index}`}
          className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm"
        >
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950 p-6 text-white">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-violet-200">
                  Screen Continuity
                </p>
                <h3 className="mt-2 text-2xl font-black">
                  {screen.screenId || `screen_${index + 1}`}
                </h3>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold text-white">
                {getBeatLinkLabel(screen)}
              </div>
            </div>
          </div>

          <div className="grid gap-5 border-b border-slate-100 bg-slate-50 p-5 lg:grid-cols-[1.2fr_1fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <SectionLabel>Screen State</SectionLabel>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">
                {screen.screenState || "No screen state"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <SectionLabel>Screen Props</SectionLabel>
              <div className="mt-2">
                <ChipList items={screen.screenProps} tone="emerald" />
              </div>
            </div>

            <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4 lg:col-span-2">
              <SectionLabel>Continuity Notes</SectionLabel>
              <p className="mt-2 text-sm leading-relaxed text-violet-900">
                {screen.continuityNotes || "No continuity notes"}
              </p>
            </div>
          </div>

          <div className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <SectionLabel>Character Outfit / Accessories</SectionLabel>
              <span className="contents">
                <Chip tone="violet">
                  {screen.screenCharacterStates?.length ?? 0} characters
                </Chip>
              </span>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {(screen.screenCharacterStates ?? []).map((state) => (
                <div key={`${screen.screenId}-${state.characterId || state.characterName}`}>
                  <CharacterStateCard state={state} />
                </div>
              ))}
            </div>

            {(screen.screenCharacterStates ?? []).length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">
                Không có character state trong screen này.
              </div>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

# StoryFlow - Vibe Code Guide: Sửa UI “Thiết lập bối cảnh” để show đúng Screen Continuity + Beat Links

## Mục tiêu

Bước **Thiết lập bối cảnh / Screen Continuity** hiện đã được tách khỏi Beat Analysis. Đây là bước phân tích **theo screen**, nhưng app vẫn dùng `beatId` làm cơ sở cuối cùng cho:

```txt
Storyboard
Prompt Engineering
Final Result
Export Image Prompt
```

Vì vậy UI của bước này phải hiển thị rõ:

```txt
Screen Continuity này áp dụng cho những beat nào?
```

Cần show các field mới:

```txt
beatIds
startBeatId
endBeatId
screenState
screenProps
screenCharacterStates
continuityNotes
```

Nếu UI chỉ show text/raw JSON hoặc chỉ merge vào ScreenStudioView chung, user sẽ khó kiểm tra dữ liệu đã đúng chưa.

---

# 1. Vấn đề hiện tại

## 1.1. Stage đã có nhưng preview chưa đủ rõ

Sidebar đã có stage:

```txt
Thiết lập bối cảnh
```

Dữ liệu được lưu vào:

```ts
production.screenContinuity
```

Nhưng UI chưa có preview chuyên biệt cho Screen Continuity.

Kết quả:

```txt
- User paste JSON xong không biết app đã nhận đúng chưa.
- Không thấy screen đó áp dụng cho beat nào.
- Không thấy rõ outfit/accessory/props/continuityNotes theo screen.
- Không kiểm tra được beatIds/startBeatId/endBeatId.
```

---

## 1.2. ScreenStudioView không đủ cho stage này

`ScreenStudioView` phù hợp cho **Phân tích nội dung** vì nó show:

```txt
Screen → Beat timeline
```

Nhưng Screen Continuity cần UI riêng để show:

```txt
Screen-level state
Screen props
Character outfit/accessory states
Beat links
```

Do đó nên tạo component riêng:

```txt
components/storyflow/ScreenContinuityView.tsx
```

---

# 2. UI mong muốn

Mỗi screen continuity card nên hiển thị:

```txt
Screen screen_001
Applies to beats: 1, 2, 3, 4
Beat range: 1–4

Screen State
Orderly corporate office with a large mahogany desk...

Screen Props
[mahogany executive desk] [share certificates] [fountain pen]

Character States
Lâm Tấn Hải
- Outfit: bespoke midnight-blue business suit...
- Main color: midnight blue
- Accent color: white and dark silk
- Accessories: gold watch, wedding ring
- Handheld: fountain pen
- Appearance: arrogant, seated behind the desk
- State changes: none

Continuity Notes
Keep the executive desk, share certificates, and tense power distance consistent.
```

---

# 3. Files cần sửa / tạo

## Tạo mới

```txt
components/storyflow/ScreenContinuityView.tsx
```

## Sửa

```txt
components/StoryFlow.tsx
types.ts
services/finalResultBuilderService.ts
```

Nếu đã có `ScreenContinuityItem` / `normalizeScreenContinuity`, chỉ cần cập nhật để hỗ trợ `beatIds/startBeatId/endBeatId`.

---

# 4. Update types.ts

File:

```txt
types.ts
```

## 4.1. Sửa ScreenContinuityItem

### Code cũ có thể là

```ts
export interface ScreenContinuityItem {
  screenId: string;
  screenState: string;
  screenProps: string[];
  screenCharacterStates: ScreenCharacterState[];
  continuityNotes?: string;
}
```

### Code mới

```ts
export interface ScreenContinuityItem {
  screenId: string;

  /**
   * Beat links allow this screen-level continuity data
   * to attach back to beat-based workflows.
   */
  beatIds?: number[];
  startBeatId?: number;
  endBeatId?: number;

  screenState: string;
  screenProps: string[];
  screenCharacterStates: ScreenCharacterState[];
  continuityNotes?: string;
}
```

## 4.2. Optional: add beatIds to StoryScreen

Nếu `StoryScreen` chưa có `beatIds`, có thể thêm optional:

```ts
export interface StoryScreen {
  screenId: string;
  screenNumber: number;
  screenName: string;

  location: string;
  locationId?: string;
  timeOfDay: string;

  screenCharacters: string[];

  startBeatId: number;
  endBeatId: number;
  beatIds?: number[];

  screenState?: string;
  screenProps?: string[];
  screenCharacterStates?: ScreenCharacterState[];

  summary: string;
  continuityNotes?: string;
  meta?: EditableMeta;
}
```

---

# 5. Update normalizer

File:

```txt
services/finalResultBuilderService.ts
```

## 5.1. Thêm helper normalizeNumberArray

Nếu chưa có:

```ts
function normalizeNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
}
```

## 5.2. Sửa normalizeScreenContinuity

### Code cũ có thể là

```ts
export function normalizeScreenContinuity(raw: any): ScreenContinuityItem[] {
  const items = raw?.screens ?? raw?.screenContinuity ?? [];

  if (!Array.isArray(items)) return [];

  return items.map((item: any) => ({
    screenId: item.screenId ?? item.screen_id ?? "",
    screenState: item.screenState ?? item.screen_state ?? "",
    screenProps: normalizeStringArray(item.screenProps ?? item.screen_props),
    screenCharacterStates: normalizeScreenCharacterStates(item),
    continuityNotes: item.continuityNotes ?? item.continuity_notes ?? "",
  }));
}
```

### Code mới

```ts
export function normalizeScreenContinuity(raw: any): ScreenContinuityItem[] {
  const items = raw?.screens ?? raw?.screenContinuity ?? [];

  if (!Array.isArray(items)) return [];

  return items.map((item: any) => ({
    screenId: item.screenId ?? item.screen_id ?? "",
    beatIds: normalizeNumberArray(item.beatIds ?? item.beat_ids),
    startBeatId:
      item.startBeatId != null
        ? Number(item.startBeatId)
        : item.start_beat_id != null
          ? Number(item.start_beat_id)
          : undefined,
    endBeatId:
      item.endBeatId != null
        ? Number(item.endBeatId)
        : item.end_beat_id != null
          ? Number(item.end_beat_id)
          : undefined,
    screenState: item.screenState ?? item.screen_state ?? "",
    screenProps: normalizeStringArray(item.screenProps ?? item.screen_props),
    screenCharacterStates: normalizeScreenCharacterStates(item),
    continuityNotes: item.continuityNotes ?? item.continuity_notes ?? "",
  }));
}
```

---

# 6. Tạo component mới: ScreenContinuityView

Tạo file:

```txt
components/storyflow/ScreenContinuityView.tsx
```

```tsx
import type { ScreenContinuityItem, ScreenCharacterState } from "../../types";

interface ScreenContinuityViewProps {
  screens: ScreenContinuityItem[];
}

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function SectionLabel({ children }: { children: React.ReactNode }) {
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
  children: React.ReactNode;
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
        <Chip key={item} tone={tone}>
          {item}
        </Chip>
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
        {state.characterId && <Chip tone="violet">{state.characterId}</Chip>}
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
              <Chip tone="violet">
                {screen.screenCharacterStates?.length ?? 0} characters
              </Chip>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {(screen.screenCharacterStates ?? []).map((state) => (
                <CharacterStateCard
                  key={`${screen.screenId}-${state.characterId || state.characterName}`}
                  state={state}
                />
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
```

---

# 7. Render ScreenContinuityView trong StoryFlow.tsx

File:

```txt
components/StoryFlow.tsx
```

## 7.1. Import

```ts
import { ScreenContinuityView } from "./storyflow/ScreenContinuityView";
```

Đảm bảo cũng import normalizer:

```ts
import {
  normalizeScreenContinuity,
  parseJsonSafe,
} from "../services/finalResultBuilderService";
```

Nếu các helper đã import rồi thì không lặp.

## 7.2. Tạo parsed data trong render

Gần khu vực render stage result:

```ts
const screenContinuityData = parseJsonSafe(production.screenContinuity, {
  screens: [],
});

const screenContinuityScreens =
  normalizeScreenContinuity(screenContinuityData);
```

Nếu đang parse trong từng case, có thể đặt trong case `SCREEN_CONTINUITY`.

## 7.3. Render stage SCREEN_CONTINUITY

Tìm switch/render theo `stage` hoặc `currentStage`.

### Code cũ có thể là

```tsx
{stage === ProductionStage.SCREEN_CONTINUITY && (
  <OutputPanel value={production.screenContinuity || ""} />
)}
```

hoặc đang dùng raw JSON.

### Code mới

```tsx
{stage === ProductionStage.SCREEN_CONTINUITY && (
  <div className="space-y-5">
    <ScreenContinuityView screens={screenContinuityScreens} />

    {showRawJson && (
      <pre className="max-h-[640px] overflow-auto whitespace-pre-wrap rounded-3xl bg-slate-950 p-5 text-xs leading-relaxed text-slate-100">
        {JSON.stringify(screenContinuityData, null, 2)}
      </pre>
    )}
  </div>
)}
```

Nếu app chưa có `showRawJson`, có thể bỏ raw JSON hoặc dùng toggle hiện có.

---

# 8. Update manual paste validation

File:

```txt
components/StoryFlow.tsx
```

Tìm:

```ts
validateStageJsonShape
```

## 8.1. Code cũ có thể là

```ts
if (targetStage === ProductionStage.SCREEN_CONTINUITY) {
  if (!parsed || !Array.isArray(parsed.screens)) {
    return 'JSON của Thiết lập bối cảnh phải có dạng { "screens": [...] }.';
  }
}
```

## 8.2. Code mới

```ts
if (targetStage === ProductionStage.SCREEN_CONTINUITY) {
  if (!parsed || !Array.isArray(parsed.screens)) {
    return 'JSON của Thiết lập bối cảnh phải có dạng { "screens": [...] }.';
  }

  const invalidScreen = parsed.screens.find((screen: any) => !screen.screenId);
  if (invalidScreen) {
    return "Mỗi screen trong Thiết lập bối cảnh phải có screenId.";
  }

  const missingBeatLinks = parsed.screens.find((screen: any) => {
    const hasBeatIds =
      Array.isArray(screen.beatIds) && screen.beatIds.length > 0;
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
```

---

# 9. Update ScreenStudioView nếu vẫn dùng chung

Nếu bạn vẫn dùng `ScreenStudioView` để xem screen đã merge, nên thêm Beat Link vào screen header.

File:

```txt
components/storyflow/ScreenStudioView.tsx
```

Trong `ScreenCard`, thêm gần stats hoặc continuity:

```tsx
{(screen.beatIds?.length || screen.startBeatId || screen.endBeatId) && (
  <div className="rounded-2xl border border-slate-200 bg-white p-4">
    <SectionLabel>Beat Link</SectionLabel>
    <p className="mt-2 text-sm font-semibold text-slate-700">
      {screen.beatIds?.length
        ? `Applies to beats: ${screen.beatIds.join(", ")}`
        : `Beat range: ${screen.startBeatId ?? "?"}–${screen.endBeatId ?? "?"}`}
    </p>
  </div>
)}
```

Nếu TypeScript báo `beatIds` chưa có trong `StoryScreen`, thêm optional field vào `types.ts`.

---

# 10. Prompt cho vibe coding agent

Copy prompt này đưa cho Codex/vibe code trong repo StoryFlow.

```txt
Bạn đang sửa UI bước "Thiết lập bối cảnh / Screen Continuity" trong repo StoryFlow.

Mục tiêu:
Stage Screen Continuity đang lưu production.screenContinuity, nhưng UI chưa show đầy đủ dữ liệu theo workflow mới. Cần tạo preview riêng để user thấy screen continuity áp dụng cho những beat nào.

A. Update types.ts
- ScreenContinuityItem phải có:
  beatIds?: number[]
  startBeatId?: number
  endBeatId?: number
- Nếu cần, StoryScreen thêm:
  beatIds?: number[]

B. Update normalizer
- Trong services/finalResultBuilderService.ts:
  add normalizeNumberArray nếu chưa có.
  update normalizeScreenContinuity để parse:
    beatIds / beat_ids
    startBeatId / start_beat_id
    endBeatId / end_beat_id
  giữ screenId, screenState, screenProps, screenCharacterStates, continuityNotes.

C. Add component
- Tạo components/storyflow/ScreenContinuityView.tsx
- Props: { screens: ScreenContinuityItem[] }
- Render mỗi screen card:
  screenId
  beatIds hoặc startBeatId-endBeatId
  screenState
  screenProps chips
  continuityNotes
  screenCharacterStates cards
- Character state card show:
  characterId
  characterName
  outfit
  outfitMainColor
  outfitAccentColor
  accessories
  handheldItems
  appearanceNotes
  stateChanges
- Nếu không có data, show empty state:
  "Chưa có dữ liệu Thiết lập bối cảnh hoặc JSON chưa đúng schema."

D. Update StoryFlow.tsx
- Import ScreenContinuityView.
- Khi stage === ProductionStage.SCREEN_CONTINUITY:
  parse production.screenContinuity bằng parseJsonSafe
  normalize bằng normalizeScreenContinuity
  render <ScreenContinuityView screens={screenContinuityScreens} />
- Raw JSON chỉ show nếu user bật toggle/debug, không làm preview chính.

E. Update manual paste validation
- Trong validateStageJsonShape:
  SCREEN_CONTINUITY cần { screens: [...] }
  mỗi screen cần screenId
  mỗi screen cần beatIds non-empty hoặc startBeatId/endBeatId
  mỗi character state nên có characterName
- Nếu thiếu, báo lỗi rõ.

F. Optional
- Nếu ScreenStudioView vẫn render merged screens, thêm Beat Link section:
  Applies to beats: ...
  hoặc Beat range: ...

G. Do not do
- Không biến Screen Continuity thành per-beat output.
- Không lặp screenState/outfit/accessory trên từng beat.
- Không xóa raw JSON hoàn toàn nếu app đang có debug toggle.
- Không phá ScreenStudioView/FinalResultStudioView hiện tại.

H. Test
- npm run typecheck
- npm run build
- Manual:
  1. Paste JSON Screen Continuity có beatIds.
  2. UI hiển thị screenId.
  3. UI hiển thị Applies to beats.
  4. UI hiển thị screenState, props, continuityNotes.
  5. UI hiển thị outfit/colors/accessories/handheld/appearance/stateChanges.
  6. Paste JSON thiếu beatIds/startBeatId/endBeatId phải báo lỗi.
```

---

# 11. Manual test checklist

```txt
[ ] Có component ScreenContinuityView.
[ ] Stage Thiết lập bối cảnh render ScreenContinuityView.
[ ] UI show screenId.
[ ] UI show beatIds hoặc startBeatId-endBeatId.
[ ] UI show screenState.
[ ] UI show screenProps.
[ ] UI show continuityNotes.
[ ] UI show characterName.
[ ] UI show characterId.
[ ] UI show outfit.
[ ] UI show outfitMainColor.
[ ] UI show outfitAccentColor.
[ ] UI show accessories.
[ ] UI show handheldItems.
[ ] UI show appearanceNotes.
[ ] UI show stateChanges.
[ ] Paste JSON thiếu screens báo lỗi.
[ ] Paste JSON thiếu screenId báo lỗi.
[ ] Paste JSON thiếu beat link báo lỗi.
[ ] typecheck pass.
[ ] build pass.
```

---

# 12. Edge cases

## Case 1 - JSON có beatIds

Expected:

```txt
UI show: Applies to beats: 1, 2, 3.
```

## Case 2 - JSON chỉ có startBeatId/endBeatId

Expected:

```txt
UI show: Beat range: 1–3.
```

## Case 3 - Không có screenCharacterStates

Expected:

```txt
UI show empty character state message, không crash.
```

## Case 4 - stateChanges rỗng

Expected:

```txt
UI show No changes.
```

## Case 5 - paste JSON cũ thiếu beat link

Expected:

```txt
App báo: cần beatIds hoặc startBeatId/endBeatId.
```

---

# 13. Definition of Done

Task hoàn thành khi:

```txt
[ ] User paste Screen Continuity JSON vào app và thấy preview đẹp.
[ ] User biết screen continuity áp dụng cho beat nào.
[ ] UI không còn cảm giác “dán vào nhưng không hiện”.
[ ] Validate chặn JSON thiếu beat link.
[ ] Screen Continuity vẫn là dữ liệu cấp screen, không bị biến thành per-beat.
```

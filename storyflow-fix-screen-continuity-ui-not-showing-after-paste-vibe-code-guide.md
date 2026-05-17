# StoryFlow - Vibe Code Guide: Sửa UI Thiết lập bối cảnh không hiện kết quả sau khi paste JSON

## Mục tiêu

Sửa lỗi:

```txt
JSON Thiết lập bối cảnh đúng cấu trúc
Paste vào app và lưu
Nhưng UI không hiện kết quả
```

JSON đã đúng dạng mới:

```json
{
  "screens": [
    {
      "screenId": "screen_001",
      "beatIds": [1, 2, 3],
      "startBeatId": 1,
      "endBeatId": 3,
      "screenState": "string",
      "screenProps": ["string"],
      "screenCharacterStates": [
        {
          "characterId": "char_001",
          "characterName": "string",
          "outfit": "string",
          "outfitMainColor": "string",
          "outfitAccentColor": "string",
          "accessories": ["string"],
          "handheldItems": ["string"],
          "appearanceNotes": "string",
          "stateChanges": ["string"]
        }
      ],
      "continuityNotes": "string"
    }
  ]
}
```

Vì vậy lỗi nằm ở UI/app flow, không phải do JSON.

Nguyên nhân thường gặp:

```txt
1. UI stage Thiết lập bối cảnh đang render từ project.screens thay vì production.screenContinuity.
2. production.screenContinuity đã lưu nhưng không có preview riêng.
3. normalizeScreenContinuity chưa parse beatIds/startBeatId/endBeatId.
4. replaceScreenContinuity chỉ merge vào screen đã có trong Beat Analysis, nên nếu Beat Analysis chưa đủ screen thì không thấy.
5. Manual paste không validate beat link nên user tưởng đã lưu nhưng preview rỗng.
```

---

# 1. Nguyên tắc sửa đúng

Ở stage **Thiết lập bối cảnh**, UI preview phải render trực tiếp từ:

```ts
production.screenContinuity
```

Không phụ thuộc hoàn toàn vào:

```ts
project.screens
```

Vì `project.screens` chỉ là dữ liệu đã merge với Beat Analysis. Nếu Beat Analysis thiếu screen hoặc merge chưa chạy đúng, UI sẽ không hiện, dù JSON paste đã đúng.

Đúng:

```txt
Paste JSON
→ lưu production.screenContinuity
→ parse production.screenContinuity
→ normalizeScreenContinuity
→ render ScreenContinuityView
```

---

# 2. Files cần sửa / tạo

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

Nếu đã có các file/helper này thì chỉ update.

---

# 3. Update types.ts

File:

```txt
types.ts
```

## 3.1. Sửa ScreenContinuityItem

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
   * Links this screen-level continuity back to beat-based stages.
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

---

## 3.2. Sửa ScreenCharacterState nếu thiếu field

Đảm bảo có đủ:

```ts
export interface ScreenCharacterState {
  characterName: string;
  characterId?: string;

  outfit: string;
  outfitMainColor?: string;
  outfitAccentColor?: string;

  accessories: string[];
  handheldItems: string[];

  appearanceNotes?: string;
  stateChanges?: string[];
}
```

---

## 3.3. Optional: thêm beatIds vào StoryScreen

Nếu muốn ScreenStudioView cũng show beat link sau khi merge:

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

# 4. Update normalizer

File:

```txt
services/finalResultBuilderService.ts
```

## 4.1. Thêm normalizeNumberArray

Nếu chưa có:

```ts
function normalizeNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
}
```

---

## 4.2. Sửa normalizeScreenContinuity

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

## 4.3. Đảm bảo normalizeScreenCharacterStates parse đủ field

```ts
export function normalizeScreenCharacterStates(raw: any): ScreenCharacterState[] {
  const items = raw?.screenCharacterStates ?? raw?.screen_character_states ?? [];

  if (!Array.isArray(items)) return [];

  return items.map((item: any) => ({
    characterName: item.characterName ?? item.character_name ?? item.name ?? "",
    characterId: item.characterId ?? item.character_id,
    outfit: item.outfit ?? "",
    outfitMainColor: item.outfitMainColor ?? item.outfit_main_color ?? "",
    outfitAccentColor: item.outfitAccentColor ?? item.outfit_accent_color ?? "",
    accessories: normalizeStringArray(item.accessories),
    handheldItems: normalizeStringArray(item.handheldItems ?? item.handheld_items),
    appearanceNotes: item.appearanceNotes ?? item.appearance_notes ?? "",
    stateChanges: normalizeStringArray(item.stateChanges ?? item.state_changes),
  }));
}
```

---

# 5. Tạo ScreenContinuityView

Tạo file:

```txt
components/storyflow/ScreenContinuityView.tsx
```

```tsx
import type { ScreenCharacterState, ScreenContinuityItem } from "../../types";

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

# 6. Render ScreenContinuityView trong StoryFlow.tsx

File:

```txt
components/StoryFlow.tsx
```

## 6.1. Import component

Thêm:

```ts
import { ScreenContinuityView } from "./storyflow/ScreenContinuityView";
```

## 6.2. Import normalizer

Đảm bảo có:

```ts
import {
  normalizeScreenContinuity,
  parseJsonSafe,
} from "../services/finalResultBuilderService";
```

Nếu đã import từ service này rồi, chỉ thêm `normalizeScreenContinuity`.

---

## 6.3. Render stage SCREEN_CONTINUITY từ production.screenContinuity

Tìm khu vực render output theo stage, ví dụ:

```tsx
{stage === ProductionStage.SCREEN_CONTINUITY && (
  <OutputPanel value={production.screenContinuity || ""} />
)}
```

hoặc chỗ render preview cũ.

### Code cũ có thể là

```tsx
{stage === ProductionStage.SCREEN_CONTINUITY && (
  <ScreenStudioView project={project} />
)}
```

hoặc:

```tsx
{stage === ProductionStage.SCREEN_CONTINUITY && (
  <pre>{production.screenContinuity}</pre>
)}
```

### Code mới

```tsx
{stage === ProductionStage.SCREEN_CONTINUITY && (() => {
  const screenContinuityData = parseJsonSafe(production.screenContinuity, {
    screens: [],
  });

  const screenContinuityScreens =
    normalizeScreenContinuity(screenContinuityData);

  return (
    <div className="space-y-5">
      <ScreenContinuityView screens={screenContinuityScreens} />

      {showRawJson && (
        <pre className="max-h-[640px] overflow-auto whitespace-pre-wrap rounded-3xl bg-slate-950 p-5 text-xs leading-relaxed text-slate-100">
          {JSON.stringify(screenContinuityData, null, 2)}
        </pre>
      )}
    </div>
  );
})()}
```

Nếu không có `showRawJson`, dùng state/toggle hiện có. Nếu không có toggle, có thể tạm bỏ phần raw JSON:

```tsx
{stage === ProductionStage.SCREEN_CONTINUITY && (() => {
  const screenContinuityData = parseJsonSafe(production.screenContinuity, {
    screens: [],
  });

  const screenContinuityScreens =
    normalizeScreenContinuity(screenContinuityData);

  return <ScreenContinuityView screens={screenContinuityScreens} />;
})()}
```

---

# 7. Sửa lỗi inline IIFE nếu JSX không cho phép

Nếu codebase không thích IIFE trong JSX, tạo biến trước return:

```ts
const screenContinuityData = parseJsonSafe(production.screenContinuity, {
  screens: [],
});

const screenContinuityScreens = normalizeScreenContinuity(screenContinuityData);
```

Sau đó render:

```tsx
{stage === ProductionStage.SCREEN_CONTINUITY && (
  <ScreenContinuityView screens={screenContinuityScreens} />
)}
```

Nếu sợ parse ở mọi stage, có thể dùng `useMemo`:

```ts
const screenContinuityScreens = useMemo(() => {
  if (stage !== ProductionStage.SCREEN_CONTINUITY) return [];

  const data = parseJsonSafe(production.screenContinuity, {
    screens: [],
  });

  return normalizeScreenContinuity(data);
}, [stage, production.screenContinuity]);
```

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

# 9. Sau khi paste phải update production.screenContinuity

Kiểm tra function lưu dữ liệu theo stage.

Tìm:

```ts
updateProductionDataByStage
```

hoặc:

```ts
updateProjectDataByStage
```

Đảm bảo có:

```ts
if (targetStage === ProductionStage.SCREEN_CONTINUITY) {
  setProduction((prev) => ({
    ...prev,
    screenContinuity: finalValueToSave,
  }));
}
```

Nếu dùng switch:

```ts
case ProductionStage.SCREEN_CONTINUITY:
  next.screenContinuity = value;
  break;
```

Và project sync:

```ts
else if (targetStage === ProductionStage.SCREEN_CONTINUITY) {
  setProject((prev) => replaceScreenContinuity(prev, result));
}
```

Quan trọng: **Preview phải đọc `production.screenContinuity`**, không chờ merge project thành công.

---

# 10. Sửa ScreenStudioView nếu vẫn dùng merged screen

File:

```txt
components/storyflow/ScreenStudioView.tsx
```

Nếu app vẫn dùng `ScreenStudioView` ở một vài nơi, thêm Beat Link section để kiểm tra sau merge.

Trong `ScreenCard`, thêm:

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

Nếu TS lỗi `beatIds`, thêm optional `beatIds?: number[]` vào `StoryScreen`.

---

# 11. Debug log tạm thời để xác nhận lưu đúng

Trong quá trình sửa, có thể thêm tạm sau khi paste:

```ts
console.log("SCREEN_CONTINUITY saved", {
  length: finalValueToSave.length,
  parsed,
});
```

Và trong render:

```ts
console.log("SCREEN_CONTINUITY render", {
  raw: production.screenContinuity?.slice(0, 80),
  count: screenContinuityScreens.length,
});
```

Sau khi ổn thì xóa log.

---

# 12. Prompt cho vibe coding agent

Copy prompt này đưa cho Codex/vibe code trong repo StoryFlow.

```txt
Bạn đang sửa UI stage "Thiết lập bối cảnh / Screen Continuity" trong repo StoryFlow.

Vấn đề:
JSON Screen Continuity người dùng paste đã đúng cấu trúc:
{ screens: [{ screenId, beatIds, startBeatId, endBeatId, screenState, screenProps, screenCharacterStates, continuityNotes }] }
Nhưng sau khi paste/lưu, UI không hiện kết quả.

Nguyên nhân cần xử lý:
- UI đang không render trực tiếp từ production.screenContinuity.
- Stage Screen Continuity chưa có preview chuyên biệt.
- Normalizer có thể chưa parse beatIds/startBeatId/endBeatId.
- Validate paste chưa bắt buộc beat link.
- Nếu chỉ render từ project.screens sau merge, sẽ không hiện khi Analysis chưa có đủ screen hoặc merge chưa match.

A. Update types.ts
- ScreenContinuityItem thêm:
  beatIds?: number[]
  startBeatId?: number
  endBeatId?: number
- ScreenCharacterState phải có:
  characterId?
  characterName
  outfit
  outfitMainColor?
  outfitAccentColor?
  accessories
  handheldItems
  appearanceNotes?
  stateChanges?
- Nếu cần, StoryScreen thêm beatIds?: number[].

B. Update services/finalResultBuilderService.ts
- Add normalizeNumberArray nếu chưa có.
- Update normalizeScreenContinuity:
  parse beatIds/beat_ids
  parse startBeatId/start_beat_id
  parse endBeatId/end_beat_id
  parse screenState, screenProps, screenCharacterStates, continuityNotes.
- Ensure normalizeScreenCharacterStates parses:
  outfitMainColor, outfitAccentColor, handheldItems, appearanceNotes, stateChanges.

C. Add component
- Create components/storyflow/ScreenContinuityView.tsx
- Props: { screens: ScreenContinuityItem[] }
- Render:
  screenId
  Applies to beats: beatIds or Beat range: startBeatId-endBeatId
  screenState
  screenProps chips
  continuityNotes
  screenCharacterStates cards
- Character cards show:
  characterId, characterName, outfit, outfitMainColor, outfitAccentColor, accessories, handheldItems, appearanceNotes, stateChanges.
- Empty state:
  "Chưa có dữ liệu Thiết lập bối cảnh hoặc JSON chưa đúng schema."

D. Update components/StoryFlow.tsx
- Import ScreenContinuityView.
- Import normalizeScreenContinuity.
- In SCREEN_CONTINUITY stage render:
  parse production.screenContinuity using parseJsonSafe(production.screenContinuity, { screens: [] })
  normalize with normalizeScreenContinuity
  render <ScreenContinuityView screens={screenContinuityScreens} />
- Do NOT rely only on project.screens for this stage preview.
- Raw JSON can be behind a toggle/debug only.

E. Manual paste validation
- In validateStageJsonShape for SCREEN_CONTINUITY:
  require parsed.screens array
  require each screen.screenId
  require each screen has beatIds non-empty OR startBeatId/endBeatId
  require character states have characterName if present
- Show clear Vietnamese error if invalid.

F. Save flow
- Ensure updateProductionDataByStage saves SCREEN_CONTINUITY into production.screenContinuity.
- Ensure updateProjectDataByStage calls replaceScreenContinuity, but preview must work even if merge fails.

G. Optional ScreenStudioView
- If ScreenStudioView displays merged screens, add Beat Link section showing beatIds or start/end range.

H. Do not do
- Do not convert Screen Continuity into per-beat output.
- Do not duplicate screenState/outfit data on every beat.
- Do not require Beat Analysis screens to exist before previewing production.screenContinuity.
- Do not hide all data behind raw JSON only.

I. Test
- npm run typecheck
- npm run build
- Manual:
  1. Go to Thiết lập bối cảnh.
  2. Paste valid JSON with 21 screens and beatIds.
  3. Save/apply.
  4. UI shows 21 Screen Continuity cards.
  5. Each card shows Applies to beats / Beat range.
  6. Character states show outfit/colors/accessories.
  7. Paste JSON missing beatIds/startBeatId/endBeatId shows error.
```

---

# 13. Manual test checklist

```txt
[ ] Paste JSON đúng cấu trúc vào Thiết lập bối cảnh.
[ ] production.screenContinuity có dữ liệu.
[ ] ScreenContinuityView render từ production.screenContinuity.
[ ] UI hiện 21 screen cards nếu JSON có 21 screens.
[ ] Mỗi screen card hiện screenId.
[ ] Mỗi screen card hiện beatIds hoặc startBeatId-endBeatId.
[ ] Mỗi screen card hiện screenState.
[ ] Mỗi screen card hiện screenProps.
[ ] Mỗi screen card hiện continuityNotes.
[ ] Character card hiện characterName.
[ ] Character card hiện outfit.
[ ] Character card hiện outfitMainColor.
[ ] Character card hiện outfitAccentColor.
[ ] Character card hiện accessories.
[ ] Character card hiện handheldItems.
[ ] Character card hiện appearanceNotes.
[ ] Character card hiện stateChanges.
[ ] Paste JSON thiếu screens báo lỗi.
[ ] Paste JSON thiếu screenId báo lỗi.
[ ] Paste JSON thiếu beat link báo lỗi.
[ ] typecheck pass.
[ ] build pass.
```

---

# 14. Edge cases

## Case 1 - production.screenContinuity có data nhưng project.screens không có screen tương ứng

Expected:

```txt
ScreenContinuityView vẫn hiển thị data từ production.screenContinuity.
```

## Case 2 - JSON có 21 screens nhưng Beat Analysis chỉ có 6 screens

Expected:

```txt
Thiết lập bối cảnh preview vẫn show 21 screens.
Merge vào project có thể chỉ match một phần, nhưng preview không rỗng.
```

## Case 3 - screenCharacterStates rỗng

Expected:

```txt
Card screen vẫn hiện, character state section báo không có character state.
```

## Case 4 - beatIds rỗng nhưng có start/end

Expected:

```txt
UI show Beat range.
```

## Case 5 - stateChanges là []

Expected:

```txt
UI show No changes.
```

---

# 15. Definition of Done

Task hoàn thành khi:

```txt
[ ] UI Thiết lập bối cảnh không còn phụ thuộc hoàn toàn vào project.screens.
[ ] JSON đúng cấu trúc paste vào là hiện preview ngay.
[ ] User thấy rõ screen nào áp dụng cho beat nào.
[ ] Validate chặn JSON thiếu beat link.
[ ] Screen Continuity vẫn là dữ liệu cấp screen, không biến thành per-beat.
```

# StoryFlow - Vibe Code Guide: Sửa Thiết lập bối cảnh để liên kết theo BeatId nhưng vẫn phân tích theo Screen

## Mục tiêu

Hiện app StoryFlow dùng `beatId` làm cơ sở chính cho các bước sau:

```txt
Storyboard
Prompt Engineering
Final Result
Export Image Prompt
```

Nhưng bước **Thiết lập bối cảnh / Screen Continuity** đang phân tích theo `screenId`.

Điều này là đúng về mặt thiết kế, vì bối cảnh/outfit/layout/props thường ổn định trong nhiều beat cùng một screen. Tuy nhiên, để app ghép dữ liệu chắc chắn theo `beatId`, mỗi screen continuity item nên có thêm:

```txt
beatIds
startBeatId
endBeatId
```

Như vậy:

```txt
Screen Continuity vẫn là dữ liệu cấp screen
nhưng có thể map ngược về từng beat bằng beatId
```

---

# 1. Vì sao Thiết lập bối cảnh không nên phân tích theo từng beat?

## 1.1. Beat là khoảnh khắc nhỏ

Ví dụ:

```txt
Beat 1: Lâm Tấn Hải ngồi sau bàn.
Beat 2: Lục Tuyết Lam bước vào.
Beat 3: hai người tranh cãi.
Beat 4: Lục Nhược Linh đứng bên cạnh nghe thấy.
```

Mỗi beat có hành động khác nhau.

## 1.2. Screen là cảnh liên tục

Các beat trên cùng thuộc một screen:

```txt
Screen 1: Văn phòng công ty Lâm gia, buổi sáng.
```

Trong screen này, các yếu tố sau không cần lặp lại ở từng beat:

```txt
- location layout
- ánh sáng
- screen props
- outfit chính của nhân vật
- phụ kiện cấp screen
- trạng thái không gian
- continuity notes
```

Nếu phân tích theo từng beat, JSON sẽ phình rất nhanh và AI dễ bị cắt output.

---

# 2. Thiết kế đúng

## 2.1. Phân tích nội dung

Tạo skeleton:

```json
{
  "screens": [
    {
      "screenId": "screen_001",
      "screenNumber": 1,
      "screenName": "Company Office Conflict",
      "location": "Lâm Family Company",
      "locationId": "loc_001",
      "timeOfDay": "Morning",
      "screenCharacters": ["Lâm Tấn Hải", "Lục Tuyết Lam", "Lục Nhược Linh"],
      "startBeatId": 1,
      "endBeatId": 4,
      "summary": "The family conflict erupts in the company office."
    }
  ],
  "beats": [
    {
      "beatId": 1,
      "screenId": "screen_001",
      "summary": "Lâm Tấn Hải sits behind the desk.",
      "action": "Lâm Tấn Hải controls the conversation from behind the desk."
    }
  ]
}
```

## 2.2. Thiết lập bối cảnh

Bổ sung continuity theo screen, nhưng thêm beat link:

```json
{
  "screens": [
    {
      "screenId": "screen_001",
      "beatIds": [1, 2, 3, 4],
      "startBeatId": 1,
      "endBeatId": 4,
      "screenState": "Orderly corporate office with a large mahogany desk dominating the space.",
      "screenProps": ["mahogany executive desk", "share certificates", "fountain pen"],
      "screenCharacterStates": [],
      "continuityNotes": "Keep the executive desk, share certificates, and tense power distance consistent throughout this screen."
    }
  ]
}
```

## 2.3. Prompt Engineering

Khi tạo prompt cho `beatId = 3`, app làm:

```txt
1. Tìm beat 3 trong Beat Analysis.
2. Lấy beat.screenId = screen_001.
3. Tìm Screen Continuity có screenId = screen_001.
4. Hoặc fallback: tìm Screen Continuity có beatIds chứa 3.
5. Lấy Beat Moment Detail của beat 3.
6. Ghép thành visualPrompt.
```

---

# 3. Thay đổi schema của Screen Continuity

## 3.1. Schema cũ

```json
{
  "screens": [
    {
      "screenId": "screen_001",
      "screenState": "string",
      "screenProps": ["string"],
      "screenCharacterStates": [],
      "continuityNotes": "string"
    }
  ]
}
```

## 3.2. Schema mới

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

---

# 4. Update types.ts

File:

```txt
types.ts
```

## 4.1. Sửa `ScreenContinuityItem`

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
   * Link this screen-level continuity data back to the beats inside this screen.
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

## 4.2. Nếu `StoryScreen` chưa có optional beatIds

Không bắt buộc, vì `StoryScreen` đã có `startBeatId/endBeatId`. Nhưng nếu muốn dùng chung UI, có thể thêm:

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

  /**
   * Optional explicit beat mapping.
   * Usually derived from beats by screenId.
   */
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

# 5. Update Screen Continuity prompt

File:

```txt
services/geminiService.ts
```

Tìm:

```ts
getScreenContinuityPrompt
```

## 5.1. Rule cũ cần sửa

### Code cũ

```txt
Required output for each screen consists ONLY of: screenId, screenState, screenProps, screenCharacterStates, and continuityNotes.
```

### Code mới

```txt
Required output for each screen consists ONLY of: screenId, beatIds, startBeatId, endBeatId, screenState, screenProps, screenCharacterStates, and continuityNotes.
```

## 5.2. Thêm Beat Linking Rule

Thêm vào prompt:

```txt
CRITICAL BEAT LINKING RULE:
For each screen, copy all beatId values that belong to that screen from the APPROVED BEAT SKELETON SOURCE into beatIds.
Do not invent beatIds.
Do not remove beatIds.
Do not renumber beatIds.
The beatIds field is used by the app to attach this screen continuity data back to each beat.
```

## 5.3. Schema mới trong prompt

Thay schema cũ bằng:

```txt
Required JSON Schema:
{
  "screens": [
    {
      "screenId": "screen_001",
      "beatIds": [1, 2, 3],
      "startBeatId": 1,
      "endBeatId": 3,
      "screenState": "string (layout status or changes in this screen)",
      "screenProps": ["string (props permanent/visible on this screen)"],
      "screenCharacterStates": [
        {
          "characterId": "string",
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

## 5.4. Field Rules mới

Thêm:

```txt
FIELD RULES:
- screenId: copy exactly from APPROVED BEAT SKELETON SOURCE.
- beatIds: copy all beatId values belonging to this screen from the approved skeleton.
- startBeatId: copy the first beatId of this screen.
- endBeatId: copy the last beatId of this screen.
- screenState: describe only screen-level layout/status/state.
- screenProps: props visible or important throughout the screen.
- screenCharacterStates: current outfit/accessory state for each character present in this screen.
- handheldItems: only items held generally across this screen, not one-beat temporary items.
- stateChanges: array of screen-level clothing/accessory changes. If none, return [].
- continuityNotes: concise note for maintaining layout, outfit, props, and character positions across the screen.
```

---

# 6. Prompt hoàn chỉnh đề xuất

Dùng prompt này để thay `getScreenContinuityPrompt`.

```ts
export const getScreenContinuityPrompt = (
  analysis: string,
  charLocAnalysis: string,
  style = ""
) => `
You are a master of visual continuity for sequential storytelling (comics, storyboards, webtoons).

Your ONLY task:
Perform Screen-Level Continuity Analysis (Phase 2).
You will analyze the screen skeleton (from Phase 1) and output the screen-level visual details for outfits, props, and location states.

SCREEN CONTINUITY RULES:
1. For each screen in the provided input, determine the outfit and style state of every character present on that screen.
2. CRITICAL SCREEN ID RULE: You must copy the exact screenId (e.g. "screen_001") from the APPROVED BEAT SKELETON SOURCE. Do not invent new screenId formats or use "screen_1" if it is "screen_001".
3. CRITICAL BEAT LINKING RULE: For each screen, copy all beatId values that belong to that screen from the APPROVED BEAT SKELETON SOURCE into beatIds. Do not invent, remove, or renumber beatIds.
4. Do NOT output "screenNumber", "screenName", "location", "locationId", or "timeOfDay".
5. Required output for each screen consists ONLY of: screenId, beatIds, startBeatId, endBeatId, screenState, screenProps, screenCharacterStates, and continuityNotes.
6. In screenCharacterStates, you must specify:
   - characterId
   - characterName
   - outfit
   - outfitMainColor
   - outfitAccentColor
   - accessories
   - handheldItems
   - appearanceNotes
   - stateChanges
7. Return ONLY a valid JSON object. No markdown. No commentary.

Required JSON Schema:
{
  "screens": [
    {
      "screenId": "screen_001",
      "beatIds": [1, 2, 3],
      "startBeatId": 1,
      "endBeatId": 3,
      "screenState": "string (layout status or changes in this screen)",
      "screenProps": ["string (props permanent/visible on this screen)"],
      "screenCharacterStates": [
        {
          "characterId": "string",
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

FIELD RULES:
- screenId: copy exactly from APPROVED BEAT SKELETON SOURCE.
- beatIds: copy all beatId values belonging to this screen from the approved skeleton.
- startBeatId: copy the first beatId of this screen.
- endBeatId: copy the last beatId of this screen.
- screenState: describe only screen-level layout/status/state.
- screenProps: props visible or important throughout the screen.
- screenCharacterStates: current outfit/accessory state for each character present in this screen.
- handheldItems: only items held generally across this screen, not one-beat temporary items.
- stateChanges: array of screen-level clothing/accessory changes. If none, return [].
- continuityNotes: concise note for maintaining layout, outfit, props, and character positions across the screen.

APPROVED BEAT SKELETON SOURCE:
${analysis}

CHARACTER + LOCATION LIBRARY:
${charLocAnalysis}

ART STYLE:
${style}
`;
```

---

# 7. Update responseSchema của generateScreenContinuity

File:

```txt
services/geminiService.ts
```

Tìm:

```ts
generateScreenContinuity
```

Trong `responseSchema`, thêm properties:

```ts
beatIds: {
  type: "array",
  items: { type: "integer" },
},
startBeatId: { type: "integer" },
endBeatId: { type: "integer" },
```

Ví dụ:

```ts
responseSchema: {
  type: "object",
  properties: {
    screens: {
      type: "array",
      items: {
        type: "object",
        properties: {
          screenId: { type: "string" },
          beatIds: {
            type: "array",
            items: { type: "integer" },
          },
          startBeatId: { type: "integer" },
          endBeatId: { type: "integer" },
          screenState: { type: "string" },
          screenProps: {
            type: "array",
            items: { type: "string" },
          },
          screenCharacterStates: {
            type: "array",
            items: {
              type: "object",
              properties: {
                characterId: { type: "string" },
                characterName: { type: "string" },
                outfit: { type: "string" },
                outfitMainColor: { type: "string" },
                outfitAccentColor: { type: "string" },
                accessories: {
                  type: "array",
                  items: { type: "string" },
                },
                handheldItems: {
                  type: "array",
                  items: { type: "string" },
                },
                appearanceNotes: { type: "string" },
                stateChanges: {
                  type: "array",
                  items: { type: "string" },
                },
              },
              required: [
                "characterId",
                "characterName",
                "outfit",
                "outfitMainColor",
                "outfitAccentColor",
                "accessories",
                "handheldItems",
                "appearanceNotes",
                "stateChanges",
              ],
            },
          },
          continuityNotes: { type: "string" },
        },
        required: [
          "screenId",
          "beatIds",
          "startBeatId",
          "endBeatId",
          "screenState",
          "screenProps",
          "screenCharacterStates",
          "continuityNotes",
        ],
      },
    },
  },
  required: ["screens"],
} as any
```

---

# 8. Update normalizer

File có thể là:

```txt
services/finalResultBuilderService.ts
```

Tìm:

```ts
normalizeScreenContinuity
```

## 8.1. Thêm helper normalize number array

Nếu chưa có:

```ts
function normalizeNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
}
```

## 8.2. Sửa normalizeScreenContinuity

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

# 9. Update merge logic

File:

```txt
services/finalResultBuilderService.ts
```

Tìm:

```ts
mergeScreenContinuityIntoScreens
```

## 9.1. Code cũ có thể là

```ts
export function mergeScreenContinuityIntoScreens(
  screens: StoryScreen[],
  continuityItems: ScreenContinuityItem[]
): StoryScreen[] {
  const map = new Map(continuityItems.map((item) => [item.screenId, item]));

  return screens.map((screen) => {
    const item = map.get(screen.screenId);

    if (!item) return screen;

    return {
      ...screen,
      screenState: item.screenState || screen.screenState,
      screenProps: item.screenProps?.length ? item.screenProps : screen.screenProps,
      screenCharacterStates: item.screenCharacterStates?.length
        ? item.screenCharacterStates
        : screen.screenCharacterStates,
      continuityNotes: item.continuityNotes || screen.continuityNotes,
    };
  });
}
```

## 9.2. Code mới

```ts
export function mergeScreenContinuityIntoScreens(
  screens: StoryScreen[],
  continuityItems: ScreenContinuityItem[]
): StoryScreen[] {
  const byScreenId = new Map(
    continuityItems
      .filter((item) => item.screenId)
      .map((item) => [item.screenId, item])
  );

  return screens.map((screen) => {
    const item = byScreenId.get(screen.screenId);

    if (!item) return screen;

    return {
      ...screen,
      beatIds: item.beatIds?.length ? item.beatIds : screen.beatIds,
      startBeatId: item.startBeatId ?? screen.startBeatId,
      endBeatId: item.endBeatId ?? screen.endBeatId,
      screenState: item.screenState || screen.screenState,
      screenProps: item.screenProps?.length ? item.screenProps : screen.screenProps,
      screenCharacterStates: item.screenCharacterStates?.length
        ? item.screenCharacterStates
        : screen.screenCharacterStates,
      continuityNotes: item.continuityNotes || screen.continuityNotes,
    };
  });
}
```

---

# 10. Add helper resolve Screen Continuity by beatId

File:

```txt
services/finalResultBuilderService.ts
```

Hoặc file mới:

```txt
services/sourceOfTruthService.ts
```

Thêm helper:

```ts
export function findScreenContinuityForBeat(
  beatId: number,
  screenId: string | undefined,
  continuityItems: ScreenContinuityItem[]
): ScreenContinuityItem | undefined {
  if (screenId) {
    const byScreenId = continuityItems.find((item) => item.screenId === screenId);
    if (byScreenId) return byScreenId;
  }

  return continuityItems.find((item) => {
    if (item.beatIds?.includes(beatId)) return true;

    if (
      item.startBeatId != null &&
      item.endBeatId != null &&
      beatId >= item.startBeatId &&
      beatId <= item.endBeatId
    ) {
      return true;
    }

    return false;
  });
}
```

Dùng helper này khi Prompt Engineering hoặc Final Builder cần lấy continuity theo beat.

---

# 11. Update UI preview của Screen Continuity

File có thể là:

```txt
components/storyflow/ScreenContinuityView.tsx
```

hoặc trong `StoryFlow.tsx`.

Hiển thị thêm:

```tsx
<p>
  <span className="font-semibold">Beats:</span>{" "}
  {screen.beatIds?.length
    ? screen.beatIds.join(", ")
    : `${screen.startBeatId ?? "?"}–${screen.endBeatId ?? "?"}`}
</p>
```

Nếu chưa có component riêng, thêm vào card screen continuity.

---

# 12. Update manual paste validation

File:

```txt
components/StoryFlow.tsx
```

Trong `validateStageJsonShape`, nếu stage = `SCREEN_CONTINUITY`, kiểm tra thêm:

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
    const hasBeatIds = Array.isArray(screen.beatIds) && screen.beatIds.length > 0;
    const hasRange = screen.startBeatId != null && screen.endBeatId != null;
    return !hasBeatIds && !hasRange;
  });

  if (missingBeatLinks) {
    return "Mỗi screen trong Thiết lập bối cảnh cần có beatIds hoặc startBeatId/endBeatId để liên kết với beat.";
  }
}
```

---

# 13. Prompt Engineering source priority update

File:

```txt
services/geminiService.ts
```

Trong `getEngineerPromptsPrompt`, thêm rule:

```txt
SCREEN CONTINUITY LINKING RULE:
Screen Continuity is screen-level data, but each item also includes beatIds/startBeatId/endBeatId.
When generating a visualPrompt for a beat:
1. Use beat.screenId to find the matching Screen Continuity.
2. If screenId does not match, use beatId against beatIds/startBeatId/endBeatId.
3. Do not invent screen continuity if no match exists.
```

---

# 14. Final Result Builder update

Trong `buildFinalResultFromCurrentProject`, sau khi normalize:

```ts
const screenContinuity = normalizeScreenContinuity(screenContinuityData);
```

Khi merge screens:

```ts
const screens = mergeScreenContinuityIntoScreens(baseScreens, screenContinuity);
```

Nếu FinalResult panel source cần lưu continuity link, có thể thêm:

```ts
refs: {
  characterIds,
  locationId,
  screenId: beat.screenId,
  screenContinuityBeatIds: screen?.beatIds ?? [],
}
```

Không bắt buộc, nhưng hữu ích cho debug.

---

# 15. Prompt cho vibe coding agent

Copy prompt này đưa cho Codex/vibe code trong repo StoryFlow.

```txt
Bạn đang sửa repo StoryFlow.

Mục tiêu:
Bước "Thiết lập bối cảnh / Screen Continuity" vẫn phải phân tích theo screen để giữ continuity và tránh lặp JSON, nhưng app đang dùng beatId làm cơ sở cuối cùng cho Prompt Engineering/Final. Vì vậy mỗi screen continuity item cần thêm beatIds/startBeatId/endBeatId để gắn dữ liệu screen vào từng beat.

A. Update types.ts
- ScreenContinuityItem thêm optional:
  beatIds?: number[]
  startBeatId?: number
  endBeatId?: number
- Nếu cần, StoryScreen cũng thêm beatIds?: number[] optional.

B. Update getScreenContinuityPrompt in services/geminiService.ts
- Add CRITICAL BEAT LINKING RULE:
  For each screen, copy all beatId values belonging to that screen from APPROVED BEAT SKELETON SOURCE into beatIds.
  Do not invent/remove/renumber beatIds.
- Required output per screen should be ONLY:
  screenId, beatIds, startBeatId, endBeatId, screenState, screenProps, screenCharacterStates, continuityNotes.
- Do not output screenNumber/screenName/location/locationId/timeOfDay.
- Update Required JSON Schema to include:
  beatIds: [1,2,3]
  startBeatId: 1
  endBeatId: 3

C. Update generateScreenContinuity responseSchema
- Add properties:
  beatIds: array integer
  startBeatId: integer
  endBeatId: integer
- Add required:
  beatIds
  startBeatId
  endBeatId
- Keep existing required:
  screenId, screenState, screenProps, screenCharacterStates, continuityNotes

D. Update normalizer
- Add normalizeNumberArray if missing.
- Update normalizeScreenContinuity:
  parse beatIds / beat_ids
  parse startBeatId / start_beat_id
  parse endBeatId / end_beat_id

E. Update merge
- mergeScreenContinuityIntoScreens should copy:
  beatIds
  startBeatId
  endBeatId
  screenState
  screenProps
  screenCharacterStates
  continuityNotes

F. Add helper
- Add findScreenContinuityForBeat(beatId, screenId, continuityItems)
- First match by screenId.
- Fallback by beatIds includes beatId.
- Fallback by startBeatId/endBeatId range.

G. Update UI
- Screen Continuity preview should show beatIds or startBeatId-endBeatId.
- This helps user verify which beats each screen applies to.

H. Update manual paste validation
- For SCREEN_CONTINUITY JSON:
  require { screens: [...] }
  require screenId
  require either beatIds non-empty OR startBeatId/endBeatId
- Show clear error if missing beat link.

I. Update Prompt Engineering prompt
- Add SCREEN CONTINUITY LINKING RULE:
  Use beat.screenId to find continuity.
  If screenId fails, use beatId against beatIds/startBeatId/endBeatId.

J. Do not do
- Do not convert Screen Continuity to per-beat output.
- Do not duplicate full screenState/outfit/accessory data on every beat.
- Do not remove screenId.
- Do not remove beatId-only linkage from later stages.
- Do not put characterMomentDetails back into Screen Continuity.
- Do not put screenCharacterStates back into Beat Analysis.

K. Checks
- npm run typecheck
- npm run build

Manual test:
1. Run Beat Analysis.
2. Run Screen Continuity.
3. Output screen continuity includes screenId, beatIds, startBeatId, endBeatId.
4. Paste Screen Continuity JSON.
5. UI shows which beats each screen applies to.
6. Prompt Engineering can still generate prompts by beatId.
7. Final Result still builds.
```

---

# 16. Manual test checklist

```txt
[ ] ScreenContinuityItem has beatIds/startBeatId/endBeatId.
[ ] getScreenContinuityPrompt asks for beatIds/startBeatId/endBeatId.
[ ] responseSchema requires beatIds/startBeatId/endBeatId.
[ ] normalizeScreenContinuity parses beatIds.
[ ] normalizeScreenContinuity parses startBeatId/endBeatId.
[ ] mergeScreenContinuityIntoScreens preserves beat links.
[ ] Manual paste validates beat links.
[ ] UI displays beat range/link for screen continuity.
[ ] Prompt Engineering can link screen continuity by screenId.
[ ] Prompt Engineering can fallback link by beatId.
[ ] Final Result still builds.
[ ] typecheck pass.
[ ] build pass.
```

---

# 17. Edge cases

## Case 1 - AI returns beatIds but no range

Expected:

```txt
Valid.
App can link by beatIds.
```

## Case 2 - AI returns start/end but no beatIds

Expected:

```txt
Valid.
App can link by range.
```

## Case 3 - screenId mismatch but beatIds correct

Expected:

```txt
App can fallback by beatId.
```

## Case 4 - beatIds wrong

Expected:

```txt
Manual preview makes it visible.
User can correct JSON.
```

---

# 18. Definition of Done

Task hoàn thành khi:

```txt
[ ] Thiết lập bối cảnh vẫn phân tích theo screen.
[ ] Mỗi screen continuity item có beat link.
[ ] App có thể gắn screen continuity vào từng beat bằng beatId.
[ ] Không làm JSON bị lặp nặng theo từng beat.
[ ] Prompt Engineering và Final Result vẫn dùng beatId làm cơ sở cuối cùng.
```

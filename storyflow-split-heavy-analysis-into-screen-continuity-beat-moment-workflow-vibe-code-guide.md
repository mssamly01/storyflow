# StoryFlow - Vibe Code Guide: Chia lại workflow để giảm tải Beat Analysis

## Mục tiêu

Sửa vấn đề hiện tại:

```txt
Phân tích nội dung / Beat Analysis đang trả về quá nhiều field.
AI dễ chỉ phân tích được một đoạn đầu của tiểu thuyết rồi dừng.
JSON có thể bị thiếu field ở cuối, nhưng coverageCheck vẫn báo sai là đã cover hết.
```

Nguyên nhân chính:

```txt
Beat Analysis hiện đang ôm quá nhiều việc:
- chia screen
- chia beat
- phân tích nhân vật trong screen
- outfit theo screen
- accessories
- handheld items
- moment details
- posture
- interaction
- props
- location state
```

Hướng sửa đúng:

```txt
Không tiếp tục nhồi field vào Beat Analysis.
Tách field nặng sang các stage riêng.
```

Workflow mới đề xuất:

```txt
1. Phân tích nội dung
2. Nhân vật & Bối cảnh
3. Screen Continuity
4. Beat Moment Detail
5. Phác thảo minh họa
6. Prompt Engineering
7. QA
8. Final Result
```

---

# 1. Workflow cũ và vấn đề

## 1.1. Workflow hiện tại

```txt
Input
→ Beat Analysis
→ Character / Location
→ Storyboard
→ Prompt Engineering
→ QA
→ Final Result
```

## 1.2. Vấn đề

Beat Analysis đang phải trả schema quá lớn:

```txt
screens[]
beats[]
screenCharacterStates[]
characterMomentDetails[]
outfitMainColor
outfitAccentColor
accessories
handheldItems
appearanceNotes
stateChanges
interaction
posture
props
locationState
```

Khi truyện dài, output JSON quá lớn. AI có thể:

```txt
- chỉ phân tích 20–30 beats đầu
- bị cắt giữa chừng
- beat cuối thiếu field
- coverageCheck báo sai allSourceTextCovered = true
```

---

# 2. Workflow mới

## 2.1. Stage 1 - Phân tích nội dung

Mục tiêu:

```txt
Chỉ tạo skeleton nhẹ:
- screens cơ bản
- beats cơ bản
- nhân vật hiện diện/focus/visible/offscreen
- hành động chính
```

Không phân tích outfit/accessory/posture chi tiết ở đây.

Output:

```json
{
  "screens": [
    {
      "screenId": "screen_001",
      "screenNumber": 1,
      "screenName": "string",
      "location": "string",
      "locationId": "loc_001",
      "timeOfDay": "Evening",
      "screenCharacters": ["Character A", "Character B"],
      "startBeatId": 1,
      "endBeatId": 12,
      "summary": "string"
    }
  ],
  "beats": [
    {
      "beatId": 1,
      "screenId": "screen_001",
      "originalText": "string",
      "summary": "string",
      "focusCharacters": ["Character A"],
      "visibleCharacters": ["Character A", "Character B"],
      "offscreenPresentCharacters": ["Character C"],
      "location": "string",
      "locationId": "loc_001",
      "timeOfDay": "Evening",
      "action": "string",
      "visualFocus": "string",
      "atmosphere": "string"
    }
  ]
}
```

---

## 2.2. Stage 2 - Nhân vật & Bối cảnh

Mục tiêu:

```txt
Tạo source-of-truth cố định:
- character profiles
- location profiles
```

Character:

```txt
name
gender
age
height
face
hair + hairColor
eyes + eyeColor
signatureAccessories
defaultStyle
styleNotes
```

Location:

```txt
locationId
name
description
layout
keyObjects
lighting
colorPalette
baseState
continuityNotes
```

---

## 2.3. Stage 3 - Screen Continuity

Mục tiêu:

```txt
Bổ sung dữ liệu theo từng screen:
- screenState
- screenProps
- screenCharacterStates
- outfit theo screen
- accessories theo screen
- handheldItems theo screen
- continuityNotes
```

Input:

```txt
Beat Analysis skeleton
Character Library
Location Library
```

Output:

```json
{
  "screens": [
    {
      "screenId": "screen_001",
      "screenState": "string",
      "screenProps": ["string"],
      "screenCharacterStates": [
        {
          "characterName": "Character A",
          "characterId": "char_001",
          "outfit": "string with color",
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

## 2.4. Stage 4 - Beat Moment Detail

Mục tiêu:

```txt
Bổ sung dữ liệu chi tiết theo từng beat:
- interaction
- posture
- props
- locationState
- characterMomentDetails
- visibleAccessories
- handheldItems
- accessoriesChange
- momentNotes
```

Input:

```txt
Beat Analysis skeleton
Character Library
Location Library
Screen Continuity
```

Output:

```json
{
  "beatDetails": [
    {
      "beatId": 1,
      "interaction": "string",
      "posture": "string",
      "props": ["string"],
      "locationState": "string",
      "characterMomentDetails": [
        {
          "characterName": "Character A",
          "characterId": "char_001",
          "visibleAccessories": ["string"],
          "handheldItems": ["string"],
          "accessoriesChange": ["string"],
          "momentNotes": "string"
        }
      ]
    }
  ]
}
```

---

## 2.5. Stage 5 - Storyboard

Mục tiêu:

```txt
Chỉ xử lý camera/composition.
Không phân tích lại story.
Không tự tạo outfit/accessory.
```

Output:

```txt
shotType
cameraAngle
cameraDistance
lensFeel
composition
foreground
midground
background
characterBlocking
lightingDirection
depthAndPerspective
visualEmphasis
cameraNotes
```

---

## 2.6. Stage 6 - Prompt Engineering

Mục tiêu:

```txt
Tổng hợp dữ liệu đã có để tạo visualPrompt.
Không phân tích lại story.
```

Input:

```txt
Beat Analysis skeleton
Character Library
Location Library
Screen Continuity
Beat Moment Detail
Storyboard
```

Output:

```json
{
  "engineerPrompts": [
    {
      "beatId": 1,
      "visualPrompt": "string"
    }
  ]
}
```

---

## 2.7. Stage 7 - QA

QA kiểm tra prompt, không sinh lại dữ liệu gốc.

---

## 2.8. Stage 8 - Final Result

Final Result build local, không gọi AI.

Input:

```txt
analysis
characterLocationAnalysis
screenContinuity
beatMomentDetails
storyboard
prompts
qaReport
```

---

# 3. Update type: ProductionStage

File:

```txt
types.ts
```

## 3.1. Code cũ có thể là

```ts
export enum ProductionStage {
  INPUT = "input",
  ANALYSIS = "analysis",
  CHARACTER_LOCATION = "character_location",
  STORYBOARD = "storyboard",
  PROMPTS = "prompts",
  QA = "qa",
  FINAL = "final",
  LIBRARY = "library",
}
```

## 3.2. Code mới

```ts
export enum ProductionStage {
  INPUT = "input",
  ANALYSIS = "analysis",
  CHARACTER_LOCATION = "character_location",
  SCREEN_CONTINUITY = "screen_continuity",
  BEAT_MOMENT = "beat_moment",
  STORYBOARD = "storyboard",
  PROMPTS = "prompts",
  QA = "qa",
  FINAL = "final",
  LIBRARY = "library",
}
```

---

# 4. Update type: ProductionData

File:

```txt
types.ts
```

## 4.1. Code cũ có thể là

```ts
export interface ProductionData {
  sourceText?: string;
  analysis?: string;
  characterLocationAnalysis?: string;
  storyboard?: string;
  prompts?: string;
  qaReport?: string;
  finalResult?: string;
}
```

## 4.2. Code mới

```ts
export interface ProductionData {
  sourceText?: string;

  /**
   * Lightweight skeleton:
   * screens + beats only.
   */
  analysis?: string;

  /**
   * Character and location source-of-truth.
   */
  characterLocationAnalysis?: string;

  /**
   * Screen-level outfit/accessory/location continuity.
   */
  screenContinuity?: string;

  /**
   * Beat-level posture/props/moment accessory details.
   */
  beatMomentDetails?: string;

  /**
   * Camera/composition only.
   */
  storyboard?: string;

  /**
   * Final visualPrompt output.
   */
  prompts?: string;

  qaReport?: string;
  finalResult?: string;
}
```

---

# 5. Update StoryScreen / StoryBeat

## 5.1. StoryScreen nên nhẹ trong Beat Analysis

File:

```txt
types.ts
```

Giữ type đầy đủ để downstream dùng được, nhưng Beat Analysis prompt không sinh hết.

```ts
export interface StoryScreen {
  screenId: string;
  screenNumber: number;
  screenName: string;

  location: string;
  locationId?: string;
  timeOfDay: string;

  /**
   * Should be filled by Screen Continuity stage, not Beat Analysis.
   */
  screenState?: string;
  screenCharacters: string[];
  screenProps?: string[];
  screenCharacterStates?: ScreenCharacterState[];

  startBeatId: number;
  endBeatId: number;

  summary: string;
  continuityNotes?: string;

  meta?: EditableMeta;
}
```

## 5.2. StoryBeat nên nhẹ trong Beat Analysis

```ts
export interface StoryBeat {
  beatId: number;
  screenId: string;

  originalText: string;
  summary: string;

  characters?: string[];
  focusCharacters: string[];
  visibleCharacters: string[];
  offscreenPresentCharacters: string[];

  location: string;
  locationId?: string;
  timeOfDay: string;

  action: string;
  visualFocus: string;
  atmosphere: string;

  /**
   * Should be filled by Beat Moment Detail stage.
   */
  interaction?: string;
  posture?: string;
  props?: string[];
  locationState?: string;
  characterMomentDetails?: BeatCharacterMomentDetail[];

  meta?: EditableMeta;
}
```

---

# 6. Add types for separated outputs

File:

```txt
types.ts
```

## 6.1. Screen Continuity output

```ts
export interface ScreenContinuityItem {
  screenId: string;
  screenState: string;
  screenProps: string[];
  screenCharacterStates: ScreenCharacterState[];
  continuityNotes?: string;
}

export interface ScreenContinuityResult {
  screens: ScreenContinuityItem[];
}
```

## 6.2. Beat Moment output

```ts
export interface BeatMomentDetail {
  beatId: number;
  interaction?: string;
  posture?: string;
  props?: string[];
  locationState?: string;
  characterMomentDetails?: BeatCharacterMomentDetail[];
}

export interface BeatMomentDetailResult {
  beatDetails: BeatMomentDetail[];
}
```

---

# 7. Update Beat Analysis prompt

File:

```txt
services/geminiService.ts
```

Tìm:

```txt
getBeatAnalysisPrompt
```

## 7.1. Xóa khỏi Beat Analysis prompt

Bỏ yêu cầu sinh:

```txt
screenCharacterStates
characterMomentDetails
outfitMainColor
outfitAccentColor
accessories
handheldItems
appearanceNotes
stateChanges
screenProps chi tiết
screenState dài
posture dài
interaction dài
props chi tiết
locationState dài
```

## 7.2. Thêm rule mới

```txt
LIGHTWEIGHT BEAT ANALYSIS RULE - CRITICAL:
This stage must only create the story skeleton.

Do NOT generate:
- screenCharacterStates
- detailed outfit/accessory state
- characterMomentDetails
- detailed posture
- detailed props
- detailed locationState
- long interaction descriptions

Those fields will be generated in later stages:
- Screen Continuity
- Beat Moment Detail

Your job:
- split story into screens
- split screens into beats
- keep originalText
- summarize beat
- identify focus/visible/offscreen characters
- identify location/time
- write short action
- write short visualFocus
- write atmosphere
```

## 7.3. New required JSON shape

```txt
REQUIRED JSON SHAPE:
{
  "screens": [
    {
      "screenId": "screen_001",
      "screenNumber": 1,
      "screenName": "Concrete screen name",
      "location": "Concrete location",
      "locationId": "loc_001",
      "timeOfDay": "Evening",
      "screenCharacters": ["Character A", "Character B"],
      "startBeatId": 1,
      "endBeatId": 8,
      "summary": "Short screen summary"
    }
  ],
  "beats": [
    {
      "beatId": 1,
      "screenId": "screen_001",
      "originalText": "Source text for this beat",
      "summary": "Short beat summary",
      "focusCharacters": ["Character A"],
      "visibleCharacters": ["Character A", "Character B"],
      "offscreenPresentCharacters": ["Character C"],
      "location": "Concrete location",
      "locationId": "loc_001",
      "timeOfDay": "Evening",
      "action": "One short drawable action",
      "visualFocus": "Main image focus",
      "atmosphere": "Mood"
    }
  ]
}
```

---

# 8. Add Screen Continuity prompt

File:

```txt
services/geminiService.ts
```

Add function:

```ts
export function getScreenContinuityPrompt(params: {
  analysisJson: string;
  characterLocationJson: string;
}): string {
  return `
You are generating SCREEN CONTINUITY data for StoryFlow.

INPUTS:
1. Approved Beat Analysis skeleton:
${params.analysisJson}

2. Approved Character/Location Library:
${params.characterLocationJson}

TASK:
For each screen, generate only screen-level continuity data:
- screenState
- screenProps
- screenCharacterStates
- continuityNotes

Do not rewrite beats.
Do not generate beat-level posture/props.
Do not create visualPrompt.
Do not create storyboard camera.

SCREEN CHARACTER STATE RULE:
For each character present in the screen, provide:
- current outfit with color
- outfitMainColor
- outfitAccentColor
- accessories visible or relevant in this screen
- handheldItems that persist through this screen
- appearanceNotes
- stateChanges if any

Use Character Library for identity and signature accessories.
Use Location Library for layout/key objects.
Do not include accessories from other screens.

REQUIRED JSON SHAPE:
{
  "screens": [
    {
      "screenId": "screen_001",
      "screenState": "Current state of this screen",
      "screenProps": ["Prop A", "Prop B"],
      "screenCharacterStates": [
        {
          "characterName": "Character A",
          "characterId": "char_001",
          "outfit": "current outfit with color",
          "outfitMainColor": "main color",
          "outfitAccentColor": "accent color",
          "accessories": ["visible screen-level accessory"],
          "handheldItems": ["persistent handheld item"],
          "appearanceNotes": "short note",
          "stateChanges": ["optional change"]
        }
      ],
      "continuityNotes": "Short continuity note"
    }
  ]
}

Return valid JSON only.
`;
}
```

Nếu repo dùng class `GeminiService`, đặt function đúng style hiện tại.

---

# 9. Add Beat Moment Detail prompt

File:

```txt
services/geminiService.ts
```

Add function:

```ts
export function getBeatMomentDetailsPrompt(params: {
  analysisJson: string;
  characterLocationJson: string;
  screenContinuityJson: string;
  beatRange?: string;
}): string {
  return `
You are generating BEAT MOMENT DETAIL data for StoryFlow.

INPUTS:
1. Approved Beat Analysis skeleton:
${params.analysisJson}

2. Approved Character/Location Library:
${params.characterLocationJson}

3. Approved Screen Continuity:
${params.screenContinuityJson}

TASK:
Generate beat-level detail only:
- interaction
- posture
- props
- locationState
- characterMomentDetails

Do not rewrite originalText.
Do not create screens.
Do not create visualPrompt.
Do not create storyboard camera.
Do not repeat screen-level outfit/accessory data unless it changes or is visible in the beat.

${params.beatRange ? `ONLY process these beats: ${params.beatRange}` : ""}

BEAT MOMENT RULE:
Only add characterMomentDetails when needed:
- visible accessory in this beat
- handheld item in this beat
- accessory/item changes
- temporary moment state

REQUIRED JSON SHAPE:
{
  "beatDetails": [
    {
      "beatId": 1,
      "interaction": "Specific interaction in this beat",
      "posture": "Character blocking/posture in this beat",
      "props": ["Beat-specific prop"],
      "locationState": "Specific location state in this beat",
      "characterMomentDetails": [
        {
          "characterName": "Character A",
          "characterId": "char_001",
          "visibleAccessories": ["visible accessory"],
          "handheldItems": ["handheld item"],
          "accessoriesChange": ["change"],
          "momentNotes": "short note"
        }
      ]
    }
  ]
}

Return valid JSON only.
`;
}
```

---

# 10. Update stage list in UI

File:

```txt
components/StoryFlow.tsx
```

Tìm array stage/sidebar kiểu:

```ts
const stages = [
  ProductionStage.INPUT,
  ProductionStage.ANALYSIS,
  ProductionStage.CHARACTER_LOCATION,
  ProductionStage.STORYBOARD,
  ProductionStage.PROMPTS,
  ProductionStage.QA,
  ProductionStage.FINAL,
];
```

Sửa thành:

```ts
const stages = [
  ProductionStage.INPUT,
  ProductionStage.ANALYSIS,
  ProductionStage.CHARACTER_LOCATION,
  ProductionStage.SCREEN_CONTINUITY,
  ProductionStage.BEAT_MOMENT,
  ProductionStage.STORYBOARD,
  ProductionStage.PROMPTS,
  ProductionStage.QA,
  ProductionStage.FINAL,
];
```

Add labels:

```ts
const stageLabels: Record<ProductionStage, string> = {
  [ProductionStage.INPUT]: "Nhập nội dung",
  [ProductionStage.ANALYSIS]: "Phân tích nội dung",
  [ProductionStage.CHARACTER_LOCATION]: "Nhân vật & Bối cảnh",
  [ProductionStage.SCREEN_CONTINUITY]: "Screen Continuity",
  [ProductionStage.BEAT_MOMENT]: "Beat Moment Detail",
  [ProductionStage.STORYBOARD]: "Phác thảo minh họa",
  [ProductionStage.PROMPTS]: "Prompt Engineering",
  [ProductionStage.QA]: "QA",
  [ProductionStage.FINAL]: "Final Result",
  [ProductionStage.LIBRARY]: "Library",
};
```

---

# 11. Update handleProcess stage switch

File:

```txt
components/StoryFlow.tsx
```

Tìm:

```ts
switch (currentStage) {
  case ProductionStage.ANALYSIS:
  ...
}
```

Thêm:

```ts
case ProductionStage.SCREEN_CONTINUITY: {
  result = await gemini.generateScreenContinuity({
    analysisJson: production.analysis ?? "",
    characterLocationJson: production.characterLocationAnalysis ?? "",
  });

  setProduction((prev) => ({
    ...prev,
    screenContinuity: result,
  }));

  break;
}

case ProductionStage.BEAT_MOMENT: {
  result = await gemini.generateBeatMomentDetails({
    analysisJson: production.analysis ?? "",
    characterLocationJson: production.characterLocationAnalysis ?? "",
    screenContinuityJson: production.screenContinuity ?? "",
  });

  setProduction((prev) => ({
    ...prev,
    beatMomentDetails: result,
  }));

  break;
}
```

Nếu service function signatures khác, chỉnh theo pattern hiện tại.

---

# 12. Update Gemini service methods

File:

```txt
services/geminiService.ts
```

Nếu repo đang có class/object `gemini`, thêm methods:

```ts
async generateScreenContinuity(params: {
  analysisJson: string;
  characterLocationJson: string;
}): Promise<string> {
  const prompt = getScreenContinuityPrompt(params);
  return this.generateJson(prompt);
}
```

```ts
async generateBeatMomentDetails(params: {
  analysisJson: string;
  characterLocationJson: string;
  screenContinuityJson: string;
  beatRange?: string;
}): Promise<string> {
  const prompt = getBeatMomentDetailsPrompt(params);
  return this.generateJson(prompt);
}
```

Nếu repo dùng `generateContent`, sửa theo style hiện tại.

---

# 13. Update manual paste/apply logic

Nếu app có manual prompt workflow, cần thêm nơi lưu:

```txt
screenContinuity
beatMomentDetails
```

Khi user paste JSON ở stage `SCREEN_CONTINUITY`:

```ts
setProduction((prev) => ({
  ...prev,
  screenContinuity: manualJson,
}));
```

Khi user paste JSON ở stage `BEAT_MOMENT`:

```ts
setProduction((prev) => ({
  ...prev,
  beatMomentDetails: manualJson,
}));
```

Không lưu nhầm vào `analysis`.

---

# 14. Add normalizers

File:

```txt
services/finalResultBuilderService.ts
```

## 14.1. normalizeScreenContinuity

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

## 14.2. normalizeBeatMomentDetails

```ts
export function normalizeBeatMomentDetails(raw: any): BeatMomentDetail[] {
  const items = raw?.beatDetails ?? raw?.beat_details ?? [];

  if (!Array.isArray(items)) return [];

  return items.map((item: any) => ({
    beatId: Number(item.beatId ?? item.beat_id ?? 0),
    interaction: item.interaction ?? "",
    posture: item.posture ?? "",
    props: normalizeStringArray(item.props),
    locationState: item.locationState ?? item.location_state ?? "",
    characterMomentDetails: normalizeCharacterMomentDetails(item),
  }));
}
```

---

# 15. Add merge helpers

File:

```txt
services/finalResultBuilderService.ts
```

## 15.1. Merge screen continuity into screens

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

## 15.2. Merge beat moments into beats

```ts
export function mergeBeatMomentDetailsIntoBeats(
  beats: StoryBeat[],
  details: BeatMomentDetail[]
): StoryBeat[] {
  const map = new Map(details.map((item) => [item.beatId, item]));

  return beats.map((beat) => {
    const detail = map.get(beat.beatId);

    if (!detail) return beat;

    return {
      ...beat,
      interaction: detail.interaction || beat.interaction,
      posture: detail.posture || beat.posture,
      props: detail.props?.length ? detail.props : beat.props,
      locationState: detail.locationState || beat.locationState,
      characterMomentDetails: detail.characterMomentDetails?.length
        ? detail.characterMomentDetails
        : beat.characterMomentDetails,
    };
  });
}
```

---

# 16. Update Prompt Engineering input

File:

```txt
components/StoryFlow.tsx
```

Trong stage `PROMPTS`, parse thêm:

```ts
const analysisData = parseJsonSafe(production.analysis, {});
const characterLocationData = parseJsonSafe(production.characterLocationAnalysis, {});
const screenContinuityData = parseJsonSafe(production.screenContinuity, {});
const beatMomentData = parseJsonSafe(production.beatMomentDetails, {});
const storyboardData = parseJsonSafe(production.storyboard, {});
```

Gửi vào prompt engineering:

```ts
result = await gemini.generateEngineerPrompts({
  analysisJson: production.analysis ?? "",
  characterLocationJson: production.characterLocationAnalysis ?? "",
  screenContinuityJson: production.screenContinuity ?? "",
  beatMomentDetailsJson: production.beatMomentDetails ?? "",
  storyboardJson: production.storyboard ?? "",
});
```

Nếu function cũ chỉ nhận analysis/storyboard/library, update signature.

---

# 17. Update getEngineerPromptsPrompt

File:

```txt
services/geminiService.ts
```

Thêm input blocks:

```txt
APPROVED SCREEN CONTINUITY:
${screenContinuityJson}

APPROVED BEAT MOMENT DETAILS:
${beatMomentDetailsJson}
```

Thêm rule:

```txt
SOURCE PRIORITY RULE:
- Use Beat Analysis for screen/beat skeleton.
- Use Character/Location Library for identity and location source-of-truth.
- Use Screen Continuity for screen-level outfit/accessories/location state.
- Use Beat Moment Details for posture, props, handheld items, and momentary accessory changes.
- Use Storyboard only for camera/composition.
- Do not re-analyze fields that already exist in approved upstream data.
```

---

# 18. Update Final Builder

File:

```txt
components/StoryFlow.tsx
```

Trong `buildFinalResultFromCurrentProject`:

```ts
const analysisData = parseJsonSafe(production.analysis, {});
const screenContinuityData = parseJsonSafe(production.screenContinuity, {});
const beatMomentData = parseJsonSafe(production.beatMomentDetails, {});

const baseBeats = normalizeBeats(analysisData);
const baseScreens = normalizeScreens(analysisData);

const screenContinuity = normalizeScreenContinuity(screenContinuityData);
const beatMomentDetails = normalizeBeatMomentDetails(beatMomentData);

const screens = mergeScreenContinuityIntoScreens(
  baseScreens.length > 0 ? baseScreens : createFallbackScreensFromBeats(baseBeats),
  screenContinuity
);

const beats = mergeBeatMomentDetailsIntoBeats(baseBeats, beatMomentDetails);

const finalResult = buildFinalResult({
  screens,
  beats,
  panels: normalizeStoryboardPanels(storyboardData),
  engineerPrompts: normalizeEngineerPrompts(promptData),
  qaResults: normalizeQAResults(qaData),
  characters: library.characters,
  locations: library.locations,
});
```

Nhớ import helpers:

```ts
normalizeScreenContinuity
normalizeBeatMomentDetails
mergeScreenContinuityIntoScreens
mergeBeatMomentDetailsIntoBeats
```

---

# 19. Update canBuildFinalResult

Screen Continuity và Beat Moment có thể optional lúc đầu, nhưng nếu muốn prompt đầy đủ, nên warning nếu thiếu.

## 19.1. Minimal build

```ts
function canBuildFinalResult(production: ProductionData): boolean {
  return (
    hasTextValue(production.analysis) &&
    hasTextValue(production.storyboard) &&
    hasTextValue(production.prompts)
  );
}
```

## 19.2. Better readiness

```ts
function hasRecommendedPromptInputs(production: ProductionData): boolean {
  return (
    hasTextValue(production.analysis) &&
    hasTextValue(production.characterLocationAnalysis) &&
    hasTextValue(production.screenContinuity) &&
    hasTextValue(production.beatMomentDetails) &&
    hasTextValue(production.storyboard)
  );
}
```

UI có thể báo:

```txt
Screen Continuity hoặc Beat Moment Detail đang thiếu. Prompt vẫn có thể build nhưng visualPrompt có thể thiếu outfit/accessory/posture.
```

---

# 20. Update UI previews

## 20.1. Screen Continuity View

Có thể reuse ScreenStudioView, nhưng render screen continuity section.

MVP: dùng JSON preview + summary count.

Tốt hơn: tạo:

```txt
components/storyflow/ScreenContinuityView.tsx
```

Hiển thị:

```txt
Screen #1
screenState
screenProps
screenCharacterStates
continuityNotes
```

## 20.2. Beat Moment Detail View

Tạo:

```txt
components/storyflow/BeatMomentDetailView.tsx
```

Hiển thị:

```txt
Beat #1
interaction
posture
props
locationState
characterMomentDetails
```

---

# 21. Update export/save project

Nếu project save/load đang serialize `production`, đảm bảo fields mới được lưu:

```txt
screenContinuity
beatMomentDetails
```

Nếu save project dùng spread `production`, không cần sửa. Nếu whitelist fields, thêm 2 fields mới.

---

# 22. Batch recommendation

Sau khi tách field:

```txt
Beat Analysis: 12–20 beats/batch nếu truyện dài
Screen Continuity: 5–8 screens/batch
Beat Moment Detail: 10–15 beats/batch
Prompt Engineering: 10–20 beats/batch
```

Không nên dùng một request duy nhất cho tiểu thuyết dài.

---

# 23. Prompt cho vibe coding agent

Copy prompt này đưa cho Codex/vibe code trong repo StoryFlow.

```txt
Bạn đang sửa repo StoryFlow.

Mục tiêu:
Chia lại workflow để Beat Analysis nhẹ hơn. Hiện Beat Analysis đang sinh quá nhiều field như screenCharacterStates, characterMomentDetails, accessories, outfit, posture, props, locationState, làm AI output quá dài và bị dừng giữa chừng. Cần tách thành stage mới.

Workflow mới:
1. ANALYSIS = skeleton only
2. CHARACTER_LOCATION = source-of-truth
3. SCREEN_CONTINUITY = screen-level outfit/accessory/location state
4. BEAT_MOMENT = beat-level posture/props/moment accessories
5. STORYBOARD = camera/composition
6. PROMPTS = visualPrompt
7. QA
8. FINAL

A. Update types.ts
- Add ProductionStage.SCREEN_CONTINUITY = "screen_continuity"
- Add ProductionStage.BEAT_MOMENT = "beat_moment"
- Add production fields:
  screenContinuity?: string
  beatMomentDetails?: string
- Make StoryScreen heavy fields optional:
  screenState?, screenProps?, screenCharacterStates?, continuityNotes?
- Make StoryBeat heavy fields optional:
  interaction?, posture?, props?, locationState?, characterMomentDetails?
- Add ScreenContinuityItem / ScreenContinuityResult
- Add BeatMomentDetail / BeatMomentDetailResult

B. Lighten Beat Analysis prompt
- In getBeatAnalysisPrompt, remove from required output:
  screenCharacterStates
  characterMomentDetails
  detailed outfit/accessory state
  posture
  interaction
  props
  locationState
- Add LIGHTWEIGHT BEAT ANALYSIS RULE:
  this stage only creates screens + beats skeleton.
- Required JSON shape only:
  screens: screenId, screenNumber, screenName, location, locationId, timeOfDay, screenCharacters, startBeatId, endBeatId, summary
  beats: beatId, screenId, originalText, summary, focusCharacters, visibleCharacters, offscreenPresentCharacters, location, locationId, timeOfDay, action, visualFocus, atmosphere

C. Add getScreenContinuityPrompt in geminiService.ts
- Inputs: analysisJson, characterLocationJson
- Output:
  { screens: [{ screenId, screenState, screenProps, screenCharacterStates, continuityNotes }] }
- It must not rewrite beats, not create visualPrompt, not create storyboard.

D. Add getBeatMomentDetailsPrompt in geminiService.ts
- Inputs: analysisJson, characterLocationJson, screenContinuityJson, optional beatRange
- Output:
  { beatDetails: [{ beatId, interaction, posture, props, locationState, characterMomentDetails }] }
- It must not rewrite originalText, not create screens, not create visualPrompt.

E. Add service methods
- generateScreenContinuity(...)
- generateBeatMomentDetails(...)

F. Update StoryFlow.tsx
- Add stages to sidebar/stage list:
  SCREEN_CONTINUITY after CHARACTER_LOCATION
  BEAT_MOMENT after SCREEN_CONTINUITY
- Update stage labels:
  "Screen Continuity"
  "Beat Moment Detail"
- In handleProcess:
  SCREEN_CONTINUITY stores result in production.screenContinuity
  BEAT_MOMENT stores result in production.beatMomentDetails
- Manual paste/apply must also save to correct fields.

G. Add normalizers in finalResultBuilderService.ts
- normalizeScreenContinuity(raw)
- normalizeBeatMomentDetails(raw)
- mergeScreenContinuityIntoScreens(screens, continuityItems)
- mergeBeatMomentDetailsIntoBeats(beats, beatDetails)

H. Update Prompt Engineering
- generateEngineerPrompts / getEngineerPromptsPrompt must accept:
  screenContinuityJson
  beatMomentDetailsJson
- Add SOURCE PRIORITY RULE:
  Beat Analysis = skeleton
  Character/Location = identity/location
  Screen Continuity = outfit/accessories/location state
  Beat Moment = posture/props/handheld/accessory changes
  Storyboard = camera/composition
- Do not re-analyze fields already provided.

I. Update Final Result Builder flow
- In buildFinalResultFromCurrentProject:
  parse analysis
  parse screenContinuity
  parse beatMomentDetails
  merge screen continuity into screens
  merge beat moments into beats
  then call buildFinalResult({ screens, beats, ... })

J. UI
- Add simple preview for Screen Continuity:
  screen count, screen states, character states.
- Add simple preview for Beat Moment Detail:
  beat count, posture/props/moment details.
- Existing ScreenStudioView should still work after merged data.
- FinalResultStudioView should use merged data.

K. Save/load
- Ensure screenContinuity and beatMomentDetails are persisted in project.

L. Do not do
- Do not keep screenCharacterStates in Beat Analysis prompt.
- Do not keep characterMomentDetails in Beat Analysis prompt.
- Do not make Beat Analysis heavier.
- Do not call Gemini for Final Result.
- Do not remove backward compatibility for old data.
- Do not break existing export JSON/SRT/TXT/Image Prompt.

M. Checks
- npm run typecheck
- npm run build

Manual test:
1. Run Beat Analysis on a long text.
2. Output is much shorter and does not include screenCharacterStates/characterMomentDetails.
3. Run Character/Location.
4. Run Screen Continuity.
5. Run Beat Moment Detail.
6. Run Storyboard.
7. Run Prompt Engineering.
8. VisualPrompt includes outfit/accessories/posture from separated stages.
9. Final Result builds local.
10. Export functions still work.
```

---

# 24. Manual test checklist

```txt
[ ] ProductionStage has SCREEN_CONTINUITY.
[ ] ProductionStage has BEAT_MOMENT.
[ ] ProductionData has screenContinuity.
[ ] ProductionData has beatMomentDetails.
[ ] Beat Analysis prompt is lightweight.
[ ] Beat Analysis output does not include screenCharacterStates.
[ ] Beat Analysis output does not include characterMomentDetails.
[ ] Screen Continuity stage stores production.screenContinuity.
[ ] Beat Moment stage stores production.beatMomentDetails.
[ ] Manual paste works for new stages.
[ ] Prompt Engineering receives screenContinuityJson.
[ ] Prompt Engineering receives beatMomentDetailsJson.
[ ] Final Builder merges screen continuity into screens.
[ ] Final Builder merges beat moment details into beats.
[ ] Final Result still builds without calling AI.
[ ] Save/load preserves new production fields.
[ ] typecheck pass.
[ ] build pass.
```

---

# 25. Edge cases

## Case 1 - Old project without screenContinuity

Expected:

```txt
App still works.
Merged screens use analysis only.
Prompt may be less detailed but does not crash.
```

## Case 2 - Old project without beatMomentDetails

Expected:

```txt
App still works.
Beats have no posture/props detail unless old analysis had it.
```

## Case 3 - Screen Continuity missing one screen

Expected:

```txt
That screen keeps base analysis data.
No crash.
```

## Case 4 - Beat Moment missing one beat

Expected:

```txt
That beat keeps base analysis data.
No crash.
```

## Case 5 - Prompt Engineering run before Screen Continuity

Expected:

```txt
Either warning or degraded mode.
No crash.
```

---

# 26. Definition of Done

Task hoàn thành khi:

```txt
[ ] Beat Analysis chỉ còn skeleton nhẹ.
[ ] Screen Continuity là stage riêng.
[ ] Beat Moment Detail là stage riêng.
[ ] Prompt Engineering tổng hợp dữ liệu từ các stage mới.
[ ] Final Builder merge dữ liệu đúng.
[ ] App không còn bắt AI trả schema quá nặng trong một bước.
[ ] Workflow giảm nguy cơ AI dừng giữa chừng.
[ ] typecheck/build pass.
```

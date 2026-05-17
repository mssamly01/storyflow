# StoryFlow - Big Update Fix Guide: Sửa lỗi workflow sau khi tách Screen Continuity / Beat Moment

## Mục tiêu

Repo đã update theo hướng tách workflow, nhưng hiện còn một số lỗi cấu trúc khiến:

```txt
- "Thiết lập bối cảnh" paste JSON nhưng không hiện/không merge đúng.
- Prompt Screen Continuity cho AI ngoài trả schema chưa đúng.
- Stage mới SCREEN_CONTINUITY / BEAT_MOMENT chưa được tích hợp đủ vào UI/workflow status.
- Character/Location stage có thể chạy lại Phase 1 sai chỗ.
- Storyboard / QA chưa dùng đầy đủ Screen Continuity + Beat Moment.
- Export Image Prompt vẫn có thể xuất cách dòng đôi thay vì mỗi dòng một visualPrompt.
```

Các lỗi này không phải do ý tưởng tách workflow sai. Ý tưởng đúng, nhưng **big update chưa nối hết các điểm trong code**.

---

# 1. Lỗi lớn nhất: Prompt Screen Continuity sai schema / sai `screenId`

## 1.1. Vấn đề

Prompt hiện đang có schema kiểu:

```json
{
  "screenId": "string (e.g. screen_1)",
  "screenNumber": 1,
  "screenName": "string",
  "location": "string",
  "locationId": "string",
  "timeOfDay": "string",
  "screenState": "string",
  "screenProps": ["string"],
  "screenCharacterStates": [
    {
      "characterId": "string",
      "characterName": "string",
      "outfit": "string",
      "accessories": ["string"]
    }
  ],
  "continuityNotes": "string"
}
```

Sai ở 3 điểm:

```txt
1. Ví dụ screen_1 sai format. App dùng screen_001.
2. Screen Continuity không nên trả lại screenNumber/screenName/location/locationId/timeOfDay.
3. screenCharacterStates thiếu outfitMainColor/outfitAccentColor/handheldItems/appearanceNotes/stateChanges.
```

## 1.2. Code cần sửa

File:

```txt
services/geminiService.ts
```

Tìm:

```ts
export const getScreenContinuityPrompt = ...
```

## 1.3. Thay prompt cũ bằng prompt mới

```ts
export const getScreenContinuityPrompt = (
  analysis: string,
  charLocAnalysis: string,
  style = ""
) => `
You are a master of visual continuity for sequential storytelling (comics, storyboards, webtoons).

Your ONLY task:
Perform Screen-Level Continuity Analysis.
You will analyze the approved screen skeleton and output ONLY screen-level visual continuity data.

You must NOT:
- create new screens
- rename screenId
- rewrite beats
- create beat-level posture
- create beat-level props
- create characterMomentDetails
- create storyboard camera
- create visualPrompt
- output markdown
- output commentary

CRITICAL SCREEN ID RULE:
- screenId must be copied EXACTLY from APPROVED BEAT SKELETON SOURCE.
- Do not convert screen_001 to screen_1.
- Do not convert screen_002 to screen_2.
- Do not invent new screenId.
- Do not omit approved screens.
- Return exactly one continuity item for each approved screen.

SCREEN CONTINUITY RULES:
1. For each approved screen, determine the screen-level visual state.
2. For each character in screenCharacters, create one screenCharacterStates item.
3. If a character appears in multiple continuous screens in the same location/time, their outfit should remain logically consistent.
4. If a character moves to a new location or time of day, outfit/accessory changes must be narratively logical.
5. Use Character Library for stable identity, hair, eyes, signature accessories, and default style.
6. Use Location Library for layout, key objects, lighting, and location continuity.
7. Do NOT list every accessory. Only signature accessories and screen-level accessories.
8. Do NOT include temporary beat-only items unless they persist throughout the whole screen.
9. Return ONLY a valid JSON object. No markdown. No commentary.

Required JSON Schema:
{
  "screens": [
    {
      "screenId": "screen_001",
      "screenState": "string",
      "screenProps": ["string"],
      "screenCharacterStates": [
        {
          "characterId": "char_001",
          "characterName": "string",
          "outfit": "string with complete outfit type, main color, and accent color",
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
- screenId: copy exactly from the approved screen.
- screenState: describe the current visual state/layout/status of this screen.
- screenProps: screen-level props visible or important throughout this screen.
- screenCharacterStates: outfit/accessory state for each character present in this screen.
- outfit: must include outfit type and visible colors.
- outfitMainColor: main outfit color.
- outfitAccentColor: accent/detail colors.
- accessories: worn accessories, signature accessories, or screen-level accessories.
- handheldItems: items held or repeatedly used during the whole screen.
- appearanceNotes: screen-specific visual state, such as tearful eyes, messy hair, formal posture.
- stateChanges: only screen-level changes, not every small beat movement.
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

# 2. Sửa responseSchema của `generateScreenContinuity`

## 2.1. Vấn đề

Hiện responseSchema vẫn yêu cầu các field không cần:

```txt
screenNumber
screenName
location
locationId
timeOfDay
```

và thiếu:

```txt
outfitMainColor
outfitAccentColor
handheldItems
appearanceNotes
stateChanges
```

## 2.2. Code mới

File:

```txt
services/geminiService.ts
```

Tìm:

```ts
export const generateScreenContinuity = async ...
```

Thay `responseSchema` phần `screens.items.properties` thành:

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
          screenState: { type: "string" },
          screenProps: { type: "array", items: { type: "string" } },
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
                accessories: { type: "array", items: { type: "string" } },
                handheldItems: { type: "array", items: { type: "string" } },
                appearanceNotes: { type: "string" },
                stateChanges: { type: "array", items: { type: "string" } },
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

# 3. Sửa prompt + schema Beat Moment Detail

## 3.1. Vấn đề

Beat Moment hiện đang yêu cầu output lại:

```txt
screenId
originalText
```

Điều này không cần thiết vì Beat Moment chỉ nên bổ sung detail theo `beatId`.

Ngoài ra `characterMomentDetails` hiện dùng:

```txt
poseRefinement
expression
handheldItems
```

Trong khi type/prompt trước đó cần:

```txt
visibleAccessories
handheldItems
accessoriesChange
momentNotes
```

## 3.2. Prompt Beat Moment nên là

File:

```txt
services/geminiService.ts
```

Tìm:

```ts
export const getBeatMomentDetailsPrompt = ...
```

Sửa schema yêu cầu thành:

```txt
Required JSON Schema:
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
          "characterId": "char_001",
          "characterName": "string",
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

Thêm rule:

```txt
Do NOT output screenId.
Do NOT output originalText.
Do NOT rewrite beat summary.
Use beatId as the only link key.
```

## 3.3. responseSchema mới

Trong `generateBeatMomentDetails`, sửa responseSchema thành:

```ts
responseSchema: {
  type: "object",
  properties: {
    beatDetails: {
      type: "array",
      items: {
        type: "object",
        properties: {
          beatId: { type: "integer" },
          interaction: { type: "string" },
          posture: { type: "string" },
          props: { type: "array", items: { type: "string" } },
          locationState: { type: "string" },
          characterMomentDetails: {
            type: "array",
            items: {
              type: "object",
              properties: {
                characterId: { type: "string" },
                characterName: { type: "string" },
                visibleAccessories: { type: "array", items: { type: "string" } },
                handheldItems: { type: "array", items: { type: "string" } },
                accessoriesChange: { type: "array", items: { type: "string" } },
                momentNotes: { type: "string" },
              },
              required: [
                "characterId",
                "characterName",
                "visibleAccessories",
                "handheldItems",
                "accessoriesChange",
                "momentNotes",
              ],
            },
          },
        },
        required: [
          "beatId",
          "interaction",
          "posture",
          "props",
          "locationState",
          "characterMomentDetails",
        ],
      },
    },
  },
  required: ["beatDetails"],
} as any
```

---

# 4. Sửa `hasData()` cho stage mới

## 4.1. Vấn đề

Trong `StoryFlow.tsx`, `steps` đã có:

```txt
SCREEN_CONTINUITY
BEAT_MOMENT
```

nhưng `hasData()` hiện chỉ check các stage cũ.

Điều này làm app không biết stage mới đã có dữ liệu hay chưa.

## 4.2. Code cũ

```ts
if (s === ProductionStage.ANALYSIS) return !!production.analysis;
if (s === ProductionStage.CHARACTER_LOCATION) return !!production.characterLocationAnalysis;
if (s === ProductionStage.STORYBOARD) return !!production.storyboard;
if (s === ProductionStage.PROMPTS) return !!production.prompts;
if (s === ProductionStage.QA) return !!production.qaReport;
if (s === ProductionStage.FINAL) return !!production.finalResult;
```

## 4.3. Code mới

```ts
if (s === ProductionStage.ANALYSIS) return !!production.analysis;
if (s === ProductionStage.CHARACTER_LOCATION) return !!production.characterLocationAnalysis;
if (s === ProductionStage.SCREEN_CONTINUITY) return !!production.screenContinuity;
if (s === ProductionStage.BEAT_MOMENT) return !!production.beatMomentDetails;
if (s === ProductionStage.STORYBOARD) return !!production.storyboard;
if (s === ProductionStage.PROMPTS) return !!production.prompts;
if (s === ProductionStage.QA) return !!production.qaReport;
if (s === ProductionStage.FINAL) return !!production.finalResult;
```

---

# 5. Sửa workflow state cho stage mới

## 5.1. Vấn đề

`workflowStateService.createEmptyWorkflow()` hiện chỉ có:

```txt
beatAnalysis
characterLocation
storyboard
promptEngineering
qa
finalResult
```

Nhưng `storyFlowProjectService.replaceScreenContinuity()` đang dùng:

```ts
project.workflow.screenContinuity
```

Nếu `WorkflowState`/`createEmptyWorkflow` chưa có field này, UI status dễ thiếu hoặc lỗi ngầm.

## 5.2. Sửa type WorkflowState

File:

```txt
types.ts
```

Tìm:

```ts
export interface WorkflowState {
  beatAnalysis: WorkflowStepState;
  characterLocation: WorkflowStepState;
  storyboard: WorkflowStepState;
  promptEngineering: WorkflowStepState;
  qa: WorkflowStepState;
  finalResult: WorkflowStepState;
}
```

Sửa thành:

```ts
export interface WorkflowState {
  beatAnalysis: WorkflowStepState;
  characterLocation: WorkflowStepState;
  screenContinuity: WorkflowStepState;
  beatMomentDetails: WorkflowStepState;
  storyboard: WorkflowStepState;
  promptEngineering: WorkflowStepState;
  qa: WorkflowStepState;
  finalResult: WorkflowStepState;
}
```

## 5.3. Sửa createEmptyWorkflow

File:

```txt
services/workflowStateService.ts
```

Code cũ:

```ts
export function createEmptyWorkflow(): WorkflowState {
  return {
    beatAnalysis: createWorkflowStep(),
    characterLocation: createWorkflowStep(),
    storyboard: createWorkflowStep(),
    promptEngineering: createWorkflowStep(),
    qa: createWorkflowStep(),
    finalResult: createWorkflowStep()
  };
}
```

Code mới:

```ts
export function createEmptyWorkflow(): WorkflowState {
  return {
    beatAnalysis: createWorkflowStep(),
    characterLocation: createWorkflowStep(),
    screenContinuity: createWorkflowStep(),
    beatMomentDetails: createWorkflowStep(),
    storyboard: createWorkflowStep(),
    promptEngineering: createWorkflowStep(),
    qa: createWorkflowStep(),
    finalResult: createWorkflowStep(),
  };
}
```

## 5.4. Sửa stale propagation

Khi Beat Analysis đổi, các stage sau phải stale:

```ts
export function markDownstreamStaleAfterBeatEdit(workflow: WorkflowState): WorkflowState {
  return {
    ...workflow,
    screenContinuity: markStepStale(workflow.screenContinuity, "Beat data changed; screen continuity may be outdated."),
    beatMomentDetails: markStepStale(workflow.beatMomentDetails, "Beat data changed; beat moment details may be outdated."),
    storyboard: markStepStale(workflow.storyboard, "Beat data changed; storyboard may be outdated."),
    promptEngineering: markStepStale(workflow.promptEngineering, "Beat data changed; prompts may be outdated."),
    qa: markStepStale(workflow.qa, "Beat data changed; QA may be outdated."),
    finalResult: markStepStale(workflow.finalResult, "Beat data changed; final result must be rebuilt."),
  };
}
```

Khi Character/Location đổi:

```ts
export function markDownstreamStaleAfterCharacterEdit(workflow: WorkflowState): WorkflowState {
  return {
    ...workflow,
    screenContinuity: markStepStale(workflow.screenContinuity, "Character data changed; screen continuity may be outdated."),
    beatMomentDetails: markStepStale(workflow.beatMomentDetails, "Character data changed; beat moment details may be outdated."),
    promptEngineering: markStepStale(workflow.promptEngineering, "Character data changed; prompts may be outdated."),
    qa: markStepStale(workflow.qa, "Character data changed; QA may be outdated."),
    finalResult: markStepStale(workflow.finalResult, "Character data changed; final result must be rebuilt."),
  };
}
```

---

# 6. Sửa `hydrateStoryFlowProject()`

## 6.1. Vấn đề

Nếu workflow cũ không có `screenContinuity`/`beatMomentDetails`, hydrate phải fallback.

File:

```txt
services/storyFlowProjectService.ts
```

Trong `workflow`, thêm:

```ts
screenContinuity: hydrateWorkflowStep(
  rawWorkflow.screenContinuity,
  fallback.workflow.screenContinuity
),
beatMomentDetails: hydrateWorkflowStep(
  rawWorkflow.beatMomentDetails,
  fallback.workflow.beatMomentDetails
),
```

---

# 7. Sửa `getWorkflowStatusForStage()`

## 7.1. Code cũ

```ts
if (s === ProductionStage.ANALYSIS) return project.workflow.beatAnalysis.status;
if (s === ProductionStage.CHARACTER_LOCATION) return project.workflow.characterLocation.status;
if (s === ProductionStage.STORYBOARD) return project.workflow.storyboard.status;
if (s === ProductionStage.PROMPTS) return project.workflow.promptEngineering.status;
if (s === ProductionStage.QA) return project.workflow.qa.status;
if (s === ProductionStage.FINAL) return project.workflow.finalResult.status;
```

## 7.2. Code mới

```ts
if (s === ProductionStage.ANALYSIS) return project.workflow.beatAnalysis.status;
if (s === ProductionStage.CHARACTER_LOCATION) return project.workflow.characterLocation.status;
if (s === ProductionStage.SCREEN_CONTINUITY) return project.workflow.screenContinuity.status;
if (s === ProductionStage.BEAT_MOMENT) return project.workflow.beatMomentDetails.status;
if (s === ProductionStage.STORYBOARD) return project.workflow.storyboard.status;
if (s === ProductionStage.PROMPTS) return project.workflow.promptEngineering.status;
if (s === ProductionStage.QA) return project.workflow.qa.status;
if (s === ProductionStage.FINAL) return project.workflow.finalResult.status;
```

---

# 8. Sửa lỗi Character/Location stage đang chạy lại Phase 1

## 8.1. Vấn đề

Trong `handleProcess`, hiện có logic:

```ts
if (stage === ProductionStage.ANALYSIS || stage === ProductionStage.CHARACTER_LOCATION) {
  result = await gemini.analyzePhase1Analysis(...)
  ...
}
```

Điều này có nghĩa là khi đang ở stage **Nhân vật & Bối cảnh**, bấm process có thể chạy lại cả Beat Analysis + Character Library.

Sau khi đã tách workflow, đây là sai. ANALYSIS và CHARACTER_LOCATION phải tách riêng.

## 8.2. Code mới

```ts
if (stage === ProductionStage.ANALYSIS) {
  const beatResult = await gemini.analyzeBeats(inputData.script, getSelectedStylePrompt());
  const analysisValue = JSON.stringify(beatResult, null, 2);

  setProduction((prev) => ({
    ...prev,
    analysis: analysisValue,
  }));

  updateProductionDataByStage(analysisValue, ProductionStage.ANALYSIS);
  setStage(ProductionStage.CHARACTER_LOCATION);
  setIsLoading(false);
  return;
}

if (stage === ProductionStage.CHARACTER_LOCATION) {
  const existingLibrary = getMasterLibrary();
  const analysisData = parseJsonSafe(production.analysis, { screens: [], beats: [] });
  const beats = normalizeBeats(analysisData);
  const screens = normalizeScreens(analysisData);

  const library = await gemini.generateCharacterLocationLibrary(
    inputData.script,
    beats,
    getSelectedStylePrompt(),
    existingLibrary,
    screens.length ? screens : createFallbackScreensFromBeats(beats)
  );

  const characterLocationValue =
    typeof library === "string" ? library : JSON.stringify(library, null, 2);

  updateProductionDataByStage(characterLocationValue, ProductionStage.CHARACTER_LOCATION);
  setStage(ProductionStage.SCREEN_CONTINUITY);
  setIsLoading(false);
  return;
}
```

Nếu muốn giữ `analyzePhase1Analysis` cho nút “Auto Full Phase 1”, thì dùng riêng mode khác, không dùng trong stage Character/Location.

---

# 9. Sửa Storyboard để nhận dữ liệu đã tách

## 9.1. Vấn đề

`createStoryboard()` hiện chỉ nhận:

```ts
analysis
characterLocationAnalysis
style
```

Nhưng sau khi tách workflow, posture/props/locationState nằm trong:

```txt
beatMomentDetails
screenContinuity
```

Storyboard nên nhận thêm 2 nguồn này, hoặc ít nhất prompt phải biết chúng.

## 9.2. Sửa signature

File:

```txt
services/geminiService.ts
```

```ts
export const getStoryboardPrompt = (
  analysis: string,
  charLocAnalysis: string,
  artStyleDescription = "",
  screenContinuity = "",
  beatMomentDetails = ""
) => {
  ...
}
```

Trong prompt thêm:

```txt
APPROVED SCREEN CONTINUITY:
${screenContinuity}

APPROVED BEAT MOMENT DETAILS:
${beatMomentDetails}
```

Thêm rule:

```txt
Use Beat Moment Details for posture, active props, interaction, and moment-level character state.
Use Screen Continuity for outfit/accessory/location state.
Do not invent posture/props if they already exist in Beat Moment Details.
```

Sửa `createStoryboard`:

```ts
export const createStoryboard = async (
  analysis: string,
  charLocAnalysis: string,
  style = "",
  screenContinuity = "",
  beatMomentDetails = ""
) => {
  ...
  contents: getStoryboardPrompt(
    analysis,
    charLocAnalysis,
    style,
    screenContinuity,
    beatMomentDetails
  )
}
```

Sửa call trong `StoryFlow.tsx`:

```ts
result = await gemini.createStoryboard(
  production.analysis || '',
  production.characterLocationAnalysis || '',
  getSelectedStylePrompt(),
  production.screenContinuity || '',
  production.beatMomentDetails || ''
);
```

---

# 10. Sửa QA để nhận dữ liệu mới

## 10.1. Vấn đề

QA hiện chỉ nhận:

```txt
prompts
charLocAnalysis
style
storyboard
analysis
```

Nên QA không biết Screen Continuity / Beat Moment.

## 10.2. Sửa signature

```ts
export const getQAPrompt = (
  prompts: string,
  charLocAnalysis: string,
  style: string,
  storyboard = "",
  analysis = "",
  screenContinuity = "",
  beatMomentDetails = ""
) => `...`;
```

Trong prompt thêm:

```txt
APPROVED SCREEN CONTINUITY:
${screenContinuity}

APPROVED BEAT MOMENT DETAILS:
${beatMomentDetails}
```

Sửa `runQA`:

```ts
export const runQA = async (
  data: string,
  charLocAnalysis: string,
  style: string,
  storyboard = "",
  analysis = "",
  screenContinuity = "",
  beatMomentDetails = ""
) => {
  ...
  contents: getQAPrompt(
    data,
    charLocAnalysis,
    style,
    storyboard,
    analysis,
    screenContinuity,
    beatMomentDetails
  )
}
```

Sửa call trong `StoryFlow.tsx`:

```ts
result = await gemini.runQA(
  production.prompts || '',
  production.characterLocationAnalysis || '',
  getSelectedStylePrompt(),
  production.storyboard || '',
  production.analysis || '',
  production.screenContinuity || '',
  production.beatMomentDetails || ''
);
```

---

# 11. Sửa Image Prompt Export: mỗi dòng là một prompt

## 11.1. Vấn đề

`buildImagePromptTxtFromFinalResult()` hiện join bằng:

```ts
.join("\n\n")
```

Nhưng yêu cầu của app là:

```txt
mỗi dòng = một visualPrompt
```

## 11.2. Code mới

File:

```txt
services/subtitleExportService.ts
```

Sửa:

```ts
export function buildImagePromptTxtFromFinalResult(
  finalResult: FinalResult | null | undefined
): string {
  if (!finalResult?.panels || !Array.isArray(finalResult.panels)) {
    return "";
  }

  return finalResult.panels
    .map((panel) => {
      const visualPrompt = panel.prompt?.visualPrompt ?? "";
      return visualPrompt.replace(/\s+/g, " ").trim();
    })
    .filter(Boolean)
    .join("\n");
}
```

---

# 12. Thêm validation khi paste JSON stage mới

## 12.1. Vấn đề

Nếu user paste JSON sai shape, app có thể lưu nhưng UI không hiện.

## 12.2. Thêm helper validate

File:

```txt
components/StoryFlow.tsx
```

```ts
function validateStageJsonShape(parsed: any, targetStage: ProductionStage): string | null {
  if (targetStage === ProductionStage.SCREEN_CONTINUITY) {
    if (!parsed || !Array.isArray(parsed.screens)) {
      return 'JSON của Thiết lập bối cảnh phải có dạng { "screens": [...] }.';
    }

    const invalid = parsed.screens.find((screen: any) => !screen.screenId);
    if (invalid) {
      return "Mỗi screen trong Thiết lập bối cảnh phải có screenId.";
    }
  }

  if (targetStage === ProductionStage.BEAT_MOMENT) {
    if (!parsed || !Array.isArray(parsed.beatDetails)) {
      return 'JSON của Chi tiết hành động phải có dạng { "beatDetails": [...] }.';
    }

    const invalid = parsed.beatDetails.find((detail: any) => !detail.beatId);
    if (invalid) {
      return "Mỗi beat detail phải có beatId.";
    }
  }

  return null;
}
```

Trong manual apply:

```ts
const parsed = parseJsonSafe(finalValueToSave, null);
const shapeError = validateStageJsonShape(parsed, stage);

if (shapeError) {
  setError(shapeError);
  return;
}
```

---

# 13. Sửa project sync khi paste Screen Continuity / Beat Moment

Đảm bảo `updateProjectDataByStage` có:

```ts
else if (targetStage === ProductionStage.SCREEN_CONTINUITY) {
  setProject((prev) => replaceScreenContinuity(prev, result));
}
else if (targetStage === ProductionStage.BEAT_MOMENT) {
  setProject((prev) => replaceBeatMomentDetails(prev, result));
}
```

Nếu function hiện đang chỉ update production mà không update project thì Final Result sẽ thiếu data khi build từ project.

---

# 14. Sửa display / preview cho stage mới

## 14.1. Thiết lập bối cảnh

Nếu stage = `SCREEN_CONTINUITY`, render preview từ:

```ts
parseJsonSafe(production.screenContinuity, { screens: [] })
```

Hiển thị:

```txt
Screen ID
screenState
screenProps
screenCharacterStates
continuityNotes
```

Nếu không có screens:

```txt
Chưa có dữ liệu Thiết lập bối cảnh hoặc JSON sai schema.
```

## 14.2. Chi tiết hành động

Nếu stage = `BEAT_MOMENT`, render preview từ:

```ts
parseJsonSafe(production.beatMomentDetails, { beatDetails: [] })
```

Hiển thị:

```txt
Beat ID
interaction
posture
props
locationState
characterMomentDetails
```

---

# 15. Prompt cho vibe coding agent

Copy prompt này đưa cho Codex/vibe code trong repo StoryFlow.

```txt
Bạn đang sửa repo StoryFlow sau big update tách workflow.

Mục tiêu:
Sửa các lỗi còn lại sau khi thêm SCREEN_CONTINUITY và BEAT_MOMENT.

A. Sửa Screen Continuity prompt và schema
- Trong services/geminiService.ts, sửa getScreenContinuityPrompt:
  - Không dùng ví dụ screen_1; dùng screen_001.
  - Thêm CRITICAL SCREEN ID RULE: copy exact screenId từ APPROVED BEAT SKELETON SOURCE.
  - Không yêu cầu output screenNumber/screenName/location/locationId/timeOfDay.
  - Required output chỉ gồm:
    screenId, screenState, screenProps, screenCharacterStates, continuityNotes.
  - screenCharacterStates phải có:
    characterId, characterName, outfit, outfitMainColor, outfitAccentColor,
    accessories, handheldItems, appearanceNotes, stateChanges.
- Sửa generateScreenContinuity responseSchema tương ứng.

B. Sửa Beat Moment prompt và schema
- getBeatMomentDetailsPrompt không được yêu cầu screenId/originalText.
- Output chỉ là:
  { beatDetails: [{ beatId, interaction, posture, props, locationState, characterMomentDetails }] }
- characterMomentDetails dùng:
  characterId, characterName, visibleAccessories, handheldItems, accessoriesChange, momentNotes.
- Sửa generateBeatMomentDetails responseSchema tương ứng.

C. Sửa StoryFlow.tsx
- hasData() phải support:
  SCREEN_CONTINUITY -> production.screenContinuity
  BEAT_MOMENT -> production.beatMomentDetails
- getWorkflowStatusForStage() phải support:
  SCREEN_CONTINUITY -> project.workflow.screenContinuity.status
  BEAT_MOMENT -> project.workflow.beatMomentDetails.status
- handleProcess không được gộp ANALYSIS và CHARACTER_LOCATION chung nữa:
  ANALYSIS chỉ chạy analyzeBeats và lưu production.analysis.
  CHARACTER_LOCATION chỉ chạy generateCharacterLocationLibrary từ analysis đã có.
- Manual paste phải validate:
  SCREEN_CONTINUITY cần { screens: [...] }
  BEAT_MOMENT cần { beatDetails: [...] }
- updateProjectDataByStage phải gọi:
  replaceScreenContinuity
  replaceBeatMomentDetails

D. Sửa workflowStateService + types
- WorkflowState thêm:
  screenContinuity
  beatMomentDetails
- createEmptyWorkflow thêm 2 step mới.
- hydrateStoryFlowProject hydrate 2 step mới.
- stale propagation:
  beat edit/source edit/character edit/location edit phải stale screenContinuity/beatMomentDetails khi phù hợp.

E. Sửa Storyboard + QA
- createStoryboard/getStoryboardPrompt nhận thêm:
  screenContinuity, beatMomentDetails
- Storyboard prompt dùng:
  Screen Continuity = outfit/accessory/location state
  Beat Moment = posture/props/interaction
- runQA/getQAPrompt nhận thêm:
  screenContinuity, beatMomentDetails
- QA kiểm tra visualPrompt với dữ liệu này.

F. Sửa Export Image Prompt
- services/subtitleExportService.ts:
  buildImagePromptTxtFromFinalResult phải join bằng "\n", không phải "\n\n".
- Mỗi dòng là một visualPrompt.

G. Không làm
- Không đưa screenCharacterStates trở lại Beat Analysis.
- Không đưa characterMomentDetails trở lại Beat Analysis.
- Không gọi Gemini ở Final Result.
- Không đổi beatId-only linkage.
- Không phá export JSON/SRT/TXT/Image Prompt.

H. Test
- npm run typecheck
- npm run build
- Manual:
  1. Run Analysis.
  2. Run Character/Location.
  3. Copy prompt Screen Continuity ra AI ngoài, AI trả { screens: [...] } với screenId screen_001.
  4. Paste vào app, stage hiển thị kết quả.
  5. Run/Paste Beat Moment, stage hiển thị beatDetails.
  6. Storyboard dùng data mới.
  7. Prompt Engineering dùng data mới.
  8. Final Result build local.
  9. Export Image Prompt mỗi dòng là một visualPrompt.
```

---

# 16. Manual test checklist

```txt
[ ] Screen Continuity prompt không còn ví dụ screen_1.
[ ] Screen Continuity prompt bắt copy exact screenId.
[ ] Screen Continuity output không yêu cầu screenNumber/screenName/location/timeOfDay.
[ ] screenCharacterStates có outfitMainColor/outfitAccentColor/handheldItems/appearanceNotes/stateChanges.
[ ] Beat Moment output không yêu cầu screenId/originalText.
[ ] Beat Moment uses visibleAccessories/handheldItems/accessoriesChange/momentNotes.
[ ] hasData support SCREEN_CONTINUITY.
[ ] hasData support BEAT_MOMENT.
[ ] workflow status support SCREEN_CONTINUITY.
[ ] workflow status support BEAT_MOMENT.
[ ] Character/Location stage không chạy lại Analysis.
[ ] Manual paste sai schema báo lỗi rõ.
[ ] Manual paste Screen Continuity đúng schema hiển thị kết quả.
[ ] Manual paste Beat Moment đúng schema hiển thị kết quả.
[ ] Storyboard nhận screenContinuity/beatMomentDetails.
[ ] QA nhận screenContinuity/beatMomentDetails.
[ ] Export Image Prompt join bằng một dòng mỗi prompt.
[ ] typecheck pass.
[ ] build pass.
```

---

# 17. Definition of Done

Task hoàn thành khi:

```txt
[ ] Big update workflow chạy liên tục từ Analysis đến Final.
[ ] Không còn dán Screen Continuity JSON mà không hiện.
[ ] Screen Continuity merge được bằng screenId chính xác.
[ ] Beat Moment merge được bằng beatId.
[ ] Stage mới có status và hasData đầy đủ.
[ ] Character/Location không làm lại Beat Analysis.
[ ] Storyboard/QA/Prompt Engineering dùng đủ dữ liệu mới.
[ ] Export Image Prompt đúng 1 prompt / 1 dòng.
```

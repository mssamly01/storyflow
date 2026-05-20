# Storyflow - Fix Field Ownership: Analysis = Beat Skeleton, Chi Tiết Hành Động = Hướng B

## Mục tiêu

Sửa ứng dụng theo hướng field ownership rõ ràng:

```txt
Phân tích nội dung
= Beat Skeleton
= chỉ chia beat + screen skeleton + action/visualFocus cơ bản

Chi tiết hành động
= Beat Moment Details Hướng B
= visualMoment + mainAction + interaction + posture + props + locationState + characterMomentDetails

Phác thảo minh họa
= Storyboard
= shot/camera/composition/framing/blocking

Prompt Engineering
= chỉ tổng hợp các trường đã có thành visualPrompt
= không phân tích mới
```

Mục tiêu sửa cụ thể:

- Rút gọn prompt `getBeatAnalysisPrompt`.
- Không để “Phân tích nội dung” output field của “Chi tiết hành động” hoặc “Storyboard”.
- Nâng `BeatMomentDetail` theo **Hướng B**.
- Chuyển các field `visualMoment`, `mainAction`, `environmentDetails` về “Chi tiết hành động”.
- Chuyển `cameraHint`, `compositionHint` về Storyboard.
- Giữ `sourceSegmentIds` ở “Phân tích nội dung”.
- Giữ `originalText` do app hydrate, AI không output.
- Engineer Prompt chỉ tổng hợp, không tự phân tích lại truyện.

---

# Pland

## 1. Vấn đề hiện tại

Hiện tại prompt “Phân tích nội dung” vẫn đang làm quá nhiều việc.

Nó đang yêu cầu output các field như:

```txt
visualMoment
mainAction
analysis
mentionedCharacters
presentCharacters
enteredCharacters
exitedCharacters
characterVisualStates
interactionTarget
environmentDetails
props
cameraHint
compositionHint
continuityNotes
```

Những field này không nên thuộc “Phân tích nội dung”.

Điều này gây 3 lỗi thiết kế:

```txt
1. Analysis bị nặng, dễ chia beat sai.
2. Analysis trùng nhiệm vụ với “Chi tiết hành động”.
3. Analysis trùng nhiệm vụ với Storyboard vì có cameraHint/compositionHint.
```

---

## 2. Field ownership mới

## 2.1. Phân tích nội dung / Beat Skeleton

Chỉ sở hữu:

```txt
screens
beats
sourceSegmentIds
summary
action
visualFocus
beatType
focusCharacters
visibleCharacters
offscreenPresentCharacters
characters
location
locationId
timeOfDay
atmosphere
```

Không sở hữu:

```txt
visualMoment
mainAction
characterVisualStates
interactionTarget
environmentDetails
props
cameraHint
compositionHint
continuityNotes
```

---

## 2.2. Chi tiết hành động / Beat Moment Details Hướng B

Sở hữu:

```txt
beatId
visualMoment
mainAction
interaction
posture
props
locationState
environmentDetails
characterMomentDetails
continuityNotes
```

Ý nghĩa:

```txt
visualMoment = khoảnh khắc hình ảnh cụ thể của beat
mainAction = hành động chính nhìn thấy được
interaction = ai tương tác với ai/cái gì
posture = tư thế/cử chỉ tổng thể của beat
props = đạo cụ tạm thời trong beat
locationState = trạng thái tạm thời của địa điểm trong beat
environmentDetails = chi tiết môi trường nhìn thấy trong beat
characterMomentDetails = biểu cảm/cử chỉ/vật cầm/phụ kiện nhìn thấy theo từng nhân vật
continuityNotes = ghi chú kế thừa hoặc chưa chắc chắn
```

---

## 2.3. Storyboard

Sở hữu:

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

Không để Analysis sinh `cameraHint` / `compositionHint` nữa.

---

## 2.4. Prompt Engineering

Chỉ sở hữu:

```txt
beatId
visualPrompt
```

Không được phân tích mới.

Nó chỉ tổng hợp:

```txt
Beat Skeleton
+ Character Library
+ Location Library
+ Screen Continuity
+ Beat Moment Details
+ Storyboard
+ Style Settings
```

---

## 3. Data flow sau khi sửa

```txt
Source text
  ↓
segmentSourceText()
  ↓
Phân tích nội dung / Beat Skeleton
  ↓
AI trả screens + beats nhẹ
  ↓
App hydrate originalText từ sourceSegmentIds
  ↓
App validate coverage
  ↓
Nhân vật & Bối cảnh
  ↓
Thiết lập bối cảnh / Screen Continuity
  ↓
Chi tiết hành động / Beat Moment Details Hướng B
  ↓
Storyboard
  ↓
Prompt Engineering resolver
  ↓
Final Result builder
```

---

# Code

## 1. Sửa `getBeatAnalysisPrompt` thành Beat Skeleton Prompt

### Code Cần Sửa

Trong `services/geminiService.ts`, tìm `getBeatAnalysisPrompt`.

Hiện prompt có các đoạn kiểu:

```txt
VISUAL PRECISION RULES:
- Every beat must describe the exact visual moment that should become an image.
- Convert the beat into visible action, posture, facial expression, gaze, position, environment, and composition.
- For each present character, describe visible state in characterVisualStates...
```

Và schema output có:

```json
{
  "visualMoment": "...",
  "mainAction": "...",
  "analysis": "...",
  "mentionedCharacters": ["Character A"],
  "presentCharacters": ["Character A", "Character B"],
  "enteredCharacters": [],
  "exitedCharacters": [],
  "characterVisualStates": [],
  "interactionTarget": [],
  "environmentDetails": "...",
  "props": [],
  "cameraHint": "...",
  "compositionHint": "...",
  "continuityNotes": "..."
}
```

### Code Mới

Thay toàn bộ body của `getBeatAnalysisPrompt` bằng bản Beat Skeleton:

```ts
export const getBeatAnalysisPrompt = (
  source: SourceSegment[] | string,
  artStyleDescription = ""
) => {
  const sourceSegments = Array.isArray(source) ? source : segmentSourceText(source);

  return `
You are a professional story analyst for a vertical comic / visual storyboard generation app.

Your ONLY task:
Analyze the provided SOURCE SEGMENTS and group them into accurate Beat Skeletons and Screen Skeletons.

This step is only for:
- beat rhythm
- sourceSegmentIds coverage
- screen grouping
- basic story action
- basic visual focus
- basic character/location/time/mood

Do NOT perform deep visual analysis in this step.
Do NOT output characterVisualStates, detailed posture, facialExpression, bodyLanguage, gazeTarget, detailed position, props, camera, composition, or final visualPrompt.

CRITICAL ORIGINAL TEXT RULE:
- Do NOT output originalText.
- Do NOT copy, rewrite, summarize, translate, polish, or shorten source text.
- The app will build originalText deterministically from sourceSegmentIds after your response.
- Your job is only to decide which exact sourceSegmentIds belong to each beat.
- Do NOT output sourceSegmenterVersion, sourceTextHash, targetBeatWordMin, targetBeatWordMax, or repairNotes; the app attaches that metadata after validation.

SOURCE SEGMENT COVERAGE RULE - CRITICAL:
1. Every source segment with role "body" must appear in exactly one beat.
2. Keep sourceSegmentIds in source order.
3. Do not skip body segments.
4. Do not duplicate body segments across beats.
5. Use role "title" segments as context only; do not include them unless the story genuinely needs a title-card beat.
6. If a beat covers multiple adjacent source segments, list all of those IDs in sourceSegmentIds.
7. Never invent segment IDs.

CORE BEAT RULE:
- 1 beat = 1 clear visual story moment that can be illustrated in one image.
- A beat is not a paragraph.
- A beat should capture the smallest meaningful visual story moment, not the smallest possible text fragment.
- Do not output deep visual details here. Those belong to the Chi tiết hành động / Beat Moment Details step.

BEAT LENGTH AND RHYTHM:
- Target length: 20–60 words of source text per beat.
- Preferred range: 25–50 words.
- Each beat should be short enough to capture one clear illustration moment.
- Each beat should also be long enough to avoid meaningless micro-beats.
- A beat may be shorter than 20 words only if it is:
  1. a major reveal,
  2. a hard scene cut,
  3. a strong standalone visual moment,
  4. a decisive emotional turning point,
  5. or a short but critical line of dialogue.
- Do not create many short beats in a row.
- If 2–3 adjacent short text fragments belong to the same action, same emotional exchange, same location, or same character focus, merge them into one stronger beat.

BEAT SPLITTING RULES:
- Never cut in the middle of a sentence.
- Split when the visual story moment changes enough to require a different image.
- Split when a new central character takes focus.
- Split when the main visible action changes.
- Split when the interaction target changes in a meaningful way.
- Split when location, time, or scene changes.
- Split when a major emotional turn happens.
- Split when a major reveal or plot turn happens.
- Split when a character moves to a meaningful new position.
- Split when long dialogue changes topic, goal, or emotional direction.

BEAT MERGING RULES:
- Merge short dialogue with its direct action tag.
- Merge characters interacting directly in the same space if they are part of the same emotional exchange.
- If an action/narration ends with a colon ":" introducing dialogue, keep the action and dialogue in the same beat.
- For messaging/calls, merge one Question + Answer pair into one beat. If very short, you may merge two Question + Answer pairs into one beat.
- If several details can be shown in one coherent shot, keep them in the same beat.

ANTI MICRO-BEAT RULES:
- Do NOT create micro-beats.
- A micro-beat is a beat that only contains a tiny gesture, slight gaze shift, blink, small facial change, breath, pause, nod, or short continuation dialogue without a new visual story moment.
- Do not split just because a character looks down, looks up, blinks, smiles slightly, clenches a fist, pauses, breathes, nods, turns slightly, or makes a minor hand movement.
- Minor gestures should stay inside the current beat as context, but do not describe them deeply here.
- Only split when the visual story moment changes enough to require a different image.
- If adjacent details can be shown clearly in one coherent shot, keep them in the same beat.
- Avoid over-fragmentation.
- Maintain a stable cinematic rhythm.

MAJOR VS MINOR CHANGE:
Split for MAJOR changes:
- A new central character takes focus.
- The main visible action changes.
- The interaction target changes in a meaningful way.
- Location, time, or scene changes.
- A major emotional turn happens.
- A major reveal or plot turn happens.
- A character moves to a meaningful new position.
- A long dialogue changes topic, goal, or emotional direction.

Do NOT split for MINOR changes:
- Small facial expression change.
- Slight gaze shift.
- Small hand movement.
- Blink, breath, pause, nod, slight smile, slight frown.
- Short continuation dialogue.
- The same character continuing the same action.
- Several visual details that can fit in one coherent shot.

MERGE BIAS:
- When uncertain, merge adjacent details instead of splitting.
- If the same image can show the action, expression, gaze, interaction, and environment clearly, keep them in one beat.
- Prefer one strong beat over several weak micro-beats.
- A beat may contain multiple small gestures if they support the same main visual moment.
- Short reaction lines should stay with the main interaction unless they clearly form a separate visual story moment.

SCREEN SKELETON RULE - CRITICAL:
- Group consecutive beats into screens.
- A screen is a continuous scene with the same location, timeOfDay, and ongoing character presence.
- Multiple beats can belong to one screen.
- Do not analyze each beat as an isolated scene.
- Use screenId to link beats to screens.
- screenCharacters must include all characters physically present or directly involved in the screen.
- A character can be in screenCharacters but not visibleCharacters. That means the character is still present in the screen, just not in this shot.

CHARACTER PRESENCE RULE:
- focusCharacters = main characters of this beat.
- visibleCharacters = characters physically visible in the beat.
- offscreenPresentCharacters = characters present in the screen but not visible in the current beat.
- characters = union of visibleCharacters and offscreenPresentCharacters.
- A character remains present until the text says they leave, disappear, or the scene changes.

TIME RULE:
- timeOfDay should remain consistent within the same screen.
- Only change timeOfDay when the source text clearly indicates a time change.

FIELD OWNERSHIP RULE:
- Phân tích nội dung owns: sourceSegmentIds, summary, action, visualFocus, beatType, characters, location, timeOfDay, atmosphere, screens.
- Chi tiết hành động owns: visualMoment, mainAction, interaction, posture, props, locationState, environmentDetails, characterMomentDetails.
- Storyboard owns: camera, shot, composition, framing, foreground, background.
- Prompt Engineering owns: visualPrompt only.
- Therefore, do NOT output fields owned by later steps.

Selected art style context:
${artStyleDescription || "No specific style selected."}

SELF-CHECK BEFORE OUTPUT:
Before returning JSON, silently review your beats:
1. Did every body source segment appear in exactly one beat?
2. Did you avoid outputting originalText?
3. Did beat order follow source segment order?
4. Did each beat target 20–60 words after sourceSegmentIds are joined?
5. Did you merge minor gestures to avoid micro-beats?
6. Did you avoid broad sourceSegmentId ranges that combine multiple visual moments?
7. Did you remove deep visual fields such as visualMoment, mainAction, characterVisualStates, props, cameraHint, compositionHint?
8. Did you avoid placeholder fields like "..."?
9. Do not output this self-check. Only output final JSON.

Return ONLY valid JSON with this schema:
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
      "endBeatId": 5,
      "summary": "What happens in this screen"
    }
  ],
  "beats": [
    {
      "beatId": 1,
      "screenId": "screen_001",
      "sourceSegmentIds": ["src_0001", "src_0002"],

      "summary": "Short plot summary.",
      "action": "One main drawable action.",
      "visualFocus": "Specific main image focus.",
      "beatType": "establishing | action | reaction | dialogue | reveal | transition",

      "focusCharacters": ["Character A"],
      "visibleCharacters": ["Character A", "Character B"],
      "offscreenPresentCharacters": ["Character C"],
      "characters": ["Character A", "Character B", "Character C"],

      "location": "Concrete location name",
      "locationId": "loc_001",
      "timeOfDay": "Early Morning | Morning | Mid-day | Afternoon | Golden Hour | Evening | Late Night | Unknown",
      "atmosphere": "Dominant mood."
    }
  ]
}

SOURCE SEGMENTS:
\`\`\`json
${formatSourceSegmentsForPrompt(sourceSegments)}
\`\`\`
`;
};
```

---

## 2. Đánh dấu legacy prompt rõ ràng

### Code Cần Sửa

Nếu đang có:

```ts
const getLegacyBeatAnalysisPrompt = ...
```

nhưng chưa ghi rõ deprecated.

### Code Mới

Thêm comment:

```ts
/**
 * @deprecated Legacy fallback only.
 * Do not use in active Storyflow workflow.
 * Current workflow must use getBeatAnalysisPrompt with sourceSegmentIds.
 */
const getLegacyBeatAnalysisPrompt = ...
```

Nếu có bất kỳ chỗ nào gọi legacy prompt trong đường chính, thay bằng `getBeatAnalysisPrompt`.

---

## 3. Sửa type `BeatAnalysis` thành Beat Skeleton

### Code Cần Sửa

Trong `types.ts`, nếu `BeatAnalysis` hiện có cả visual/camera fields:

```ts
export interface BeatAnalysis {
  beatId: number;
  screenId?: string;
  sourceSegmentIds?: string[];
  originalText: string;

  summary?: string;
  visualMoment?: string;
  mainAction?: string;
  analysis?: string;

  characterVisualStates?: CharacterVisualState[];
  interactionTarget?: InteractionTarget[];
  environmentDetails?: string;
  props?: string[];

  cameraHint?: string;
  compositionHint?: string;

  action?: string;
  visualFocus?: string;
}
```

### Code Mới

Tách rõ:

```ts
export type BeatType =
  | "establishing"
  | "action"
  | "reaction"
  | "dialogue"
  | "reveal"
  | "transition";

export interface BeatSkeleton {
  beatId: number;
  screenId: string;
  sourceSegmentIds: string[];

  /**
   * Hydrated by app from sourceSegmentIds.
   * AI must not output this.
   */
  originalText: string;

  summary: string;
  action: string;
  visualFocus: string;
  beatType: BeatType;

  focusCharacters: string[];
  visibleCharacters: string[];
  offscreenPresentCharacters: string[];

  /**
   * Union of visibleCharacters and offscreenPresentCharacters.
   * Kept for backward compatibility.
   */
  characters: string[];

  location: string;
  locationId?: string;
  timeOfDay: string;
  atmosphere: string;
}

/**
 * Backward compatible name used across existing app.
 * Treat BeatAnalysis as BeatSkeleton after this migration.
 */
export type BeatAnalysis = BeatSkeleton;
```

Nếu nhiều code đang phụ thuộc optional fields, dùng bản mềm hơn để tránh vỡ build:

```ts
export interface BeatAnalysis {
  beatId: number;
  screenId: string;
  sourceSegmentIds: string[];
  originalText: string;

  summary: string;
  action: string;
  visualFocus: string;
  beatType?: BeatType;

  focusCharacters?: string[];
  visibleCharacters?: string[];
  offscreenPresentCharacters?: string[];
  characters?: string[];

  location?: string;
  locationId?: string;
  timeOfDay?: string;
  atmosphere?: string;

  /**
   * Deprecated legacy visual fields.
   * Do not output these from getBeatAnalysisPrompt anymore.
   * Keep optional only to load old projects.
   */
  visualMoment?: string;
  mainAction?: string;
  characterVisualStates?: unknown[];
  interactionTarget?: unknown[];
  environmentDetails?: string;
  props?: string[];
  cameraHint?: string;
  compositionHint?: string;
  continuityNotes?: string;
}
```

---

## 4. Nâng `BeatMomentDetail` theo Hướng B

### Code Cần Sửa

Nếu hiện tại `BeatMomentDetail` là:

```ts
export interface BeatMomentDetail {
  beatId: number;
  interaction: string;
  posture: string;
  props: string[];
  locationState: string;
  characterMomentDetails: BeatCharacterMomentDetail[];
}
```

### Code Mới

Nâng thành Hướng B:

```ts
export interface BeatCharacterMomentDetail {
  characterId?: string;
  characterName: string;

  visibleAccessories?: string[];
  handheldItems?: string[];
  accessoriesChange?: string[];

  poseRefinement?: string;
  expression?: string;
  momentNotes?: string;
}

export interface BeatMomentDetail {
  beatId: number;

  /**
   * Exact illustration moment for this beat.
   * This replaces visualMoment from old BeatAnalysis.
   */
  visualMoment: string;

  /**
   * Main visible action for this beat.
   * This replaces mainAction from old BeatAnalysis.
   */
  mainAction: string;

  /**
   * Specific interaction: who acts toward whom / what.
   */
  interaction: string;

  /**
   * Beat-level posture/gesture summary.
   */
  posture: string;

  /**
   * Temporary visible props used in this beat.
   * Screen-level props stay in Screen Continuity.
   */
  props: string[];

  /**
   * Temporary state of the location in this beat.
   * Stable location description stays in Location Library / Screen Continuity.
   */
  locationState: string;

  /**
   * Visible environment details for this beat.
   * If stable across screen, put it in Screen Continuity instead.
   */
  environmentDetails?: string;

  characterMomentDetails: BeatCharacterMomentDetail[];

  continuityNotes?: string;
}

export interface BeatMomentDetailsResult {
  beatDetails: BeatMomentDetail[];
}
```

---

## 5. Sửa `getBeatMomentDetailsPrompt` theo Hướng B

### Code Cần Sửa

Trong `services/geminiService.ts`, tìm `getBeatMomentDetailsPrompt`.

Nếu schema output chỉ có:

```json
{
  "beatDetails": [
    {
      "beatId": 1,
      "interaction": "...",
      "posture": "...",
      "props": [],
      "locationState": "...",
      "characterMomentDetails": []
    }
  ]
}
```

### Code Mới

Cập nhật prompt thành:

```ts
export const getBeatMomentDetailsPrompt = (
  analysisJson: string,
  characterLocationJson: string,
  screenContinuityJson: string,
  artStyleDescription = ""
) => `
You are Storyflow Beat Moment Details Analyzer.

This step is "Chi tiết hành động".

Your job:
Add detailed beat-level visual/action information to existing beats.

CRITICAL RULES:
- Do NOT split beats.
- Do NOT merge beats.
- Do NOT renumber beats.
- Do NOT change beatId.
- Do NOT change sourceSegmentIds.
- Do NOT change originalText.
- Do NOT change screenId.
- Do NOT change locationId unless the input is clearly invalid.
- Do NOT create camera/composition fields.
- Do NOT create final visualPrompt.
- Do NOT invent major props, actions, injuries, outfits, or locations not supported by the input.
- Keep details grounded in Beat Skeleton + Character/Location Library + Screen Continuity.

FIELD OWNERSHIP:
- Phân tích nội dung already owns sourceSegmentIds, summary, action, visualFocus, characters, location, timeOfDay, atmosphere.
- Chi tiết hành động owns visualMoment, mainAction, interaction, posture, beat-level props, locationState, environmentDetails, characterMomentDetails.
- Storyboard owns shot/camera/composition.
- Prompt Engineering owns final visualPrompt only.

OUTPUT JSON ONLY:
{
  "beatDetails": [
    {
      "beatId": 1,
      "visualMoment": "Exact illustration moment for this beat.",
      "mainAction": "Main visible action in this beat.",
      "interaction": "Specific interaction: who acts toward whom or what.",
      "posture": "Beat-level posture and gesture summary.",
      "props": ["temporary visible prop used in this beat"],
      "locationState": "Temporary state/change of the location in this beat.",
      "environmentDetails": "Visible environment details specific to this beat.",
      "characterMomentDetails": [
        {
          "characterId": "char_001",
          "characterName": "Character A",
          "visibleAccessories": ["accessory visible in this beat"],
          "handheldItems": ["item held in this beat"],
          "accessoriesChange": ["temporary accessory change if any"],
          "poseRefinement": "specific pose/body refinement for this beat",
          "expression": "specific facial expression for this beat",
          "momentNotes": "short note about this character in this beat"
        }
      ],
      "continuityNotes": "Inherited or uncertain details."
    }
  ]
}

DETAIL RULES:
- visualMoment must be specific enough for illustration, but must not include camera/composition.
- mainAction must be visible action, not just emotion.
- interaction must name actor and target when possible.
- posture should describe the main physical state of the beat.
- props should contain only beat-level temporary objects.
- Do not list stable furniture or room objects as props unless the character interacts with them.
- locationState should describe temporary state, such as spilled coffee, opened door, broken object, crowd reaction, rain through window.
- environmentDetails should describe visible detail in this beat, not the whole location profile.
- characterMomentDetails must include only characters relevant to the beat.
- If a character is offscreen, do not invent facial expression.
- Keep outfit/accessories consistent with Screen Continuity.
- If data is missing, keep the field simple instead of inventing.

Selected art style context:
${artStyleDescription || "No specific style selected."}

BEAT SKELETON ANALYSIS:
\`\`\`json
${analysisJson || "{}"}
\`\`\`

CHARACTER / LOCATION LIBRARY:
\`\`\`json
${characterLocationJson || "{}"}
\`\`\`

SCREEN CONTINUITY:
\`\`\`json
${screenContinuityJson || "{}"}
\`\`\`
`;
```

---

## 6. Sửa normalize Beat Moment Details

### Code Cần Sửa

Trong `finalResultBuilderService.ts` hoặc service đang normalize, nếu normalize chỉ lấy field cũ:

```ts
export function normalizeBeatMomentDetails(value: any): BeatMomentDetail[] {
  return items.map((item) => ({
    beatId: Number(item.beatId),
    interaction: String(item.interaction || ""),
    posture: String(item.posture || ""),
    props: Array.isArray(item.props) ? item.props : [],
    locationState: String(item.locationState || ""),
    characterMomentDetails: Array.isArray(item.characterMomentDetails)
      ? item.characterMomentDetails
      : [],
  }));
}
```

### Code Mới

```ts
const toString = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.map(String).map((item) => item.trim()).filter(Boolean)
    : [];

const toNumber = (value: unknown, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

export function normalizeBeatMomentDetails(value: any): BeatMomentDetail[] {
  const rawItems = Array.isArray(value)
    ? value
    : Array.isArray(value?.beatDetails)
      ? value.beatDetails
      : Array.isArray(value?.beatMomentDetails)
        ? value.beatMomentDetails
        : [];

  return rawItems
    .map((item: any) => ({
      beatId: toNumber(item.beatId),

      visualMoment: toString(item.visualMoment),
      mainAction: toString(item.mainAction),

      interaction: toString(item.interaction),
      posture: toString(item.posture),
      props: toStringArray(item.props),
      locationState: toString(item.locationState),
      environmentDetails: toString(item.environmentDetails),

      characterMomentDetails: Array.isArray(item.characterMomentDetails)
        ? item.characterMomentDetails.map((detail: any) => ({
            characterId: toString(detail.characterId),
            characterName: toString(detail.characterName),
            visibleAccessories: toStringArray(detail.visibleAccessories),
            handheldItems: toStringArray(detail.handheldItems),
            accessoriesChange: toStringArray(detail.accessoriesChange),
            poseRefinement: toString(detail.poseRefinement),
            expression: toString(detail.expression),
            momentNotes: toString(detail.momentNotes),
          })).filter((detail: any) => detail.characterName)
        : [],

      continuityNotes: toString(item.continuityNotes),
    }))
    .filter((item: BeatMomentDetail) => item.beatId > 0);
}
```

---

## 7. Sửa visual prompt resolver ưu tiên Beat Moment Hướng B

### Code Cần Sửa

Trong `services/visualPromptResolverService.ts`, nếu resolver còn lấy từ beat:

```ts
const action = beat.mainAction || beat.action || beat.summary;
const visualMoment = beat.visualMoment || beat.visualFocus;
const props = beat.props || moment.props || [];
const composition = storyboard.composition || beat.compositionHint;
const shotType = storyboard.shotType || beat.cameraHint;
```

### Code Mới

Ưu tiên field theo ownership:

```ts
const moment = beatMomentByBeatId.get(Number(beat.beatId));
const panel = storyboardByBeatId.get(Number(beat.beatId));

const visualMoment =
  moment?.visualMoment ||
  beat.visualFocus ||
  beat.action ||
  beat.summary ||
  "";

const mainAction =
  moment?.mainAction ||
  moment?.interaction ||
  beat.action ||
  "";

const interaction = moment?.interaction || "";
const posture = moment?.posture || "";
const beatProps = moment?.props || [];
const locationState = moment?.locationState || "";
const environmentDetails = moment?.environmentDetails || "";

const shotType = panel?.shotType || "";
const cameraAngle = panel?.cameraAngle || "";
const composition = panel?.composition || "";
```

Rule:

```txt
- Không lấy camera/composition từ Beat Analysis nữa.
- Chỉ fallback từ legacy beat.cameraHint/beat.compositionHint nếu cần load project cũ.
```

Nếu muốn backward compatibility:

```ts
const legacyShotType = (beat as any).cameraHint || "";
const legacyComposition = (beat as any).compositionHint || "";

const shotType = panel?.shotType || legacyShotType;
const composition = panel?.composition || legacyComposition;
```

Thêm comment:

```ts
// Legacy fallback only. New Beat Analysis must not output cameraHint/compositionHint.
```

---

## 8. Sửa Storyboard prompt: camera/composition là của Storyboard

### Code Cần Sửa

Nếu Storyboard prompt đang cho phép đổi action/story fields hoặc vẫn dựa vào Analysis camera fields.

### Code Mới

Thêm rule:

```txt
STORYBOARD FIELD OWNERSHIP:
- Storyboard owns shot, camera, composition, framing, blocking, foreground, midground, background, lightingDirection, depthAndPerspective, visualEmphasis.
- Do NOT change beatId, sourceSegmentIds, originalText, summary, action, visualFocus, characters, location, timeOfDay, atmosphere.
- Do NOT invent new story actions.
- Do NOT add major props not present in Beat Skeleton, Screen Continuity, or Beat Moment Details.
- Use Beat Moment Details for visualMoment, mainAction, posture, expression, props, and locationState.
```

Storyboard output should include:

```json
{
  "panels": [
    {
      "beatId": 1,
      "shotType": "medium shot",
      "cameraAngle": "eye level",
      "cameraDistance": "medium",
      "lensFeel": "natural perspective",
      "composition": "Character A on left, key object center frame.",
      "foreground": "...",
      "midground": "...",
      "background": "...",
      "characterBlocking": [],
      "lightingDirection": "...",
      "depthAndPerspective": "...",
      "visualEmphasis": "...",
      "cameraNotes": "..."
    }
  ]
}
```

---

## 9. Sửa Final Result Builder đọc Beat Moment Hướng B

### Code Cần Sửa

Nếu final result đang lấy:

```ts
source: {
  action: beat.action,
  visualFocus: beat.visualFocus,
  interaction: moment.interaction,
  posture: moment.posture,
  props: moment.props,
}
```

nhưng chưa có `visualMoment`, `mainAction`, `environmentDetails`.

### Code Mới

Trong `FinalResultPanel.source`, thêm hoặc map:

```ts
source: {
  originalText: beat.originalText || "",
  summary: beat.summary || "",
  action: beat.action || "",
  visualFocus: beat.visualFocus || "",

  visualMoment: moment?.visualMoment || "",
  mainAction: moment?.mainAction || "",
  interaction: moment?.interaction || "",
  posture: moment?.posture || "",

  atmosphere: beat.atmosphere || "",
  timeOfDay: beat.timeOfDay || "",
  location: beat.location || "",
  locationId: beat.locationId || "",

  locationState: moment?.locationState || "",
  environmentDetails: moment?.environmentDetails || "",

  focusCharacters: beat.focusCharacters || [],
  visibleCharacters: beat.visibleCharacters || [],
  offscreenPresentCharacters: beat.offscreenPresentCharacters || [],

  props: moment?.props || [],
  characterMomentDetails: moment?.characterMomentDetails || [],
}
```

Nếu type chưa có field, cập nhật `FinalResultPanel.source`.

---

## 10. Sửa Engineer Prompt source-of-truth rule

### Code Cần Sửa

Nếu prompt/code comment có ý:

```txt
Analyze the story and create prompts...
```

### Code Mới

Thêm rule vào prompt/resolver comment:

```txt
ENGINEER PROMPT SOURCE-OF-TRUTH RULE:
- Do not re-analyze the story.
- Do not infer new story actions from originalText.
- Do not change characters, location, timeOfDay, props, outfit, posture, or camera.
- Use:
  Beat Skeleton for summary/action/visualFocus/characters/location/time/atmosphere.
  Beat Moment Details for visualMoment/mainAction/interaction/posture/props/locationState/environmentDetails/characterMomentDetails.
  Screen Continuity for outfit/accessories/screen layout/fixed props.
  Storyboard for camera/composition/framing/blocking.
  Character Library and Location Library for reusable appearance/location descriptions.
- If data is missing, keep the visualPrompt simpler instead of inventing.
```

---

## 11. Sửa manual paste cho Analysis

### Code Cần Sửa

Nếu manual paste “Phân tích nội dung” vẫn chấp nhận visual fields và lưu vào project beats.

### Code Mới

Khi paste Analysis:

```ts
const parsed = parseJsonSafe(pastedText);

const rawBeats = Array.isArray(parsed)
  ? parsed
  : Array.isArray(parsed?.beats)
    ? parsed.beats
    : [];

const sanitizedBeats = rawBeats.map((beat: any) => ({
  beatId: beat.beatId,
  screenId: beat.screenId,
  sourceSegmentIds: beat.sourceSegmentIds,

  summary: beat.summary,
  action: beat.action,
  visualFocus: beat.visualFocus,
  beatType: beat.beatType,

  focusCharacters: beat.focusCharacters,
  visibleCharacters: beat.visibleCharacters,
  offscreenPresentCharacters: beat.offscreenPresentCharacters,
  characters: beat.characters,

  location: beat.location,
  locationId: beat.locationId,
  timeOfDay: beat.timeOfDay,
  atmosphere: beat.atmosphere,
}));

// Then hydrate originalText from sourceSegmentIds.
// Do not keep visualMoment/mainAction/characterVisualStates/cameraHint from Analysis paste.
```

Mục đích:

```txt
Nếu người dùng dán JSON cũ có field visual, Analysis sẽ bỏ field đó.
Field visual phải đi vào Chi tiết hành động.
```

---

## 12. Sửa manual paste cho Chi tiết hành động

### Code Cần Sửa

Nếu paste Chi tiết hành động chỉ nhận schema cũ.

### Code Mới

Cho phép schema Hướng B:

```json
{
  "beatDetails": [
    {
      "beatId": 1,
      "visualMoment": "...",
      "mainAction": "...",
      "interaction": "...",
      "posture": "...",
      "props": [],
      "locationState": "...",
      "environmentDetails": "...",
      "characterMomentDetails": [],
      "continuityNotes": "..."
    }
  ]
}
```

Khi paste:

```ts
const parsed = parseJsonSafe(pastedText);
const beatDetails = normalizeBeatMomentDetails(parsed);

setProduction((prev) => ({
  ...prev,
  beatMomentDetails: JSON.stringify({ beatDetails }, null, 2),
}));
```

Không merge vào `production.analysis`.

Không đổi `sourceSegmentIds`.

---

## 13. Backward compatibility cho project cũ

### Code Cần Sửa

Nếu load project cũ có `visualMoment/mainAction` trong beats.

### Code Mới

Tạo helper migrate:

```ts
export function extractLegacyBeatMomentDetailsFromBeats(beats: any[]): BeatMomentDetail[] {
  return beats
    .filter((beat) =>
      beat.visualMoment ||
      beat.mainAction ||
      beat.interactionTarget ||
      beat.characterVisualStates ||
      beat.environmentDetails ||
      beat.props
    )
    .map((beat) => ({
      beatId: Number(beat.beatId),

      visualMoment: String(beat.visualMoment || ""),
      mainAction: String(beat.mainAction || beat.action || ""),
      interaction: Array.isArray(beat.interactionTarget)
        ? beat.interactionTarget
            .map((item: any) =>
              [item.actor, item.target, item.interaction].filter(Boolean).join(" -> ")
            )
            .join("; ")
        : "",
      posture: Array.isArray(beat.characterVisualStates)
        ? beat.characterVisualStates
            .map((state: any) =>
              [state.characterName, state.bodyLanguage, state.position]
                .filter(Boolean)
                .join(": ")
            )
            .join("; ")
        : "",
      props: Array.isArray(beat.props) ? beat.props.map(String) : [],
      locationState: "",
      environmentDetails: String(beat.environmentDetails || ""),
      characterMomentDetails: Array.isArray(beat.characterVisualStates)
        ? beat.characterVisualStates.map((state: any) => ({
            characterName: String(state.characterName || ""),
            poseRefinement: String(state.bodyLanguage || state.position || ""),
            expression: String(state.facialExpression || ""),
            momentNotes: [
              state.gazeTarget ? `gazeTarget: ${state.gazeTarget}` : "",
              state.emotionalState ? `emotion: ${state.emotionalState}` : "",
            ].filter(Boolean).join("; "),
          })).filter((item: any) => item.characterName)
        : [],
      continuityNotes: String(beat.continuityNotes || "Migrated from legacy BeatAnalysis visual fields."),
    }))
    .filter((item) => item.beatId > 0);
}
```

Khi load project cũ:

```ts
if (!production.beatMomentDetails && analysis?.beats?.length) {
  const migrated = extractLegacyBeatMomentDetailsFromBeats(analysis.beats);
  if (migrated.length) {
    production.beatMomentDetails = JSON.stringify({ beatDetails: migrated }, null, 2);
  }
}
```

---

## 14. Checklist cho Vibe Code

```txt
[ ] getBeatAnalysisPrompt chỉ output Beat Skeleton.
[ ] getBeatAnalysisPrompt không output visualMoment/mainAction/characterVisualStates/props/cameraHint/compositionHint.
[ ] BeatAnalysis/BeatSkeleton type được rút gọn hoặc giữ legacy optional.
[ ] BeatMomentDetail nâng theo Hướng B.
[ ] getBeatMomentDetailsPrompt output visualMoment/mainAction/interaction/posture/props/locationState/environmentDetails/characterMomentDetails.
[ ] normalizeBeatMomentDetails hỗ trợ field Hướng B.
[ ] Manual paste Analysis sanitize bỏ field visual/camera.
[ ] Manual paste Chi tiết hành động nhận schema Hướng B.
[ ] Storyboard prompt là nơi duy nhất tạo camera/composition.
[ ] visualPromptResolver ưu tiên Beat Moment Details Hướng B.
[ ] visualPromptResolver chỉ dùng camera/composition từ Storyboard.
[ ] FinalResultBuilder đưa visualMoment/mainAction/environmentDetails từ Beat Moment Details vào source.
[ ] Engineer Prompt/resolver có source-of-truth rule: chỉ tổng hợp, không phân tích mới.
[ ] Backward compatibility: migrate visual fields cũ từ Analysis sang BeatMomentDetails nếu cần.
[ ] npm run typecheck pass.
[ ] npm run build pass.
```

---

## 15. Test case cần chạy

## Test 1: Phân tích nội dung không output field sai

Sau khi chạy “Phân tích nội dung”, JSON không được có:

```txt
visualMoment
mainAction
characterVisualStates
interactionTarget
environmentDetails
props
cameraHint
compositionHint
continuityNotes
```

Chỉ được có:

```txt
screens
beats
sourceSegmentIds
summary
action
visualFocus
beatType
focusCharacters
visibleCharacters
offscreenPresentCharacters
characters
location
locationId
timeOfDay
atmosphere
```

---

## Test 2: Chi tiết hành động output Hướng B

Sau khi chạy “Chi tiết hành động”, JSON phải có:

```txt
beatDetails[]
beatId
visualMoment
mainAction
interaction
posture
props
locationState
environmentDetails
characterMomentDetails
continuityNotes
```

Không được đổi:

```txt
sourceSegmentIds
originalText
screenId
```

---

## Test 3: Storyboard mới có camera/composition

Sau khi chạy Storyboard, camera/composition chỉ xuất hiện trong storyboard:

```txt
shotType
cameraAngle
composition
foreground
midground
background
characterBlocking
```

Analysis không có `cameraHint/compositionHint`.

---

## Test 4: Engineer Prompt không bịa mới

Nếu Chi tiết hành động không có prop “dao”, Engineer Prompt không được thêm “dao”.

Nếu Storyboard không có low angle, Engineer Prompt không tự thêm low angle.

Nếu Screen Continuity nói áo trắng, Engineer Prompt không đổi thành áo đỏ.

---

## Test 5: Final Result merge đúng nguồn

Final Result panel phải lấy:

```txt
originalText từ app hydrate / Analysis
summary/action/visualFocus từ Analysis
visualMoment/mainAction/interaction/posture/props/locationState từ Chi tiết hành động
camera/composition từ Storyboard
visualPrompt từ Prompt Engineering
```

---

# Kết luận

Hướng sửa chuẩn:

```txt
Phân tích nội dung = Beat Skeleton
Chi tiết hành động = Beat Moment Details Hướng B
Storyboard = Camera/Composition
Prompt Engineering = Tổng hợp visualPrompt
Final Result = Snapshot merge
```

Điểm quan trọng nhất:

```txt
Đừng để Analysis sinh field của Chi tiết hành động hoặc Storyboard nữa.
```

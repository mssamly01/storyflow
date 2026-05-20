# Storyflow - Tách “Phân Tích Nội Dung” Thành 2 Bước: Beat Skeleton + Beat Moment Details

## Mục tiêu

Sửa workflow **Phân tích nội dung** để:

- Không để prompt “Phân tích nội dung” ôm quá nhiều việc.
- Bước 1 chỉ tập trung vào **chia beat chính xác**.
- Bước 2 mới phân tích **visual details** cho từng beat.
- Engineer Prompt **không phân tích mới**, chỉ tổng hợp các trường đã có thành `visualPrompt`.
- Giữ nguyên nguyên tắc:
  - AI không tự output `originalText`.
  - AI dùng `sourceSegmentIds`.
  - App hydrate `originalText` từ text gốc.
  - App validate coverage.
  - App không tự hậu xử lý chia/gộp semantic beat.
- Giảm rủi ro:
  - AI tạo micro-beat quá đà.
  - JSON quá dài.
  - AI bỏ sót source segment.
  - AI bịa camera/props/expression quá sớm.
  - Engineer Prompt tự phân tích lại truyện.

---

# Pland

## 1. Vấn đề hiện tại

Prompt **Phân tích nội dung** hiện đang làm quá nhiều việc cùng lúc:

```txt
1. Chia beats.
2. Tạo screen skeleton.
3. Phân tích visualMoment.
4. Phân tích mainAction chi tiết.
5. Phân tích facialExpression / bodyLanguage / gazeTarget.
6. Phân tích position / positionSource.
7. Phân tích interactionTarget.
8. Phân tích environmentDetails.
9. Phân tích props.
10. Gợi ý cameraHint / compositionHint.
11. Continuity nhân vật/vị trí/thời gian.
```

Điều này làm AI dễ bị phân tán khỏi nhiệm vụ quan trọng nhất:

```txt
Chia beat đúng, đủ sourceSegmentIds, không micro-beat, không bỏ sót text.
```

---

## 2. Kiến trúc mới

Tách **Phân tích nội dung** thành 2 bước con:

```txt
Phân tích nội dung
  ├─ 1. Beat Skeleton / Chia Beats
  └─ 2. Beat Moment Details / Chi tiết khoảnh khắc
```

Hoặc trong workflow chính có thể là:

```txt
1. Nhập nội dung
2. Phân tích nội dung - Chia Beats
3. Phân tích chi tiết Beat
4. Thiết lập nhân vật / bối cảnh
5. Storyboard
6. Engineer Prompt
7. Final Result
```

Khuyến nghị UI:

```txt
Giữ một mục lớn “Phân tích nội dung”
nhưng bên trong có 2 tab/action:
[1] Chia Beats
[2] Chi tiết Beat
```

---

## 3. Bước 1: Beat Skeleton

Bước này được quyền chia beat.

Nhiệm vụ:

```txt
- Chia toàn bộ sourceSegments thành beats.
- Cover đủ sourceSegmentIds.
- Không duplicate sourceSegmentIds.
- Không output originalText.
- Giữ target 20–60 từ/beat.
- Ưu tiên 25–50 từ/beat.
- Chống micro-beat.
- Xác định screenId cơ bản.
- Xác định location/time/characters cơ bản.
```

Bước này chỉ output các field nhẹ:

```txt
beatId
screenId
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

Không output ở bước 1:

```txt
visualMoment chi tiết
mainAction chi tiết
characterVisualStates
facialExpression
bodyLanguage
gazeTarget
position chi tiết
positionSource
interactionTarget chi tiết
environmentDetails dài
props chi tiết
cameraHint
compositionHint
visualPrompt
```

---

## 4. Bước 2: Beat Moment Details

Bước này **không được chia lại beat**.

Input của bước này là output từ bước 1:

```txt
beatId
originalText đã hydrate
summary
action
visualFocus
screenId
characters
location
timeOfDay
atmosphere
```

Nhiệm vụ:

```txt
- Làm giàu visual detail cho từng beat.
- Không thay đổi beatId.
- Không thay đổi sourceSegmentIds.
- Không chia/gộp beat.
- Không đổi screenId/location/time nếu không có lỗi rõ ràng.
- Không tạo visualPrompt cuối.
```

Bước 2 output:

```txt
beatId
visualMoment
mainAction
characterVisualStates
interactionTarget
environmentDetails
props
continuityNotes
```

Các field camera/composition nên để Storyboard xử lý.

---

## 5. Storyboard

Storyboard nhận Beat Skeleton + Beat Moment Details.

Storyboard nên xử lý:

```txt
shotType
cameraAngle
framing
composition
foreground
background
panelDescription
panelMood
```

Storyboard không chia lại beat.

Storyboard không viết visualPrompt cuối.

---

## 6. Engineer Prompt

Engineer Prompt chỉ tổng hợp.

Không được:

```txt
- Không tự phân tích lại truyện.
- Không tự đổi hành động.
- Không tự đổi nhân vật.
- Không tự đổi location.
- Không tự thêm props lớn không có trong dữ liệu.
- Không tự chia lại beat.
```

Chỉ được:

```txt
- Lấy Beat Skeleton.
- Lấy Beat Moment Details.
- Lấy Character Library.
- Lấy Location Library.
- Lấy Storyboard camera/composition.
- Lấy style settings.
- Tổng hợp thành visualPrompt cuối.
```

---

## 7. Data flow mới

```txt
Source text
  ↓
segmentSourceText()
  ↓
Beat Skeleton Prompt
  ↓
AI trả beats + screens nhẹ
  ↓
App hydrate originalText từ sourceSegmentIds
  ↓
App validate coverage
  ↓
Beat Moment Details Prompt
  ↓
AI trả visual details theo beatId
  ↓
App merge details vào project.beats hoặc lưu production.beatMomentDetails
  ↓
Storyboard
  ↓
Engineer Prompt
  ↓
Final Result
```

---

# Code

## 1. Sửa prompt “Phân tích nội dung” hiện tại thành Beat Skeleton Prompt

### Code Cần Sửa

Tìm trong `services/geminiService.ts` prompt hiện tại kiểu:

```ts
export function getBeatAnalysisPrompt(script: string, style?: string) {
  // ...
  return `
  You are Storyflow Beat Analyzer.

  ...
  OUTPUT JSON ONLY:
  {
    "beats": [
      {
        "beatId": "beat_001",
        "sourceSegmentIds": ["src_0001", "src_0002"],

        "summary": "...",
        "visualMoment": "...",
        "mainAction": "...",
        "beatType": "...",

        "analysis": "...",
        "atmosphere": "...",
        "timeOfDay": "...",

        "characterVisualStates": [...],
        "interactionTarget": [...],
        "environmentDetails": "...",
        "props": [...],
        "cameraHint": "...",
        "compositionHint": "...",
        "continuityNotes": "..."
      }
    ]
  }
  `;
}
```

Vấn đề:

```txt
Prompt Beat Analysis đang output quá nhiều visual fields.
Điều này làm bước chia beat bị nặng và dễ sai nhịp.
```

### Code Mới

Đổi prompt này thành **Beat Skeleton Prompt**:

```ts
export function getBeatSkeletonPrompt(script: string, style?: string) {
  const sourceSegments = segmentSourceText(script);
  const serializedSegments = JSON.stringify(sourceSegments, null, 2);

  return `
You are Storyflow Beat Skeleton Analyzer.

Your only job is to split the provided source segments into accurate story beats and basic screen skeletons.

CRITICAL SOURCE TEXT RULE:
- Do NOT output originalText.
- Do NOT copy, rewrite, summarize, or translate originalText.
- Each beat MUST reference sourceSegmentIds from the provided source segment list.
- The application will reconstruct originalText from sourceSegmentIds.
- Every body source segment must appear in exactly one beat.
- Do not skip any body source segment.
- Do not duplicate sourceSegmentIds across beats.
- Keep sourceSegmentIds in chronological order.

CORE PRINCIPLE:
- 1 beat = 1 visual story moment.
- This step focuses on beat rhythm and source coverage only.
- Do NOT perform deep visual analysis in this step.
- Do NOT output facialExpression, bodyLanguage, gazeTarget, detailed position, props, camera, or composition.
- Those details will be analyzed in the Beat Moment Details step.

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
- Minor gestures should stay inside the current beat as visual detail, but do not describe them deeply in this step.
- Only split when the visual story moment changes enough to require a different image.
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

SENTENCE-LEVEL ILLUSTRATION PRIORITY:
- The goal is to create detailed illustrations close to sentence-level rhythm.
- If a sentence contains a strong standalone visual image, it may become its own beat.
- If adjacent sentences describe the same continuous visual moment, keep them in the same beat.
- Do not split mechanically by sentence count.
- Prioritize image clarity over rigid sentence counting.
- A beat should capture the smallest meaningful visual story moment, not the smallest possible text fragment.

SCREEN SKELETON RULES:
- Group consecutive beats into screens.
- A screen is a continuous scene with the same location, time period, and present character set.
- If location changes, create a new screen.
- If time changes significantly, create a new screen.
- If the scene cuts to another place, create a new screen.
- Keep screen metadata simple. Detailed visual continuity will be handled later.

CHARACTER PRESENCE RULES:
- Track who is present in each screen.
- visibleCharacters = characters physically visible in the beat.
- offscreenPresentCharacters = characters present in the scene but not visible in the current shot.
- characters = union of visibleCharacters and offscreenPresentCharacters.
- A character remains present until the text says they leave, disappear, or the scene changes.

TIME RULES:
- timeOfDay should remain consistent inside the same screen.
- Only change timeOfDay when the source text clearly indicates a time change.

SELF-CHECK BEFORE OUTPUT:
Before returning JSON, silently review:
1. Does every body source segment appear exactly once?
2. Are all sourceSegmentIds in order?
3. Are there any beats under 20 words?
4. If yes, are they major reveal, hard cut, standalone visual moment, emotional turning point, or critical dialogue?
5. If not, merge them with previous or next beat.
6. Are there 3 or more consecutive short beats in the same screen?
7. If yes, merge them into fewer stronger beats.
8. Did you output any deep visual fields? If yes, remove them.
9. Do not output this self-check. Only output final JSON.

OUTPUT JSON ONLY:
{
  "screens": [
    {
      "screenId": "screen_001",
      "screenNumber": 1,
      "screenName": "short concrete screen name",
      "location": "concrete location",
      "locationId": "loc_001",
      "timeOfDay": "Early Morning | Morning | Mid-day | Afternoon | Golden Hour | Evening | Late Night | Unknown",
      "screenCharacters": ["all characters present in this screen"],
      "startBeatId": 1,
      "endBeatId": 5,
      "summary": "what happens in this screen"
    }
  ],
  "beats": [
    {
      "beatId": 1,
      "screenId": "screen_001",
      "sourceSegmentIds": ["src_0001", "src_0002"],

      "summary": "short plot summary",
      "action": "one main drawable action",
      "visualFocus": "main thing the image should focus on",
      "beatType": "establishing | action | reaction | dialogue | reveal | transition",

      "focusCharacters": ["main characters of this beat"],
      "visibleCharacters": ["characters visible in this beat"],
      "offscreenPresentCharacters": ["characters present but not visible"],
      "characters": ["union of visible and offscreen present characters"],

      "location": "concrete location",
      "locationId": "loc_001",
      "timeOfDay": "Early Morning | Morning | Mid-day | Afternoon | Golden Hour | Evening | Late Night | Unknown",
      "atmosphere": "dominant mood"
    }
  ]
}

SOURCE SEGMENTS:
${serializedSegments}

STYLE CONTEXT:
${style || "Default cinematic illustration style"}
`;
}
```

---

## 2. Giữ alias để không phá code cũ

### Code Cần Sửa

Nếu code hiện gọi:

```ts
getBeatAnalysisPrompt(script, style)
```

### Code Mới

Để tránh sửa quá nhiều nơi, có thể giữ alias:

```ts
export function getBeatAnalysisPrompt(script: string, style?: string) {
  return getBeatSkeletonPrompt(script, style);
}
```

Sau đó có thể đổi tên UI dần dần.

---

## 3. Tạo prompt mới cho Beat Moment Details

### Code Cần Sửa

Nếu hiện chưa có prompt riêng hoặc đang dùng chung prompt Beat Analysis để phân tích mọi thứ.

### Code Mới

Thêm vào `services/geminiService.ts`:

```ts
export function getBeatMomentDetailsPrompt(input: {
  beats: any[];
  screens?: any[];
  characterLibrary?: any;
  locationLibrary?: any;
  style?: string;
}) {
  return `
You are Storyflow Beat Moment Detail Analyzer.

Your job is to enrich existing beats with detailed visual moment information.

CRITICAL RULES:
- Do NOT split beats.
- Do NOT merge beats.
- Do NOT renumber beats.
- Do NOT change beatId.
- Do NOT change sourceSegmentIds.
- Do NOT change originalText.
- Do NOT change screenId unless the input is clearly invalid.
- Do NOT create final visualPrompt.
- Do NOT create camera/composition fields. Storyboard will handle camera and composition later.
- Only analyze the visual details of each existing beat.

INPUT DATA:
You will receive beats that already have:
- beatId
- screenId
- originalText
- summary
- action
- visualFocus
- characters
- location
- timeOfDay
- atmosphere

YOUR OUTPUT:
Return details for the same beatIds only.

VISUAL DETAIL RULES:
- visualMoment should describe the exact illustration moment for this beat.
- mainAction should be the visible action, not just emotion or summary.
- For every visible character, describe facial expression, body language, gaze target, emotional state, and position.
- If a character is present but offscreen, do not invent visible expression.
- Keep all details grounded in originalText and existing beat data.
- Minor cinematic interpretation is allowed only to make the image coherent.
- Do not invent major props, injuries, outfits, locations, or actions not supported by the source.
- Props should only include visible objects relevant to the beat.
- environmentDetails should describe visible environment details grounded in location/originalText.
- continuityNotes should describe inherited or uncertain details.

OUTPUT JSON ONLY:
{
  "beatMomentDetails": [
    {
      "beatId": 1,
      "visualMoment": "the exact visual moment that should become an illustration",
      "mainAction": "specific visible action",
      "characterVisualStates": [
        {
          "characterName": "name",
          "roleInShot": "main | supporting | background | offscreen",
          "facialExpression": "specific visible expression or empty if offscreen",
          "bodyLanguage": "specific posture/body action or empty if offscreen",
          "gazeTarget": "who or what the character is looking at",
          "emotionalState": "inner emotion visible through expression/body",
          "position": "specific position in the scene",
          "positionSource": "explicit | inherited | inferred"
        }
      ],
      "interactionTarget": [
        {
          "actor": "character name",
          "target": "character name or object",
          "interaction": "what the actor does/says toward the target"
        }
      ],
      "environmentDetails": "specific visible environment details grounded in the text",
      "props": ["important visible prop 1", "important visible prop 2"],
      "continuityNotes": "anything inherited or uncertain"
    }
  ]
}

BEATS:
${JSON.stringify(input.beats, null, 2)}

SCREENS:
${JSON.stringify(input.screens || [], null, 2)}

CHARACTER LIBRARY:
${JSON.stringify(input.characterLibrary || {}, null, 2)}

LOCATION LIBRARY:
${JSON.stringify(input.locationLibrary || {}, null, 2)}

STYLE CONTEXT:
${input.style || "Default cinematic illustration style"}
`;
}
```

---

## 4. Thêm method trong Gemini service

### Code Cần Sửa

Nếu class/service hiện chỉ có:

```ts
async analyzeBeats(script: string, style?: string) {
  return this.generateJson(getBeatAnalysisPrompt(script, style));
}
```

### Code Mới

Giữ `analyzeBeats` cho bước 1:

```ts
async analyzeBeats(script: string, style?: string) {
  return this.generateJson(getBeatSkeletonPrompt(script, style));
}
```

Thêm method mới cho bước 2:

```ts
async analyzeBeatMomentDetails(input: {
  beats: any[];
  screens?: any[];
  characterLibrary?: any;
  locationLibrary?: any;
  style?: string;
}) {
  return this.generateJson(getBeatMomentDetailsPrompt(input));
}
```

Nếu service đang trả text raw thay vì JSON object, giữ style cũ của repo:

```ts
async analyzeBeatMomentDetails(input: {
  beats: any[];
  screens?: any[];
  characterLibrary?: any;
  locationLibrary?: any;
  style?: string;
}) {
  const prompt = getBeatMomentDetailsPrompt(input);
  return this.generateContent(prompt);
}
```

---

## 5. Sửa type `BeatAnalysis`

### Code Cần Sửa

Nếu `BeatAnalysis` hiện đang chứa quá nhiều field visual:

```ts
export interface BeatAnalysis {
  beatId: number;
  sourceSegmentIds: string[];
  originalText: string;

  summary: string;
  visualMoment: string;
  mainAction: string;

  characterVisualStates: CharacterVisualState[];
  interactionTarget: InteractionTarget[];
  environmentDetails: string;
  props: string[];

  cameraHint: string;
  compositionHint: string;
}
```

### Code Mới

Tách type:

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
   * Keep for backward compatibility.
   */
  characters: string[];

  location: string;
  locationId: string;
  timeOfDay: string;
  atmosphere: string;
}

export type RoleInShot = "main" | "supporting" | "background" | "offscreen";
export type PositionSource = "explicit" | "inherited" | "inferred";

export interface CharacterVisualState {
  characterName: string;
  roleInShot: RoleInShot;
  facialExpression: string;
  bodyLanguage: string;
  gazeTarget: string;
  emotionalState: string;
  position: string;
  positionSource: PositionSource;
}

export interface InteractionTarget {
  actor: string;
  target: string;
  interaction: string;
}

export interface BeatMomentDetail {
  beatId: number;
  visualMoment: string;
  mainAction: string;
  characterVisualStates: CharacterVisualState[];
  interactionTarget: InteractionTarget[];
  environmentDetails: string;
  props: string[];
  continuityNotes?: string;
}

/**
 * Backward compatible merged beat used by UI / downstream steps.
 */
export type BeatAnalysis = BeatSkeleton & Partial<BeatMomentDetail>;
```

---

## 6. Sửa normalize Beat Skeleton

### Code Cần Sửa

Nếu normalize hiện parse tất cả field trong một beat:

```ts
export function normalizeBeats(raw: any[]): BeatAnalysis[] {
  return raw.map((beat) => ({
    sourceSegmentIds: beat.sourceSegmentIds,
    visualMoment: beat.visualMoment,
    mainAction: beat.mainAction,
    characterVisualStates: beat.characterVisualStates,
    cameraHint: beat.cameraHint,
    compositionHint: beat.compositionHint,
  }));
}
```

### Code Mới

```ts
function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(String).map((item) => item.trim()).filter(Boolean)
    : [];
}

function asNumber(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeBeatType(value: unknown): BeatType {
  const allowed: BeatType[] = [
    "establishing",
    "action",
    "reaction",
    "dialogue",
    "reveal",
    "transition",
  ];

  return allowed.includes(value as BeatType) ? (value as BeatType) : "action";
}

export function normalizeBeatSkeletons(raw: any[]): BeatSkeleton[] {
  return raw.map((beat, index) => {
    const visibleCharacters = asStringArray(beat.visibleCharacters);
    const offscreenPresentCharacters = asStringArray(
      beat.offscreenPresentCharacters
    );

    const characters =
      asStringArray(beat.characters).length > 0
        ? asStringArray(beat.characters)
        : Array.from(new Set([...visibleCharacters, ...offscreenPresentCharacters]));

    return {
      beatId: asNumber(beat.beatId, index + 1),
      screenId: asString(beat.screenId, "screen_001"),
      sourceSegmentIds: asStringArray(beat.sourceSegmentIds),

      /**
       * Must be hydrated by sourceTextSegmentService.
       */
      originalText: "",

      summary: asString(beat.summary),
      action: asString(beat.action),
      visualFocus: asString(beat.visualFocus),
      beatType: normalizeBeatType(beat.beatType),

      focusCharacters: asStringArray(beat.focusCharacters),
      visibleCharacters,
      offscreenPresentCharacters,
      characters,

      location: asString(beat.location),
      locationId: asString(beat.locationId),
      timeOfDay: asString(beat.timeOfDay, "Unknown"),
      atmosphere: asString(beat.atmosphere),
    };
  });
}
```

---

## 7. Thêm normalize Beat Moment Details

### Code Cần Sửa

Chưa có normalize riêng.

### Code Mới

```ts
function normalizeCharacterVisualStates(value: unknown): CharacterVisualState[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => ({
      characterName: asString(item?.characterName),
      roleInShot: ["main", "supporting", "background", "offscreen"].includes(
        item?.roleInShot
      )
        ? item.roleInShot
        : "supporting",
      facialExpression: asString(item?.facialExpression),
      bodyLanguage: asString(item?.bodyLanguage),
      gazeTarget: asString(item?.gazeTarget),
      emotionalState: asString(item?.emotionalState),
      position: asString(item?.position),
      positionSource: ["explicit", "inherited", "inferred"].includes(
        item?.positionSource
      )
        ? item.positionSource
        : "inferred",
    }))
    .filter((item) => item.characterName);
}

function normalizeInteractionTarget(value: unknown): InteractionTarget[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => ({
      actor: asString(item?.actor),
      target: asString(item?.target),
      interaction: asString(item?.interaction),
    }))
    .filter((item) => item.actor || item.target || item.interaction);
}

export function normalizeBeatMomentDetails(raw: any[]): BeatMomentDetail[] {
  return raw.map((detail) => ({
    beatId: asNumber(detail.beatId, 0),
    visualMoment: asString(detail.visualMoment),
    mainAction: asString(detail.mainAction),
    characterVisualStates: normalizeCharacterVisualStates(
      detail.characterVisualStates
    ),
    interactionTarget: normalizeInteractionTarget(detail.interactionTarget),
    environmentDetails: asString(detail.environmentDetails),
    props: asStringArray(detail.props),
    continuityNotes: asString(detail.continuityNotes),
  })).filter((detail) => detail.beatId > 0);
}
```

---

## 8. Thêm helper merge Beat Skeleton + Beat Moment Details

### Code Cần Sửa

Nếu downstream vẫn expect một object beat có đủ field.

### Code Mới

```ts
export function mergeBeatSkeletonsWithMomentDetails(
  beats: BeatSkeleton[],
  details: BeatMomentDetail[]
): BeatAnalysis[] {
  const detailByBeatId = new Map(
    details.map((detail) => [Number(detail.beatId), detail])
  );

  return beats.map((beat) => {
    const detail = detailByBeatId.get(Number(beat.beatId));

    if (!detail) {
      return beat;
    }

    return {
      ...beat,
      ...detail,
      beatId: beat.beatId,
      sourceSegmentIds: beat.sourceSegmentIds,
      originalText: beat.originalText,
      screenId: beat.screenId,
    };
  });
}
```

Rule quan trọng:

```txt
Detail không được override beatId, sourceSegmentIds, originalText, screenId.
```

---

## 9. Sửa flow auto “Phân tích nội dung” trong StoryFlow.tsx

### Code Cần Sửa

Flow cũ có thể là:

```ts
const result = await gemini.analyzeBeats(inputData.script, getSelectedStylePrompt());
const parsed = parseJsonSafe(result);
const hydrated = hydratePastedAnalysisIfNeeded(parsed);
setProduction((prev) => ({
  ...prev,
  analysis: JSON.stringify(hydrated, null, 2),
}));
```

### Code Mới

Bước 1 chỉ chạy Beat Skeleton:

```ts
const result = await gemini.analyzeBeats(
  inputData.script,
  getSelectedStylePrompt()
);

const parsed = parseJsonSafe(result);

const rawBeats = Array.isArray(parsed)
  ? parsed
  : Array.isArray(parsed?.beats)
    ? parsed.beats
    : [];

const rawScreens = Array.isArray(parsed?.screens) ? parsed.screens : [];

const normalizedBeats = normalizeBeatSkeletons(rawBeats);
const normalizedScreens = normalizeScreens(rawScreens);

const sourceSegments = segmentSourceText(inputData.script);

const hydratedResult = hydrateBeatAnalysisOriginalText(
  {
    beats: normalizedBeats,
    screens: normalizedScreens,
  },
  inputData.script,
  sourceSegments,
  {
    repairMissingSegments: true,
    splitLongBeats: false,
  }
);

setProduction((prev) => ({
  ...prev,
  analysis: JSON.stringify(
    {
      screens: normalizedScreens,
      beats: hydratedResult.beats,
      coverageCheck: hydratedResult.coverageCheck,
    },
    null,
    2
  ),
}));

setProject((prev) => ({
  ...prev,
  beats: hydratedResult.beats,
  screens: normalizedScreens,
}));
```

Nếu repo có helper `hydratePastedAnalysisIfNeeded`, có thể sửa helper đó để dùng `normalizeBeatSkeletons`.

---

## 10. Thêm flow cho Beat Moment Details

### Code Cần Sửa

Nếu chưa có handler riêng.

### Code Mới

Thêm handler:

```ts
const handleAutoBeatMomentDetails = useCallback(async () => {
  try {
    const beats = project.beats || [];
    const screens = project.screens || [];

    if (!beats.length) {
      alert("Vui lòng chạy Chia Beats trước.");
      return;
    }

    const result = await gemini.analyzeBeatMomentDetails({
      beats,
      screens,
      characterLibrary: project.characters || [],
      locationLibrary: project.locations || [],
      style: getSelectedStylePrompt(),
    });

    const parsed = parseJsonSafe(result);

    const rawDetails = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.beatMomentDetails)
        ? parsed.beatMomentDetails
        : [];

    const details = normalizeBeatMomentDetails(rawDetails);

    const mergedBeats = mergeBeatSkeletonsWithMomentDetails(beats, details);

    setProduction((prev) => ({
      ...prev,
      beatMomentDetails: JSON.stringify(
        {
          beatMomentDetails: details,
        },
        null,
        2
      ),
    }));

    setProject((prev) => ({
      ...prev,
      beats: mergedBeats,
      beatMomentDetails: details,
    }));

    alert("Đã phân tích chi tiết Beat Moment.");
  } catch (error) {
    console.error(error);
    alert("Không thể phân tích Beat Moment Details.");
  }
}, [project, gemini, getSelectedStylePrompt]);
```

Nếu project type chưa có `beatMomentDetails`, thêm optional field.

---

## 11. Sửa manual paste JSON cho Phân tích nội dung

### Code Cần Sửa

Nếu manual paste của “Phân tích nội dung” đang cho phép paste cả visual fields và lưu thẳng.

### Code Mới

Manual paste ở bước Beat Skeleton chỉ nhận:

```json
{
  "screens": [],
  "beats": []
}
```

Sau khi paste:

```ts
const parsed = parseJsonSafe(pastedText);

const rawBeats = Array.isArray(parsed)
  ? parsed
  : Array.isArray(parsed?.beats)
    ? parsed.beats
    : [];

const rawScreens = Array.isArray(parsed?.screens) ? parsed.screens : [];

const normalizedBeats = normalizeBeatSkeletons(rawBeats);
const normalizedScreens = normalizeScreens(rawScreens);

const sourceSegments = segmentSourceText(inputData.script);

const hydratedResult = hydrateBeatAnalysisOriginalText(
  {
    beats: normalizedBeats,
    screens: normalizedScreens,
  },
  inputData.script,
  sourceSegments,
  {
    repairMissingSegments: true,
    splitLongBeats: false,
  }
);

setProduction((prev) => ({
  ...prev,
  analysis: JSON.stringify(
    {
      screens: normalizedScreens,
      beats: hydratedResult.beats,
      coverageCheck: hydratedResult.coverageCheck,
    },
    null,
    2
  ),
}));

setProject((prev) => ({
  ...prev,
  beats: hydratedResult.beats,
  screens: normalizedScreens,
}));
```

Manual paste cho Beat Moment Details dùng handler riêng:

```ts
const parsed = parseJsonSafe(pastedText);

const rawDetails = Array.isArray(parsed)
  ? parsed
  : Array.isArray(parsed?.beatMomentDetails)
    ? parsed.beatMomentDetails
    : [];

const details = normalizeBeatMomentDetails(rawDetails);

const mergedBeats = mergeBeatSkeletonsWithMomentDetails(project.beats || [], details);

setProduction((prev) => ({
  ...prev,
  beatMomentDetails: JSON.stringify({ beatMomentDetails: details }, null, 2),
}));

setProject((prev) => ({
  ...prev,
  beats: mergedBeats,
  beatMomentDetails: details,
}));
```

---

## 12. Sửa UI “Phân tích nội dung”

### Code Cần Sửa

Nếu hiện chỉ có một nút:

```tsx
<button onClick={handleAutoAnalysis}>
  Phân tích nội dung
</button>
```

### Code Mới

Thêm 2 action/tab:

```tsx
<div className="grid gap-3 md:grid-cols-2">
  <button
    type="button"
    onClick={handleAutoAnalysis}
    className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-left"
  >
    <div className="text-sm font-semibold text-slate-100">
      1. Chia Beats
    </div>
    <div className="mt-1 text-xs text-slate-400">
      Chia source text thành beats chính xác, giữ sourceSegmentIds, chống micro-beat.
    </div>
  </button>

  <button
    type="button"
    onClick={handleAutoBeatMomentDetails}
    disabled={!project.beats?.length}
    className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-left disabled:opacity-50"
  >
    <div className="text-sm font-semibold text-slate-100">
      2. Chi tiết Beat
    </div>
    <div className="mt-1 text-xs text-slate-400">
      Phân tích visualMoment, biểu cảm, tư thế, gaze, props và môi trường cho từng beat.
    </div>
  </button>
</div>
```

---

## 13. Sửa label trong UI

### Code Cần Sửa

Nếu UI gọi chung:

```txt
Phân tích nội dung
```

và description nói “tạo visual prompt / camera / composition”.

### Code Mới

Đổi description:

```txt
Phân tích nội dung gồm 2 bước:
1. Chia Beats: tập trung chia source text thành nhịp truyện chính xác.
2. Chi tiết Beat: phân tích visual details cho từng beat đã chia.
```

---

## 14. Sửa Storyboard Prompt để nhận Beat Moment Details

### Code Cần Sửa

Storyboard hiện có thể lấy trực tiếp:

```ts
beat.visualMoment
beat.mainAction
beat.cameraHint
beat.compositionHint
```

từ analysis.

### Code Mới

Storyboard nên lấy:

```ts
beat.visualMoment
beat.mainAction
beat.characterVisualStates
beat.environmentDetails
beat.props
```

từ merged beats hoặc `production.beatMomentDetails`.

Storyboard mới được tạo:

```txt
cameraHint
compositionHint
shotType
cameraAngle
framing
foreground
background
```

Prompt Storyboard cần có rule:

```txt
Do not change beatId, sourceSegmentIds, or originalText.
Do not re-analyze story content.
Use Beat Skeleton + Beat Moment Details as source of truth.
Your job is only camera, framing, and composition.
```

---

## 15. Sửa Engineer Prompt để chỉ tổng hợp

### Code Cần Sửa

Nếu Engineer Prompt có rule tự suy:

```txt
Analyze the story and create a visual prompt...
```

hoặc:

```txt
Infer missing actions, expressions, props...
```

### Code Mới

Đổi thành:

```txt
ENGINEER PROMPT SOURCE-OF-TRUTH RULE:
- Do not re-analyze the story.
- Do not invent new story actions.
- Do not change characters, location, timeOfDay, or props.
- Do not add major visual elements not present in Beat Skeleton, Beat Moment Details, Character Library, Location Library, or Storyboard.
- Your only job is to synthesize the existing approved fields into one final visualPrompt.
- If a field is missing, keep the prompt simpler instead of inventing new facts.
```

Engineer Prompt input nên có:

```txt
Beat Skeleton:
- originalText
- summary
- action
- visualFocus
- characters
- location
- timeOfDay
- atmosphere

Beat Moment Details:
- visualMoment
- mainAction
- characterVisualStates
- interactionTarget
- environmentDetails
- props

Storyboard:
- shotType
- cameraAngle
- composition
- foreground/background

Character Library:
- appearance/outfit/accessories

Location Library:
- stable location description

Style:
- selected style
```

---

## 16. Sửa Final Result Builder

### Code Cần Sửa

Nếu Final Result chỉ lấy từ `production.analysis` và không đọc `beatMomentDetails`.

### Code Mới

Khi build final result:

```ts
const beatMomentDetails = parseJsonSafe(production.beatMomentDetails);

const mergedBeats = mergeBeatSkeletonsWithMomentDetails(
  normalizeBeatSkeletons(analysis.beats || []),
  normalizeBeatMomentDetails(beatMomentDetails.beatMomentDetails || [])
);
```

Hoặc nếu `project.beats` đã merge sẵn, dùng `project.beats`.

Final result nên lưu cả:

```json
{
  "beatId": 1,
  "originalText": "...",
  "summary": "...",
  "action": "...",
  "visualFocus": "...",
  "visualMoment": "...",
  "mainAction": "...",
  "characterVisualStates": [],
  "environmentDetails": "...",
  "props": [],
  "storyboard": {},
  "visualPrompt": "..."
}
```

---

## 17. Backward compatibility

### Code Cần Sửa

Project cũ có thể đang lưu analysis với visual fields trong `beats`.

### Code Mới

Khi load project cũ:

```ts
function extractBeatMomentDetailsFromLegacyBeats(beats: any[]): BeatMomentDetail[] {
  return beats
    .filter((beat) => beat.visualMoment || beat.mainAction || beat.characterVisualStates)
    .map((beat) => ({
      beatId: Number(beat.beatId),
      visualMoment: asString(beat.visualMoment),
      mainAction: asString(beat.mainAction),
      characterVisualStates: normalizeCharacterVisualStates(
        beat.characterVisualStates
      ),
      interactionTarget: normalizeInteractionTarget(beat.interactionTarget),
      environmentDetails: asString(beat.environmentDetails),
      props: asStringArray(beat.props),
      continuityNotes: asString(beat.continuityNotes),
    }))
    .filter((detail) => detail.beatId > 0);
}
```

Nếu `production.beatMomentDetails` thiếu nhưng beats cũ có visual fields, tự extract.

---

## 18. Checklist cho Vibe Code

```txt
[ ] Đổi getBeatAnalysisPrompt thành Beat Skeleton Prompt.
[ ] Beat Skeleton Prompt không output deep visual fields.
[ ] Beat Skeleton Prompt vẫn giữ 20–60 từ + anti micro-beat.
[ ] Beat Skeleton Prompt vẫn dùng sourceSegmentIds và không output originalText.
[ ] Thêm getBeatMomentDetailsPrompt.
[ ] Thêm gemini.analyzeBeatMomentDetails().
[ ] Tách type BeatSkeleton và BeatMomentDetail.
[ ] Thêm normalizeBeatSkeletons().
[ ] Thêm normalizeBeatMomentDetails().
[ ] Thêm mergeBeatSkeletonsWithMomentDetails().
[ ] Flow Phân tích nội dung bước 1 chỉ lưu beats/screens nhẹ.
[ ] Flow Phân tích nội dung bước 2 lưu production.beatMomentDetails.
[ ] UI có 2 action/tab: Chia Beats và Chi tiết Beat.
[ ] Storyboard dùng Beat Moment Details nhưng chỉ tạo camera/composition.
[ ] Engineer Prompt chỉ tổng hợp, không phân tích mới.
[ ] Final Result có đọc/merge Beat Moment Details.
[ ] Backward compatibility cho project cũ.
[ ] npm run typecheck pass.
[ ] npm run build pass.
```

---

## 19. Test case

### Test 1: Beat Skeleton không output visual fields sâu

Sau khi chạy Chia Beats, output không nên có:

```txt
characterVisualStates
facialExpression
bodyLanguage
gazeTarget
cameraHint
compositionHint
props chi tiết
```

Output chỉ nên có:

```txt
sourceSegmentIds
summary
action
visualFocus
characters
location/time/atmosphere cơ bản
screens
```

---

### Test 2: Beat Moment Details không chia lại beat

Input có 10 beats.

Output phải có details cho đúng `beatId`:

```txt
Không thêm beat 11.
Không xóa beat.
Không đổi sourceSegmentIds.
Không đổi originalText.
```

---

### Test 3: Engineer Prompt không tự phân tích mới

Nếu Beat Moment Details không có prop “dao”, Engineer Prompt không được tự thêm “dao”.

Nếu Storyboard không có camera angle, Engineer Prompt có thể dùng prompt đơn giản hơn, không tự bịa camera quá cụ thể.

---

### Test 4: Final Result đầy đủ

Final Result phải có cả:

```txt
originalText từ sourceSegmentIds
summary/action/visualFocus từ Beat Skeleton
visualMoment/mainAction/characterVisualStates từ Beat Moment Details
camera/composition từ Storyboard
visualPrompt từ Engineer Prompt
```

---

## Kết luận

Hướng sửa đúng:

```txt
Phân tích nội dung không nên làm tất cả.
Tách thành 2 bước:
1. Beat Skeleton = chia beat chính xác.
2. Beat Moment Details = phân tích visual sâu.
Engineer Prompt = chỉ tổng hợp các trường đã có.
```

Việc này giúp app:

```txt
- Chia beats ổn hơn.
- Prompt nhẹ hơn.
- Ít lỗi JSON hơn.
- Dễ kiểm soát sourceSegmentIds hơn.
- Visual prompt vẫn chi tiết nhờ bước Beat Moment Details.
- Engineer Prompt không tự phân tích lại truyện.
```

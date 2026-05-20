# Hướng Dẫn Sửa Prompt Beat Analysis: Áp Dụng Rule Tốt Từ Prompt Cũ Và Khắc Phục Lỗi `originalText`

## Mục tiêu

Sửa prompt và flow xử lý Beat Analysis trong Storyflow để:

- Không còn phụ thuộc vào `originalText` do AI tự viết.
- Tránh lỗi AI trả thiếu text gốc, rewrite text, thêm dấu `...`, hoặc làm sai thứ tự.
- Giữ lại các rule tốt từ prompt cũ:
  - Chia/gộp beat hợp lý.
  - Không cắt ngang câu.
  - Theo dõi nhân vật đang có mặt.
  - Theo dõi vị trí nhân vật.
  - Theo dõi posture/tư thế.
  - Giữ `timeOfDay` nhất quán.
  - Xác định rõ ai tương tác với ai.
- Chuyển logic chuẩn sang hướng:
  - AI chọn `sourceSegmentIds`.
  - Ứng dụng tự hydrate `originalText` từ text gốc.

---

# Pland

## 1. Không để AI tự tạo `originalText` nữa

Hiện tại lỗi chính là prompt yêu cầu AI trả:

```json
{
  "originalText": "..."
}
```

Cách này không bền vì AI có thể:

- Tóm tắt lại thay vì trích nguyên văn.
- Bỏ sót câu.
- Thêm dấu `...`.
- Sửa câu chữ.
- Gộp đoạn sai thứ tự.
- Trả `originalText` không khớp text gốc.

Cần đổi nguyên tắc thành:

```txt
AI không viết originalText.
AI chỉ chọn sourceSegmentIds.
App tự phục hồi originalText từ text gốc.
```

---

## 2. Dùng `sourceSegmentIds` làm nguồn liên kết chính

Ứng dụng nên chia source text thành các segment:

```json
[
  {
    "id": "src_0001",
    "text": "..."
  },
  {
    "id": "src_0002",
    "text": "..."
  }
]
```

Sau đó prompt gửi cho AI danh sách segment này.

AI chỉ trả:

```json
{
  "beatId": "beat_001",
  "sourceSegmentIds": ["src_0001", "src_0002"]
}
```

Ứng dụng tự hydrate:

```ts
originalText = text của src_0001 + src_0002
```

---

## 3. Áp dụng rule tốt từ prompt cũ

Prompt ứng dụng nên giữ lại các rule tốt sau:

### Beat Splitting Rules

- Chia toàn bộ văn bản thành beat liên tục.
- Không bỏ sót nội dung.
- Không cắt ngang câu.
- Mỗi beat là một khoảnh khắc hình ảnh rõ ràng.
- Nên dài khoảng 40-80 từ.
- Tách beat khi:
  - Đổi nhân vật hành động/lời thoại/suy nghĩ.
  - Có dẫn chuyện chen ngang làm đổi context/mood/focus.
  - Đổi địa điểm/bối cảnh.
  - Cùng nhân vật nhưng đổi đối tượng tương tác.
  - Đổi cảm xúc/tư thế/hành động trong lời thoại dài.
  - Lời thoại dài hơn 3 câu hoặc chứa nhiều ý quan trọng.

### Beat Merging Rules

- Gộp lời thoại ngắn với hành động đi kèm.
- Gộp nhân vật đang tương tác trực tiếp trong cùng không gian.
- Nếu câu dẫn kết thúc bằng dấu `:` để giới thiệu lời thoại, phải gộp câu dẫn và lời thoại vào cùng beat.
- Với nhắn tin/gọi điện:
  - Gộp một cặp câu hỏi + câu trả lời thành một beat.
  - Nếu rất ngắn, có thể gộp hai cặp câu hỏi + câu trả lời.

### Character Continuity Rules

- Theo dõi nhân vật đang có mặt trong scene.
- Nếu A đang ở phòng, B bước vào, beat sau phải có cả A và B.
- Chỉ loại bỏ nhân vật khi text nói rõ họ rời đi hoặc chuyển sang scene khác.

### Position Continuity Rules

- Vị trí nhân vật phải kế thừa từ beat trước.
- Chỉ đổi vị trí khi text gốc mô tả hành động di chuyển.
- Không tự ý teleport nhân vật.

### Time Rules

- `timeOfDay` phải nhất quán trong cùng scene/screen.
- Chỉ đổi `timeOfDay` khi text gốc có dấu hiệu đổi thời gian rõ ràng.

---

## 4. Sửa schema Beat Analysis

Schema mới nên tách rõ:

```ts
sourceSegmentIds
summary
analysis
beatType
atmosphere
timeOfDay
mentionedCharacters
presentCharacters
enteredCharacters
exitedCharacters
characterPostures
characterPositions
interactionTarget
notes
```

Không yêu cầu AI trả `originalText`.

Nếu vẫn cần giữ field `originalText` trong type cũ để tương thích UI, thì field này phải được app hydrate sau, không lấy trực tiếp từ AI.

---

## 5. Luồng xử lý sau khi AI trả JSON

Flow mới nên là:

```txt
User nhập source text
  ↓
App chia source text thành sourceSegments
  ↓
Prompt Beat Analysis gửi sourceSegments cho AI
  ↓
AI trả beats với sourceSegmentIds
  ↓
App parse JSON
  ↓
App hydrate originalText từ sourceSegmentIds
  ↓
App validate coverage
  ↓
App repair missing segments nếu cần
  ↓
App lưu Beat Analysis vào state
```

---

## 6. UI nên hiển thị coverage check

Trong bước `Phân tích nội dung`, nên hiển thị thêm:

```txt
Source coverage: 97/100 segments
Missing segments: src_0010, src_0011
Duplicated segments: src_0007
Repair notes: ...
```

Nếu có missing segment, app nên cho:

```txt
Auto repair missing originalText
```

hoặc tự động repair nếu đang ở chế độ strict.

---

# Code

## 1. Sửa prompt Beat Analysis

### Code Cần Sửa

Tìm prompt Beat Analysis hiện tại trong các file kiểu:

```txt
services/geminiService.ts
services/promptService.ts
services/storyboardPromptService.ts
services/*
```

Prompt cũ thường có dạng yêu cầu AI trả:

```txt
Return an array of objects:
[
  {
    "originalText": "...",
    "analysis": "...",
    "atmosphere": "...",
    "posture": "...",
    "character_positions": "...",
    "timeOfDay": "...",
    "characters": ["A", "B"]
  }
]
```

Hoặc tiếng Việt:

```txt
Trả về một mảng các đối tượng:
[
  {
    "originalText": "...",
    "analysis": "...",
    "atmosphere": "...",
    "posture": "...",
    "character_positions": "...",
    "timeOfDay": "...",
    "characters": ["A", "B"]
  }
]
```

### Code Mới

Thay bằng prompt mới:

```ts
export const BEAT_ANALYSIS_PROMPT = `
You are Storyflow Beat Analyzer.

Your job is to split the provided source segments into visual story beats.

CRITICAL SOURCE TEXT RULE:
- Do NOT rewrite originalText.
- Do NOT create originalText manually.
- Each beat MUST reference sourceSegmentIds from the provided source segment list.
- The application will reconstruct originalText from sourceSegmentIds.
- You must cover all sourceSegmentIds in order.
- Do not skip any source segment unless it is only a title, separator, chapter marker, or non-story metadata.

BEAT SPLITTING RULES:
- Each beat should represent one visual moment that can become one storyboard/image shot.
- Target length: 40-80 words of source text per beat when possible.
- Never cut in the middle of a sentence.
- Split immediately when:
  1. A different character begins a new action, speech, or thought.
  2. Narration interrupts actions/dialogue and changes context, time, mood, or focus.
  3. The location or scene changes.
  4. The same character changes interaction target.
  5. A character's emotion, posture, or action changes inside a long dialogue.
  6. A dialogue is longer than 3 sentences or contains multiple important ideas.

BEAT MERGING RULES:
- Merge short dialogue with its direct action tag.
- Merge characters interacting directly in the same space if there is no meaningful narration interruption.
- If an action/narration ends with a colon ":" introducing dialogue, keep the action and dialogue in the same beat.
- For messaging/calls, merge one Question + Answer pair into one beat. If very short, you may merge two Question + Answer pairs into one beat.

ANALYSIS RULES:
- Always use specific character names.
- Do not use vague references like "he", "she", "the person", "continues doing that" when the character name is known.
- Clearly state who acts toward whom.
- For crowd/background characters, describe what they are doing or watching.

CONTINUITY RULES:
- Track which characters are present in the scene.
- If A is present and B enters, the next beat must include both A and B in presentCharacters.
- A character remains present until the text says they leave, disappear, or the scene changes.
- Track character positions across beats.
- A character position must be inherited from the previous beat unless the source text describes movement.
- Do not teleport characters.

TIME RULES:
- timeOfDay should remain consistent within the same scene/screen.
- Only change timeOfDay when the source text clearly indicates a time change.

OUTPUT JSON ONLY:
{
  "beats": [
    {
      "beatId": "beat_001",
      "sourceSegmentIds": ["src_0001", "src_0002"],
      "summary": "short summary of the beat",
      "analysis": "specific action/context analysis using character names",
      "beatType": "establishing | action | reaction | dialogue | reveal | transition",
      "atmosphere": "main emotional atmosphere",
      "timeOfDay": "Early Morning | Morning | Mid-day | Afternoon | Golden Hour | Evening | Late Night | Unknown",
      "mentionedCharacters": ["character names explicitly mentioned in this beat"],
      "presentCharacters": ["all characters physically present in the scene"],
      "enteredCharacters": ["characters who enter in this beat"],
      "exitedCharacters": ["characters who leave in this beat"],
      "characterPostures": [
        {
          "characterName": "name",
          "posture": "standing | sitting | lying | kneeling | walking | running | unknown",
          "actionState": "specific action state"
        }
      ],
      "characterPositions": [
        {
          "characterName": "name",
          "position": "specific position in the scene",
          "source": "explicit | inherited | inferred"
        }
      ],
      "interactionTarget": [
        {
          "actor": "character name",
          "target": "character name or object",
          "interaction": "what the actor does/says toward the target"
        }
      ],
      "notes": "optional continuity or uncertainty notes"
    }
  ]
}
`;
```

---

## 2. Sửa type Beat Analysis

### Code Cần Sửa

Tìm type tương tự:

```ts
export interface BeatAnalysis {
  originalText: string;
  analysis: string;
  atmosphere: string;
  posture: string;
  character_positions: string;
  timeOfDay: string;
  characters: string[];
}
```

### Code Mới

Thay hoặc mở rộng thành:

```ts
export type BeatType =
  | "establishing"
  | "action"
  | "reaction"
  | "dialogue"
  | "reveal"
  | "transition";

export type PositionSource = "explicit" | "inherited" | "inferred";

export interface CharacterPosture {
  characterName: string;
  posture:
    | "standing"
    | "sitting"
    | "lying"
    | "kneeling"
    | "walking"
    | "running"
    | "unknown";
  actionState: string;
}

export interface CharacterPosition {
  characterName: string;
  position: string;
  source: PositionSource;
}

export interface InteractionTarget {
  actor: string;
  target: string;
  interaction: string;
}

export interface BeatAnalysis {
  beatId: string;
  sourceSegmentIds: string[];
  originalText: string;
  summary: string;
  analysis: string;
  beatType: BeatType;
  atmosphere: string;
  timeOfDay: string;
  mentionedCharacters: string[];
  presentCharacters: string[];
  enteredCharacters: string[];
  exitedCharacters: string[];
  characterPostures: CharacterPosture[];
  characterPositions: CharacterPosition[];
  interactionTarget: InteractionTarget[];
  notes?: string;
}
```

Nếu app còn dùng field cũ `characters`, có thể giữ backward compatible:

```ts
export interface BeatAnalysis {
  beatId: string;
  sourceSegmentIds: string[];
  originalText: string;
  summary?: string;
  analysis: string;
  beatType?: BeatType;
  atmosphere?: string;
  timeOfDay?: string;
  characters?: string[];
  mentionedCharacters?: string[];
  presentCharacters?: string[];
  enteredCharacters?: string[];
  exitedCharacters?: string[];
  posture?: string;
  character_positions?: string;
  characterPostures?: CharacterPosture[];
  characterPositions?: CharacterPosition[];
  interactionTarget?: InteractionTarget[];
  notes?: string;
}
```

---

## 3. Sửa nơi parse kết quả AI

### Code Cần Sửa

Tìm đoạn parse kiểu:

```ts
const parsed = parseJsonSafe(responseText);
setAnalysis(parsed);
```

hoặc:

```ts
const beats = JSON.parse(responseText);
setBeatAnalysis(beats);
```

Vấn đề: code đang lưu thẳng JSON AI trả về state.

### Code Mới

Sau khi parse, phải normalize + hydrate:

```ts
import {
  segmentSourceText,
  hydrateBeatAnalysisOriginalText,
  validateSourceTextCoverage,
} from "../services/sourceTextSegmentService";

const parsed = parseJsonSafe(responseText);

const rawBeats = Array.isArray(parsed)
  ? parsed
  : Array.isArray(parsed?.beats)
    ? parsed.beats
    : [];

const sourceSegments = segmentSourceText(sourceText);

const hydratedResult = hydrateBeatAnalysisOriginalText(
  {
    beats: rawBeats,
  },
  sourceText,
  sourceSegments,
  {
    repairMissingSegments: true,
    splitLongBeats: true,
  }
);

const coverageCheck = validateSourceTextCoverage(
  hydratedResult.beats,
  sourceSegments
);

setAnalysis({
  ...hydratedResult,
  coverageCheck,
});
```

Nếu signature service hiện tại khác, hãy giữ nguyên ý tưởng:

```txt
parse AI JSON
→ lấy beats
→ segment source text
→ hydrate originalText từ sourceSegmentIds
→ validate coverage
→ set state
```

---

## 4. Sửa normalize Beat Analysis

### Code Cần Sửa

Nếu đang có normalize kiểu:

```ts
export function normalizeBeats(raw: any[]): BeatAnalysis[] {
  return raw.map((beat, index) => ({
    originalText: String(beat.originalText || ""),
    analysis: String(beat.analysis || ""),
    atmosphere: String(beat.atmosphere || ""),
    posture: String(beat.posture || ""),
    character_positions: String(beat.character_positions || ""),
    timeOfDay: String(beat.timeOfDay || ""),
    characters: Array.isArray(beat.characters) ? beat.characters : [],
  }));
}
```

Vấn đề: normalize này tin vào `originalText` của AI.

### Code Mới

Sửa thành không tin `originalText` AI:

```ts
export function normalizeBeats(raw: any[]): BeatAnalysis[] {
  return raw.map((beat, index) => {
    const presentCharacters = Array.isArray(beat.presentCharacters)
      ? beat.presentCharacters.map(String)
      : Array.isArray(beat.characters)
        ? beat.characters.map(String)
        : [];

    return {
      beatId: String(beat.beatId || `beat_${String(index + 1).padStart(3, "0")}`),
      sourceSegmentIds: Array.isArray(beat.sourceSegmentIds)
        ? beat.sourceSegmentIds.map(String)
        : [],
      originalText: "",
      summary: String(beat.summary || ""),
      analysis: String(beat.analysis || ""),
      beatType: String(beat.beatType || "action") as BeatAnalysis["beatType"],
      atmosphere: String(beat.atmosphere || ""),
      timeOfDay: String(beat.timeOfDay || "Unknown"),
      mentionedCharacters: Array.isArray(beat.mentionedCharacters)
        ? beat.mentionedCharacters.map(String)
        : [],
      presentCharacters,
      enteredCharacters: Array.isArray(beat.enteredCharacters)
        ? beat.enteredCharacters.map(String)
        : [],
      exitedCharacters: Array.isArray(beat.exitedCharacters)
        ? beat.exitedCharacters.map(String)
        : [],
      characterPostures: Array.isArray(beat.characterPostures)
        ? beat.characterPostures
        : [],
      characterPositions: Array.isArray(beat.characterPositions)
        ? beat.characterPositions
        : [],
      interactionTarget: Array.isArray(beat.interactionTarget)
        ? beat.interactionTarget
        : [],
      notes: beat.notes ? String(beat.notes) : undefined,
      characters: presentCharacters,
      posture: String(beat.posture || ""),
      character_positions: String(beat.character_positions || ""),
    };
  });
}
```

---

## 5. Thêm fallback nếu AI vẫn trả `originalText` nhưng thiếu `sourceSegmentIds`

### Code Cần Sửa

Nếu app nhận JSON cũ không có `sourceSegmentIds`, hiện tại có thể lưu thẳng:

```ts
const beats = normalizeBeats(rawBeats);
setAnalysis(beats);
```

### Code Mới

Thêm fallback map `originalText` → segment gần nhất.

```ts
function attachSourceSegmentIdsFallback(
  rawBeats: any[],
  sourceSegments: { id: string; text: string }[]
): any[] {
  return rawBeats.map((beat) => {
    if (Array.isArray(beat.sourceSegmentIds) && beat.sourceSegmentIds.length > 0) {
      return beat;
    }

    const originalText = String(beat.originalText || "").trim();

    if (!originalText) {
      return {
        ...beat,
        sourceSegmentIds: [],
      };
    }

    const matchedSegmentIds = sourceSegments
      .filter((segment) => {
        const segmentText = String(segment.text || "").trim();
        return (
          segmentText.includes(originalText) ||
          originalText.includes(segmentText)
        );
      })
      .map((segment) => segment.id);

    return {
      ...beat,
      sourceSegmentIds: matchedSegmentIds,
    };
  });
}
```

Dùng trong parse flow:

```ts
const sourceSegments = segmentSourceText(sourceText);

const rawBeatsWithSegmentIds = attachSourceSegmentIdsFallback(
  rawBeats,
  sourceSegments
);

const hydratedResult = hydrateBeatAnalysisOriginalText(
  {
    beats: rawBeatsWithSegmentIds,
  },
  sourceText,
  sourceSegments,
  {
    repairMissingSegments: true,
    splitLongBeats: true,
  }
);
```

Lưu ý: fallback này chỉ để tương thích JSON cũ. Prompt mới vẫn phải yêu cầu AI trả `sourceSegmentIds`.

---

## 6. Thêm UI Coverage Check

### Code Cần Sửa

Trong UI bước `Phân tích nội dung`, nếu hiện chỉ render JSON/result:

```tsx
<pre>{JSON.stringify(analysis, null, 2)}</pre>
```

### Code Mới

Thêm block hiển thị coverage:

```tsx
function SourceCoveragePanel({ coverageCheck }: { coverageCheck?: any }) {
  if (!coverageCheck) return null;

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-100">
          Source Text Coverage
        </h3>

        <span
          className={
            coverageCheck.allSourceTextCovered
              ? "text-xs text-emerald-400"
              : "text-xs text-amber-400"
          }
        >
          {coverageCheck.allSourceTextCovered ? "Covered" : "Needs Review"}
        </span>
      </div>

      {coverageCheck.missingText && (
        <div>
          <div className="text-xs font-medium text-amber-300">
            Missing Text
          </div>
          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-3 text-xs text-slate-200">
            {coverageCheck.missingText}
          </pre>
        </div>
      )}

      {coverageCheck.duplicatedText && (
        <div>
          <div className="text-xs font-medium text-red-300">
            Duplicated Text
          </div>
          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-3 text-xs text-slate-200">
            {coverageCheck.duplicatedText}
          </pre>
        </div>
      )}

      {coverageCheck.notes && (
        <div>
          <div className="text-xs font-medium text-slate-300">
            Notes
          </div>
          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-3 text-xs text-slate-200">
            {coverageCheck.notes}
          </pre>
        </div>
      )}
    </div>
  );
}
```

Sau đó render:

```tsx
<SourceCoveragePanel coverageCheck={analysis?.coverageCheck} />
```

---

## 7. Đảm bảo Final Result chỉ dùng `originalText` đã hydrate

### Code Cần Sửa

Nếu Final Result đang lấy trực tiếp từ beat AI:

```ts
originalText: beat.originalText
```

### Code Mới

Đảm bảo beat đã đi qua hydrate trước khi build Final Result:

```ts
const finalResult = buildFinalResult({
  ...finalBuildData,
  beatAnalysis: hydratedBeatAnalysis,
});
```

Hoặc trong builder:

```ts
originalText: beat.originalText || getOriginalTextFromSourceSegments(beat.sourceSegmentIds)
```

Không dùng `originalText` raw từ AI nếu chưa hydrate.

---

## 8. Checklist cho Vibe Code

Sau khi sửa, kiểm tra các điểm sau:

```txt
[ ] Prompt Beat Analysis không còn yêu cầu AI tự viết originalText.
[ ] Prompt yêu cầu AI trả sourceSegmentIds.
[ ] Schema BeatAnalysis có sourceSegmentIds.
[ ] originalText được hydrate bằng sourceTextSegmentService.
[ ] Parse manual JSON cũng đi qua hydrate.
[ ] AI output dạng { beats: [...] } và [...] đều được hỗ trợ.
[ ] Coverage check được lưu vào state hoặc hiển thị ở UI.
[ ] Missing segments được repair hoặc cảnh báo rõ.
[ ] Final Result chỉ dùng originalText đã hydrate.
[ ] npm run typecheck pass.
[ ] npm run build pass.
```

---

## 9. Test Case Nên Thử

### Test 1: AI bỏ sót một đoạn

Input source có 5 segment, AI chỉ trả:

```json
{
  "beats": [
    {
      "beatId": "beat_001",
      "sourceSegmentIds": ["src_0001", "src_0002"]
    },
    {
      "beatId": "beat_002",
      "sourceSegmentIds": ["src_0004", "src_0005"]
    }
  ]
}
```

Kết quả mong muốn:

```txt
coverageCheck báo thiếu src_0003
Nếu repairMissingSegments=true thì app tự tạo fallback beat cho src_0003
```

### Test 2: AI trả `originalText` sai

AI trả:

```json
{
  "beats": [
    {
      "beatId": "beat_001",
      "sourceSegmentIds": ["src_0001"],
      "originalText": "AI tự viết lại câu sai"
    }
  ]
}
```

Kết quả mong muốn:

```txt
App bỏ qua originalText AI.
App hydrate originalText bằng text thật của src_0001.
```

### Test 3: Cùng scene, nhân vật không được nhắc nhưng vẫn còn đó

Source:

```txt
A đứng trong phòng. B bước vào. B nhìn ra cửa sổ.
```

AI nên trả:

```json
{
  "presentCharacters": ["A", "B"]
}
```

cho beat “B nhìn ra cửa sổ”, vì A vẫn còn trong phòng.

### Test 4: Vị trí nhân vật không teleport

Beat 1:

```json
{
  "characterPositions": [
    {
      "characterName": "A",
      "position": "sitting on the sofa",
      "source": "explicit"
    }
  ]
}
```

Beat 2 không nói A di chuyển.

Kết quả mong muốn:

```json
{
  "characterPositions": [
    {
      "characterName": "A",
      "position": "sitting on the sofa",
      "source": "inherited"
    }
  ]
}
```

---

## Kết luận

Lỗi `AI trả originalText không đủ so với text gốc` không nên sửa bằng cách chỉ nhắc AI “đừng bỏ sót”.

Cách sửa đúng là đổi kiến trúc prompt:

```txt
AI chọn sourceSegmentIds.
App tự hydrate originalText từ text gốc.
App validate coverage.
App repair missing segments.
```

Prompt cũ vẫn rất có giá trị, nhưng chỉ nên lấy các rule tốt về chia/gộp beat, nhân vật, vị trí, posture, timeOfDay và interaction. Không nên giữ phần bắt AI tự tạo `originalText`.

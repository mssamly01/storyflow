
import { GoogleGenAI, Part } from "@google/genai";
import { getConfig } from "./configService";
import { mapLocationIdsToBeats } from "./locationContinuityService";
import { normalizeStoryboardPanels, sanitizeStoryboardPanels } from "./storyboardDataService";
import type {
  BeatAnalysisResult,
  CharacterLocationLibraryResult,
  CharacterProfile,
  LocationProfile,
  StoryBeat
} from "../types";

// Helper to get AI instance with current config
const getAI = () => {
  const config = getConfig();
  const apiKey = config.geminiApiKey || process.env.API_KEY || "";
  if (!apiKey) {
    throw new Error("API Key not found. Please configure it in Settings.");
  }
  return new GoogleGenAI({ apiKey });
};

const getModel = () => {
  const config = getConfig();
  return config.geminiModel || "gemini-2.5-flash";
};

// --- PROMPT GENERATORS ---

const extractJsonObject = (rawText: string): string => {
  const trimmed = rawText.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("Gemini response does not contain a valid JSON object.");
  }

  return trimmed.slice(firstBrace, lastBrace + 1);
};

const parseGeminiJson = <T,>(rawText?: string): T => {
  if (!rawText) {
    throw new Error("No response received from Gemini.");
  }

  return JSON.parse(extractJsonObject(rawText)) as T;
};

const parseJsonFallback = <T,>(rawText: string | undefined, fallback: T): T => {
  if (!rawText) return fallback;
  try {
    return JSON.parse(rawText) as T;
  } catch {
    return fallback;
  }
};

export const getBeatAnalysisPrompt = (text: string, artStyleDescription = "") => `
You are a professional story analyst for a vertical comic / visual storyboard generation app.

Your ONLY task:
Split the source story text into visual story beats.

Do NOT create character profiles.
Do NOT create location profiles.
Do NOT create image prompts.
Do NOT rewrite the source story.

Selected art style context:
${artStyleDescription || "No specific style selected."}

Return ONLY valid JSON with this schema:

{
  "beats": [
    {
      "beatId": 1,
      "originalText": "...",
      "summary": "...",
      "characters": ["..."],
      "location": "...",
      "action": "...",
      "interaction": "...",
      "posture": "...",
      "props": ["..."],
      "visualFocus": "...",
      "atmosphere": "...",
      "timeOfDay": "..."
    }
  ],
  "coverageCheck": {
    "allSourceTextCovered": true,
    "missingText": "",
    "duplicatedText": "",
    "notes": ""
  }
}

CRITICAL ORIGINAL TEXT RULES:
- originalText must preserve the source text exactly.
- Do not rewrite, translate, summarize, correct, or polish originalText.
- Every part of the source text must appear in exactly one beat.
- Do not duplicate the same source text in multiple beats.
- Do not add text that does not exist in the source.
- Beat order must follow source order.

BEAT CUTTING RULES:
- A beat is one visual moment that can be illustrated as one storyboard panel.
- Recommended length: 40-80 words per beat.
- Visual integrity is more important than word count.
- Never cut in the middle of a sentence.

SPLIT WHEN:
- Location changes.
- Time changes.
- Main visual action changes.
- Character posture changes significantly.
- Main interaction target changes.
- Emotional intensity or atmosphere changes clearly.
- Dialogue becomes long or moves to a new action/emotional point.

DO NOT SPLIT WHEN:
- Short narration supports the same action/dialogue.
- Short internal thought belongs to the same visual moment.
- A short question-answer exchange shares the same location and emotional focus.
- A colon-introduced dialogue belongs directly to the preceding action.

FIELD RULES:
- summary: short explanation of the beat, not copied from originalText.
- characters: visible or visually important characters.
- location: most specific known place, or "Unknown".
- action: main action.
- interaction: who reacts/speaks/looks/touches/threatens/helps whom.
- posture: concrete body positions.
- props: objects required for continuity.
- visualFocus: what the image should focus on.
- atmosphere: emotional mood.
- timeOfDay: Early Morning, Morning, Mid-day, Afternoon, Golden Hour, Evening, Late Night, or Unknown.

SOURCE TEXT:
${text}
`;

export const getCharacterLocationLibraryPrompt = (
  originalText: string,
  beats: StoryBeat[],
  artStyleDescription = "",
  existingLibrary?: string
) => `
You are a character and location continuity designer for a vertical comic / visual storyboard generation app.

Your ONLY task:
Create a reusable Character Library and Location Library from the original text and the approved beat list.

Do NOT split beats again.
Do NOT rewrite originalText.
Do NOT create final image prompts.
Do NOT create storyboard panels.

Selected art style context:
${artStyleDescription || "No specific style selected."}

${existingLibrary ? `EXISTING LIBRARY / PREVIOUS CHAPTER CONTEXT:
${existingLibrary}

Use this context to preserve established identity, outfit, location layout, and continuity. Update only when the current chapter provides new evidence.
` : ""}

Return ONLY valid JSON with this schema:

{
  "characters": [
    {
      "characterId": "char_001",
      "name": "...",
      "aliases": ["..."],
      "role": "...",
      "gender": "...",
      "age": "...",
      "height": "...",
      "bodyType": "...",
      "face": "...",
      "hair": "...",
      "eyes": "...",
      "outfit": "...",
      "accessories": ["..."],
      "props": ["..."],
      "colorPalette": ["..."],
      "personalityVisualCues": "...",
      "expressionSet": ["neutral", "happy", "curious", "worried", "angry", "surprised", "sad", "determined"],
      "gestureSet": ["relaxed hand", "pointing gesture", "gripping object", "thinking gesture"],
      "continuityNotes": "...",
      "firstAppearanceBeatId": 1,
      "appearsInBeatIds": [1, 2]
    }
  ],
  "locations": [
    {
      "locationId": "loc_001",
      "name": "...",
      "aliases": ["..."],
      "description": "...",
      "layout": "...",
      "keyObjects": ["..."],
      "lighting": "...",
      "atmosphere": "...",
      "colorPalette": ["..."],
      "continuityNotes": "...",
      "baseState": "...",
      "firstAppearanceBeatId": 1,
      "appearsInBeatIds": [1, 2]
    }
  ]
}

CHARACTER RULES:
- One profile per unique character.
- Merge aliases/pronouns/titles that refer to the same person.
- If unnamed, create stable names like "Unknown Man 1".
- Use beatId references to fill firstAppearanceBeatId and appearsInBeatIds.
- Infer missing visual details conservatively.
- outfit describes current/default visual outfit.
- accessories lists items worn or carried on the body that must remain visually consistent.
- props lists recurring objects associated with the character.
- colorPalette is a compact list of key colors from hair, eyes, skin tone, outfit, accessories, and recurring props.
- expressionSet includes expressions suitable for this character based on personality and story tone.
- gestureSet includes common hand gestures or body gestures this character may need in visual panels.
- These extra fields are used later by the app to build a Character Reference Sheet Prompt.
- continuityNotes lists stable traits that should not change.
- Do not include any image prompt field.

LOCATION RULES:
- One profile per unique location.
- Merge aliases that refer to the same place.
- If vague, create stable names like "Unknown Interior 1".
- description defines the overall reusable environment.
- layout describes the spatial arrangement of major elements, furniture, doors, windows, and architectural features.
- keyObjects lists furniture, props, and architectural features that must stay consistent.
- lighting describes reusable lighting conditions.
- colorPalette is a compact reusable palette for the environment.
- continuityNotes explicitly describes what must remain consistent across beats.
- baseState describes the default environmental state before beat-specific changes.
- Use appearsInBeatIds based on the approved beat list.
- Do not include any image prompt field.

APPROVED BEATS:
${JSON.stringify(beats, null, 2)}

ORIGINAL SOURCE TEXT:
${originalText}
`;

export const getPhase1AnalysisPrompt = (script: string, style: string, _existingLibrary?: string) => getBeatAnalysisPrompt(script, style);

const getLegacyStoryboardPrompt = (analysis: string, charLocAnalysis: string) => `
Bạn là chuyên gia họa sĩ minh họa và đạo diễn hình ảnh. Dựa trên kết quả phân tích nội dung và hồ sơ nhân vật/bối cảnh, hãy phác thảo storyboard chi tiết.

YÊU CẦU ĐẦU RA (PHẢI TRẢ VỀ ĐỊNH DẠNG JSON):
- Trả về một mảng các đối tượng: [{ "panelNumber": 1, "beatId": 1, "originalText": "...", "shotType": "...", "cameraAngle": "...", "framing": "...", "composition": "...", "lighting": "...", "visibleCharacters": ["..."], "locationName": "...", "actionInFrame": "...", "continuityNotes": "..." }]
- Tạo danh sách các khung hình tương ứng với từng Beat trong bản phân tích.
- **ANTI-DUPLICATION:** Không lặp lại full profile nhân vật/địa điểm. Không viết final image prompt. \`actionInFrame\` chỉ mô tả hành động nhìn thấy trong panel; camera/framing/composition/lighting nằm ở field riêng.

PHÂN TÍCH NHỊP TRUYỆN:
${analysis}

HỒ SƠ NHÂN VẬT & BỐI CẢNH:
${charLocAnalysis}

QUY TẮC MÔ TẢ (DESCRIPTION RULES - CRITICAL):
1. **SỰ NHẤT QUÁN CỦA ĐẠO CỤ (PROP CONTINUITY):** Nếu một nhân vật đang cầm hoặc sử dụng một vật dụng (thùng, túi, vũ khí, vật dụng cá nhân) trong một khung hình, vật dụng đó PHẢI được nhắc lại trong mô tả của các khung hình tiếp theo trừ khi có hành động rõ ràng là họ đã bỏ nó xuống.
2. **CHI TIẾT TƯ THẾ & HÀNH ĐỘNG (POSTURE & ACTION - MANDATORY):** 
   - Mô tả rõ tư thế (nằm, ngồi, đứng, quỳ, chạy, nhảy), cử chỉ và biểu cảm dựa trên nội dung văn bản. 
   - **QUY TẮC DUY TRÌ TƯ THẾ:** Nếu nhân vật đang ở một tư thế đặc biệt (ví dụ: đang nằm trên sofa) và chưa có hành động thay đổi tư thế trong văn bản, tư thế này PHẢI được nhắc lại RÕ RÀNG trong mô tả của các khung hình tiếp theo. TUYỆT ĐỐI KHÔNG được bỏ qua thông tin tư thế ở các khung hình sau.
   - **QUY TẮC ĐỊNH DANH & TƯƠNG TÁC (CRITICAL):** 
     - Luôn sử dụng TÊN CỤ THỂ của nhân vật. KHÔNG dùng đại từ hoặc mô tả chung chung.
     - Phải mô tả rõ nhân vật đang tương tác với ai, nhìn vào ai. (Ví dụ: "Trương Kiến Quốc nhìn chằm chằm vào Vương Việt với vẻ khinh miệt").
     - **QUY TẮC OFF-SCREEN:** Ngay cả khi nhân vật ở ngoài màn hình (off-screen), nếu họ được nhắc đến trong hành động hoặc tương tác, họ vẫn phải được mô tả đầy đủ đặc điểm nhận dạng từ Profile.
     - Đối với đám đông hoặc nhân vật phụ, phải mô tả cụ thể hành động và hướng nhìn của họ (Ví dụ: "Nhóm nhân viên ở tiền cảnh đang xì xào và nhìn về phía văn phòng nơi xảy ra tranh chấp").
3. **BỐI CẢNH:** Luôn nhắc lại các chi tiết bối cảnh quan trọng để duy trì không gian.
`;

export const getStoryboardPrompt = (
  analysis: string,
  charLocAnalysis: string,
  artStyleDescription = ""
) => {
  const beats = parseJsonFallback<StoryBeat[]>(analysis, []);
  const library = parseJsonFallback<CharacterLocationLibraryResult>(charLocAnalysis, {
    characters: [],
    locations: []
  });

  return `You are a professional storyboard director for a vertical comic / visual illustration app.

Your ONLY task:
Create visual direction for each approved beat.

You must NOT re-analyze story content.
You must NOT rewrite originalText.
You must NOT change location.
You must NOT change visible characters.
You must NOT change props, action, posture, interaction, atmosphere, or visualFocus.

Use the approved beat data as the source of truth.
Character profiles and location profiles are also source of truth.
Use them only to guide blocking and composition.
Do not create new character identities or new locations.

Your output should contain ONLY visual/camera fields.
Return ONLY valid JSON. No markdown. No commentary.

Required JSON schema:
{
  "panels": [
    {
      "panelId": "panel_001",
      "panelNumber": 1,
      "beatId": 1,
      "shotType": "...",
      "cameraAngle": "...",
      "cameraDistance": "...",
      "lensFeel": "...",
      "composition": "...",
      "foreground": "...",
      "midground": "...",
      "background": "...",
      "characterBlocking": [
        {
          "characterId": "char_001",
          "characterName": "...",
          "framePosition": "...",
          "bodyPosition": "...",
          "facingDirection": "...",
          "expression": "...",
          "poseRefinement": "...",
          "interactionWith": "char_002"
        }
      ],
      "lightingDirection": "...",
      "depthAndPerspective": "...",
      "visualEmphasis": "...",
      "cameraNotes": "..."
    }
  ]
}

DO NOT OUTPUT these fields:
- originalText
- location
- locationId
- locationState
- visibleCharacters
- props
- action
- posture
- atmosphere
- visualFocus

These fields already exist in the approved beat data and must be reused by the app.

VISUAL DIRECTION RULES:
- shotType: close-up, medium shot, wide shot, over-the-shoulder, POV, etc.
- cameraAngle: eye-level, low angle, high angle, tilted angle, etc.
- cameraDistance: close, medium, wide, extreme close-up, etc.
- lensFeel: natural, cinematic compression, slight wide-angle, intimate portrait feel, etc.
- composition: where the important subjects are placed in the frame.
- foreground/midground/background: describe visual layers only.
- characterBlocking: place approved characters in the frame.
- expression and poseRefinement can refine the approved beat posture, but must not contradict it.
- lightingDirection can refine how existing location lighting is presented, but must not rewrite source story facts.
- cameraNotes should mention continuity concerns only when helpful.

SOURCE BEATS:
${JSON.stringify(beats, null, 2)}

CHARACTER LIBRARY:
${JSON.stringify(library.characters || [], null, 2)}

LOCATION LIBRARY:
${JSON.stringify(library.locations || [], null, 2)}

ART STYLE:
${artStyleDescription || "No specific style selected."}
`;
};

export const getEngineerPromptsPrompt = (storyboard: string, charLocAnalysis: string, style: string, _analysis = "") => `
Bạn là chuyên gia Prompt Engineering cấp cao. Hãy chuyển đổi Storyboard thành các prompt AI Image Generation (16:9) tuân thủ các quy tắc "NHẤT QUÁN CỰC ĐOAN".

DỮ LIỆU:
STORYBOARD: ${storyboard}

PHONG CÁCH HÌNH ẢNH (VISUAL STYLE):
${style}

QUY TẮC CẤU TRÚC PROMPT (PHẢI TUÂN THỦ THỨ TỰ):
1. **STYLE FIRST (BẮT BUỘC):** Luôn bắt đầu prompt bằng tên phong cách kèm mô tả chi tiết của nó: "${style}".
2. **LOCATION (BẮT BUỘC - CRITICAL FOR CONSISTENCY):** Tiếp theo là: "Location: [Tên địa điểm] ([Mô tả chi tiết địa điểm từ profile]), [Mô tả vật liệu/ánh sáng từ storyboard/profile]."
   - **LÝ DO:** TUYỆT ĐỐI KHÔNG được chỉ nhắc tên địa điểm đơn độc. Nếu chỉ ghi tên, AI sẽ tự tạo ra bối cảnh ngẫu nhiên (hallucination), dẫn đến việc địa điểm không đồng nhất giữa các PANEL.
   - **YÊU CẦU:** Phải sao chép đầy đủ mô tả từ Profile và Storyboard vào mỗi prompt.
   - **VÍ DỤ ĐÚNG:** "Location: Finance Department Office (A spacious modern office with glass walls, rows of white desks, and blue ergonomic chairs), night time with moonlight through windows mixed with flickering overhead fluorescent lights."
3. **SCENE & CHARACTERS (MANDATORY POSTURE & INTERACTION):** Sau đó là: "Scene: [Góc máy/Camera Angle], [Mô tả chi tiết TƯ THẾ (POSTURE), HÀNH ĐỘNG và TƯƠNG TÁC của từng nhân vật]. 
   - **BẮT BUỘC** mô tả tư thế (đứng, ngồi, nằm, quỳ, v.v.) ngay cả khi nó không thay đổi so với panel trước.
   - **BẮT BUỘC** xác định rõ đối tượng tương tác (nhìn ai, nói với ai, chạm vào ai). Sử dụng tên nhân vật cụ thể.
   - **ĐÁM ĐÔNG/NHÂN VẬT PHỤ:** Phải mô tả cụ thể hành động và hướng nhìn của họ đối với sự kiện chính.
4. **GLOBAL CHARACTER DESCRIPTION (CHARACTERS MUST HAVE PROFILES - CRITICAL):** 
   - **BẤT KỲ** nhân vật nào được nhắc đến trong prompt (kể cả nhân vật chính, phụ, phản diện, người qua đường, hay nhân vật ở tiền cảnh/hậu cảnh) đều **BẮT BUỘC** phải có mô tả Profile chi tiết kèm theo ngay sau tên.
   - **LƯU Ý QUAN TRỌNG:** Quy tắc này áp dụng cho cả các nhân vật được ghi chú là **(off-screen)**. Dù không xuất hiện trên khung hình, việc mô tả đầy đủ giúp AI hiểu rõ ngữ cảnh và tương tác.
   - **LÝ DO:** Nếu chỉ ghi tên nhân vật mà không có mô tả, AI sẽ tự động tạo ra ngoại hình ngẫu nhiên, làm mất tính nhất quán (hallucination).
   - **BẮT BUỰC** áp dụng cho cả khi chỉ mô tả một bộ phận cơ thể (tay, chân, vai).
   - Định dạng: "CharacterName (Gender: [gender], Age: [age], Height: [height], Face: [face], Hair: [hair], Eyes: [eyes], [Posture: [tư thế hiện tại]], [Mô tả 01 Outfit phù hợp nhất])".
   - **VÍ DỤ ĐÚNG:** "Police Officer (Male, 30, 180cm, Square face, ..., Posture: Standing upright, ...) enters the frame... Behind him, Chị Trương (Female, 35, 160cm, Round face, ..., Posture: Sitting on a chair, ...) looks smug... To the side, Vương Việt (Male, 28, 175cm, Sharp features, ..., Outfit 1: Black suit) (off-screen) is shouting."
   - **OUTFIT SELECTION (STRICT & SEQUENTIAL):** Nếu hồ sơ nhân vật có nhiều Outfit, AI phải phân tích nội dung Panel và đối chiếu với thứ tự trong danh sách \`outfit\` để chọn ra trang phục chính xác nhất theo diễn biến truyện. CHỈ đưa mô tả của outfit đó vào prompt.
   - **OUTFIT FIDELITY (TRUNG THỰC TUYỆT ĐỐI):**
     - Khi chèn mô tả Outfit vào prompt, bạn PHẢI sao chép **NGUYÊN VĂN 100%** từng từ trong mô tả Outfit từ Profile.
     - **CẤM** rút gọn, tóm tắt, hoặc lược bỏ bất kỳ chi tiết nào (ví dụ: không được bỏ "traditional-style", "velvet", "leggings").
     - **VÍ DỤ SAI:** Profile: "Bright purple velvet traditional-style coat and black leggings" -> Prompt: "Bright purple coat". (SAI - Rút gọn).
     - **VÍ DỤ ĐÚNG:** Profile: "Bright purple velvet traditional-style coat and black leggings" -> Prompt: "Bright purple velvet traditional-style coat and black leggings". (ĐÚNG - Nguyên văn).
5. **CẤM DANH TỪ TẬP HỢP:** Tuyệt đối không dùng "The trio", "The group", "Both of them".
6. **QUY TẮC GÓC MÁY & TƯƠNG TÁC (CAMERA ANGLES & INTERACTION - CRITICAL):** 
   - Hội thoại dùng Close-up, Tương tác dùng Medium/OTS, Hành động dùng Wide.
   - **QUY TẮC OTS & POV (OTS & POV RULES - CRITICAL):**
     - Trong góc máy **Over-the-shoulder (OTS)** hoặc **POV**, nhân vật đóng vai trò là "điểm nhìn" (người có vai/lưng ở tiền cảnh) PHẢI được mô tả Profile đầy đủ. 
     - **CẤM** chỉ ghi "from Character's perspective" mà không có mô tả ngoại hình của Character.
     - **CẤU TRÚC ĐÚNG:** "Over-the-shoulder shot, foreground: [Character A Profile]'s shoulder and back of head, background: [Character B's Profile] [Action]...".
     - Điều này đảm bảo AI biết được màu tóc, trang phục của người ở tiền cảnh để duy trì tính nhất quán.
   - **TƯƠNG TÁC VẬT DỤNG (OBJECT INTERACTION):** Khi nhân vật tương tác với vật dụng (điện thoại, sách, gương, đồ vật), TUYỆT ĐỐI KHÔNG được chỉ mô tả vật dụng đó đơn độc. 
   - **BẮT BUỘC** phải sử dụng góc máy **Over-the-shoulder (OTS)** hoặc **Point of View (POV)** để thấy tay/vai của nhân vật đang cầm/nhìn vật dụng đó. 
   - Ví dụ: Thay vì "A phone screen", phải là "Over-the-shoulder shot, CharacterName's hand holding a phone, looking at the screen showing...". Điều này giúp duy trì sự hiện diện của nhân vật ngay cả khi tập trung vào chi tiết.
   - **QUY TẮC PHẢN CHIẾU (REFLECTION RULES):** Khi mô tả sự phản chiếu của nhân vật hoặc biểu cảm lên màn hình điện thoại, tivi, hoặc cửa kính:
     - BẮT BUỘC mô tả sự phản chiếu là **"faint reflection"** hoặc **"low opacity reflection"**.
     - Phải đảm bảo nội dung chính trên màn hình hoặc bối cảnh phía sau kính vẫn rõ nét (Ví dụ: "faint reflection of CharacterName's worried face on the glowing phone screen showing chat messages").
   - **HIỂN THỊ MÀN HÌNH GIÁN TIẾP (INDIRECT SCREEN VISUALIZATION - CRITICAL):**
     - Khi góc máy quay từ phía sau thiết bị (nhìn thấy lưng điện thoại/máy tính) hoặc màn hình không hướng trực diện vào camera, nhưng nội dung trên màn hình là quan trọng:
     - **HÀNH ĐỘNG:** Yêu cầu tạo một khung hình nhỏ (inset panel/bubble) hoặc bố cục chia đôi (split screen) để hiển thị rõ nội dung đó.
     - **PROMPT:** Thêm từ khóa "with an inset close-up of the phone screen showing [Content]" hoặc "split screen: one side shows [Character holding phone], other side shows [Phone Screen Content]".
     - **CẤM:** Tuyệt đối không để AI vẽ nội dung màn hình đè lên mặt lưng điện thoại hoặc lơ lửng trong không gian.
7. **TÍNH LIÊN TỤC & VẬT THỂ BẤT BIẾN (OBJECT PERMANENCE & STATE CONTINUITY - CRITICAL):** 
   - AI phải ghi nhớ vị trí, **TƯ THẾ (POSTURE - nằm, ngồi, đứng, quỳ)**, TRẠNG THÁI HÀNH ĐỘNG và **CÁC VẬT DỤNG ĐANG CẦM/SỬ DỤNG** của nhân vật từ các panel trước đó. 
   - **QUY TẮC TƯ THẾ (POSTURE):** Nếu ở panel trước nhân vật đang nằm hoặc ngồi, và văn bản tiếp theo không mô tả hành động đứng dậy, thì ở panel sau nhân vật PHẢI tiếp tục ở tư thế đó. 
   - **QUY TẮC VẬT DỤNG (PROPS):** Nếu ở panel trước nhân vật đang cầm một vật dụng (ví dụ: cái thùng, túi xách, vũ khí, điện thoại), thì ở các panel tiếp theo vật dụng đó PHẢI XUẤT HIỆN TRONG PROMPT cho đến khi có hành động rõ ràng là nhân vật đã đặt xuống hoặc làm mất nó. 
   - Tuyệt đối không được bỏ quên các trạng thái này giữa các khung hình. (Ví dụ: Nếu Panel 1 đang nằm trên sofa thì Panel 2 dù chỉ mô tả "looking at phone" vẫn PHẢI thêm "while still lying on the sofa" vào prompt).
8. **CẤM VĂN BẢN & BÓNG (STRICT):** 
   - Tuyệt đối KHÔNG bao gồm lời thoại, văn bản, bong bóng chat (speech bubbles) trong prompt. 
   - Hạn chế tối đa các mô tả về bóng đổ (shadows) quá mạnh làm mất chi tiết nhân vật. Thêm "no text, no speech bubbles, no shadows" vào cuối mỗi prompt.

VÍ DỤ CẤU TRÚC:
"${style}, Location: Living Room, wooden floor, warm sunset light. Scene: John (Male, 25, 180cm, ...) sitting on the sofa, holding a cup of coffee..."

YÊU CẦU ĐẦU RA (PHẢI TRẢ VỀ JSON):
Trả về một mảng các đối tượng, mỗi đối tượng tương ứng với một panel:
{
  "panelNumber": number,
  "visualPrompt": "string (định dạng Style-First + Location-First)"
}

HỒ SƠ NHÂN VẬT & ĐỊA ĐIỂM:
${charLocAnalysis}
`;

export const getQAPrompt = (data: string, charLocAnalysis: string, style: string) => `
Bạn là QA Director kiểm định tính nhất quán hình ảnh và logic không gian.

PHONG CÁCH HÌNH ẢNH (VISUAL STYLE) CẦN KIỂM TRA:
${style}

KIỂM TRA CÁC LỖI SAU (ĐẶC BIỆT CHÚ TRỌNG TÍNH NHẤT QUÁN):
1. Prompt có bắt đầu bằng phong cách "${style}" kèm mô tả đầy đủ không?
2. Prompt có Location kèm theo đầy đủ mô tả chi tiết địa điểm (từ profile) và mô tả vật liệu/ánh sáng (từ storyboard) không?
   - **KIỂM TRA LỖI:** Nếu chỉ thấy "Location: [Tên]" mà thiếu phần mô tả chi tiết trong ngoặc đơn hoặc thiếu mô tả ánh sáng/vật liệu -> **LỖI NGHIÊM TRỌNG**. AI sẽ tự vẽ bối cảnh sai lệch. 
   - **HÀNH ĐỘNG:** Phải chèn đầy đủ mô tả từ Profile và Storyboard vào để đảm bảo tất cả các PANEL có bối cảnh giống hệt nhau.
3. TẤT CẢ các nhân vật xuất hiện (kể cả nhân vật chính, phụ, phản diện, hay người qua đường, và ngay cả khi chỉ nhắc đến bộ phận cơ thể) đã có mô tả Profile chi tiết đi kèm ngay sau tên chưa? 
   - **CẤM TUYỆT ĐỐI** việc chỉ để tên nhân vật mà không có mô tả hình thể và trang phục trong ngoặc đơn.
   - **QUY TẮC OFF-SCREEN:** Ngay cả khi nhân vật được ghi chú là **(off-screen)**, họ vẫn BẮT BUỘC phải có Profile chi tiết đi kèm.
   - **LÝ DO KIỂM TRA:** Nếu thiếu mô tả, AI sẽ tự vẽ ngẫu nhiên (hallucination) làm sai lệch nhân vật.
   - **KIỂM TRA LỖI:** Nếu thấy "CharacterName" hoặc "CharacterName's [body part]" mà không có ngoặc đơn mô tả profile -> BẮT BUỘC sửa lại bằng cách chèn Profile từ thư viện vào.
4. Có xuất hiện "The group" hay "The trio" không?
5. Trang phục (Outfit) của nhân vật có được chọn đúng theo diễn biến truyện không? (Phải chọn đúng 1 bộ trang phục phù hợp nhất từ danh sách \`outfit\` dựa trên thứ tự xuất hiện trong nội dung).
   - **TÍNH LIÊN TỤC GIỮA CÁC CHƯƠNG (CROSS-CHAPTER CONTINUITY):** Đặc biệt lưu ý nếu đây là phần tiếp nối của chương trước, nhân vật PHẢI mặc đúng bộ trang phục đã mặc ở cuối chương trước trừ khi có tình tiết thay đồ rõ ràng.
   - **KIỂM TRA GIỚI HẠN OUTFIT (MAX 2 PER CONTEXT):** Đảm bảo trong cùng một bối cảnh (Ví dụ: Công sở) không xuất hiện quá 2 bộ đồ khác nhau. 
   - **KIỂM TRA TÍNH LUÂN PHIÊN (ROTATION LOGIC):** Nếu qua ngày mới trong cùng bối cảnh, hãy kiểm tra xem outfit có được luân phiên A-B-A-B hợp lý không. TUYỆT ĐỐI không để nhân vật mặc bộ thứ 3 nếu không có mô tả thay đồ đặc biệt trong tiểu thuyết.
   - **KIỂM TRA ĐỘ ĐẦY ĐỦ CỦA OUTFIT (OUTFIT COMPLETENESS CHECK):**
     - So sánh mô tả Outfit trong prompt với mô tả gốc trong Profile.
     - Nếu thấy prompt bị rút gọn, lược bỏ từ khóa quan trọng (Ví dụ: Bỏ "leggings", bỏ "velvet", bỏ "traditional-style") -> **LỖI**.
     - **HÀNH ĐỘNG:** Sửa lại bằng cách sao chép đầy đủ mô tả từ Profile vào.
6. **TÍNH NHẤT QUÁN VẬT DỤNG (PROP CONSISTENCY - CỰC KỲ QUAN TRỌNG):** 
   - So sánh giữa các panel liên tiếp: Nếu panel trước nhân vật đang cầm/mang theo một vật dụng (thùng, túi, đạo cụ), hãy kiểm tra xem panel sau có còn mô tả vật dụng đó không?
   - Nếu bị mất vật dụng mà không có lý do trong văn bản -> PHẢI THÊM LẠI vật dụng đó vào prompt.
7. **SỰ HIỆN DIỆN CỦA NHÂN VẬT TRONG CẢNH CHI TIẾT (CHARACTER PRESENCE):**
   - Kiểm tra các cảnh tập trung vào vật dụng (như nhìn điện thoại, xem tài liệu). Nếu prompt chỉ mô tả vật dụng mà quên mất nhân vật -> PHẢI yêu cầu sửa lại thành góc máy **Over-the-shoulder (OTS)** hoặc thêm mô tả tay/vai nhân vật đang tương tác.
   - **KIỂM TRA OTS/POV (CRITICAL):** Nếu cameraAngle là OTS hoặc POV, hãy kiểm tra xem trong prompt đã có mô tả Profile của nhân vật ở tiền cảnh (foreground character) chưa?
     - Nếu chỉ có "from [Name]'s perspective" mà thiếu Profile của [Name] ở tiền cảnh -> **LỖI NGHIÊM TRỌNG**. Phải sửa lại bằng cách thêm: "foreground: [Character Profile]'s shoulder and back of head".
   - **KIỂM TRA PHẢN CHIẾU (REFLECTION CHECK):** Nếu có mô tả phản chiếu (reflection), phải đảm bảo có các từ khóa như "faint", "low opacity", hoặc "translucent" để không làm mờ nội dung chính của màn hình/kính.
   - **KIỂM TRA HIỂN THỊ MÀN HÌNH (SCREEN VISUALIZATION CHECK):**
     - Nếu prompt mô tả nội dung trên màn hình (điện thoại, máy tính) nhưng góc máy không nhìn thấy màn hình (ví dụ: quay lưng, góc nghiêng khuất):
     - **HÀNH ĐỘNG:** Kiểm tra xem đã có yêu cầu "inset panel", "close-up bubble" hoặc "split screen" chưa. Nếu chưa -> **LỖI**. Phải thêm vào để tránh lỗi AI vẽ nội dung lên lưng thiết bị.
8. **TÍNH NHẤT QUÁN TƯ THẾ (POSTURE CONSISTENCY):** 
   - Kiểm tra tư thế của nhân vật giữa các panel liên tiếp. 
   - Nếu panel trước nhân vật đang ở một tư thế (nằm, ngồi, quỳ) và văn bản không có hành động thay đổi tư thế (đứng dậy, đi lại) -> PHẢI đảm bảo panel sau vẫn mô tả nhân vật ở tư thế đó, ngay cả trong các cảnh cận cảnh (Close-up).
   - Ví dụ: Nếu nhân vật đang nằm, cảnh cận cảnh điện thoại phải mô tả "phone held by a character lying down".
9. Kiểm tra văn bản/lời thoại: Prompt có chứa từ khóa về "speech bubbles", "text", "dialogue" không? (Phải loại bỏ).
10. **KIỂM TRA TỪ CẤM & NHẠY CẢM (CONTENT SAFETY - CRITICAL):**
   - Kiểm tra các từ ngữ có thể bị các công cụ tạo ảnh (như Midjourney, DALL-E) chặn do vi phạm chính sách (bạo lực, máu me, nhạy cảm, bộ phận cơ thể, từ lóng...).
   - **HÀNH ĐỘNG:** Thay thế các từ này bằng các từ ngữ nghệ thuật, ẩn dụ hoặc mô tả gián tiếp nhưng vẫn giữ nguyên ý nghĩa của khung hình.
   - **VÍ DỤ:** 
     - Thay "blood" bằng "crimson liquid" hoặc "dark red splashes".
     - Thay "killing/murder" bằng "defeated/neutralized".
     - Thay các từ nhạy cảm về cơ thể bằng các mô tả về trang phục hoặc ánh sáng che khuất.
     - Thay "gun/weapon" (nếu bị chặn) bằng "metallic tool" hoặc mô tả hình dáng cụ thể.
11. Vị trí nhân vật có bị thay đổi vô lý giữa các screen không?

YÊU CẦU ĐẦU RA (PHẢI TRẢ VỀ JSON):
CHỈ trả về các panel có lỗi cần sửa hoặc có thay đổi. Các panel đạt yêu cầu (Pass) thì KHÔNG cần đưa vào danh sách kết quả này.
{
  "panelNumber": number,
  "visualPrompt": "string (đã được fix)",
  "qaNotes": "string (ghi chú lỗi đã sửa)"
}

HỒ SƠ GỐC:
${charLocAnalysis}

PROMPTS CẦN KIỂM TRA (JSON):
${data}
`;

export const getFinalResultPrompt = (storyboard: string, prompts: string, qaReport: string, charLocAnalysis: string) => `
Bạn là Production Manager cho dự án minh họa tiểu thuyết. Tổng hợp dữ liệu thành JSON. 

QUY TẮC LẤY VISUAL PROMPT:
1. Bản QA chỉ chứa các panel đã được sửa lỗi hoặc thay đổi.
2. NẾU panelNumber có trong bản QA, PHẢI lấy visualPrompt từ bản QA đó.
3. NẾU panelNumber KHÔNG có trong bản QA, hãy lấy visualPrompt từ bản PROMPTS gốc.
4. Đảm bảo kết quả cuối cùng có đầy đủ tất cả các panel từ 1 đến hết.

YÊU CẦU CẤU TRÚC JSON ĐẦU RA:
{
  "characterName": ["tong_mat", "vuong_viet", ...], // Danh sách tên nhân vật dạng snake_case, không dấu (ví dụ: "Tống Mật" thành "tong_mat") từ HỒ SƠ NHÂN VẬT bên dưới.
  "panels": [ // Mảng chứa thông tin các khung hình
    {
      "panelNumber": Số thứ tự khung hình,
      "shotName": "Tiêu đề ngắn gọn cho khung hình",
      "originalText": "Câu văn hoặc đoạn văn gốc được minh họa",
      "cameraAngle": "Góc máy",
      "framing": "Bố cục khung hình",
      "subject": "Chủ thể chính",
      "action": "Hành động diễn ra",
      "location_cues": "Dấu hiệu bối cảnh",
      "lighting": "Ánh sáng (theo quy tắc [Global Light] mixed with [Accent Light])",
      "visualPrompt": "Prompt hình ảnh cuối cùng",
      "negative_prompt": "text, speech bubbles, watermark, low quality, shadows, blurry"
    }
  ]
}

DỮ LIỆU:
HỒ SƠ NHÂN VẬT: ${charLocAnalysis}
STORYBOARD: ${storyboard}
PROMPTS: ${prompts}
QA (Chỉ gồm các bản sửa lỗi): ${qaReport}
`;

// --- API SERVICES ---

export const analyzeBeats = async (text: string, artStyleDescription?: string): Promise<BeatAnalysisResult> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: getModel(),
    contents: getBeatAnalysisPrompt(text, artStyleDescription),
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          beats: {
            type: "array",
            items: {
              type: "object",
              properties: {
                beatId: { type: "integer" },
                originalText: { type: "string" },
                summary: { type: "string" },
                characters: {
                  type: "array",
                  items: { type: "string" }
                },
                location: { type: "string" },
                action: { type: "string" },
                interaction: { type: "string" },
                posture: { type: "string" },
                props: {
                  type: "array",
                  items: { type: "string" }
                },
                visualFocus: { type: "string" },
                atmosphere: { type: "string" },
                timeOfDay: { type: "string" }
              },
              required: ["beatId", "originalText", "summary", "characters", "location", "action", "interaction", "posture", "props", "visualFocus", "atmosphere", "timeOfDay"]
            }
          },
          coverageCheck: {
            type: "object",
            properties: {
              allSourceTextCovered: { type: "boolean" },
              missingText: { type: "string" },
              duplicatedText: { type: "string" },
              notes: { type: "string" }
            }
          }
        },
        required: ["beats"]
      } as any
    }
  });

  return parseGeminiJson<BeatAnalysisResult>(response.text);
};

export const generateCharacterLocationLibrary = async (
  originalText: string,
  beats: StoryBeat[],
  artStyleDescription?: string,
  existingLibrary?: string
): Promise<CharacterLocationLibraryResult> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: getModel(),
    contents: getCharacterLocationLibraryPrompt(originalText, beats, artStyleDescription, existingLibrary),
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          characters: {
            type: "array",
            items: {
              type: "object",
              properties: {
                characterId: { type: "string" },
                name: { type: "string" },
                aliases: {
                  type: "array",
                  items: { type: "string" }
                },
                role: { type: "string" },
                gender: { type: "string" },
                age: { type: "string" },
                height: { type: "string" },
                bodyType: { type: "string" },
                face: { type: "string" },
                hair: { type: "string" },
                eyes: { type: "string" },
                outfit: { type: "string" },
                accessories: {
                  type: "array",
                  items: { type: "string" }
                },
                props: {
                  type: "array",
                  items: { type: "string" }
                },
                colorPalette: {
                  type: "array",
                  items: { type: "string" }
                },
                personalityVisualCues: { type: "string" },
                expressionSet: {
                  type: "array",
                  items: { type: "string" }
                },
                gestureSet: {
                  type: "array",
                  items: { type: "string" }
                },
                continuityNotes: { type: "string" },
                firstAppearanceBeatId: { type: "integer" },
                appearsInBeatIds: {
                  type: "array",
                  items: { type: "integer" }
                }
              },
              required: ["characterId", "name", "aliases", "role", "gender", "age", "height", "bodyType", "face", "hair", "eyes", "outfit", "accessories", "props", "colorPalette", "personalityVisualCues", "expressionSet", "gestureSet", "continuityNotes", "appearsInBeatIds"]
            }
          },
          locations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                locationId: { type: "string" },
                name: { type: "string" },
                aliases: {
                  type: "array",
                  items: { type: "string" }
                },
                description: { type: "string" },
                layout: { type: "string" },
                keyObjects: {
                  type: "array",
                  items: { type: "string" }
                },
                lighting: { type: "string" },
                atmosphere: { type: "string" },
                colorPalette: {
                  type: "array",
                  items: { type: "string" }
                },
                continuityNotes: { type: "string" },
                baseState: { type: "string" },
                firstAppearanceBeatId: { type: "integer" },
                appearsInBeatIds: {
                  type: "array",
                  items: { type: "integer" }
                }
              },
              required: ["locationId", "name", "aliases", "description", "layout", "keyObjects", "lighting", "atmosphere", "colorPalette", "continuityNotes", "baseState", "appearsInBeatIds"]
            }
          }
        },
        required: ["characters", "locations"]
      } as any
    }
  });

  return parseGeminiJson<CharacterLocationLibraryResult>(response.text);
};

export const analyzeStoryPhase1 = async (script: string, style: string, existingLibrary?: string) => {
  const beatResult = await analyzeBeats(script, style);
  const normalizedAnalysis = beatResult.beats.map((beat) => ({
    ...beat,
    actionAnalysis: beat.actionAnalysis || beat.action || beat.summary,
    charactersInvolved: beat.charactersInvolved || beat.characters,
    locationName: beat.locationName || beat.location
  }));
  const characterLocationAnalysis = await generateCharacterLocationLibrary(
    script,
    normalizedAnalysis,
    style,
    existingLibrary
  );
  const analysis = mapLocationIdsToBeats(normalizedAnalysis, characterLocationAnalysis.locations);

  return {
    analysis,
    coverageCheck: beatResult.coverageCheck,
    characterLocationAnalysis
  };
};

export const analyzePhase1Analysis = async (script: string, style: string, existingLibrary?: string) => {
  const result = await analyzeStoryPhase1(script, style, existingLibrary);
  return JSON.stringify(result);
};

export const createStoryboard = async (analysis: string, charLocAnalysis: string, style = "") => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: getModel(),
    contents: getStoryboardPrompt(analysis, charLocAnalysis, style),
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          panels: {
            type: "array",
            items: {
              type: "object",
              properties: {
                panelId: { type: "string" },
                panelNumber: { type: "integer" },
                beatId: { type: "integer" },
                shotType: { type: "string" },
                cameraAngle: { type: "string" },
                cameraDistance: { type: "string" },
                lensFeel: { type: "string" },
                composition: { type: "string" },
                foreground: { type: "string" },
                midground: { type: "string" },
                background: { type: "string" },
                characterBlocking: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      characterId: { type: "string" },
                      characterName: { type: "string" },
                      framePosition: { type: "string" },
                      bodyPosition: { type: "string" },
                      facingDirection: { type: "string" },
                      expression: { type: "string" },
                      poseRefinement: { type: "string" },
                      interactionWith: { type: "string" }
                    }
                  }
                },
                lightingDirection: { type: "string" },
                depthAndPerspective: { type: "string" },
                visualEmphasis: { type: "string" },
                cameraNotes: { type: "string" }
              },
              required: ["panelId", "panelNumber", "beatId", "shotType", "cameraAngle", "composition"]
            }
          }
        },
        required: ["panels"]
      } as any
    }
  });
  const parsed = parseGeminiJson<{ panels?: unknown[] } | unknown[]>(response.text);
  const panels = sanitizeStoryboardPanels(normalizeStoryboardPanels(parsed));
  return JSON.stringify({ panels }, null, 2);
};

export const engineerPrompts = async (storyboard: string, charLocAnalysis: string, style: string, analysis = "") => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: getModel(),
    contents: getEngineerPromptsPrompt(storyboard, charLocAnalysis, style, analysis),
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "array",
        items: {
          type: "object",
          properties: {
            panelNumber: { type: "integer" },
            visualPrompt: { type: "string" }
          },
          required: ["panelNumber", "visualPrompt"]
        }
      } as any
    }
  });
  return response.text;
};

export const runQA = async (data: string, charLocAnalysis: string, style: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: getModel(),
    contents: getQAPrompt(data, charLocAnalysis, style),
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "array",
        items: {
          type: "object",
          properties: {
            panelNumber: { type: "integer" },
            visualPrompt: { type: "string" },
            qaNotes: { type: "string" }
          },
          required: ["panelNumber", "visualPrompt", "qaNotes"]
        }
      } as any
    }
  });
  return response.text;
};

export const generateFinalResult = async (storyboard: string, prompts: string, qaReport: string, charLocAnalysis: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: getModel(),
    contents: getFinalResultPrompt(storyboard, prompts, qaReport, charLocAnalysis),
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          characterName: {
            type: "array",
            items: { type: "string" }
          },
          panels: {
            type: "array",
            items: {
              type: "object",
              properties: {
                panelNumber: { type: "integer" },
                shotName: { type: "string" },
                originalText: { type: "string" },
                cameraAngle: { type: "string" },
                framing: { type: "string" },
                subject: { type: "string" },
                action: { type: "string" },
                location_cues: { type: "string" },
                lighting: { type: "string" },
                visualPrompt: { type: "string" },
                negative_prompt: { type: "string" }
              },
              required: ["panelNumber", "shotName", "originalText", "visualPrompt"]
            }
          }
        },
        required: ["characterName", "panels"]
      } as any
    }
  });
  return response.text;
};


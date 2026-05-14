
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
You must NOT change timeOfDay.
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
- summary
- timeOfDay
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

export const getEngineerPromptsPrompt = (storyboard: string, charLocAnalysis: string, style: string, analysis = "") => `
You are an expert image prompt engineer for an illustrated story pipeline.

Your ONLY task:
Build final image-generation prompts by combining approved source data.

SOURCE OF TRUTH RULES:
- Do not re-analyze the story.
- Do not infer or change location, characters, props, action, interaction, posture, atmosphere, or visualFocus.
- Use APPROVED BEATS as the source of truth for story fields.
- Use CHARACTER + LOCATION LIBRARY as the source of truth for identity and continuity.
- Use STORYBOARD VISUAL DIRECTION only for camera, composition, blocking, lighting direction, depth, and visual emphasis.
- Do not output source fields as separate fields unless the schema below requires them.
- Do not output timeOfDay as a separate field.

Return ONLY a valid JSON array. No markdown. No commentary.

Required JSON schema:
[
  {
    "panelNumber": 1,
    "panelId": "panel_001",
    "beatId": 1,
    "visualPrompt": "string",
    "negativePrompt": "text, speech bubbles, watermark, low quality",
    "sourceUsage": {
      "usedBeatId": 1,
      "usedLocationId": "loc_001",
      "usedCharacterIds": ["char_001"]
    }
  }
]

VISUAL PROMPT COMPOSITION:
For each storyboard panel:
1. Find the matching approved beat by panel.beatId.
2. Reuse beat originalText, location, locationId, locationState, characters, props, action, interaction, posture, atmosphere, and visualFocus without changing their meaning.
3. Reuse character profiles for identity, outfit, accessories, props, color palette, and continuity notes.
4. Reuse location profiles for description, layout, key objects, lighting, color palette, continuity notes, and base state.
5. Reuse storyboard visual direction only for shotType, cameraAngle, cameraDistance, lensFeel, composition, foreground, midground, background, characterBlocking, lightingDirection, depthAndPerspective, visualEmphasis, and cameraNotes.
6. Produce one self-contained visualPrompt per panel.

STYLE:
${style}

APPROVED BEATS:
${analysis || "No approved beat data provided. Use storyboard legacy source fields only as fallback."}

STORYBOARD VISUAL DIRECTION:
${storyboard}

CHARACTER + LOCATION LIBRARY:
${charLocAnalysis}
`;

export const getQAPrompt = (data: string, charLocAnalysis: string, style: string, storyboard = "", analysis = "") => `
You are a QA checker for an illustrated story prompt pipeline.

Your ONLY task:
Check whether generated image prompts preserve approved source data.

SOURCE OF TRUTH RULES:
- Do not rewrite approved source fields.
- Do not create new story fields.
- Do not change location, characters, props, action, interaction, posture, atmosphere, or visualFocus.
- Use APPROVED BEATS as the source of truth for story fields.
- Use CHARACTER + LOCATION LIBRARY as the source of truth for identity and continuity.
- Use STORYBOARD VISUAL DIRECTION only for camera, composition, blocking, and visual direction.
- Only report mismatches and suggested visualPrompt fixes.

Return ONLY a valid JSON array. No markdown. No commentary.

Required JSON schema:
[
  {
    "panelNumber": 1,
    "panelId": "panel_001",
    "beatId": 1,
    "visualPrompt": "string, only if a prompt patch is needed",
    "qaNotes": "string"
  }
]

CHECK FOR:
- location mismatch or missing location continuity
- unapproved characters or missing approved characters
- character outfit / identity inconsistency
- location layout / key object inconsistency
- missing approved props
- action, interaction, or posture contradiction
- atmosphere or visualFocus contradiction
- storyboard camera/composition not reflected
- text, captions, subtitles, speech bubbles, watermark, or unsafe wording

STYLE:
${style}

APPROVED BEATS:
${analysis || "No approved beat data provided."}

STORYBOARD VISUAL DIRECTION:
${storyboard || "No storyboard data provided."}

CHARACTER + LOCATION LIBRARY:
${charLocAnalysis}

GENERATED PROMPTS TO CHECK:
${data}
`;

export const getFinalResultPrompt = (storyboard: string, prompts: string, qaReport: string, charLocAnalysis: string, analysis = "") => `
You are assembling the final approved output for an illustrated story pipeline.

Your ONLY task:
Create a clean final JSON by linking approved sources together.

SOURCE OF TRUTH RULES:
- Do not re-analyze the story.
- Do not rewrite originalText.
- Do not infer new location or characters.
- Do not modify visual prompts except applying explicit QA patches when provided.
- Beat Analysis is the source of truth for story fields.
- Character Library is the source of truth for character identity and continuity.
- Location Library is the source of truth for location identity and continuity.
- Storyboard is the source of truth only for camera and composition.
- Engineer Prompts are the source of truth for visualPrompt.
- QA is the source of truth for fixes and notes.

Return ONLY valid JSON. No markdown. No commentary.

Required JSON schema:
{
  "characterName": ["character_snake_case"],
  "panels": [
    {
      "panelNumber": 1,
      "beatId": 1,
      "shotName": "short panel title",
      "originalText": "copy from approved beat source",
      "cameraAngle": "from storyboard visual direction",
      "framing": "from storyboard visual direction",
      "subject": "main approved subject",
      "action": "copy from approved beat source",
      "location_cues": "copy/reuse approved location source",
      "lighting": "reuse approved location/storyboard lighting direction",
      "visualPrompt": "final approved prompt",
      "negative_prompt": "text, speech bubbles, watermark, low quality, blurry",
      "qaNotes": "QA notes if any"
    }
  ]
}

APPROVED BEATS:
${analysis || "No approved beat data provided. Use storyboard legacy fields only as fallback."}

CHARACTER + LOCATION LIBRARY:
${charLocAnalysis}

STORYBOARD VISUAL DIRECTION:
${storyboard}

ENGINEER PROMPTS:
${prompts}

QA PATCHES / NOTES:
${qaReport}
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
            panelId: { type: "string" },
            beatId: { type: "integer" },
            visualPrompt: { type: "string" },
            negativePrompt: { type: "string" },
            sourceUsage: {
              type: "object",
              properties: {
                usedBeatId: { type: "integer" },
                usedLocationId: { type: "string" },
                usedCharacterIds: {
                  type: "array",
                  items: { type: "string" }
                }
              }
            }
          },
          required: ["panelNumber", "visualPrompt"]
        }
      } as any
    }
  });
  return response.text;
};

export const runQA = async (
  data: string,
  charLocAnalysis: string,
  style: string,
  storyboard = "",
  analysis = ""
) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: getModel(),
    contents: getQAPrompt(data, charLocAnalysis, style, storyboard, analysis),
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "array",
        items: {
          type: "object",
          properties: {
            panelNumber: { type: "integer" },
            panelId: { type: "string" },
            beatId: { type: "integer" },
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

export const generateFinalResult = async (
  storyboard: string,
  prompts: string,
  qaReport: string,
  charLocAnalysis: string,
  analysis = ""
) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: getModel(),
    contents: getFinalResultPrompt(storyboard, prompts, qaReport, charLocAnalysis, analysis),
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


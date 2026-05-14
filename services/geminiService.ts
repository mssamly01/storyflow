
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

LOCKED FIELD RULES:
If any input entity contains meta.locks.lockedFields, preserve those fields exactly.
Do not rewrite, reinterpret, summarize, improve, or change locked fields.
Only regenerate unlocked fields. Locked values are approved source-of-truth data.

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
You are an illustration artist and visual director. Based on the content analysis and the character/location library, draft a detailed storyboard.

OUTPUT REQUIREMENTS (MUST RETURN JSON):
- Return an array of objects: [{ "panelNumber": 1, "beatId": 1, "originalText": "...", "shotType": "...", "cameraAngle": "...", "framing": "...", "composition": "...", "lighting": "...", "visibleCharacters": ["..."], "locationName": "...", "actionInFrame": "...", "continuityNotes": "..." }]
- Create panels that correspond to each beat in the analysis.
- ANTI-DUPLICATION: Do not repeat full character/location profiles. Do not write final image prompts. actionInFrame should only describe visible action in the panel; camera/framing/composition/lighting must stay in separate fields.

BEAT ANALYSIS:
${analysis}

CHARACTER + LOCATION LIBRARY:
${charLocAnalysis}

DESCRIPTION RULES - CRITICAL:
1. PROP CONTINUITY: If a character is holding or using an item in one panel, mention that item in following panels until the story clearly says it was put down or lost.
2. POSTURE AND ACTION: Describe clear posture, gesture, facial expression, action, and interaction based on the text. If a character is lying, sitting, kneeling, or in another specific posture, keep that posture until the story explicitly changes it.
3. NAMED INTERACTIONS: Use specific character names. Do not use vague pronouns or group labels. Describe who looks at whom, speaks to whom, or interacts with whom.
4. BACKGROUND CHARACTERS: For crowds or side characters, describe their concrete action and gaze direction.
5. LOCATION: Repeat important location details needed to preserve spatial continuity.
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

LOCKED FIELD RULES:
If any beat, character, location, or panel input contains meta.locks.lockedFields, preserve those fields exactly.
Do not rewrite, reinterpret, summarize, improve, or change locked fields.
Only regenerate unlocked fields. Locked values are approved source-of-truth data.

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
You are a senior Prompt Engineering specialist. Convert the Storyboard into 16:9 AI image-generation prompts under EXTREME CONSISTENCY rules.

TASK:
Create one copy-ready visualPrompt for each panel.
Each visualPrompt must be detailed enough to paste directly into an AI image generator.
Each visualPrompt must contain both the positive prompt and a final "Negative prompt:" section.

SOURCE-OF-TRUTH RULES:
- Do not re-analyze story fields.
- Do not infer timeOfDay, location, visible characters, props, action, interaction, posture, atmosphere, or visualFocus.
- originalText, timeOfDay, location, locationId, locationState, visible characters, props, action, interaction, posture, atmosphere, and visualFocus must come from APPROVED BEAT SOURCE.
- Storyboard is only visual direction: shotType, cameraAngle, cameraDistance, lensFeel, composition, foreground, midground, background, characterBlocking, lightingDirection, depthAndPerspective, visualEmphasis, cameraNotes.
- Character Library is the source of truth for identity, face, hair, eyes, outfit, accessories, props, colorPalette, and continuityNotes.
- Location Library is the source of truth for description, layout, keyObjects, lighting, colorPalette, continuityNotes, and baseState.
- If data conflicts, prioritize APPROVED BEAT SOURCE plus Character/Location Library.
- If any input entity contains meta.locks.lockedFields, preserve those fields exactly and only regenerate unlocked fields.
- All source linking is handled by the app through beatId. Do not output extra source mapping metadata.

VISUAL STYLE:
${style}

VISUAL PROMPT CONSTRUCTION RULES - MUST FOLLOW ORDER:

1. STYLE FIRST:
Start every visualPrompt exactly with the selected visual style:
"${style}"
Do not start with action, character, camera, or location before the style.

2. LOCATION FIRST:
Immediately after style, write:
"Location: [location name] ([full location description from Location Library]), [timeOfDay from APPROVED BEAT SOURCE], [lighting/material from Location Library + Storyboard]."
Never write only the location name. Use location/locationId/locationState from APPROVED BEAT SOURCE. Match Location Library by locationId first, then name/aliases. Include description, layout, keyObjects, lighting, colorPalette where available. Do not redesign the room, add random furniture, move doors/windows/desks/sofas/shelves, or change color palette unless the beat explicitly says so.

3. LOCATION CONTINUITY BLOCK:
Every visualPrompt must include this block right after Location:
"Location Continuity: use location [locationId]: [name]; base description: [description]; spatial layout: [layout]; key objects to preserve: [keyObjects]; lighting: [lighting]; color palette: [colorPalette]; current beat state: [locationState/baseState]; keep the same room layout, furniture placement, architectural features, and object relationships across panels. Camera angle may change, but object positions and room structure must remain consistent."

4. SCENE + POSTURE + INTERACTION:
After Location Continuity, write:
"Scene: [shotType/cameraAngle from Storyboard], [composition], [detailed posture, action, and interaction of every visible character from APPROVED BEAT SOURCE + Storyboard blocking]."
Always describe posture for each visible character. Always describe action and interaction: who looks at whom, speaks to whom, touches whom. For side/background characters, describe concrete action and gaze direction. Avoid vague group nouns such as "the group", "the trio", "both of them", or ambiguous "they"; use specific character names.

5. FULL CHARACTER PROFILE:
Every named character mentioned in visualPrompt must include a full profile immediately after the name, including foreground/background/off-screen characters and body parts.
Required format:
"CharacterName (Gender: [gender], Age: [age], Height: [height], Face: [face], Hair: [hair], Eyes: [eyes], Posture: [current posture], Outfit: [copy outfit exactly])"
If a profile field is missing, use available fields only. Do not invent new appearance details.

6. OUTFIT FIDELITY:
Copy outfit text from Character Library exactly. Do not shorten, summarize, or remove material/color/style details. If multiple outfits exist, choose the most story-appropriate outfit, then copy it verbatim.

7. CAMERA / OTS / POV / OBJECT INTERACTION:
Dialogue prefers close-up or medium close-up. Interaction prefers medium shot or over-the-shoulder. Large action prefers wide shot. If Storyboard provides cameraAngle/shotType, use it as source.
For OTS or POV, the foreground viewpoint character must have a full profile:
"Over-the-shoulder shot, foreground: [Character A profile]'s shoulder and back of head, background: [Character B profile] [action]."
When a character interacts with phone/book/mirror/weapon/object, do not describe the object alone. Show the character's hand/shoulder/body holding or interacting with it. If screen content matters but the screen is not front-facing, use inset panel or split screen. Reflections must be "faint reflection" or "low opacity reflection".

8. OBJECT PERMANENCE & STATE CONTINUITY:
Keep posture/action/props from previous panels if the text does not clearly change them. If a character is lying/sitting/kneeling, keep that posture until an explicit change. If a character holds a phone/bag/weapon/cup, mention it until the text says it was put down or lost. Do not forget approved props or change location state without beat evidence.

9. FOREGROUND / MIDGROUND / BACKGROUND:
Use Storyboard fields foreground, midground, background, depthAndPerspective, visualEmphasis, lightingDirection, but never alter source fields from Beat.

10. STRICT NO TEXT RULE:
End the positive part with:
"no text, no speech bubbles, no captions, no subtitles, no watermark, no logo."

11. NEGATIVE PROMPT INSIDE visualPrompt:
Every visualPrompt must end with:
"Negative prompt: low quality, blurry, low resolution, bad anatomy, extra fingers, missing fingers, deformed hands, distorted face, inconsistent character design, wrong outfit, changed hairstyle, changed eye color, random extra characters, missing approved characters, random furniture, changed location layout, inconsistent background, missing key objects, unreadable text, speech bubbles, captions, subtitles, watermark, logo, heavy shadows."
Do not put negativePrompt in a separate field.

VISUAL PROMPT EXAMPLE - FORMAT ONLY, DO NOT COPY CONTENT:
The example below is only a format example.
Do not copy its character names, location names, location details, or scene content unless they exist in the input data.
Never use the example names Linh An, Tong Mat, or CEO Office unless those exact names exist in the input data.
Use this example only to understand the required level of detail, ordering, and structure.

Example visualPrompt:
"Modern Manhua style, Chinese webtoon aesthetic, elegant character designs, vibrant digital coloring, clean line art, beautiful lighting, polished look, contemporary manhua inspired. Location: CEO Office (a modern luxury CEO office with a dark walnut executive desk, black leather chair, floor-to-ceiling city window, glass bookshelves on the left wall, abstract painting behind the desk, and a black sofa area on the right), evening, cool city light from the window mixed with soft interior office lighting. Location Continuity: use location loc_001: CEO Office; base description: a modern luxury CEO office with dark walnut desk, black leather chair, floor-to-ceiling city window, glass bookshelves, abstract wall painting, and black sofa area; spatial layout: desk centered near the window, chair behind desk, guest chairs in front, bookshelf on left wall, sofa area on right side; key objects to preserve: dark walnut executive desk, black leather office chair, silver laptop, white coffee cup, glass bookshelf, abstract wall painting, black sofa; lighting: cool daylight/city light from the large window combined with soft interior lighting; color palette: dark walnut brown, black leather, cool gray, glass blue, white accent; current beat state: clean office, coffee cup near the laptop; keep the same room layout, furniture placement, architectural features, and object relationships across panels. Camera angle may change, but object positions and room structure must remain consistent. Scene: medium close-up, eye-level camera angle, main character positioned on the left side of the frame, tense conversation across the desk. Linh An (Female, 24, 165cm, oval face, long black hair, dark brown eyes, Posture: standing stiffly with tense shoulders, Outfit: white silk blouse, black pencil skirt, small pearl earrings) grips the edge of the desk while looking directly at Tong Mat. Tong Mat (Male, 31, 182cm, sharp face, neatly styled black hair, cold dark eyes, Posture: seated behind the desk, Outfit: tailored black business suit, white dress shirt, silver wristwatch) leans back in the black leather office chair, staring back at Linh An with a controlled expression. Foreground: edge of the dark walnut desk and white coffee cup. Midground: Linh An and Tong Mat facing each other. Background: floor-to-ceiling city window and glass bookshelves. no text, no speech bubbles, no captions, no subtitles, no watermark, no logo.

Negative prompt: low quality, blurry, low resolution, bad anatomy, extra fingers, missing fingers, deformed hands, distorted face, inconsistent character design, wrong outfit, changed hairstyle, changed eye color, random extra characters, missing approved characters, random furniture, changed location layout, inconsistent background, missing key objects, unreadable text, speech bubbles, captions, subtitles, watermark, logo, heavy shadows."

DATA INPUTS:

APPROVED BEAT SOURCE:
${analysis || "No approved beat data provided. Use storyboard legacy source fields only as fallback."}

STORYBOARD VISUAL DIRECTION:
${storyboard}

CHARACTER + LOCATION LIBRARY:
${charLocAnalysis}

OUTPUT FIELD RULES:
- Return ONLY valid JSON.
- Do not use markdown.
- Do not add commentary.
- Output may be a JSON array or an object with "engineerPrompts".
- Each engineerPrompts item must contain ONLY:
  panelNumber
  panelId
  beatId
  visualPrompt
- Do NOT output sourceUsage.
- Do NOT output usedBeatId.
- Do NOT output usedLocationId.
- Do NOT output usedCharacterIds.
- Do NOT output negativePrompt.
- Do NOT output negative_prompt.

REQUIRED JSON SHAPE:
{
  "engineerPrompts": [
    {
      "panelNumber": 1,
      "panelId": "panel_001",
      "beatId": 1,
      "visualPrompt": "string ending with Negative prompt:"
    }
  ]
}

FINAL CHECK BEFORE OUTPUT:
- Return ONLY valid JSON.
- Do not use markdown code fences.
- Do not add commentary outside JSON.
- Did every item include panelNumber, panelId, beatId, and visualPrompt?
- Did you avoid sourceUsage, usedBeatId, usedLocationId, usedCharacterIds?
- Did you avoid negativePrompt and negative_prompt fields?
- Does every visualPrompt start with the selected style?
- Does every visualPrompt contain Location?
- Does every visualPrompt contain Location Continuity?
- Does every visualPrompt use timeOfDay from APPROVED BEAT SOURCE?
- Does every named character include full profile details?
- Is every outfit copied exactly from Character Library?
- Does every visualPrompt include posture, action, and interaction?
- Does every visualPrompt include foreground, midground, and background when available?
- Does every visualPrompt include no text, no speech bubbles, no captions, no subtitles?
- Does every visualPrompt include a final "Negative prompt:" section?
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

/**
 * @deprecated Prefer buildFinalResult() from finalResultBuilderService.
 * This prompt is only a fallback formatter and must not re-analyze source fields.
 */
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
      "visualPrompt": "final approved prompt, including Negative prompt: section at the end",
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
        type: "object",
        properties: {
          engineerPrompts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                panelNumber: { type: "integer" },
                panelId: { type: "string" },
                beatId: { type: "integer" },
                visualPrompt: { type: "string" }
              },
              required: ["panelNumber", "panelId", "beatId", "visualPrompt"]
            }
          }
        },
        required: ["engineerPrompts"]
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

/**
 * @deprecated Main StoryFlow now builds Final Result with code via finalResultBuilderService.
 * Keep this only as a legacy AI fallback.
 */
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
                visualPrompt: { type: "string" }
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



import { GoogleGenAI, Part } from "@google/genai";
import { getConfig } from "./configService";
import { mapLocationIdsToBeats } from "./locationContinuityService";
import { createFallbackScreensFromBeats, normalizeBeats, normalizeScreens } from "./finalResultBuilderService";
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
Analyze the input story and split it into fine-grained image-ready beats.

A beat is not a paragraph.
A beat is one clear visual moment that can be illustrated in one image.

Do NOT create character profiles.
Do NOT create location profiles.
Do NOT create image prompts.
Do NOT rewrite the source story.
Do NOT add a visualMoment field. Make each beat itself small and drawable instead.

BEAT SPLITTING RULES - CRITICAL:
1. Split the entire story into continuous, fine-grained, image-ready beats.
2. Do not omit any source content.
3. One beat = one drawable image moment.
4. Each beat has exactly one main action.
5. originalText should usually be 1-3 short original sentences copied from the source.
6. If a source paragraph contains multiple actions, split it into multiple beats.
7. If a source paragraph contains dialogue + reaction + movement, split into separate beats when they create different images.
8. If a source paragraph contains present scene + memory/flashback/social media/phone screen, split them.
9. Split when location, timeOfDay, POV, central character, or scene state changes.
10. Internal monologue must be represented through drawable visual cues such as a phone screen, facial expression, object detail, silent posture, walking away, or ticket/notification.
11. Do not over-split filler sentences with no visual value unless they change emotion, action, location, or story state.
12. It is better to output more short beats than fewer long beats.

SCREEN CONTINUITY RULE - CRITICAL:
- Group consecutive beats into screens.
- A screen is a continuous scene with the same location, timeOfDay, spatial layout, ongoing character presence, and props/state continuity.
- Multiple beats can belong to one screen.
- Do not analyze each beat as an isolated scene.
- Use screenId to link beats to screens.
- screenCharacters must include all characters physically present or directly involved in the screen.
- Do not remove a character from screenCharacters unless the source says they leave, the location changes, time jumps, or a new screen starts.

CHARACTER ROLE RULE:
- screenCharacters: all characters present or directly involved in the continuous screen.
- focusCharacters: characters receiving narrative/camera focus in this beat.
- visibleCharacters: characters visible in the frame for this beat.
- offscreenPresentCharacters: characters still present in the screen but not visible because of camera angle, focus, or composition.
- A character can be in screenCharacters but not visibleCharacters. That means the character is still present in the screen, just not in this shot.
- Do not drop supporting characters from the screen just because the current beat focuses on someone else.

ORIGINAL TEXT RULE:
- Copy originalText exactly from the source segment.
- Do not rewrite originalText.
- Do not summarize originalText.
- Keep originalText short enough to represent one visual beat.
- Keep complete sentences. Never cut in the middle of a sentence.
- Preferred length: 1-3 short source sentences.
- Ideal length: 40-80 Vietnamese words per beat.
- Hard warning: if originalText would exceed 120 words, split it unless it is truly one single visual moment.

ORIGINAL TEXT QUALITY RULE:
- originalText should be copied from the source story as exactly as possible.
- Do not intentionally rewrite, summarize, translate, or polish originalText.
- Do not use "[...]", "(...)" or similar placeholders to omit source text.
- Avoid using "..." to shorten content unless the source text itself uses ellipsis.
- If a source segment is too long, split it into smaller beats instead of shortening it.
- If you cannot fit the full source segment into one beat, create multiple smaller beats.

ACTION FIELD RULE:
- action must describe only one main drawable action.
- Do not combine many actions with "and then".
- If action needs several verbs for different moments, split the beat.

SCENE-CUTTING RULES - CRITICAL:
Split into a new beat immediately when:
1. A different character starts a new action, line of dialogue, or thought.
2. Narration interrupts actions/dialogue.
3. Location or setting changes.
4. A character moves from one place to another; separate the movement and the action at the destination.
5. The target of interaction changes.
6. Emotion, facial expression, or body action changes inside a long dialogue.
7. A dialogue is longer than 3 sentences or contains multiple important ideas.
8. The text switches between present scene and memory/flashback/social media/phone screen.
9. timeOfDay changes.
10. POV or central character changes.

MERGE RULES - DO NOT OVER-SPLIT:
Merge into one beat when:
1. Characters directly interact in the same space and there is no narration interruption.
2. A short line of dialogue has one simple accompanying action.
3. A sentence ending with a colon introduces the dialogue immediately after it; keep the introduction and dialogue in the same beat.
4. Messaging/calls: merge one question + answer pair into one beat. If very short, merge up to two question-answer pairs into one beat.
5. Do not create separate beats for filler sentences with no visual value unless they change emotion, action, location, or story state.

INTERACTION SPECIFICITY RULE:
- Always specify who acts toward whom.
- Always use concrete character names.
- Do not write vague phrases like "continues doing that", "still acts that way", or "keeps arguing".
- Bad: "pretends to care."
- Good: "Hua Ran pretends to care about Thanh Y while looking at Yunfan for support."

CROWD ACTION RULE:
- If guests, staff, classmates, family members, or crowd characters are present, describe what they are doing, where they are looking, or how they react.
- Do not write vague phrases like "public setting" or "crowd in background".

POSTURE AND POSITION RULE:
- posture must describe body posture, action state, and relative position of every character in the beat.
- Include standing/sitting/lying/kneeling/running/leaning/turning/head lowered/hand gripping/etc.
- Include where each character is in the scene.
- Position must persist from the previous beat.
- Only change a character's position when the source text describes movement.
- Do not teleport characters.

CHARACTER PRESENCE CONTINUITY:
- characters must list all characters physically present in the scene or directly involved in the visual beat.
- Track the timeline continuously.
- If character A was in the room in the previous beat and has not left, A is still present.
- If character B enters, subsequent beats in the same location include both A and B until someone leaves or the scene changes.
- Remove a character only when the source says they leave or when the location/scene changes completely.

TIME OF DAY RULE:
- timeOfDay must be accurate and consistent across beats in the same segment.
- Only change timeOfDay when the story indicates a time jump or scene change.

VISUAL FOCUS RULE:
- visualFocus must identify the main image focus.
- Bad: "The conversation."
- Good: "Thanh Y's calm face as she gives up her seat beside the angry grandfather."

BEAT SPLITTING EXAMPLE - FORMAT ONLY, DO NOT COPY CONTENT:
Source paragraph:
"At the grandfather's birthday banquet, Yunfan arrived late with his assistant. 'Thanh Y, move across the table; Hua Ran is unfamiliar with this seat and is used to sitting beside me.' Thanh Y did not hesitate. She stood up immediately and sat beside the dark-faced grandfather. Yunfan looked surprised, raised his eyebrow, then pressed the embarrassed assistant into Thanh Y's former seat."

Bad output:
One beat containing the whole paragraph.

Good output:
[
  {
    "beatId": 1,
    "originalText": "At the grandfather's birthday banquet, Yunfan arrived late with his assistant.",
    "summary": "Yunfan arrives late at the birthday banquet with his assistant.",
    "action": "Yunfan enters the banquet hall with Hua Ran.",
    "visualFocus": "Their awkward late entrance in front of the banquet guests."
  },
  {
    "beatId": 2,
    "originalText": "'Thanh Y, move across the table; Hua Ran is unfamiliar with this seat and is used to sitting beside me.'",
    "summary": "Yunfan asks Thanh Y to give up her seat for Hua Ran.",
    "action": "Yunfan gestures for Thanh Y to move seats.",
    "visualFocus": "Thanh Y being publicly displaced at the banquet table."
  },
  {
    "beatId": 3,
    "originalText": "Thanh Y did not hesitate. She stood up immediately and sat beside the dark-faced grandfather.",
    "summary": "Thanh Y calmly moves beside the angry grandfather.",
    "action": "Thanh Y stands and sits beside the grandfather.",
    "visualFocus": "Thanh Y's calm face beside the grandfather's dark expression."
  },
  {
    "beatId": 4,
    "originalText": "Yunfan looked surprised, raised his eyebrow, then pressed the embarrassed assistant into Thanh Y's former seat.",
    "summary": "Yunfan seats Hua Ran in Thanh Y's former seat.",
    "action": "Yunfan presses Hua Ran into the chair Thanh Y just left.",
    "visualFocus": "Hua Ran sitting awkwardly in Thanh Y's former place."
  }
]

The example is only for splitting logic. Do not copy its names or events unless they appear in the input story.

Selected art style context:
${artStyleDescription || "No specific style selected."}

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
      "screenState": "Current state of this continuous scene",
      "screenCharacters": ["Character A", "Character B"],
      "screenProps": ["Prop A", "Prop B"],
      "startBeatId": 1,
      "endBeatId": 5,
      "summary": "What happens in this screen",
      "continuityNotes": "Continuity notes for characters, props, and layout"
    }
  ],
  "beats": [
    {
      "beatId": 1,
      "screenId": "screen_001",
      "originalText": "Exact short source sentence copied here.",
      "summary": "Short summary of this visual beat.",
      "focusCharacters": ["Character A"],
      "visibleCharacters": ["Character A", "Character B"],
      "offscreenPresentCharacters": ["Character C"],
      "characters": ["Character A", "Character B"],
      "location": "Concrete location name",
      "locationId": "loc_001",
      "locationState": "Current state of the location in this beat.",
      "action": "One main drawable action.",
      "interaction": "Specific interaction using character names.",
      "posture": "Posture, action state, and relative position of all present characters.",
      "props": ["Specific prop"],
      "visualFocus": "Specific main image focus.",
      "atmosphere": "Dominant mood.",
      "timeOfDay": "Evening"
    }
  ],
  "coverageCheck": {
    "allSourceTextCovered": true,
    "missingText": "",
    "duplicatedText": "",
    "notes": ""
  }
}

ORIGINAL TEXT COVERAGE GUIDELINES:
- originalText should preserve the source text as closely as possible.
- Do not intentionally rewrite, translate, summarize, correct, or polish originalText.
- Do not use placeholder ellipsis to skip source words.
- Every part of the source text must appear in exactly one beat.
- Do not duplicate the same source text in multiple beats.
- Do not add text that does not exist in the source.
- Beat order must follow source order.
- Do not add visualMoment.

BEAT CUTTING RULES:
- A beat is one visual moment that can be illustrated as one storyboard panel.
- Recommended length: 40-120 Vietnamese words per beat.
- Visual integrity is more important than word count.
- Never cut in the middle of a sentence.

SPLIT WHEN:
- Location changes.
- Time changes.
- POV or central character changes.
- Present scene changes to memory, flashback, social media, or phone screen.
- Main visual action changes.
- A different character starts a new action, dialogue line, or thought.
- Character posture changes significantly.
- Main interaction target changes.
- Narration interrupts actions/dialogue.
- Emotional intensity or atmosphere changes clearly.
- Dialogue becomes long or moves to a new action/emotional point.

DO NOT SPLIT WHEN:
- Short narration supports the same action/dialogue.
- Short internal thought belongs to the same visual moment.
- A short question-answer exchange shares the same location and emotional focus.
- A colon-introduced dialogue belongs directly to the preceding action.
- One short message/call question-answer pair belongs to the same visual moment.

FIELD RULES:
- screens: screen-level continuity containers for shared location, time, layout, present characters, and props.
- screenId: stable link from each beat to its screen.
- summary: short explanation of the beat, not copied from originalText.
- characters: legacy compatibility field; include visibleCharacters when possible.
- focusCharacters: characters receiving narrative/camera focus in this beat.
- visibleCharacters: characters visible in this beat's frame.
- offscreenPresentCharacters: characters still present in the screen but not visible in this beat.
- location: most specific known place, or "Unknown".
- locationId: stable location id if inferable from consistent location naming, otherwise omit or use "".
- locationState: current state of the location in this beat.
- action: main action.
- interaction: who reacts/speaks/looks/touches/threatens/helps whom, using concrete character names.
- posture: concrete body positions, action state, and relative positions of all present characters.
- props: objects required for continuity.
- visualFocus: what the image should focus on.
- atmosphere: emotional mood.
- timeOfDay: Early Morning, Morning, Mid-day, Afternoon, Golden Hour, Evening, Late Night, or Unknown.

FINAL CHECK BEFORE OUTPUT:
- Did you keep originalText as close to the source story as possible?
- Did you avoid intentionally rewriting or summarizing originalText?
- Did you avoid placeholder ellipsis?
- Did you split long source segments instead of shortening them?
- Did you avoid using placeholder fields like "..."?

SOURCE TEXT:
${text}
`;

export const getCharacterLocationLibraryPrompt = (
  originalText: string,
  beats: StoryBeat[],
  artStyleDescription = "",
  existingLibrary?: string,
  screens = createFallbackScreensFromBeats(beats)
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
- Use screens.screenCharacters as the primary source for who is present in each continuous screen.
- Use beats.focusCharacters, beats.visibleCharacters, and beats.offscreenPresentCharacters to understand character roles per beat.
- Do not rely only on beat focus characters.
- If a character appears in screenCharacters, create or maintain their character profile even if they are offscreen in some beats.
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

APPROVED SCREENS:
${JSON.stringify(screens, null, 2)}

ORIGINAL SOURCE TEXT:
${originalText}
`;

export const getPhase1AnalysisPrompt = (script: string, style: string, _existingLibrary?: string) => getBeatAnalysisPrompt(script, style);

const getLegacyStoryboardPrompt = (analysis: string, charLocAnalysis: string) => `
You are an illustration artist and visual director. Based on the content analysis and the character/location library, draft a detailed storyboard.

OUTPUT REQUIREMENTS (MUST RETURN JSON):
- Return an array of objects: [{ "beatId": 1, "originalText": "...", "shotType": "...", "cameraAngle": "...", "framing": "...", "composition": "...", "lighting": "...", "visibleCharacters": ["..."], "locationName": "...", "actionInFrame": "...", "continuityNotes": "..." }]
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
  const analysisData = parseJsonFallback<unknown>(analysis, []);
  const beats = normalizeBeats(analysisData);
  const parsedScreens = normalizeScreens(analysisData);
  const screens = parsedScreens.length ? parsedScreens : createFallbackScreensFromBeats(beats);
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
Use screen data as the continuity source for characters who remain present across multiple beats.
Character profiles and location profiles are also source of truth.
Use them only to guide blocking and composition.
Do not create new character identities or new locations.

LOCKED FIELD RULES:
If any beat, character, location, or panel input contains meta.locks.lockedFields, preserve those fields exactly.
Do not rewrite, reinterpret, summarize, improve, or change locked fields.
Only regenerate unlocked fields. Locked values are approved source-of-truth data.

Your output should contain ONLY visual/camera fields.
Return ONLY valid JSON. No markdown. No commentary.
Use beatId as the only link key. Do NOT output panelId or panelNumber.

Required JSON schema:
{
  "panels": [
    {
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
- panelId
- panelNumber
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

SCREEN CONTINUITY FOR STORYBOARD:
- Each beat belongs to a screen.
- Use screenCharacters as the continuity pool.
- Use focusCharacters for camera priority.
- Use visibleCharacters for frame composition.
- Use offscreenPresentCharacters as continuity notes.
- Do not remove screen characters from the scene just because the beat focuses on someone else.
- If the camera angle excludes a present character, mention them in cameraNotes.

SOURCE BEATS:
${JSON.stringify(beats, null, 2)}

SOURCE SCREENS:
${JSON.stringify(screens, null, 2)}

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
- Beat Analysis has already split the story into image-ready beats.
- Treat each beat as one drawable image moment.
- Do not try to illustrate the entire source story paragraph.
- Use beat.originalText only as context for that one beat.
- Main visual direction must come from beat.action, beat.interaction, beat.posture, beat.visualFocus, beat.focusCharacters, beat.visibleCharacters, beat.offscreenPresentCharacters, beat.props, beat.location/locationState, and beat.timeOfDay.
- Screen continuity comes from APPROVED BEAT SOURCE screens[]. Use screenCharacters as the present-character continuity pool.

CLEAN VISUAL PROMPT RULE - CRITICAL:
visualPrompt must be clean, natural, and copy-ready for an image generator.
Do NOT include internal metadata in visualPrompt:
- no locationId, screenId, beatId, panelId, or sourceUsage
- no raw IDs like loc_001, screen_001, char_001, or panel_001
- no phrases like "use location loc_001"
- no beat ranges like "(beats 1-164)", "(beat 234)", or "beats 190-215"
- no raw hex color codes like #FFD700
- no schema/debug labels such as "base description:", "spatial layout:", "key objects to preserve:", "current beat state:", or "color palette:"
- no JSON-style field labels unless rewritten as natural image-prompt language
Use internal IDs only to look up data. Never print them in visualPrompt.

CURRENT BEAT OUTFIT RULE - CRITICAL:
Character Library may contain multiple outfits for different story sections or beat ranges.
For each visualPrompt:
- Select ONLY the outfit relevant to the current beatId/screen.
- Do NOT list alternate outfits from other beats or screens.
- Do NOT include beat ranges in the prompt.
- Do NOT write "(beats 1-164)" or similar.
- If unsure, choose the outfit that matches the current location, timeOfDay, action, and screen.

NATURAL CONTINUITY RULE:
Location Continuity and Screen Continuity must be written as natural image-prompt language, not internal debug text.
Bad: "Location Continuity: use location loc_001: Banquet Hall; base description: ...; spatial layout: ...; key objects to preserve: ...; color palette: #FFD700."
Good: "Location Continuity: keep the same banquet hall layout, central round table, ornate chairs, chandeliers, flower arrangements, and luxury dinnerware consistent across this screen."
Bad: "Screen Continuity: This beat belongs to screen_001."
Good: "Screen Continuity: Khuc Thanh Y, Ha Van Pham, Hua Nhiem, Grandfather Ha, and the guests remain present around the banquet table; this shot focuses on Ha Van Pham and Khuc Thanh Y."

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
"Location Continuity: keep [important layout elements], [important furniture/objects], and [lighting/material cues] consistent across this screen."
Do not include locationId. Do not include labels like base description, spatial layout, key objects to preserve, color palette, or current beat state. Do not include hex colors. Keep this continuity block short and natural.

4. SCENE + POSTURE + INTERACTION:
After Location Continuity, write:
"Scene: [shotType/cameraAngle from Storyboard], [composition], [detailed posture, action, and interaction of every visible character from APPROVED BEAT SOURCE + Storyboard blocking]."
Always describe posture for each visible character. Always describe action and interaction: who looks at whom, speaks to whom, touches whom. For side/background characters, describe concrete action and gaze direction. Avoid vague group nouns such as "the group", "the trio", "both of them", or ambiguous "they"; use specific character names.

SCREEN CONTINUITY IN VISUAL PROMPT:
Each visualPrompt must include a Screen Continuity sentence after Location Continuity:
"Screen Continuity: [screen characters] remain present in/around [location]; this shot focuses on [focusCharacters], while [visible supporting characters] remain [background position/action], and [offscreen characters] stay nearby but outside the frame."
Do not include screenId or raw screen metadata. Do not over-list if not needed. Do not delete supporting characters from the screen. If visibleCharacters excludes a screen character, treat them as offscreen, not absent. If a screen character is visible in background, include their profile if named. If a screen character is offscreen, mention them only in continuity note, not as visible.

5. FULL CHARACTER PROFILE:
Every named character mentioned in visualPrompt must include a full profile immediately after the name, including foreground/background/off-screen characters and body parts.
Required format:
"CharacterName (Gender: [gender], Age: [age], Height: [height], Face: [face], Hair: [hair], Eyes: [eyes], Posture: [current posture], Outfit: [copy outfit exactly])"
If a profile field is missing, use available fields only. Do not invent new appearance details.

6. OUTFIT FIDELITY:
First choose the correct outfit for the current beat/screen, then copy only that outfit description accurately. Do not copy the entire multi-outfit list. Do not copy beat ranges or outfit metadata. Do not include outfits from other story sections.

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
"Modern Manhua style, Chinese webtoon aesthetic, elegant character designs, vibrant digital coloring, clean line art, beautiful lighting, polished look, contemporary manhua inspired. Location: CEO Office (a modern luxury CEO office with a dark walnut executive desk, black leather chair, floor-to-ceiling city window, glass bookshelves on the left wall, abstract painting behind the desk, and a black sofa area on the right), evening, cool city light from the window mixed with soft interior office lighting. Location Continuity: keep the centered executive desk, black leather chair, guest chairs, glass bookshelves, abstract wall painting, sofa area, laptop, coffee cup, and cool office lighting consistent across this screen. Screen Continuity: Linh An and Tong Mat remain in the office across this tense conversation; this shot focuses on Linh An confronting Tong Mat across the desk. Scene: medium close-up, eye-level camera angle, main character positioned on the left side of the frame, tense conversation across the desk. Linh An (Female, 24, 165cm, oval face, long black hair, dark brown eyes, Posture: standing stiffly with tense shoulders, Outfit: white silk blouse, black pencil skirt, small pearl earrings) grips the edge of the desk while looking directly at Tong Mat. Tong Mat (Male, 31, 182cm, sharp face, neatly styled black hair, cold dark eyes, Posture: seated behind the desk, Outfit: tailored black business suit, white dress shirt, silver wristwatch) leans back in the black leather office chair, staring back at Linh An with a controlled expression. Foreground: edge of the dark walnut desk and white coffee cup. Midground: Linh An and Tong Mat facing each other. Background: floor-to-ceiling city window and glass bookshelves. no text, no speech bubbles, no captions, no subtitles, no watermark, no logo.

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
  beatId
  visualPrompt
- Do NOT output panelId.
- Do NOT output panelNumber.
- Do NOT output sourceUsage.
- Do NOT output usedBeatId.
- Do NOT output usedLocationId.
- Do NOT output usedCharacterIds.
- Do NOT output negativePrompt.
- Do NOT output negative_prompt.
- visualPrompt must not contain internal IDs, beat ranges, raw hex codes, or debug/schema labels.

REQUIRED JSON SHAPE:
{
  "engineerPrompts": [
    {
      "beatId": 1,
      "visualPrompt": "string ending with Negative prompt:"
    }
  ]
}

FINAL CHECK BEFORE OUTPUT:
- Return ONLY valid JSON.
- Do not use markdown code fences.
- Do not add commentary outside JSON.
- Did every item include beatId and visualPrompt?
- Did you avoid panelId and panelNumber?
- Did you avoid sourceUsage, usedBeatId, usedLocationId, usedCharacterIds?
- Did you avoid negativePrompt and negative_prompt fields?
- Did every visualPrompt avoid internal IDs like loc_001, screen_001, char_001, and panel_001?
- Did every visualPrompt avoid beat ranges and raw hex color codes?
- Did every visualPrompt use natural Location Continuity and Screen Continuity sentences instead of debug/schema labels?
- Does every visualPrompt start with the selected style?
- Does every visualPrompt contain Location?
- Does every visualPrompt contain Location Continuity?
- Does every visualPrompt contain Screen Continuity?
- Does every visualPrompt use timeOfDay from APPROVED BEAT SOURCE?
- Does every named character include full profile details?
- Is every outfit copied exactly from Character Library?
- Did you include only the current beat/screen outfit, without alternate outfits or beat ranges?
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
Use beatId as the only link key. Do NOT output panelId or panelNumber.

Required JSON schema:
[
  {
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
          screens: {
            type: "array",
            items: {
              type: "object",
              properties: {
                screenId: { type: "string" },
                screenNumber: { type: "integer" },
                screenName: { type: "string" },
                location: { type: "string" },
                locationId: { type: "string" },
                timeOfDay: { type: "string" },
                screenState: { type: "string" },
                screenCharacters: {
                  type: "array",
                  items: { type: "string" }
                },
                screenProps: {
                  type: "array",
                  items: { type: "string" }
                },
                startBeatId: { type: "integer" },
                endBeatId: { type: "integer" },
                summary: { type: "string" },
                continuityNotes: { type: "string" }
              },
              required: ["screenId", "screenNumber", "screenName", "location", "timeOfDay", "screenState", "screenCharacters", "screenProps", "startBeatId", "endBeatId", "summary"]
            }
          },
          beats: {
            type: "array",
            items: {
              type: "object",
              properties: {
                beatId: { type: "integer" },
                screenId: { type: "string" },
                originalText: { type: "string" },
                summary: { type: "string" },
                focusCharacters: {
                  type: "array",
                  items: { type: "string" }
                },
                visibleCharacters: {
                  type: "array",
                  items: { type: "string" }
                },
                offscreenPresentCharacters: {
                  type: "array",
                  items: { type: "string" }
                },
                characters: {
                  type: "array",
                  items: { type: "string" }
                },
                location: { type: "string" },
                locationId: { type: "string" },
                locationState: { type: "string" },
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
              required: ["beatId", "screenId", "originalText", "summary", "focusCharacters", "visibleCharacters", "offscreenPresentCharacters", "characters", "location", "action", "interaction", "posture", "props", "visualFocus", "atmosphere", "timeOfDay"]
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
        required: ["screens", "beats"]
      } as any
    }
  });

  return parseGeminiJson<BeatAnalysisResult>(response.text);
};

export const generateCharacterLocationLibrary = async (
  originalText: string,
  beats: StoryBeat[],
  artStyleDescription?: string,
  existingLibrary?: string,
  screens?: ReturnType<typeof createFallbackScreensFromBeats>
): Promise<CharacterLocationLibraryResult> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: getModel(),
    contents: getCharacterLocationLibraryPrompt(originalText, beats, artStyleDescription, existingLibrary, screens),
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
    screenId: beat.screenId || "screen_001",
    actionAnalysis: beat.actionAnalysis || beat.action || beat.summary,
    charactersInvolved: beat.charactersInvolved || beat.characters,
    locationName: beat.locationName || beat.location
  }));
  const screens = beatResult.screens?.length
    ? beatResult.screens
    : createFallbackScreensFromBeats(normalizedAnalysis);
  const characterLocationAnalysis = await generateCharacterLocationLibrary(
    script,
    normalizedAnalysis,
    style,
    existingLibrary,
    screens
  );
  const beats = mapLocationIdsToBeats(normalizedAnalysis, characterLocationAnalysis.locations);

  return {
    analysis: {
      screens,
      beats,
      coverageCheck: beatResult.coverageCheck
    },
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
              required: ["beatId", "shotType", "cameraAngle", "composition"]
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
                beatId: { type: "integer" },
                visualPrompt: { type: "string" }
              },
              required: ["beatId", "visualPrompt"]
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
            beatId: { type: "integer" },
            visualPrompt: { type: "string" },
            qaNotes: { type: "string" }
          },
          required: ["beatId", "visualPrompt", "qaNotes"]
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
                beatId: { type: "integer" },
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
              required: ["beatId", "shotName", "originalText", "visualPrompt"]
            }
          }
        },
        required: ["characterName", "panels"]
      } as any
    }
  });
  return response.text;
};


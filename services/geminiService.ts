
import { GoogleGenAI } from "@google/genai";
import {
  createFallbackScreensFromBeats,
  normalizeBeatMomentDetails,
  normalizeBeats,
  normalizeScreenContinuity,
  normalizeScreens
} from "./finalResultBuilderService";
import { getConfig } from "./configService";
import { buildEngineerPromptsJsonWithResolver } from "./visualPromptResolverService";
import { segmentSourceText } from "./sourceTextSegmentService";
import type {
  CharacterLocationLibraryResult,
  CharacterProfile,
  LocationProfile,
  SourceSegment,
  StoryBeat
} from "../types";

export const STORYBOARD_BATCH_SIZE = 50;

// --- PROMPT GENERATORS ---

const parseJsonFallback = <T,>(rawText: string | undefined, fallback: T): T => {
  if (!rawText) return fallback;
  try {
    return JSON.parse(rawText) as T;
  } catch {
    return fallback;
  }
};

export function compactJsonArrays(jsonStr: string | null | undefined): string {
  if (!jsonStr) return "";
  let text = jsonStr.trim();
  if (!text) return "";
  
  // Compact number arrays: e.g. [ 1,\n 2,\n 3 ] -> [1, 2, 3]
  text = text.replace(/\[\s*([\d\s,]+?)\s*\]/g, (match, p1) => {
    const compacted = p1.replace(/\s+/g, ' ').replace(/,\s*$/, '').trim();
    return `[${compacted}]`;
  });
  
  // Compact short string arrays: e.g. [ "A",\n "B" ] -> ["A", "B"]
  text = text.replace(/\[\s*((?:"[^"]*"\s*,\s*)*"[^"]*")\s*\]/g, (match, p1) => {
    const compacted = p1.replace(/\s+/g, ' ').trim();
    return `[${compacted}]`;
  });

  return text;
}

export function compactJson(value: any): string {
  if (value === undefined || value === null) return "";
  const jsonStr = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return compactJsonArrays(jsonStr);
}

function normalize(value?: string | null): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function formatSourceSegmentsForPrompt(sourceSegments: SourceSegment[]): string {
  return JSON.stringify(
    sourceSegments.map((segment, index) => ({
      sourceSegmentId: segment.sourceSegmentId,
      order: index + 1,
      role: segment.role || "body",
      text: segment.text
    })),
    null,
    2
  );
}

/**
 * @deprecated Legacy fallback only.
 * Do not use in the active StoryFlow workflow.
 * Current workflow must use getBeatAnalysisPrompt with sourceSegmentIds.
 */
export const getLegacySourceSegmentBeatAnalysisPrompt = (source: SourceSegment[] | string, artStyleDescription = "") => {
  const sourceSegments = Array.isArray(source) ? source : segmentSourceText(source);
  return `
You are a professional story analyst for a vertical comic / visual storyboard generation app.

Your ONLY task:
Analyze the provided SOURCE SEGMENTS and group them into fine-grained image-ready beats.

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

A beat is not a paragraph.
A beat is one clear visual moment that can be illustrated in one image.

BEAT LENGTH AND RHYTHM:
- Target length: 20–60 words of source text per beat.
- Preferred range: 25–50 words.
- Each beat should be short enough to capture one clear visual story moment for illustration.
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
- Minor gestures should be included inside the current beat as visual detail.
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
- Prefer one strong detailed beat over several weak micro-beats.
- A beat may contain multiple small gestures if they support the same main visual moment.
- Short reaction lines should stay with the main interaction unless they clearly form a separate visual story moment.
- Dialogue reactions may be merged when they happen in the same space and support the same emotional exchange.

SENTENCE-LEVEL ILLUSTRATION PRIORITY:
- The goal is to create detailed illustrations for the novel, close to the sentence-level rhythm.
- If a sentence contains a strong standalone visual image, it may become its own beat.
- If adjacent sentences describe the same continuous visual moment, keep them in the same beat.
- Do not split mechanically by sentence count.
- Prioritize image clarity over rigid sentence counting.
- A beat should capture the smallest meaningful visual story moment, not the smallest possible text fragment.

VISUAL PRECISION RULES:
- Every beat must describe the exact visual moment that should become an image.
- Do not only summarize the plot.
- Convert the beat into visible action, posture, facial expression, gaze, position, environment, and composition.
- For each present character, describe visible state in characterVisualStates:
  - role in shot (main | supporting | background)
  - facial expression
  - body language
  - gaze target
  - emotional state
  - position in the scene
  - positionSource (explicit | inherited | inferred)
- If a character is present but not active, still describe where they are and what they are doing visually.
- Describe important props and environmental details that are visible in the shot.
- Keep all visual details grounded in the source text.
- Do not invent major props, locations, outfits, injuries, or actions not supported by the text.
- Minor cinematic interpretation is allowed only to make the image coherent, but it must not change the story.

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

SCREEN SKELETON RULE - CRITICAL:
- Group consecutive beats into screens.
- A screen is a continuous scene with the same location, timeOfDay, ongoing character presence.
- Multiple beats can belong to one screen.
- Do not analyze each beat as an isolated scene.
- Use screenId to link beats to screens.
- screenCharacters must include all characters physically present or directly involved in the screen.
- A character can be in screenCharacters but not visibleCharacters. That means the character is still present in the screen, just not in this shot.

Selected art style context:
${artStyleDescription || "No specific style selected."}

SELF-CHECK BEFORE OUTPUT:
Before returning JSON, silently review your beats:
1. Check every beat under 20 words.
2. Keep it only if it is a major reveal, hard scene cut, strong standalone visual moment, decisive emotional turning point, or critical dialogue.
3. Otherwise merge it with the previous or next beat.
4. Check if there are 3 or more consecutive short beats in the same scene.
5. If yes, merge them into fewer stronger visual beats.
6. Check if any beat is only a tiny gesture, gaze shift, blink, pause, breath, nod, or short continuation line.
7. If yes, merge it into the nearest beat with the same action, same emotional exchange, or same character focus.
8. Ensure every beat is a complete visual story moment, not a fragment.
9. Ensure all sourceSegmentIds are covered in order.
10. Do not output this self-check. Only output the final JSON.

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
      "summary": "short plot summary",
      "visualMoment": "the exact visual moment that should become an image",
      "mainAction": "specific visible action",
      "beatType": "establishing | action | reaction | dialogue | reveal | transition",
      "analysis": "specific action/context analysis using character names",
      "atmosphere": "main mood",
      "timeOfDay": "Early Morning | Morning | Mid-day | Afternoon | Golden Hour | Evening | Late Night | Unknown",
      "mentionedCharacters": ["Character A"],
      "presentCharacters": ["Character A", "Character B"],
      "enteredCharacters": [],
      "exitedCharacters": [],
      "characterVisualStates": [
        {
          "characterName": "Character A",
          "roleInShot": "main | supporting | background",
          "facialExpression": "specific visible expression",
          "bodyLanguage": "specific posture/body action",
          "gazeTarget": "who or what the character is looking at",
          "emotionalState": "inner emotion visible through expression/body",
          "position": "specific position in the scene",
          "positionSource": "explicit | inherited | inferred"
        }
      ],
      "interactionTarget": [
        {
          "actor": "Character A",
          "target": "Character B",
          "interaction": "what the actor does/says toward the target"
        }
      ],
      "environmentDetails": "specific visible environment details grounded in the text",
      "props": ["important visible prop 1", "important visible prop 2"],
      "cameraHint": "close-up | medium shot | wide shot | over-the-shoulder | low angle | high angle | tracking shot | unknown",
      "compositionHint": "how the shot should be arranged",
      "continuityNotes": "anything inherited or uncertain",
      "focusCharacters": ["Character A"],
      "visibleCharacters": ["Character A", "Character B"],
      "offscreenPresentCharacters": ["Character C"],
      "characters": ["Character A", "Character B"],
      "location": "Concrete location name",
      "locationId": "loc_001",
      "action": "One main action.",
      "visualFocus": "Specific main image focus."
    }
  ]
}

FINAL CHECK BEFORE OUTPUT:
- Did every body source segment appear in exactly one beat?
- Did you avoid outputting originalText?
- Did you avoid rewriting source text?
- Did beat order follow source segment order?
- Did each beat target 20-60 words after sourceSegmentIds are joined?
- Did you merge minor gestures to avoid micro-beats?
- Did you avoid broad sourceSegmentId ranges that combine multiple visual moments?
- Did you avoid placeholder fields like "..."?

SOURCE SEGMENTS:
\`\`\`json
${formatSourceSegmentsForPrompt(sourceSegments)}
\`\`\`
`;
};

export const getBeatSkeletonPrompt = (source: SourceSegment[] | string, artStyleDescription = "") => {
  const sourceSegments = Array.isArray(source) ? source : segmentSourceText(source);

  return `
You are Storyflow Beat Skeleton Analyzer.

Your ONLY task:
Split the provided SOURCE SEGMENTS into accurate story beats and basic screen skeletons.

CRITICAL ORIGINAL TEXT RULE:
- Do NOT output originalText.
- Do NOT copy, rewrite, summarize, translate, polish, or shorten source text.
- The app will hydrate originalText deterministically from sourceSegmentIds.
- Every body source segment must appear in exactly one beat.
- Do not skip or duplicate body source segments.
- Keep sourceSegmentIds in chronological order.

CORE PRINCIPLE:
- 1 beat = 1 visual story moment.
- This step focuses on beat rhythm, source coverage, and simple scene metadata only.
- Do NOT perform deep visual analysis in this step.
- Do NOT output visualMoment, mainAction, characterVisualStates, facialExpression, bodyLanguage, gazeTarget, detailed position, interactionTarget, environmentDetails, detailed props, cameraHint, compositionHint, continuityNotes, or visualPrompt.
- Beat Moment Details, Storyboard, and Prompt Engineering will handle those later.

FIELD OWNERSHIP RULE:
- Phan tich noi dung owns: screens, sourceSegmentIds, summary, action, visualFocus, beatType, focusCharacters, visibleCharacters, offscreenPresentCharacters, characters, location, locationId, timeOfDay, atmosphere.
- Chi tiet hanh dong owns: visualMoment, mainAction, interaction, posture, props, locationState, environmentDetails, characterMomentDetails, continuityNotes.
- Storyboard owns: shot, camera, composition, framing, blocking, foreground, midground, background, lightingDirection, depthAndPerspective, visualEmphasis.
- Prompt Engineering owns: visualPrompt only.
- Therefore, do NOT output fields owned by later steps.

BEAT LENGTH AND RHYTHM:
- Target length: 20-60 words of source text per beat.
- Preferred range: 25-50 words.
- A beat may be shorter than 20 words only for a major reveal, hard scene cut, strong standalone visual moment, decisive emotional turn, or critical dialogue.
- Do not create many short beats in a row.
- When uncertain, merge adjacent details instead of splitting.
- Prefer one strong beat over several weak micro-beats.

BEAT SPLITTING RULES:
- Never cut in the middle of a sentence.
- Split when the central visual story moment changes enough to require a different image.
- Split when the central character focus, main visible action, meaningful interaction target, location, time, scene, major emotion, or plot reveal changes.
- Split long dialogue only when topic, goal, or emotional direction changes.

BEAT MERGING RULES:
- Merge short dialogue with its direct action tag.
- Merge a question and answer pair in calls/messages when they form one exchange.
- Merge tiny gestures, gaze shifts, pauses, breaths, nods, and short continuation lines into the current beat unless they become a new visual story moment.

SCREEN SKELETON RULES:
- Group consecutive beats into screens.
- A screen is a continuous scene with the same location, time period, and present character set.
- Keep screen metadata simple. Detailed continuity is handled later.

CHARACTER PRESENCE RULES:
- visibleCharacters = characters physically visible in the beat.
- offscreenPresentCharacters = characters present in the scene but not visible in the current shot.
- characters = union of visibleCharacters and offscreenPresentCharacters.
- A character remains present until the text says they leave, disappear, or the scene changes.

SELF-CHECK BEFORE OUTPUT:
1. Does every body source segment appear exactly once?
2. Are all sourceSegmentIds in order?
3. Are there any unnecessary micro-beats?
4. Did you output any deep visual fields? If yes, remove them.
5. Do not output this self-check. Only output JSON.

Return ONLY valid JSON with this schema:

{
  "screens": [
    {
      "screenId": "screen_001",
      "screenNumber": 1,
      "screenName": "Concrete screen name",
      "location": "Concrete location",
      "locationId": "loc_001",
      "timeOfDay": "Early Morning | Morning | Mid-day | Afternoon | Golden Hour | Evening | Late Night | Unknown",
      "screenCharacters": ["Character A"],
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
      "summary": "short plot summary",
      "action": "one main drawable action",
      "visualFocus": "main thing the image should focus on",
      "beatType": "establishing | action | reaction | dialogue | reveal | transition",
      "focusCharacters": ["Character A"],
      "visibleCharacters": ["Character A"],
      "offscreenPresentCharacters": [],
      "characters": ["Character A"],
      "location": "Concrete location",
      "locationId": "loc_001",
      "timeOfDay": "Early Morning | Morning | Mid-day | Afternoon | Golden Hour | Evening | Late Night | Unknown",
      "atmosphere": "dominant mood"
    }
  ]
}

SOURCE SEGMENTS:
\`\`\`json
${formatSourceSegmentsForPrompt(sourceSegments)}
\`\`\`

STYLE CONTEXT:
${artStyleDescription || "No specific style selected."}
`;
};

export const getBeatAnalysisPrompt = getBeatSkeletonPrompt;

/**
 * @deprecated Legacy fallback only.
 * Do not use in the active StoryFlow workflow.
 * Current workflow must use getBeatAnalysisPrompt with sourceSegmentIds.
 */
const getLegacyBeatAnalysisPrompt = (text: string, artStyleDescription = "") => `
You are a professional story analyst for a vertical comic / visual storyboard generation app.

Your ONLY task:
Analyze the input story and split it into fine-grained image-ready beats.

A beat is not a paragraph.
A beat is one clear visual moment that can be illustrated in one image.

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

Your job is to identify focus/visible/offscreen characters, location, time, short action, atmosphere, and visual focus.

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

SCREEN SKELETON RULE - CRITICAL:
- Group consecutive beats into screens.
- A screen is a continuous scene with the same location, timeOfDay, ongoing character presence.
- Multiple beats can belong to one screen.
- Do not analyze each beat as an isolated scene.
- Use screenId to link beats to screens.
- screenCharacters must include all characters physically present or directly involved in the screen.
- Do not remove a character from screenCharacters unless the source says they leave, the location changes, time jumps, or a new screen starts.
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
- Hard maximum: if originalText would exceed 80 words, split it unless it is truly one inseparable visual moment.

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
      "originalText": "Exact short source sentence copied here.",
      "summary": "Short summary of this visual beat.",
      "focusCharacters": ["Character A"],
      "visibleCharacters": ["Character A", "Character B"],
      "offscreenPresentCharacters": ["Character C"],
      "characters": ["Character A", "Character B"],
      "location": "Concrete location name",
      "locationId": "loc_001",
      "action": "One main action.",
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

BEAT CUTTING RULES:
- A beat is one visual moment that can be illustrated as one storyboard panel.
- Recommended length: 40-80 Vietnamese words per beat.
- Hard maximum: 80 Vietnamese words per beat; split longer beats by action, emotion, dialogue idea, reaction, object reveal, or camera focus.
- Visual integrity is more important than word count.
- Never cut in the middle of a sentence.

SPLIT WHEN:
- Location changes.
- Time changes.
- POV or central character changes.
- Present scene changes to memory, flashback, social media, or phone screen.
- Main visual action changes.
- A different character starts a new action, dialogue line, or thought.
- Narration interrupts actions/dialogue.
- Dialogue becomes long or moves to a new action/emotional point.

DO NOT SPLIT WHEN:
- Short narration supports the same action/dialogue.
- Short internal thought belongs to the same visual moment.
- A short question-answer exchange shares the same location and emotional focus.
- A colon-introduced dialogue belongs directly to the preceding action.
- One short message/call question-answer pair belongs to the same visual moment.

FIELD RULES:
- screens: screen-level continuity containers for shared location, time, layout, present characters.
- screenId: stable link from each beat to its screen.
- summary: short explanation of the beat, not copied from originalText.
- characters: legacy compatibility field; include visibleCharacters when possible.
- focusCharacters: characters receiving narrative/camera focus in this beat.
- visibleCharacters: characters visible in this beat's frame.
- offscreenPresentCharacters: characters still present in the screen but not visible in this beat.
- location: most specific known place, or "Unknown".
- locationId: stable location id if inferable from consistent location naming, otherwise omit or use "".
- action: main action.
- visualFocus: what the image should focus on.
- atmosphere: emotional mood.
- timeOfDay: Early Morning, Morning, Mid-day, Afternoon, Golden Hour, Evening, Late Night, or Unknown.

FINAL CHECK BEFORE OUTPUT:
- Did you keep originalText as close to the source story as possible?
- Did you avoid intentionally rewriting or summarizing originalText?
- Did you avoid placeholder ellipsis?
- Did you split long source segments instead of shortening them?
- Did you keep every originalText around 40-80 words, with no beat over 80 words unless truly inseparable?
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
      "hairColor": "...",
      "eyes": "...",
      "eyeColor": "...",
      "appearancePrompt": "...",
      "outfit": "...",
      "outfitPrompt": "...",
      "outfitMainColor": "...",
      "outfitAccentColor": "...",
      "accessories": ["..."],
      "signatureAccessories": ["..."],
      "defaultStyle": "...",
      "styleNotes": "...",
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
      "locationPrompt": "...",
      "layout": "...",
      "keyObjects": ["..."],
      "lighting": "...",
      "atmosphere": "...",
      "colorPalette": ["..."],
      "continuityNotes": "...",
      "continuityPrompt": "...",
      "baseState": "...",
      "firstAppearanceBeatId": 1,
      "appearsInBeatIds": [1, 2]
    }
  ]
}

CHARACTER RULES:
- One profile per unique character.
- SIGNATURE ACCESSORY RULE:
  * Character profiles should include only stable/signature accessories that the character normally wears across screens (e.g. glasses, wedding ring, signature earrings, familiar watch).
  * Do NOT include temporary props or handheld items (e.g. phone, wine glass, bouquet, suitcase, contract) as permanent character accessories.
  * Extract or infer general fashion identity and styling notes to defaultStyle and styleNotes.
- CHARACTER COLOR DETAIL RULE - CRITICAL:
  For each character profile, you must extract or infer explicit color information and populate these fields:
  * hairColor (e.g. "jet-black", "chestnut-brown", "platinum-blonde")
  * eyeColor (e.g. "dark-brown", "emerald-green", "icy-blue")
  * outfitMainColor (e.g. "champagne-gold", "charcoal-black", "cream-white")
  * outfitAccentColor (e.g. "pearl-white", "pale-pink", "dark-silver")
  Do not leave these blank or use vague color-less terms. If the source story does not explicitly specify a color, you MUST infer a stable, visually appealing natural color word that fits the character's description and maintain it consistently. Do NOT use hex codes like #FFD700.
- COPY-READY CHARACTER PROMPT RULE - CRITICAL:
  * appearancePrompt must be a complete, natural-language canonical identity description for the character, including face, hair, eyes, body impression, and stable style cues.
  * outfitPrompt must be a complete, natural-language canonical fallback outfit description for the character.
  * Do NOT write vague references such as "same outfit", "as before", "current outfit", "initially", "later", or "varies by scene" in appearancePrompt or outfitPrompt.
  * If the story has multiple eras/outfits, choose the current/default outfit for this chapter and describe it fully. Screen Continuity can override it later.
- GARMENT-LEVEL OUTFIT RULE - CRITICAL:
  * outfit and outfitPrompt must describe the exact garments worn on the body, not a broad category label.
  * Do NOT write generic labels such as "nurse uniform", "school uniform", "black elegant suit", "domestic clothing", "business outfit", or "hospital uniform" by themselves.
  * Expand every outfit into specific worn pieces in top-down order and inner-to-outer order.
  * Required order: headwear first if present; upper-body inner layer first; upper-body outer layers next; one-piece garment if present; bottoms; belt/waist items; socks/stockings if visible; shoes last.
  * For layered outfits, explicitly state layer position, e.g. "white button-up shirt worn inside, black suit vest worn over the shirt, black suit jacket worn outside".
  * For one-piece clothing, explicitly state it as the main garment and still mention any outer layer, e.g. "cream one-piece summer dress as the main garment, light cardigan worn outside".
  * For uniforms, describe each item, e.g. "white nurse cap on the head, pale-blue short-sleeve scrub top, matching scrub pants, white flat shoes" instead of "nurse uniform".
- POSITIONED ACCESSORY RULE - CRITICAL:
  * accessories and signatureAccessories must include where the item is worn or attached.
  * Good: "pearl earrings on both earlobes", "silver necklace around the neck", "gold watch on the left wrist", "name badge pinned to the left chest pocket".
  * Do not write accessory names without positions unless the position is physically obvious and still named in the phrase.
- Merge aliases/pronouns/titles that refer to the same person.
- Use screens.screenCharacters as the primary source for who is present in each continuous screen.
- Use beats.focusCharacters, beats.visibleCharacters, and beats.offscreenPresentCharacters to understand character roles per beat.
- Do not rely only on beat focus characters.
- If a character appears in screenCharacters, create or maintain their character profile even if they are offscreen in some beats.
- If unnamed, create stable names like "Unknown Man 1".
- Use beatId references to fill firstAppearanceBeatId and appearsInBeatIds.
- Infer missing visual details conservatively.
- outfit describes current/default visual outfit.
- outfitPrompt is the copy-ready fallback outfit wording used by deterministic prompt generation when a screen does not override the outfit.
- accessories lists items worn or carried on the body that must remain visually consistent, with their body/clothing position.
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
- locationPrompt is a complete, natural-language canonical location description used directly inside final image prompts.
- layout describes the spatial arrangement of major elements, furniture, doors, windows, and architectural features.
- keyObjects lists furniture, props, and architectural features that must stay consistent.
- lighting describes reusable lighting conditions.
- colorPalette is a compact reusable palette for the environment.
- continuityNotes explicitly describes what must remain consistent across beats.
- continuityPrompt is a complete, natural-language continuity sentence that lists the layout, key objects, materials, lighting, and object relationships that must not change.
- baseState describes the default environmental state before beat-specific changes.
- Do NOT write vague references such as "same location", "as before", "current setting", or beat-specific camera focus as the location identity.
- Use appearsInBeatIds based on the approved beat list.
- Do not include any image prompt field.

APPROVED BEATS:
${compactJson(beats)}

APPROVED SCREENS:
${compactJson(screens)}

ORIGINAL SOURCE TEXT:
${originalText}
`;

export const getPhase1AnalysisPrompt = (script: string, style: string, _existingLibrary?: string) =>
  getBeatAnalysisPrompt(segmentSourceText(script), style);

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

function uniqueStrings(items: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const clean = String(item || "").trim();
    const key = normalize(clean);
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
  }
  return result;
}

function beatIdSet(beats: StoryBeat[]): Set<number> {
  return new Set(beats.map((beat) => beat.beatId).filter(Boolean));
}

function intersectsSelectedBeats(item: any, selectedBeatIds: Set<number>): boolean {
  const beatId = Number(item?.beatId ?? item?.beat_id);
  if (Number.isFinite(beatId) && selectedBeatIds.has(beatId)) return true;
  const ids = Array.isArray(item?.beatIds ?? item?.beat_ids) ? (item.beatIds ?? item.beat_ids) : [];
  if (ids.some((id: unknown) => selectedBeatIds.has(Number(id)))) return true;
  const start = Number(item?.startBeatId ?? item?.start_beat_id);
  const end = Number(item?.endBeatId ?? item?.end_beat_id);
  if (Number.isFinite(start) && Number.isFinite(end)) {
    return Array.from(selectedBeatIds).some((id) => id >= start && id <= end);
  }
  return false;
}

function compactStoryboardBeat(beat: StoryBeat) {
  return {
    beatId: beat.beatId,
    screenId: beat.screenId,
    sourceSegmentIds: beat.sourceSegmentIds || [],
    originalText: beat.originalText,
    summary: beat.summary,
    focusCharacters: beat.focusCharacters || [],
    visibleCharacters: beat.visibleCharacters || [],
    offscreenPresentCharacters: beat.offscreenPresentCharacters || [],
    characters: beat.characters || beat.charactersInvolved || [],
    location: beat.location || beat.locationName,
    locationId: beat.locationId,
    action: beat.action || beat.actionAnalysis,
    visualFocus: beat.visualFocus,
    beatType: beat.beatType,
    atmosphere: beat.atmosphere,
    timeOfDay: beat.timeOfDay
  };
}

function compactStoryboardScreen(screen: ReturnType<typeof normalizeScreens>[number]) {
  return {
    screenId: screen.screenId,
    screenNumber: screen.screenNumber,
    screenName: screen.screenName,
    location: screen.location,
    locationId: screen.locationId,
    timeOfDay: screen.timeOfDay,
    screenCharacters: screen.screenCharacters || [],
    screenProps: screen.screenProps || [],
    screenState: screen.screenState,
    screenSpatialLayout: screen.screenSpatialLayout,
    screenFixedElements: screen.screenFixedElements || [],
    screenCharacterPositions: screen.screenCharacterPositions || [],
    beatIds: screen.beatIds,
    startBeatId: screen.startBeatId,
    endBeatId: screen.endBeatId,
    summary: screen.summary,
    continuityNotes: screen.continuityNotes
  };
}

function compactStoryboardCharacter(character: CharacterProfile) {
  return {
    characterId: character.characterId,
    name: character.name,
    aliases: character.aliases || [],
    role: character.role,
    gender: character.gender,
    age: character.age,
    height: character.height,
    bodyType: character.bodyType,
    appearancePrompt: character.appearancePrompt,
    face: character.face,
    hair: character.hair,
    hairColor: character.hairColor,
    eyes: character.eyes,
    eyeColor: character.eyeColor,
    personalityVisualCues: character.personalityVisualCues,
    gestureSet: character.gestureSet || [],
    continuityNotes: character.continuityNotes
  };
}

function compactStoryboardLocation(location: LocationProfile) {
  return {
    locationId: location.locationId,
    name: location.name,
    aliases: location.aliases || [],
    locationPrompt: location.locationPrompt,
    description: location.description || location.details,
    layout: location.layout,
    keyObjects: location.keyObjects || [],
    lighting: location.lighting || location.lightingDefault,
    atmosphere: location.atmosphere || location.atmosphereDefault,
    baseState: location.baseState,
    continuityNotes: location.continuityNotes,
    continuityPrompt: location.continuityPrompt
  };
}

interface StoryboardPromptOptions {
  batchIndex?: number;
  batchSize?: number;
  manualNextMode?: boolean;
  includeAllBeatsForManualNext?: boolean;
}

function getStoryboardBatchInfo(beats: StoryBeat[], options: StoryboardPromptOptions = {}) {
  const batchSize = options.batchSize && options.batchSize > 0 ? options.batchSize : beats.length || STORYBOARD_BATCH_SIZE;
  const totalBatches = Math.max(1, Math.ceil((beats.length || 1) / batchSize));
  const batchIndex = Math.min(Math.max(options.batchIndex || 0, 0), totalBatches - 1);
  const start = batchIndex * batchSize;
  const end = Math.min(start + batchSize, beats.length);
  const batchBeats = beats.slice(start, end);

  return {
    batchSize,
    batchIndex,
    totalBatches,
    start,
    end,
    totalBeats: beats.length,
    batchBeats,
    targetBeatIds: batchBeats.map((beat) => beat.beatId)
  };
}

function getScreenBeatIds(screen: ReturnType<typeof normalizeScreens>[number], beats: StoryBeat[]): number[] {
  if (screen.beatIds?.length) return screen.beatIds;
  const byScreenId = beats
    .filter((beat) => beat.screenId && beat.screenId === screen.screenId)
    .map((beat) => beat.beatId);
  if (byScreenId.length) return byScreenId;
  return beats
    .filter((beat) => beat.beatId >= screen.startBeatId && beat.beatId <= screen.endBeatId)
    .map((beat) => beat.beatId);
}

function collectContextKeys(
  beats: StoryBeat[],
  screens: ReturnType<typeof normalizeScreens>,
  screenContinuityItems: ReturnType<typeof normalizeScreenContinuity> = []
) {
  const characterKeys = new Set<string>();
  const locationIds = new Set<string>();
  const locationKeys = new Set<string>();

  for (const beat of beats) {
    [
      ...(beat.characters || []),
      ...(beat.charactersInvolved || []),
      ...(beat.focusCharacters || []),
      ...(beat.visibleCharacters || []),
      ...(beat.offscreenPresentCharacters || [])
    ].forEach((name) => characterKeys.add(normalize(String(name))));
    if (beat.locationId) locationIds.add(beat.locationId);
    if (beat.location || beat.locationName) locationKeys.add(normalize(beat.location || beat.locationName));
  }

  for (const screen of screens) {
    (screen.screenCharacters || []).forEach((name) => characterKeys.add(normalize(String(name))));
    (screen.screenCharacterPositions || []).forEach((position) => characterKeys.add(normalize(position.characterName)));
    if (screen.locationId) locationIds.add(screen.locationId);
    if (screen.location) locationKeys.add(normalize(screen.location));
  }

  for (const item of screenContinuityItems) {
    (item.screenCharacterStates || []).forEach((state) => characterKeys.add(normalize(state.characterName)));
    (item.screenCharacterPositions || []).forEach((position) => characterKeys.add(normalize(position.characterName)));
  }

  return { characterKeys, locationIds, locationKeys };
}

function selectLibraryItems(
  library: CharacterLocationLibraryResult,
  selectedBeatIds: Set<number>,
  keys: ReturnType<typeof collectContextKeys>
) {
  const selectedCharacters = (library.characters || []).filter((character) => {
    const names = [character.name, ...(character.aliases || [])].map((name) => normalize(name));
    const appearsInBeat = (character.appearsInBeatIds || []).some((id) => selectedBeatIds.has(Number(id)));
    return appearsInBeat || names.some((name) => keys.characterKeys.has(name));
  });
  const selectedLocations = (library.locations || []).filter((location) => {
    if (location.locationId && keys.locationIds.has(location.locationId)) return true;
    const names = [location.name, ...(location.aliases || [])].map((name) => normalize(name));
    const appearsInBeat = (location.appearsInBeatIds || []).some((id) => selectedBeatIds.has(Number(id)));
    return appearsInBeat || names.some((name) => keys.locationKeys.has(name));
  });

  return {
    characters: selectedCharacters.length ? selectedCharacters : (library.characters || []),
    locations: selectedLocations.length ? selectedLocations : (library.locations || [])
  };
}

function compactScreenContinuityBeat(beat: StoryBeat) {
  return {
    beatId: beat.beatId,
    screenId: beat.screenId,
    focusCharacters: beat.focusCharacters || [],
    visibleCharacters: beat.visibleCharacters || [],
    offscreenPresentCharacters: beat.offscreenPresentCharacters || [],
    characters: beat.characters || beat.charactersInvolved || [],
    location: beat.location || beat.locationName,
    locationId: beat.locationId,
    action: beat.action || beat.actionAnalysis,
    visualFocus: beat.visualFocus,
    atmosphere: beat.atmosphere,
    timeOfDay: beat.timeOfDay
  };
}

function compactScreenContinuityScreen(screen: ReturnType<typeof normalizeScreens>[number], beats: StoryBeat[]) {
  const beatIds = getScreenBeatIds(screen, beats);
  return {
    screenId: screen.screenId,
    screenName: screen.screenName,
    location: screen.location,
    locationId: screen.locationId,
    timeOfDay: screen.timeOfDay,
    screenCharacters: screen.screenCharacters || [],
    beatIds,
    startBeatId: beatIds[0] ?? screen.startBeatId,
    endBeatId: beatIds.at(-1) ?? screen.endBeatId,
    summary: screen.summary
  };
}

function compactScreenContinuityCharacter(character: CharacterProfile) {
  return {
    characterId: character.characterId,
    name: character.name,
    aliases: character.aliases || [],
    gender: character.gender,
    age: character.age,
    appearancePrompt: character.appearancePrompt,
    outfitPrompt: character.outfitPrompt,
    outfit: character.outfit,
    outfitMainColor: character.outfitMainColor,
    outfitAccentColor: character.outfitAccentColor,
    signatureAccessories: character.signatureAccessories || [],
    continuityNotes: character.continuityNotes
  };
}

function compactScreenContinuityLocation(location: LocationProfile) {
  return {
    locationId: location.locationId,
    name: location.name,
    aliases: location.aliases || [],
    locationPrompt: location.locationPrompt,
    layout: location.layout,
    keyObjects: location.keyObjects || [],
    lighting: location.lighting || location.lightingDefault,
    continuityPrompt: location.continuityPrompt,
    baseState: location.baseState
  };
}

function compactBeatMomentCharacter(character: CharacterProfile) {
  return {
    characterId: character.characterId,
    name: character.name,
    aliases: character.aliases || [],
    signatureAccessories: character.signatureAccessories || [],
    gestureSet: character.gestureSet || [],
    expressionSet: character.expressionSet || [],
    continuityNotes: character.continuityNotes
  };
}

function compactBeatMomentLocation(location: LocationProfile) {
  return {
    locationId: location.locationId,
    name: location.name,
    baseState: location.baseState,
    keyObjects: location.keyObjects || [],
    layout: location.layout
  };
}

function compactStoryboardScreenContinuity(item: ReturnType<typeof normalizeScreenContinuity>[number]) {
  return {
    screenId: item.screenId,
    beatIds: item.beatIds || [],
    startBeatId: item.startBeatId,
    endBeatId: item.endBeatId,
    screenState: item.screenState,
    screenProps: item.screenProps || [],
    screenSpatialLayout: item.screenSpatialLayout,
    screenFixedElements: item.screenFixedElements || [],
    screenCharacterPositions: item.screenCharacterPositions || [],
    screenCharacterStates: (item.screenCharacterStates || []).map((state) => ({
      characterId: state.characterId,
      characterName: state.characterName,
      outfit: state.outfit,
      outfitMainColor: state.outfitMainColor,
      outfitAccentColor: state.outfitAccentColor,
      accessories: state.accessories || [],
      handheldItems: state.handheldItems || [],
      appearanceNotes: state.appearanceNotes,
      stateChanges: state.stateChanges || []
    })),
    continuityNotes: item.continuityNotes
  };
}

function compactStoryboardBeatMoment(item: any) {
  return {
    beatId: item.beatId,
    visualMoment: item.visualMoment,
    mainAction: item.mainAction,
    interaction: item.interaction,
    posture: item.posture,
    props: item.props || [],
    locationState: item.locationState,
    environmentDetails: item.environmentDetails,
    characterMomentDetails: (item.characterMomentDetails || []).map((detail: any) => ({
      characterId: detail.characterId,
      characterName: detail.characterName,
      poseRefinement: detail.poseRefinement,
      expression: detail.expression,
      momentNotes: detail.momentNotes,
      handheldItems: detail.handheldItems || [],
      visibleAccessories: detail.visibleAccessories || [],
      accessoriesChange: detail.accessoriesChange || []
    })),
    continuityNotes: item.continuityNotes
  };
}

function buildStoryboardPromptContext(
  analysis: string,
  charLocAnalysis: string,
  screenContinuity: string,
  beatMomentDetails: string,
  options: StoryboardPromptOptions = {}
) {
  const analysisData = parseJsonFallback<unknown>(analysis, []);
  const allBeats = normalizeBeats(analysisData);
  const batch = getStoryboardBatchInfo(allBeats, options);
  const beats = options.includeAllBeatsForManualNext ? allBeats : batch.batchBeats;
  const selectedBeatIds = beatIdSet(beats);
  const parsedScreens = normalizeScreens(analysisData);
  const allScreens = parsedScreens.length ? parsedScreens : createFallbackScreensFromBeats(allBeats);
  const selectedScreenIds = new Set(uniqueStrings(beats.map((beat) => beat.screenId)));
  const selectedScreens = allScreens.filter((screen) =>
    selectedScreenIds.has(screen.screenId) || intersectsSelectedBeats(screen, selectedBeatIds)
  );
  const screens = selectedScreens.length ? selectedScreens : allScreens;
  const library = parseJsonFallback<CharacterLocationLibraryResult>(charLocAnalysis, {
    characters: [],
    locations: []
  });
  const screenIds = new Set(uniqueStrings([
    ...beats.map((beat) => beat.screenId),
    ...screens.map((screen) => screen.screenId)
  ]));
  const characterKeys = new Set<string>();
  const locationIds = new Set<string>();
  const locationKeys = new Set<string>();

  for (const beat of beats) {
    [
      ...(beat.characters || []),
      ...(beat.charactersInvolved || []),
      ...(beat.focusCharacters || []),
      ...(beat.visibleCharacters || []),
      ...(beat.offscreenPresentCharacters || [])
    ].forEach((name) => characterKeys.add(normalize(String(name))));
    if (beat.locationId) locationIds.add(beat.locationId);
    if (beat.location || beat.locationName) locationKeys.add(normalize(beat.location || beat.locationName));
  }

  for (const screen of screens) {
    (screen.screenCharacters || []).forEach((name) => characterKeys.add(normalize(String(name))));
    (screen.screenCharacterPositions || []).forEach((position) => characterKeys.add(normalize(position.characterName)));
    if (screen.locationId) locationIds.add(screen.locationId);
    if (screen.location) locationKeys.add(normalize(screen.location));
  }

  const screenContinuityItems = normalizeScreenContinuity(parseJsonFallback<unknown>(screenContinuity, { screens: [] }))
    .filter((item) => screenIds.has(item.screenId) || intersectsSelectedBeats(item, selectedBeatIds));
  for (const item of screenContinuityItems) {
    (item.screenCharacterStates || []).forEach((state) => characterKeys.add(normalize(state.characterName)));
    (item.screenCharacterPositions || []).forEach((position) => characterKeys.add(normalize(position.characterName)));
  }

  const beatMomentItems = normalizeBeatMomentDetails(parseJsonFallback<unknown>(beatMomentDetails, { beatDetails: [] }))
    .filter((item) => selectedBeatIds.has(Number(item.beatId)));
  for (const item of beatMomentItems) {
    (item.characterMomentDetails || []).forEach((detail: any) => characterKeys.add(normalize(detail.characterName)));
    (item.characterVisualStates || []).forEach((detail: any) => characterKeys.add(normalize(detail.characterName)));
    (item.interactionTarget || []).forEach((target: any) => {
      characterKeys.add(normalize(target.actor));
      characterKeys.add(normalize(target.target));
    });
  }

  const selectedCharacters = (library.characters || []).filter((character) => {
    const names = [character.name, ...(character.aliases || [])].map((name) => normalize(name));
    const appearsInBeat = (character.appearsInBeatIds || []).some((id) => selectedBeatIds.has(Number(id)));
    return appearsInBeat || names.some((name) => characterKeys.has(name));
  });
  const selectedLocations = (library.locations || []).filter((location) => {
    if (location.locationId && locationIds.has(location.locationId)) return true;
    const names = [location.name, ...(location.aliases || [])].map((name) => normalize(name));
    const appearsInBeat = (location.appearsInBeatIds || []).some((id) => selectedBeatIds.has(Number(id)));
    return appearsInBeat || names.some((name) => locationKeys.has(name));
  });

  return {
    batch,
    beats: beats.map(compactStoryboardBeat),
    screens: screens.map(compactStoryboardScreen),
    characters: (selectedCharacters.length ? selectedCharacters : (library.characters || [])).map(compactStoryboardCharacter),
    locations: (selectedLocations.length ? selectedLocations : (library.locations || [])).map(compactStoryboardLocation),
    screenContinuity: { screens: screenContinuityItems.map(compactStoryboardScreenContinuity) },
    beatMomentDetails: { beatDetails: beatMomentItems.map(compactStoryboardBeatMoment) }
  };
}

function buildScreenContinuityPromptContext(analysis: string, charLocAnalysis: string) {
  const analysisData = parseJsonFallback<unknown>(analysis, []);
  const beats = normalizeBeats(analysisData);
  const selectedBeatIds = beatIdSet(beats);
  const parsedScreens = normalizeScreens(analysisData);
  const screens = parsedScreens.length ? parsedScreens : createFallbackScreensFromBeats(beats);
  const library = parseJsonFallback<CharacterLocationLibraryResult>(charLocAnalysis, {
    characters: [],
    locations: []
  });
  const keys = collectContextKeys(beats, screens);
  const selectedLibrary = selectLibraryItems(library, selectedBeatIds, keys);

  return {
    screens: screens.map((screen) => compactScreenContinuityScreen(screen, beats)),
    beats: beats.map(compactScreenContinuityBeat),
    characters: selectedLibrary.characters.map(compactScreenContinuityCharacter),
    locations: selectedLibrary.locations.map(compactScreenContinuityLocation)
  };
}

function buildBeatMomentPromptContext(
  analysis: string,
  charLocAnalysis: string,
  screenContinuity: string
) {
  const analysisData = parseJsonFallback<unknown>(analysis, []);
  const beats = normalizeBeats(analysisData);
  const selectedBeatIds = beatIdSet(beats);
  const parsedScreens = normalizeScreens(analysisData);
  const screens = parsedScreens.length ? parsedScreens : createFallbackScreensFromBeats(beats);
  const screenContinuityItems = normalizeScreenContinuity(
    parseJsonFallback<unknown>(screenContinuity, { screens: [] })
  );
  const library = parseJsonFallback<CharacterLocationLibraryResult>(charLocAnalysis, {
    characters: [],
    locations: []
  });
  const keys = collectContextKeys(beats, screens, screenContinuityItems);
  const selectedLibrary = selectLibraryItems(library, selectedBeatIds, keys);

  return {
    beats: beats.map(compactStoryboardBeat),
    screenContinuity: { screens: screenContinuityItems.map(compactStoryboardScreenContinuity) },
    characters: selectedLibrary.characters.map(compactBeatMomentCharacter),
    locations: selectedLibrary.locations.map(compactBeatMomentLocation)
  };
}

export const getStoryboardPrompt = (
  analysis: string,
  charLocAnalysis: string,
  artStyleDescription = "",
  screenContinuity = "",
  beatMomentDetails = "",
  options: StoryboardPromptOptions = {}
) => {
  const context = buildStoryboardPromptContext(analysis, charLocAnalysis, screenContinuity, beatMomentDetails, options);
  const batch = context.batch;
  const isBatched = batch.totalBeats > batch.batchSize || options.batchSize;

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

SCREEN SPATIAL LOCK RULE - CRITICAL:
Screen Continuity may include screenSpatialLayout, screenFixedElements, and screenCharacterPositions.
Treat those fields as hard locks for the whole screen.
Storyboard composition may crop, zoom, pan, or hide a present character off-frame, but it must never relocate a character to a different workstation, chair, side of the counter, hallway, sofa, doorway, or background area.
Foreground/midground/background are camera layers from the locked layout, not new locations.
If a close-up focuses on one character, keep every other present character at their locked anchor and mention off-frame/partially cropped status in cameraNotes instead of moving them into the background.

LOCKED FIELD RULES:
If any beat, character, location, or panel input contains meta.locks.lockedFields, preserve those fields exactly.
Do not rewrite, reinterpret, summarize, improve, or change locked fields.
Only regenerate unlocked fields. Locked values are approved source-of-truth data.

Your output should contain ONLY visual/camera fields.
Return ONLY valid JSON. No markdown. No commentary.
Use beatId as the only link key. Do NOT output panelId or panelNumber.
${isBatched ? `
STORYBOARD BATCH MODE - CRITICAL:
- This is batch ${batch.batchIndex + 1}/${batch.totalBatches}.
- Batch size: ${batch.batchSize} beats.
- Total approved beats: ${batch.totalBeats}.
- Target beatIds for THIS response: ${batch.targetBeatIds.join(", ")}.
- Return panels ONLY for the target beatIds listed above.
- Return exactly ${batch.targetBeatIds.length} panel(s), one panel per target beatId.
- Do not output panels for earlier or later batches.
${options.manualNextMode ? `- Manual workflow: after this batch JSON is accepted, the user may type/copy "Next" to continue with the next StoryFlow batch prompt. In this response, still return ONLY valid JSON for the current batch.` : ""}
` : ""}

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
- foreground/midground/background must never redefine the location identity. If the camera focuses on the floor, glass table, hallway, stairs, eyes, or a reflected object, describe it as a layer/focus area inside the approved location.
- characterBlocking: place approved visible characters in the frame by cropping from the approved screenCharacterPositions anchors; do not create a new anchor if a locked anchor exists.
- expression and poseRefinement can refine the approved beat posture, but must not contradict it.
- lightingDirection can refine how existing location lighting is presented, but must not rewrite source story facts.
- cameraNotes should mention continuity concerns only when helpful, especially when a present character is cropped/off-frame but remains at the locked anchor.
- Do not invent or alter character outfits. Outfit identity is owned by Character Library and Screen Continuity.

SCREEN CONTINUITY FOR STORYBOARD:
- Each beat belongs to a screen.
- Use screenCharacters as the continuity pool.
- Use screenSpatialLayout as the fixed stage layout.
- Use screenFixedElements as fixed object positions.
- Use screenCharacterPositions as fixed character anchors.
- Use focusCharacters for camera priority.
- Use visibleCharacters for frame composition.
- Use offscreenPresentCharacters as continuity notes.
- Do not remove screen characters from the scene just because the beat focuses on someone else.
- If the camera angle excludes a present character, mention them in cameraNotes.
- Example: in a Hospital Nurse Station screen, if Lục Thư Vân is locked seated behind the counter at the right workstation chair and Khương Yến Ninh is locked standing at the visitor/front-left side of the counter, a close-up of Lục Thư Vân must not move Khương Yến Ninh into a background workstation; Khương Yến Ninh stays at the front-left anchor and may be off-frame.

SOURCE BEATS:
${compactJson(context.beats)}

SOURCE SCREENS:
${compactJson(context.screens)}

CHARACTER LIBRARY:
${compactJson(context.characters)}

LOCATION LIBRARY:
${compactJson(context.locations)}

APPROVED SCREEN CONTINUITY:
${compactJson(context.screenContinuity) || "No screen continuity data provided."}

APPROVED BEAT MOMENT DETAILS:
${compactJson(context.beatMomentDetails) || "No beat moment details provided."}

ART STYLE:
${artStyleDescription || "No specific style selected."}
`;
};

export interface EngineerPromptInput {
  analysisJson: string;
  characterLocationJson: string;
  screenContinuityJson: string;
  beatMomentDetailsJson: string;
  storyboardJson: string;
  style: string;
}

function safePromptJsonBlock(value: string | undefined | null): string {
  const text = value?.trim();
  if (!text) {
    return "{ }";
  }
  return compactJson(text);
}

export const getEngineerPromptsPrompt = ({
  analysisJson,
  characterLocationJson,
  screenContinuityJson,
  beatMomentDetailsJson,
  storyboardJson,
  style,
}: EngineerPromptInput): string => {
  return `
MANUAL FALLBACK ONLY:
The StoryFlow app normally builds Prompt Engineering locally with deterministic code. Use this prompt only when the user explicitly needs an external/manual fallback.

TASK:
Assemble existing approved fields into final copy-ready visualPrompt strings. Do not analyze the novel again. Do not summarize, paraphrase, reinterpret, or invent source data.
Return one output item per beatId.

SOURCE FIELD MAP:
- Location: use Location Library locationPrompt by locationId first, then name/alias fallback.
- Location Continuity: combine Location Library continuityPrompt, screenSpatialLayout, and screenFixedElements.
- Screen Spatial Lock: copy screenSpatialLayout; if missing, fallback to location layout/keyObjects/screenProps.
- Character Position Lock: use screenCharacterPositions first. Storyboard blocking may crop/frame the anchor but cannot create a new anchor.
- Screen Continuity: mention only approved screen characters as visible or off-frame. Do not draw off-frame characters.
- Visible character identity: use Character Library appearancePrompt; fallback to gender, age, height, face, hair, eyes, body/style notes.
- Outfit: use current screenCharacterStates.outfit first; fallback to Character Library outfitPrompt/outfit. Do not prepend outfit colors before the outfit wording.
- Accessories: include visible signature accessories, screen-level accessories, and beat-level visible accessories with exact body position.
- Handheld/variable items: use Beat Moment Details first, then screen-level handheld items only if still visible in this beat.
- Scene: use Storyboard shotType, cameraAngle, and composition.
- Layers: use Storyboard foreground, midground, background, and visualEmphasis.
- Beat action: use Beat Skeleton + Beat Moment Details for visualMoment, mainAction, interaction, posture, props, locationState, environmentDetails, characterMomentDetails, expression, and temporary character/accessory state.
- originalText is for UI/debug only. Do not use originalText to rewrite visualPrompt.

OUTPUT TEMPLATE ORDER:
Style.
Location.
Location Continuity.
Screen Spatial Lock.
Character Position Lock.
Screen Continuity.
Scene.
Visible character profile lines only.
Action and interaction.
Foreground. Midground. Background. Visual emphasis.
no text, no speech bubbles, no captions, no subtitles, no watermark, no logo.
Negative prompt.

CONSISTENCY GUARDS:
- Never let Storyboard foreground/midground/background replace Location.
- Never move fixed objects from screenFixedElements.
- Never move a character away from screenCharacterPositions unless Beat Moment Details explicitly says the character moved.
- If a close-up crops a character out, say the character remains at the approved anchor but outside the frame.
- Do not include full profile details for off-frame characters.
- Do not include internal IDs, raw hex colors, beat ranges, sourceUsage, panelId, panelNumber, or debug labels.

VISUAL STYLE:
${style || "Modern Manhua style, Chinese webtoon aesthetic, elegant character designs, vibrant digital coloring, clean line art, beautiful lighting, polished look, contemporary manhua inspired."}

NEGATIVE PROMPT TEXT:
Negative prompt: low quality, blurry, low resolution, bad anatomy, extra fingers, missing fingers, deformed hands, distorted face, inconsistent character design, wrong outfit, changed hairstyle, changed eye color, random extra characters, missing approved characters, random furniture, changed location layout, inconsistent background, missing key objects, unreadable text, speech bubbles, captions, subtitles, watermark, logo, heavy shadows.

APPROVED BEAT SKELETON SOURCE:
\`\`\`json
${safePromptJsonBlock(analysisJson)}
\`\`\`

CHARACTER + LOCATION LIBRARY:
\`\`\`json
${safePromptJsonBlock(characterLocationJson)}
\`\`\`

APPROVED SCREEN CONTINUITY:
\`\`\`json
${safePromptJsonBlock(screenContinuityJson)}
\`\`\`

APPROVED BEAT MOMENT DETAILS:
\`\`\`json
${safePromptJsonBlock(beatMomentDetailsJson)}
\`\`\`

APPROVED STORYBOARD VISUAL DIRECTION:
\`\`\`json
${safePromptJsonBlock(storyboardJson)}
\`\`\`

REQUIRED JSON SHAPE:
{
  "engineerPrompts": [
    {
      "beatId": 1,
      "visualPrompt": "string ending with the full Negative prompt section"
    }
  ]
}

FINAL CHECK BEFORE OUTPUT:
- Return ONLY valid JSON.
- Do not use markdown code fences.
- Do not add commentary outside JSON.
- Did every item include beatId and visualPrompt?
- Did you avoid panelId and panelNumber?
- Did every visualPrompt avoid internal IDs like loc_001, screen_001, char_001, and panel_001?
- Did every visualPrompt avoid beat ranges and raw hex color codes?
- Does every visualPrompt start with the selected style?
- Does every visualPrompt contain Location?
- Does every visualPrompt contain Location Continuity?
- Does every visualPrompt contain Screen Spatial Lock?
- Does every visualPrompt contain Character Position Lock?
- Does every visualPrompt contain Screen Continuity?
- Does every visualPrompt use timeOfDay from APPROVED BEAT SKELETON SOURCE?
- Does every visible named character include full profile details?
- Did offscreen characters avoid full profile details?
- Is every visible character's current outfit taken from APPROVED SCREEN CONTINUITY, using Character Library only for identity/default traits?
- Does every visualPrompt include posture, action, and interaction from APPROVED BEAT MOMENT DETAILS where available?
- Does every visualPrompt include foreground, midground, and background from APPROVED STORYBOARD VISUAL DIRECTION when available?
- Does every visualPrompt include no text, no speech bubbles, no captions, no subtitles?
- Does every visualPrompt include the full final "Negative prompt:" section?
`;
};

/**
 * @deprecated QA is no longer part of the active StoryFlow pipeline because Prompt Engineering is deterministic.
 * Keep this as a legacy/manual fallback for old projects.
 */
export const getQAPrompt = (data: string, charLocAnalysis: string, style: string, storyboard = "", analysis = "", screenContinuity = "", beatMomentDetails = "") => `
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

GENERATED PROMPTS TO CHECK:\r\n${data}\r\n\r\nAPPROVED SCREEN CONTINUITY:\r\n${screenContinuity || "No screen continuity data provided."}\r\n\r\nAPPROVED BEAT MOMENT DETAILS:\r\n${beatMomentDetails || "No beat moment details provided."}\r\n`;

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
- Do not modify visual prompts.
- Beat Analysis is the source of truth for story fields.
- Character Library is the source of truth for character identity and continuity.
- Location Library is the source of truth for location identity and continuity.
- Storyboard is the source of truth only for camera and composition.
- Engineer Prompts are the source of truth for visualPrompt.
- QA patches are legacy optional notes only; do not use QA to override Engineer Prompts.

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

export const getScreenContinuityPrompt = (analysis: string, charLocAnalysis: string, style = "") => {
  const context = buildScreenContinuityPromptContext(analysis, charLocAnalysis);

  return `
You are a master of visual continuity for sequential storytelling (comics, storyboards, webtoons).

Your ONLY task:
Perform Screen-Level Continuity Analysis (Phase 2).
You will analyze the screen skeleton (from Phase 1) and output the screen-level visual details for outfits, props, location states, fixed spatial layout, fixed objects, and fixed character anchors.

SCREEN CONTINUITY RULES:
1. For each screen in the provided input, determine the outfit and style state of every character present on that screen.
2. CRITICAL SCREEN ID RULE: You must copy the exact screenId (e.g. "screen_001") from the APPROVED BEAT SKELETON SOURCE. Do not invent new screenId formats or use "screen_1" if it is "screen_001".
3. CRITICAL BEAT LINKING RULE: For each screen, copy all beatId values that belong to that screen from the APPROVED BEAT SKELETON SOURCE into beatIds. Do not invent, remove, or renumber beatIds.
4. Do NOT output "screenNumber", "screenName", "location", "locationId", or "timeOfDay".
5. Required output for each screen consists ONLY of: screenId, beatIds, startBeatId, endBeatId, screenState, screenProps, screenSpatialLayout, screenFixedElements, screenCharacterStates, screenCharacterPositions, and continuityNotes.
6. In screenCharacterStates, you must specify:
   - characterId
   - characterName
   - outfit (complete description of outfit type/style)
   - outfitMainColor (main color of the outfit)
   - outfitAccentColor (accent color of the outfit)
   - accessories (visible screen-level accessories)
   - handheldItems (items they might be holding generally)
   - appearanceNotes (general visual appearance/condition)
   - stateChanges (list of any clothing/accessory changes, e.g. ["string"])
7. COPY-READY OUTFIT RULE - CRITICAL:
   - outfit must be full copy-ready wording for this screen, never "same", "same as previous", "current outfit", "domestic clothing" without color/style details, or any other vague reference.
   - If the outfit does not change from the Character Library, copy the full outfitPrompt or outfit wording and adapt it to the current screen colors.
   - outfitMainColor and outfitAccentColor must remain stable for this screen.
   - Screen Continuity decides only screen-level outfits, accessories, persistent props, and persistent handheld items.
8. GARMENT-LEVEL OUTFIT RULE - CRITICAL:
   - outfit must describe exact garments, not broad category labels.
   - Do NOT write generic labels such as "nurse uniform", "school uniform", "black elegant suit", "domestic clothing", "business outfit", or "hospital uniform" by themselves.
   - Expand the outfit into individual worn pieces in top-down order and inner-to-outer order.
   - Required order: headwear first if present; upper-body inner layer first; upper-body outer layers next; one-piece garment if present; bottoms; belt/waist items; socks/stockings if visible; shoes last.
   - Explicitly identify layer positions, e.g. "white button-up shirt worn inside, black suit vest worn over the shirt, black blazer worn outside, black trousers, black leather belt, black dress shoes".
   - If the character wears a blouse/shirt under a vest, coat, blazer, cardigan, apron, lab coat, or nurse coat, mention the inner garment first and the outer garment second.
   - If a uniform is required by the story, describe the exact uniform pieces, e.g. "white nurse cap on the head, pale-blue scrub top, matching scrub pants, white flat shoes".
9. POSITIONED ACCESSORY RULE - CRITICAL:
   - accessories must include exact body/clothing position.
   - Examples: "gold watch on the left wrist", "pearl earrings on both earlobes", "name badge clipped to the left chest pocket", "ID card hanging from a neck lanyard".
   - handheldItems must describe current position only if held across the whole screen; beat-specific item position belongs in Beat Moment Details.
10. SCREEN SPATIAL LOCK RULE - CRITICAL:
   - screenSpatialLayout must be a fixed stage map for the whole screen, not a mood note.
   - Include stable positions of major zones and landmarks, e.g. "curved white reception counter spans the foreground/right side, visitor side is front-left, right workstation chair sits behind the counter, long hospital hallway recedes in the background, wall signage is on the rear wall, file shelves are behind the counter".
   - screenFixedElements must list fixed objects whose positions cannot change, e.g. "curved white reception counter in foreground/right", "desktop monitors behind the counter", "hospital wall signage on rear wall".
   - screenCharacterPositions must lock every screen character to a fixed anchor for the whole screen.
   - For each screenCharacterPositions item, specify characterId, characterName, anchorPosition, facingDirection, relationshipToKeyObjects, and visibilityRule.
   - The anchorPosition must not change across beats in the same screen; only expression, gesture, pose refinement, and crop visibility can change.
   - If the camera is a close-up, the visibilityRule should allow crop/off-frame while preserving the anchor.
   - Hospital Nurse Station example: Lục Thư Vân stays seated behind the counter at the right workstation chair; Khương Yến Ninh stays standing on the visitor/front-left side before the counter.
11. SCREEN LOCATION RULE - CRITICAL:
   - screenState must describe only screen-level layout/status changes.
   - Do not turn beat-specific camera focus such as "glass table surface", "floor near sofa", "hallway visible", or "eyes close-up" into a new location.
12. Return ONLY a valid JSON object. No markdown. No commentary.
13. The compact input below intentionally does not include originalText. Do not ask for originalText and do not recreate it.

Required JSON Schema:
{
  "screens": [
    {
      "screenId": "string (e.g. screen_001)",
      "beatIds": [1, 2, 3],
      "startBeatId": 1,
      "endBeatId": 3,
      "screenState": "string (layout status or changes in this screen)",
      "screenProps": ["string (props permanent/visible on this screen)"],
      "screenSpatialLayout": "string (fixed stage layout for this screen)",
      "screenFixedElements": ["string (fixed object plus fixed position)"],
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
      "screenCharacterPositions": [
        {
          "characterId": "string",
          "characterName": "string",
          "anchorPosition": "string (fixed screen anchor)",
          "facingDirection": "string (stable facing direction/relationship)",
          "relationshipToKeyObjects": "string (spatial relation to counter, chair, door, table, bed, sofa, etc.)",
          "visibilityRule": "string (how crop/close-up/off-frame behaves without relocation)"
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
- screenSpatialLayout: fixed stage map for the whole screen. It must preserve location identity and key object positions.
- screenFixedElements: fixed objects with position labels. Do not list vague object names without where they are.
- screenCharacterStates: current outfit/accessory state for each character present in this screen.
- screenCharacterPositions: fixed anchor for each character present in this screen. These anchors are more authoritative than later storyboard blocking.
- anchorPosition: exact stable position in the screen, such as "visitor/front-left side of the counter", "behind the counter at the right workstation chair", "left sofa nearest the glass tea table".
- facingDirection: stable direction or target, such as "facing across the counter toward Khương Yến Ninh".
- relationshipToKeyObjects: exact relation to fixed objects, such as "seated behind the curved white counter, beside desktop monitors".
- visibilityRule: explain that close-ups may crop/hide the character off-frame while keeping the anchor unchanged.
- outfit: full copy-ready current outfit wording for the character on this screen, listing exact garments top-down and inner-to-outer.
- accessories: screen-level accessories with exact body/clothing position.
- handheldItems: only items held generally across this screen, not one-beat temporary items.
- stateChanges: array of screen-level clothing/accessory changes. If none, return [].
- continuityNotes: concise note for maintaining fixed layout, fixed anchors, outfit, props, and character positions across the screen.

APPROVED COMPACT SCREENS:
${compactJson(context.screens)}

APPROVED COMPACT BEATS:
${compactJson(context.beats)}

RELEVANT CHARACTER LIBRARY:
${compactJson(context.characters)}

RELEVANT LOCATION LIBRARY:
${compactJson(context.locations)}

ART STYLE:
${style}
`;
};

export const getBeatMomentDetailsPrompt = (analysis: string, charLocAnalysis: string, screenContinuity: string, style = "") => {
  const context = buildBeatMomentPromptContext(analysis, charLocAnalysis, screenContinuity);

  return `
You are Storyflow Beat Moment Detail Analyzer.

Your ONLY task:
Create Beat Moment Details Direction B for each approved beat.

CRITICAL RULES:
- Do NOT split beats.
- Do NOT merge beats.
- Do NOT renumber beats.
- Do NOT change beatId, sourceSegmentIds, originalText, screenId, location, or timeOfDay.
- Do NOT create final visualPrompt.
- Do NOT create camera/composition fields. Storyboard will handle camera and composition.
- Use only approved Beat Skeleton, Screen Continuity, Character Library, and Location Library data.
- Keep all details grounded in the source-backed beat data.
- If a detail is uncertain, write it in continuityNotes instead of inventing a new story fact.

FIELD OWNERSHIP:
- Chi tiet hanh dong owns: visualMoment, mainAction, interaction, posture, props, locationState, environmentDetails, characterMomentDetails, continuityNotes.
- Storyboard owns camera, shot, framing, blocking, foreground, midground, background, lightingDirection, depthAndPerspective, and composition.
- Prompt Engineering owns visualPrompt only.
- Therefore, do NOT output characterVisualStates, interactionTarget, cameraHint, compositionHint, shotType, cameraAngle, composition, framing, or visualPrompt.

DIRECTION B DETAIL RULES:
- visualMoment = exact visual moment of the beat, without camera or composition.
- mainAction = visible main action, not just emotion or plot summary.
- interaction = who acts/speaks toward whom or what.
- posture = beat-level posture and gesture summary.
- props = temporary visible props used in this beat only.
- locationState = temporary visible state/change of the location in this beat.
- environmentDetails = visible beat-specific environment details, not the whole location profile.
- characterMomentDetails = visible expression, pose refinement, handheld items, and accessories per relevant character.
- continuityNotes = inherited or uncertain details.
- If a character is offscreen, do not invent facial expression.
- Do not redefine outfit or stable location identity in this step.
- Do not add major props, injuries, outfits, locations, characters, or actions not supported by approved input.
- Return ONLY a valid JSON object. No markdown. No commentary.

Required JSON Schema:
{
  "beatDetails": [
    {
      "beatId": 1,
      "visualMoment": "the exact visual moment that should become an illustration",
      "mainAction": "specific visible action",
      "interaction": "specific interaction: who acts toward whom or what",
      "posture": "beat-level posture and gesture summary",
      "props": ["temporary visible prop used in this beat"],
      "locationState": "temporary state/change of the location in this beat",
      "environmentDetails": "visible beat-level environment details",
      "characterMomentDetails": [
        {
          "characterId": "string",
          "characterName": "string",
          "visibleAccessories": ["string"],
          "handheldItems": ["string"],
          "accessoriesChange": ["string"],
          "poseRefinement": "string",
          "expression": "string",
          "momentNotes": "string"
        }
      ],
      "continuityNotes": "inherited or uncertain details"
    }
  ]
}

APPROVED COMPACT BEAT SKELETON:
${compactJson(context.beats)}

APPROVED COMPACT SCREEN CONTINUITY:
${compactJson(context.screenContinuity)}

RELEVANT CHARACTER LIBRARY:
${compactJson(context.characters)}

RELEVANT LOCATION LIBRARY:
${compactJson(context.locations)}

ART STYLE:
${style}
`;
};

// --- LOCAL STORYFLOW SERVICES ---

const generateJsonText = async (prompt: string): Promise<string> => {
  const config = getConfig();
  const apiKey = config.geminiApiKey || "";
  if (!apiKey) {
    throw new Error("Gemini key not found. Please configure it in Settings.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const modelName = config.geminiModel || "gemini-1.5-flash";
  const result = await ai.models.generateContent({
    model: modelName,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      temperature: 0.2
    }
  });

  if (!result.text) {
    throw new Error("No response received from Gemini.");
  }

  return result.text;
};

const generateJson = async <T,>(prompt: string): Promise<T> => {
  return JSON.parse(await generateJsonText(prompt)) as T;
};

export const analyzeBeats = async (script: string, style = "") => {
  return generateJson(getBeatAnalysisPrompt(script, style));
};

export const generateCharacterLocationLibrary = async (
  script: string,
  beats: StoryBeat[],
  style = "",
  existingLibrary?: string,
  screens = createFallbackScreensFromBeats(beats)
): Promise<CharacterLocationLibraryResult> => {
  return generateJson(getCharacterLocationLibraryPrompt(script, beats, style, existingLibrary, screens));
};

export const generateScreenContinuity = async (
  analysis: string,
  charLocAnalysis: string,
  style = ""
) => {
  return generateJsonText(getScreenContinuityPrompt(analysis, charLocAnalysis, style));
};

export const generateBeatMomentDetails = async (
  analysis: string,
  charLocAnalysis: string,
  screenContinuity: string,
  style = ""
) => {
  return generateJsonText(getBeatMomentDetailsPrompt(analysis, charLocAnalysis, screenContinuity, style));
};

export const createStoryboard = async (
  analysis: string,
  charLocAnalysis: string,
  style = "",
  screenContinuity = "",
  beatMomentDetails = ""
) => {
  return generateJsonText(getStoryboardPrompt(analysis, charLocAnalysis, style, screenContinuity, beatMomentDetails));
};

export const engineerPrompts = async ({
  analysisJson,
  characterLocationJson,
  screenContinuityJson,
  beatMomentDetailsJson,
  storyboardJson,
  style,
}: EngineerPromptInput) => {
  return buildEngineerPromptsJsonWithResolver({
    analysisJson,
    characterLocationJson,
    screenContinuityJson,
    beatMomentDetailsJson,
    storyboardJson,
    style,
  });
};

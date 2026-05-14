import type { CharacterProfile } from "../types";

const DEFAULT_EXPRESSIONS = [
  "neutral",
  "happy",
  "curious",
  "worried",
  "angry",
  "surprised",
  "sad",
  "determined"
];

const DEFAULT_GESTURES = [
  "relaxed hand",
  "pointing gesture",
  "gripping an object",
  "thinking gesture"
];

function formatList(items?: string[], fallback = "None specified"): string {
  const cleanItems = items?.map((item) => item.trim()).filter(Boolean) || [];
  return cleanItems.length ? cleanItems.join(", ") : fallback;
}

function valueOrUnknown(value?: string | null): string {
  const cleanValue = value?.trim();
  return cleanValue || "Unknown";
}

export function buildCharacterReferenceSheetPrompt(
  character: CharacterProfile,
  artStyleDescription = ""
): string {
  const expressions = character.expressionSet?.length ? character.expressionSet : DEFAULT_EXPRESSIONS;
  const gestures = character.gestureSet?.length ? character.gestureSet : DEFAULT_GESTURES;

  return `Create a clean professional CHARACTER REFERENCE SHEET for a consistent illustrated character.

IMPORTANT:
This is NOT a story scene.
This is NOT a cinematic action image.
This is a production model sheet / character design bible used to keep the character consistent across many generated images.

Character identity:
- Name: ${valueOrUnknown(character.name)}
- Aliases: ${formatList(character.aliases)}
- Role: ${valueOrUnknown(character.role)}
- Gender: ${valueOrUnknown(character.gender)}
- Age: ${valueOrUnknown(character.age)}
- Height impression: ${valueOrUnknown(character.height)}
- Body type: ${valueOrUnknown(character.bodyType)}
- Face: ${valueOrUnknown(character.face)}
- Hair: ${valueOrUnknown(character.hair)}
- Eyes: ${valueOrUnknown(character.eyes)}
- Signature features: ${formatList(character.signatureFeatures)}
- Outfit: ${valueOrUnknown(character.outfit)}
- Accessories: ${formatList(character.accessories)}
- Props: ${formatList(character.props)}
- Color palette: ${formatList(character.colorPalette)}
- Personality visual cues: ${valueOrUnknown(character.personalityVisualCues)}
- Continuity notes: ${valueOrUnknown(character.continuityNotes)}

Art style:
${artStyleDescription || "Consistent high-quality illustrated character design, clean production art style."}

Reference sheet layout:
- White or very light neutral background.
- Clean organized reference sheet layout with thin panel borders.
- Large center turnaround section:
  1. front view
  2. 3/4 view
  3. side view
  4. back view
- Keep the exact same character identity in every view.
- Keep the exact same face, hairstyle, outfit, body proportions, accessories, and color palette in every view.
- Right-side expression grid:
  ${expressions.map((item, index) => `${index + 1}. ${item}`).join("\n  ")}
- Head detail views:
  front headshot, 3/4 headshot, side headshot, low angle headshot, top angle headshot.
- Pose variation section:
  neutral standing pose, relaxed stance, tense stance, confident stance.
- Hand gesture section:
  ${gestures.map((item, index) => `${index + 1}. ${item}`).join("\n  ")}
- Wardrobe and accessory detail section:
  close-up panels for outfit, accessories, shoes, important clothing details.
- Prop reference section:
  show important props separately if any are specified.

Visual quality rules:
- Animation model sheet.
- Character reference board.
- Consistent proportions across all panels.
- Consistent face and outfit across all views.
- Clean studio lighting.
- No complex scene background.
- No speech bubbles.
- No random extra characters.
- No alternate outfit unless explicitly part of the outfit details.
- No inconsistent hairstyle.
- No inconsistent face shape.
- No unreadable tiny text.

Text rendering rule:
- Avoid detailed readable text inside the image.
- Use simple section boxes or minimal labels only.
- Prioritize accurate character visuals over written labels.

Final image should look like a professional character reference sheet, with multiple panels showing the same character from different angles, expressions, poses, outfit details, accessories, props, and color palette.`;
}
